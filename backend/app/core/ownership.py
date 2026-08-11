"""Single authority for resolving and enforcing tenant ownership on writes."""

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from sqlalchemy import event, select
from sqlalchemy.orm import Session


class TenantReason(str, Enum):
    NO_PARENT_EVIDENCE = "NO_PARENT_EVIDENCE"
    PARENT_NOT_FOUND = "PARENT_NOT_FOUND"
    MULTIPLE_ORGANIZATION_CANDIDATES = "MULTIPLE_ORGANIZATION_CANDIDATES"
    USER_ORGANIZATION_MISMATCH = "USER_ORGANIZATION_MISMATCH"
    BROKEN_RELATIONSHIP_CHAIN = "BROKEN_RELATIONSHIP_CHAIN"
    LEGACY_METADATA_UNTRUSTED = "LEGACY_METADATA_UNTRUSTED"
    ORPHAN_PARENT = "ORPHAN_PARENT"
    SCOPE_CONFLICT = "SCOPE_CONFLICT"


class TenantOwnershipError(ValueError):
    def __init__(self, reason: TenantReason, message: str):
        self.reason = reason
        super().__init__(message)


@dataclass(frozen=True)
class TenantScope:
    organization_id: int
    user_id: int
    project_id: Optional[int] = None


def _fail(reason: TenantReason, message: str):
    raise TenantOwnershipError(reason, message)


def resolve_actor_scope(db: Session, user, project_id: Optional[int] = None) -> TenantScope:
    """Resolve an authenticated actor's active organization and optional project."""
    from app.models.keyword import KeywordGroup
    from app.models.organization import Organization, OrganizationMember

    organization_id = getattr(user, "current_organization_id", None)
    user_id = getattr(user, "id", None)
    if not organization_id or not user_id:
        _fail(TenantReason.NO_PARENT_EVIDENCE, "An active organization is required")

    organization = db.execute(select(Organization.id, Organization.status).where(
        Organization.id == organization_id
    )).one_or_none()
    if organization is None or organization.status != "active":
        _fail(TenantReason.PARENT_NOT_FOUND, "Active organization not found")
    membership = db.execute(
        select(OrganizationMember.id).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == "active",
        )
    ).scalar_one_or_none()
    if membership is None:
        _fail(TenantReason.USER_ORGANIZATION_MISMATCH, "User is not an active organization member")

    if project_id is not None:
        project = db.execute(select(
            KeywordGroup.id, KeywordGroup.organization_id, KeywordGroup.user_id
        ).where(KeywordGroup.id == project_id)).one_or_none()
        if project is None:
            _fail(TenantReason.PARENT_NOT_FOUND, "Project not found")
        if project.organization_id != organization_id or project.user_id is None:
            _fail(TenantReason.SCOPE_CONFLICT, "Project belongs to another or unresolved tenant")
    return TenantScope(organization_id=organization_id, user_id=user_id, project_id=project_id)


def resolve_project_scope(
    db: Session,
    project_id: int,
    *,
    actor=None,
    expected_organization_id: Optional[int] = None,
) -> TenantScope:
    """Resolve a durable project parent; JSON metadata is never authoritative."""
    from app.models.keyword import KeywordGroup
    from app.models.organization import OrganizationMember

    if actor is not None:
        return resolve_actor_scope(db, actor, project_id)
    project = db.execute(select(
        KeywordGroup.id, KeywordGroup.organization_id, KeywordGroup.user_id
    ).where(KeywordGroup.id == project_id)).one_or_none()
    if project is None:
        _fail(TenantReason.PARENT_NOT_FOUND, "Project not found")
    if not project.organization_id or not project.user_id:
        _fail(TenantReason.ORPHAN_PARENT, "Project has unresolved ownership")
    if expected_organization_id and project.organization_id != expected_organization_id:
        _fail(TenantReason.SCOPE_CONFLICT, "Project organization conflicts with expected organization")
    membership = db.execute(
        select(OrganizationMember.id).where(
            OrganizationMember.organization_id == project.organization_id,
            OrganizationMember.user_id == project.user_id,
            OrganizationMember.status == "active",
        )
    ).scalar_one_or_none()
    if membership is None:
        _fail(TenantReason.USER_ORGANIZATION_MISMATCH, "Project owner is not an active organization member")
    return TenantScope(project.organization_id, project.user_id, project.id)


def validate_explicit_scope(db: Session, organization_id: int, user_id: int, project_id: int) -> TenantScope:
    """Validate durable worker/job fields without consulting mutable user context."""
    from app.models.keyword import KeywordGroup
    from app.models.organization import OrganizationMember

    if not organization_id or not user_id or not project_id:
        _fail(TenantReason.NO_PARENT_EVIDENCE, "Explicit organization, user, and project are required")
    project = db.execute(select(
        KeywordGroup.id, KeywordGroup.organization_id, KeywordGroup.user_id
    ).where(KeywordGroup.id == project_id)).one_or_none()
    if project is None:
        _fail(TenantReason.PARENT_NOT_FOUND, "Project not found")
    if project.organization_id != organization_id:
        _fail(TenantReason.SCOPE_CONFLICT, "Project organization conflicts with explicit scope")
    membership = db.execute(select(OrganizationMember.id).where(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == user_id,
        OrganizationMember.status == "active",
    )).scalar_one_or_none()
    if membership is None:
        _fail(TenantReason.USER_ORGANIZATION_MISMATCH, "Worker user is not an active organization member")
    return TenantScope(organization_id, user_id, project_id)


def resolve_source_scope(db: Session, source_id: int, *, expected_organization_id: Optional[int] = None) -> TenantScope:
    from app.models.source import Source

    source = db.get(Source, source_id)
    if source is None:
        _fail(TenantReason.PARENT_NOT_FOUND, "Source not found")
    if not source.organization_id or not source.user_id:
        _fail(TenantReason.ORPHAN_PARENT, "Source has unresolved ownership")
    if expected_organization_id and source.organization_id != expected_organization_id:
        _fail(TenantReason.SCOPE_CONFLICT, "Source organization conflicts with expected organization")
    return TenantScope(source.organization_id, source.user_id)


def validate_schedule_targets(
    db: Session,
    scope: TenantScope,
    *,
    source_group_ids: Optional[list[int]] = None,
    keyword_group_ids: Optional[list[int]] = None,
) -> None:
    """Require every schedule target to exist in the actor's organization."""
    from app.models.keyword import KeywordGroup
    from app.models.source import SourceGroup

    for model, identifiers, label in (
        (SourceGroup, source_group_ids or [], "source group"),
        (KeywordGroup, keyword_group_ids or [], "keyword group"),
    ):
        for identifier in set(identifiers):
            parent = db.execute(select(model.id, model.organization_id).where(
                model.id == identifier
            )).one_or_none()
            if parent is None:
                _fail(TenantReason.PARENT_NOT_FOUND, f"{label} not found")
            if parent.organization_id != scope.organization_id:
                _fail(TenantReason.SCOPE_CONFLICT, f"{label} belongs to another tenant")


def resolve_mention_scope(db: Session, mention_id: int, *, expected_organization_id: Optional[int] = None) -> TenantScope:
    from app.models.mention import Mention

    mention = db.get(Mention, mention_id)
    if mention is None:
        _fail(TenantReason.PARENT_NOT_FOUND, "Mention not found")
    if not mention.organization_id or not mention.user_id or not mention.project_id:
        _fail(TenantReason.ORPHAN_PARENT, "Mention has unresolved ownership")
    if expected_organization_id and mention.organization_id != expected_organization_id:
        _fail(TenantReason.SCOPE_CONFLICT, "Mention organization conflicts with expected organization")
    validate_explicit_scope(db, mention.organization_id, mention.user_id, mention.project_id)
    return TenantScope(mention.organization_id, mention.user_id, mention.project_id)


async def resolve_async_mention_scope(db, mention_id: int) -> TenantScope:
    """Async equivalent used by Celery; validates the durable parent chain."""
    from app.models.keyword import KeywordGroup
    from app.models.mention import Mention
    from app.models.organization import OrganizationMember

    mention = await db.get(Mention, mention_id)
    if mention is None:
        _fail(TenantReason.PARENT_NOT_FOUND, "Mention not found")
    if not mention.organization_id or not mention.user_id or not mention.project_id:
        _fail(TenantReason.ORPHAN_PARENT, "Mention has unresolved ownership")
    project = (await db.execute(select(
        KeywordGroup.id, KeywordGroup.organization_id
    ).where(KeywordGroup.id == mention.project_id))).one_or_none()
    if project is None:
        _fail(TenantReason.PARENT_NOT_FOUND, "Project not found")
    if project.organization_id != mention.organization_id:
        _fail(TenantReason.SCOPE_CONFLICT, "Mention project conflicts with mention organization")
    membership = (await db.execute(select(OrganizationMember.id).where(
        OrganizationMember.organization_id == mention.organization_id,
        OrganizationMember.user_id == mention.user_id,
        OrganizationMember.status == "active",
    ))).scalar_one_or_none()
    if membership is None:
        _fail(TenantReason.USER_ORGANIZATION_MISMATCH, "Mention owner is not an active organization member")
    return TenantScope(mention.organization_id, mention.user_id, mention.project_id)


def stamp_scope(instance, scope: TenantScope, *, project: bool = True) -> None:
    if hasattr(instance, "organization_id"):
        instance.organization_id = scope.organization_id
    if hasattr(instance, "user_id"):
        instance.user_id = scope.user_id
    if hasattr(instance, "created_by_user_id"):
        instance.created_by_user_id = scope.user_id
    if hasattr(instance, "generated_by"):
        instance.generated_by = scope.user_id
    if hasattr(instance, "requested_by"):
        instance.requested_by = scope.user_id
    if project and hasattr(instance, "project_id"):
        instance.project_id = scope.project_id


_DIRECT_REQUIRED = {
    "keyword_groups": ("organization_id", "user_id"),
    "source_groups": ("organization_id", "user_id"),
    "sources": ("organization_id", "user_id"),
    "source_items": ("organization_id", "user_id"),
    "crawl_jobs": ("organization_id", "user_id", "project_id"),
    "scan_schedules": ("organization_id", "user_id"),
    "discovery_jobs": ("organization_id", "created_by_user_id", "project_id"),
    "discovered_sources": ("organization_id", "user_id", "project_id"),
    "blocked_domains": ("organization_id", "blocked_by_user_id", "project_id"),
    "mentions": ("organization_id", "user_id", "project_id"),
    "alerts": ("organization_id", "user_id", "project_id"),
    "reports": ("organization_id", "generated_by", "project_id"),
    "report_exports": ("organization_id", "requested_by", "project_id"),
}

_DIRECT_OWNER_FIELDS = {
    "organization_id",
    "user_id",
    "created_by_user_id",
    "generated_by",
    "requested_by",
    "blocked_by_user_id",
}


def required_ownership_fields(table_name: str) -> tuple[str, ...]:
    """Fields whose NULL value makes a newly inserted row tenant-incomplete."""
    if table_name == "keywords":
        return ("group_id",)
    if table_name == "ai_analysis":
        return ("mention_id",)
    return _DIRECT_REQUIRED.get(table_name, ())


def direct_scope_predicates(model) -> tuple:
    """SQL predicates that exclude every tenant-incomplete direct-scope row."""
    table_name = getattr(model, "__tablename__", "")
    return tuple(
        getattr(model, field_name).is_not(None)
        for field_name in _DIRECT_REQUIRED.get(table_name, ())
    )


def has_complete_direct_scope(instance) -> bool:
    """Return true only when every required durable scope field is populated."""
    required = _DIRECT_REQUIRED.get(getattr(instance, "__tablename__", ""), ())
    return bool(required) and all(
        getattr(instance, field_name, None) is not None for field_name in required
    )


def is_fully_ownerless_direct_scope(instance) -> bool:
    """Recognize legacy rows with no assigned direct organization or user owner."""
    required = _DIRECT_REQUIRED.get(getattr(instance, "__tablename__", ""), ())
    owner_fields = tuple(name for name in required if name in _DIRECT_OWNER_FIELDS)
    return (
        "organization_id" in owner_fields
        and len(owner_fields) >= 2
        and all(getattr(instance, field_name, None) is None for field_name in owner_fields)
    )


def has_any_direct_owner_assignment(instance) -> bool:
    """Return true when a direct tenant owner field is populated on the row."""
    required = _DIRECT_REQUIRED.get(getattr(instance, "__tablename__", ""), ())
    owner_fields = tuple(name for name in required if name in _DIRECT_OWNER_FIELDS)
    return any(
        getattr(instance, field_name, None) is not None for field_name in owner_fields
    )


@event.listens_for(Session, "before_flush")
def reject_unscoped_tenant_writes(session, flush_context, instances):
    """Fail closed for every newly inserted tenant-scoped row."""
    if not session.info.get("enforce_tenant_writes", False):
        return
    for instance in session.new:
        table = getattr(instance, "__tablename__", None)
        required = required_ownership_fields(table)
        if required:
            missing = [name for name in required if getattr(instance, name, None) is None]
            if missing:
                _fail(
                    TenantReason.NO_PARENT_EVIDENCE,
                    f"{table} write missing required ownership fields: {', '.join(missing)}",
                )

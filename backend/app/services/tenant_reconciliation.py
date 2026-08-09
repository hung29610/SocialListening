"""Deterministic, idempotent tenant reconciliation with explicit quarantine."""

# Runtime release contract: startup-state-machine-v1.

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.ownership import TenantReason, TenantScope, stamp_scope


@dataclass
class ReconciliationDecision:
    table_name: str
    row_identifier: str
    scope: Optional[TenantScope] = None
    reason: Optional[TenantReason] = None
    evidence: dict = field(default_factory=dict)

    @property
    def recoverable(self) -> bool:
        return self.scope is not None and self.reason is None


@dataclass
class ReconciliationSummary:
    dry_run: bool
    inspected: int = 0
    already_consistent: int = 0
    repairable: int = 0
    repaired: int = 0
    quarantined: int = 0
    reasons: dict = field(default_factory=dict)
    active_integrity_violations: int = 0
    ownership_conflicts: int = 0
    quarantined_legacy: int = 0


def _values(*values) -> set[int]:
    return {int(value) for value in values if value is not None}


def _add_parent(row, organizations: set, users: set, projects: set) -> None:
    if row is None:
        return
    organizations.update(_values(getattr(row, "organization_id", None)))
    users.update(_values(
        getattr(row, "user_id", None),
        getattr(row, "created_by_user_id", None),
        getattr(row, "generated_by", None),
        getattr(row, "requested_by", None),
    ))
    projects.update(_values(getattr(row, "project_id", None)))


def _active_membership_orgs(db: Session, user_id: int) -> set[int]:
    from app.models.organization import OrganizationMember

    return set(db.execute(
        select(OrganizationMember.organization_id).where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == "active",
        )
    ).scalars())


def derive_scope_for_row(db: Session, row) -> ReconciliationDecision:
    """Return exactly one evidence-backed scope or a stable quarantine reason."""
    from app.models.alert import Alert
    from app.models.crawl import CrawlJob, ScanSchedule
    from app.models.discovery import BlockedDomain, DiscoveredSource, DiscoveryJob
    from app.models.keyword import Keyword, KeywordGroup
    from app.models.mention import AIAnalysis, Mention
    from app.models.report import Report, ReportExport
    from app.models.source import Source, SourceGroup
    from app.models.source_item import SourceItem

    table = row.__tablename__
    identifier = str(row.id)
    organizations = _values(getattr(row, "organization_id", None))
    direct_users = _values(
        getattr(row, "user_id", None),
        getattr(row, "created_by_user_id", None),
        getattr(row, "generated_by", None),
        getattr(row, "requested_by", None),
    )
    users = set(direct_users)
    projects = _values(getattr(row, "project_id", None))
    missing_parent = False

    def candidate_evidence() -> dict:
        return {
            "organization_candidates": sorted(organizations),
            "user_candidates": sorted(users),
            "project_candidates": sorted(projects),
            "organization_candidate_count": len(organizations),
            "user_candidate_count": len(users),
            "project_candidate_count": len(projects),
        }

    def parent(model, parent_id):
        nonlocal missing_parent
        if parent_id is None:
            return None
        value = db.get(model, parent_id)
        if value is None:
            missing_parent = True
        _add_parent(value, organizations, users, projects)
        if value is not None and value.__tablename__ == "keyword_groups":
            projects.add(value.id)
        return value

    if isinstance(row, Keyword):
        parent(KeywordGroup, row.group_id)
    elif isinstance(row, Source):
        parent(SourceGroup, row.group_id)
    elif isinstance(row, SourceItem):
        parent(Source, row.source_id)
    elif isinstance(row, CrawlJob):
        parent(KeywordGroup, row.project_id)
        parent(ScanSchedule, row.scan_schedule_id)
        for source_id in row.source_ids or []:
            parent(Source, source_id)
    elif isinstance(row, ScanSchedule):
        for group_id in row.keyword_group_ids or []:
            project = parent(KeywordGroup, group_id)
            if project is not None:
                projects.add(project.id)
        for group_id in row.source_group_ids or []:
            parent(SourceGroup, group_id)
    elif isinstance(row, DiscoveryJob):
        parent(KeywordGroup, row.project_id or row.keyword_group_id)
    elif isinstance(row, DiscoveredSource):
        parent(DiscoveryJob, row.discovery_job_id)
        parent(KeywordGroup, row.project_id)
    elif isinstance(row, BlockedDomain):
        parent(KeywordGroup, row.project_id)
    elif isinstance(row, Mention):
        parent(KeywordGroup, row.project_id)
        source = parent(Source, row.source_id)
        job = parent(CrawlJob, row.job_id)
        keyword = parent(Keyword, row.keyword_id)
        if keyword is not None:
            parent(KeywordGroup, keyword.group_id)
        if source is not None and not projects and source.group_id:
            # A source group is not a project; retain it only as ownership evidence.
            pass
        if job is not None and job.project_id:
            projects.add(job.project_id)
    elif isinstance(row, AIAnalysis):
        mention = parent(Mention, row.mention_id)
        if mention is not None:
            projects.update(_values(mention.project_id))
    elif isinstance(row, Alert):
        mention = parent(Mention, row.mention_id)
        if mention is not None:
            projects.update(_values(mention.project_id))
    elif isinstance(row, (Report, ReportExport)):
        parent(KeywordGroup, row.project_id)
    elif isinstance(row, (KeywordGroup, SourceGroup)):
        pass

    for user_id in tuple(users):
        membership_orgs = _active_membership_orgs(db, user_id)
        if not organizations:
            organizations.update(membership_orgs)
        elif organizations and not organizations.intersection(membership_orgs):
            return ReconciliationDecision(
                table, identifier, reason=TenantReason.USER_ORGANIZATION_MISMATCH,
                evidence=candidate_evidence(),
            )

    if len(organizations) == 1 and direct_users:
        organization_id = next(iter(organizations))
        valid_direct_users = {
            user_id for user_id in direct_users
            if organization_id in _active_membership_orgs(db, user_id)
        }
        if len(valid_direct_users) == 1:
            users = valid_direct_users

    evidence = candidate_evidence()
    if missing_parent:
        return ReconciliationDecision(table, identifier, reason=TenantReason.BROKEN_RELATIONSHIP_CHAIN, evidence=evidence)
    if len(organizations) > 1:
        return ReconciliationDecision(table, identifier, reason=TenantReason.MULTIPLE_ORGANIZATION_CANDIDATES, evidence=evidence)
    if len(users) > 1 or len(projects) > 1:
        return ReconciliationDecision(table, identifier, reason=TenantReason.SCOPE_CONFLICT, evidence=evidence)
    if not organizations:
        return ReconciliationDecision(table, identifier, reason=TenantReason.NO_PARENT_EVIDENCE, evidence=evidence)

    inherited = isinstance(row, (Keyword, AIAnalysis))
    requires_project = isinstance(row, (CrawlJob, DiscoveryJob, DiscoveredSource, Mention, Alert, Report, ReportExport, BlockedDomain))
    if not users:
        return ReconciliationDecision(table, identifier, reason=TenantReason.NO_PARENT_EVIDENCE, evidence=evidence)
    if requires_project and not projects:
        return ReconciliationDecision(table, identifier, reason=TenantReason.NO_PARENT_EVIDENCE, evidence=evidence)
    scope = TenantScope(next(iter(organizations)), next(iter(users)), next(iter(projects)) if projects else None)
    if inherited:
        return ReconciliationDecision(table, identifier, scope=scope, evidence=evidence)
    return ReconciliationDecision(table, identifier, scope=scope, evidence=evidence)


def tenant_scoped_models() -> tuple:
    from app.models.alert import Alert
    from app.models.crawl import CrawlJob, ScanSchedule
    from app.models.discovery import BlockedDomain, DiscoveredSource, DiscoveryJob
    from app.models.keyword import Keyword, KeywordGroup
    from app.models.mention import AIAnalysis, Mention
    from app.models.report import Report, ReportExport
    from app.models.source import Source, SourceGroup
    from app.models.source_item import SourceItem

    return (
        KeywordGroup, Keyword, SourceGroup, Source, SourceItem, CrawlJob, ScanSchedule,
        DiscoveryJob, DiscoveredSource, BlockedDomain, Mention, AIAnalysis, Alert,
        Report, ReportExport,
    )


def _already_consistent(row, scope: TenantScope) -> bool:
    if row.__tablename__ in {"keywords", "ai_analysis"}:
        return True
    checks = []
    for name, expected in (
        ("organization_id", scope.organization_id),
        ("user_id", scope.user_id),
        ("created_by_user_id", scope.user_id),
        ("generated_by", scope.user_id),
        ("requested_by", scope.user_id),
        ("project_id", scope.project_id),
    ):
        if hasattr(row, name) and expected is not None:
            checks.append(getattr(row, name) == expected)
    return bool(checks) and all(checks)


def _record_quarantine(db: Session, decision: ReconciliationDecision) -> None:
    from app.models.tenant_integrity import TenantIntegrityQuarantine

    existing = db.execute(select(TenantIntegrityQuarantine).where(
        TenantIntegrityQuarantine.table_name == decision.table_name,
        TenantIntegrityQuarantine.row_identifier == decision.row_identifier,
        TenantIntegrityQuarantine.reason_code == decision.reason.value,
    )).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if existing:
        existing.last_seen_at = now
        existing.evidence = decision.evidence
        existing.status = "open"
    else:
        db.add(TenantIntegrityQuarantine(
            table_name=decision.table_name,
            row_identifier=decision.row_identifier,
            reason_code=decision.reason.value,
            evidence=decision.evidence,
            status="open",
        ))


def _is_safely_ownerless_legacy(row, decision: ReconciliationDecision) -> bool:
    """True only when a no-evidence row has no direct tenant owner fields."""
    if decision.reason != TenantReason.NO_PARENT_EVIDENCE:
        return False
    direct_owner_fields = (
        "organization_id",
        "user_id",
        "created_by_user_id",
        "generated_by",
        "requested_by",
        "blocked_by_user_id",
    )
    return all(
        getattr(row, field_name, None) is None
        for field_name in direct_owner_fields
        if hasattr(row, field_name)
    )


def reconcile_tenant_integrity(db: Session, *, dry_run: bool = True, batch_size: int = 500) -> ReconciliationSummary:
    """Inspect every tenant table. Mutations occur only when dry_run is False."""
    from app.models.tenant_integrity import TenantIntegrityAuditState

    summary = ReconciliationSummary(dry_run=dry_run)
    for model in tenant_scoped_models():
        last_id = 0
        while True:
            rows = db.execute(
                select(model).where(model.id > last_id).order_by(model.id).limit(batch_size)
            ).scalars().all()
            if not rows:
                break
            for row in rows:
                last_id = row.id
                summary.inspected += 1
                decision = derive_scope_for_row(db, row)
                if decision.recoverable:
                    if _already_consistent(row, decision.scope):
                        summary.already_consistent += 1
                    else:
                        summary.repairable += 1
                        if not dry_run:
                            stamp_scope(row, decision.scope)
                            summary.repaired += 1
                else:
                    summary.quarantined += 1
                    reason = decision.reason.value
                    summary.reasons[reason] = summary.reasons.get(reason, 0) + 1
                    if decision.reason in {
                        TenantReason.MULTIPLE_ORGANIZATION_CANDIDATES,
                        TenantReason.SCOPE_CONFLICT,
                        TenantReason.USER_ORGANIZATION_MISMATCH,
                    }:
                        summary.ownership_conflicts += 1
                    elif _is_safely_ownerless_legacy(row, decision):
                        summary.quarantined_legacy += 1
                    else:
                        summary.active_integrity_violations += 1
                    if not dry_run:
                        _record_quarantine(db, decision)
            if not dry_run:
                db.flush()

    if not dry_run:
        state = db.get(TenantIntegrityAuditState, 1) or TenantIntegrityAuditState(id=1)
        state.status = "ready" if summary.quarantined == 0 else "degraded"
        state.unresolved_count = summary.quarantined
        state.conflict_count = sum(
            summary.reasons.get(reason.value, 0)
            for reason in (TenantReason.MULTIPLE_ORGANIZATION_CANDIDATES, TenantReason.SCOPE_CONFLICT)
        )
        state.details = {"inspected": summary.inspected, "repaired": summary.repaired, "reasons": summary.reasons}
        state.last_run_at = datetime.now(timezone.utc)
        db.add(state)
        db.commit()
    return summary

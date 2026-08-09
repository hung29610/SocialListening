"""Fail-closed Alembic startup orchestration.

Production has presented two repository-proven historical states. The repair
deliberately executes only normal or explicitly verified Alembic paths; it
never stamps, guesses, or edits historical revision files.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import DateTime, String, Text, inspect, text
from sqlalchemy.sql.sqltypes import VARCHAR

from app.core.config import settings
from app.core.database import engine


logger = logging.getLogger(__name__)

EXPECTED_REVISION = "d72f8a913b21"
STRANDED_REVISION = "7a8e2eb4683b"
MISSING_SIBLING_REVISION = "a1b2c3d4e5f6"
BRANCHPOINT_REVISION = "c4a1e2f3b5d7"
MERGE_REVISION = "914d78ba6c8e"
LEGACY_ANCESTOR_REVISION = "5fe3f0fbfb82"
LEGACY_PARENT_REVISION = "fab61847c68d"
LEGACY_CHILD_REVISION = "a34bcad08e54"
DIAGNOSTIC_REASON_CURRENT = "CURRENT_HEAD"
DIAGNOSTIC_REASON_STRANDED = "SUPPORTED_STRANDED_HEAD"
DIAGNOSTIC_REASON_LEGACY_ANCESTOR = "SUPPORTED_LEGACY_ANCESTOR_HEAD"
DIAGNOSTIC_REASON_SIBLING_SET = "UNSUPPORTED_SIBLING_HEAD_SET"
DIAGNOSTIC_REASON_MERGEPOINT = "UNSUPPORTED_MERGEPOINT_OR_DESCENDANT"
DIAGNOSTIC_REASON_UNKNOWN = "UNKNOWN_REVISION_SET"
REVISION_ID_PATTERN = re.compile(r"^[0-9a-f]{12}$")
SCHEMA_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$")
SCHEMA_CONTRACT_TABLE = "mentions"
SCHEMA_CONTRACT_INDEX = "ix_mentions_verification_status"
SCHEMA_CONTRACT_COLUMNS = (
    ("verification_status", "varchar_50", True, "na"),
    ("verification_error", "text", True, "na"),
    ("verified_at", "timestamp", True, "true"),
    ("original_url", "text", True, "na"),
    ("canonical_url", "text", True, "na"),
)
SCHEMA_REASON_COLUMN_MISSING = "COLUMN_MISSING"
SCHEMA_REASON_COLUMN_TYPE = "COLUMN_TYPE_MISMATCH"
SCHEMA_REASON_COLUMN_NULLABILITY = "COLUMN_NULLABILITY_MISMATCH"
SCHEMA_REASON_TIMESTAMP_TIMEZONE = "TIMESTAMP_TIMEZONE_MISMATCH"
SCHEMA_REASON_INDEX_MISSING = "INDEX_MISSING"
SCHEMA_REASON_INDEX_COLUMN = "INDEX_COLUMN_MISMATCH"
SCHEMA_REASON_INDEX_UNIQUENESS = "INDEX_UNIQUENESS_MISMATCH"
SCHEMA_REASON_MULTIPLE = "MULTIPLE_SCHEMA_MISMATCHES"
SCHEMA_REASON_LENGTH_UNSAFE = "VERIFICATION_STATUS_LENGTH_UNSAFE"
REPAIRABLE_VARCHAR_TYPES = {"varchar_unbounded", "varchar_length_other"}
ALEMBIC_VERSION_TABLE = "alembic_version"
ALEMBIC_VERSION_COLUMN = "version_num"
ALEMBIC_VERSION_LEGACY_LENGTH = 32
ALEMBIC_VERSION_REQUIRED_LENGTH = 64
LONG_REVISION_ID = "029_ensure_report_email_recipients"


class StartupMigrationError(RuntimeError):
    """The checked migration sequence did not reach the repository head."""


def _config(backend_dir: Path) -> Config:
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    if settings.DATABASE_URL:
        config.set_main_option(
            "sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%")
        )
    return config


def _database_heads() -> tuple[str, ...]:
    with engine.connect() as connection:
        return tuple(sorted(MigrationContext.configure(connection).get_current_heads()))


def _verify_repository_contract(script: ScriptDirectory) -> tuple[str, ...]:
    repository_heads = tuple(sorted(script.get_heads()))
    if repository_heads != (EXPECTED_REVISION,):
        raise StartupMigrationError("repository migration head is unexpected")

    stranded = script.get_revision(STRANDED_REVISION)
    sibling = script.get_revision(MISSING_SIBLING_REVISION)
    merge = script.get_revision(MERGE_REVISION)
    legacy = script.get_revision(LEGACY_ANCESTOR_REVISION)
    legacy_child = script.get_revision(LEGACY_CHILD_REVISION)
    if (
        stranded is None
        or sibling is None
        or merge is None
        or legacy is None
        or legacy_child is None
    ):
        raise StartupMigrationError("required migration lineage is missing")
    if stranded.down_revision != BRANCHPOINT_REVISION:
        raise StartupMigrationError("stranded revision parent is unexpected")
    if sibling.down_revision != BRANCHPOINT_REVISION:
        raise StartupMigrationError("sibling revision parent is unexpected")
    if set(merge.down_revision) != {STRANDED_REVISION, MISSING_SIBLING_REVISION}:
        raise StartupMigrationError("merge revision ancestry is unexpected")
    if legacy.down_revision != LEGACY_PARENT_REVISION:
        raise StartupMigrationError("legacy ancestor parent is unexpected")
    if legacy_child.down_revision != LEGACY_ANCESTOR_REVISION:
        raise StartupMigrationError("legacy ancestor child is unexpected")

    expected_ancestry = {
        revision.revision
        for revision in script.iterate_revisions(EXPECTED_REVISION, "base")
    }
    if not {
        MERGE_REVISION,
        LEGACY_ANCESTOR_REVISION,
        LEGACY_CHILD_REVISION,
    }.issubset(expected_ancestry):
        raise StartupMigrationError("repository head does not descend from merge revision")
    if max(len(revision) for revision in expected_ancestry) > ALEMBIC_VERSION_REQUIRED_LENGTH:
        raise StartupMigrationError("repository revision exceeds metadata capacity")
    return repository_heads


def _normalized_schema_type(value: object) -> str:
    """Map reflected SQLAlchemy types to a fixed, non-sensitive vocabulary."""
    if isinstance(value, Text):
        return "text"
    if isinstance(value, DateTime):
        return "timestamp"
    if isinstance(value, VARCHAR):
        if value.length == 50:
            return "varchar_50"
        return "varchar_unbounded" if value.length is None else "varchar_length_other"
    if isinstance(value, String):
        return "character_string_other"
    return "other"


def _normalized_bool(value: object) -> str:
    if value is True:
        return "true"
    if value is False:
        return "false"
    return "none"


def _normalized_index_columns(value: object) -> str:
    """Report a bounded list of reflected column identifiers only."""
    if not value:
        return "none"
    if not isinstance(value, (list, tuple)) or len(value) > 8:
        return "other"
    identifiers = [
        item
        for item in value
        if isinstance(item, str) and SCHEMA_IDENTIFIER_PATTERN.fullmatch(item)
    ]
    return "+".join(identifiers) if len(identifiers) == len(value) else "other"


def _schema_contract_reason(mismatches: list[str]) -> str:
    reasons = tuple(dict.fromkeys(mismatches))
    return reasons[0] if len(reasons) == 1 else SCHEMA_REASON_MULTIPLE


def _legacy_schema_state(connection) -> dict:
    """Reflect only the fixed revision-owned schema surface."""
    inspector = inspect(connection)
    table_present = SCHEMA_CONTRACT_TABLE in inspector.get_table_names()
    reflected_columns = inspector.get_columns(SCHEMA_CONTRACT_TABLE) if table_present else []
    columns = {column.get("name"): column for column in reflected_columns}
    reflected_indexes = inspector.get_indexes(SCHEMA_CONTRACT_TABLE) if table_present else []
    mismatches: list[str] = []
    column_states: list[dict] = []
    for name, expected_type, expected_nullable, expected_timezone in SCHEMA_CONTRACT_COLUMNS:
        column = columns.get(name)
        present = column is not None
        actual_type = _normalized_schema_type(column.get("type")) if present else "none"
        actual_nullable = _normalized_bool(column.get("nullable")) if present else "none"
        if name == "verified_at" and present and isinstance(column.get("type"), DateTime):
            actual_timezone = _normalized_bool(column["type"].timezone)
        else:
            actual_timezone = "na"

        column_match = present
        if not present:
            mismatches.append(SCHEMA_REASON_COLUMN_MISSING)
        else:
            if actual_type != expected_type:
                mismatches.append(SCHEMA_REASON_COLUMN_TYPE)
                column_match = False
            if actual_nullable != _normalized_bool(expected_nullable):
                mismatches.append(SCHEMA_REASON_COLUMN_NULLABILITY)
                column_match = False
            if actual_timezone != expected_timezone:
                mismatches.append(SCHEMA_REASON_TIMESTAMP_TIMEZONE)
                column_match = False
        column_states.append(
            {
                "name": name,
                "present": present,
                "expected_type": expected_type,
                "actual_type": actual_type,
                "expected_nullable": expected_nullable,
                "actual_nullable": actual_nullable,
                "expected_timezone": expected_timezone,
                "actual_timezone": actual_timezone,
                "match": column_match,
            }
        )

    matching_indexes = [
        index for index in reflected_indexes if index.get("name") == SCHEMA_CONTRACT_INDEX
    ]
    index_present = len(matching_indexes) == 1
    index = matching_indexes[0] if matching_indexes else {}
    actual_index_columns = _normalized_index_columns(index.get("column_names"))
    actual_unique = _normalized_bool(index.get("unique")) if matching_indexes else "none"
    index_match = index_present
    if not matching_indexes:
        mismatches.append(SCHEMA_REASON_INDEX_MISSING)
    elif len(matching_indexes) != 1:
        mismatches.append(SCHEMA_REASON_INDEX_COLUMN)
        index_match = False
    if matching_indexes and actual_index_columns != "verification_status":
        mismatches.append(SCHEMA_REASON_INDEX_COLUMN)
        index_match = False
    if matching_indexes and actual_unique != "false":
        mismatches.append(SCHEMA_REASON_INDEX_UNIQUENESS)
        index_match = False

    return {
        "table_present": table_present,
        "columns": column_states,
        "index": {
            "name": SCHEMA_CONTRACT_INDEX,
            "present": index_present,
            "expected_columns": "verification_status",
            "actual_columns": actual_index_columns,
            "expected_unique": False,
            "actual_unique": actual_unique,
            "match": index_match,
        },
        "mismatches": mismatches,
    }


def _log_schema_contract_state(state: dict) -> None:
    columns = [
        f"{item['name']}:present={str(item['present']).lower()}:"
        f"expected_type={item['expected_type']}:actual_type={item['actual_type']}:"
        f"expected_nullable={str(item['expected_nullable']).lower()}:"
        f"actual_nullable={item['actual_nullable']}:"
        f"expected_timezone={item['expected_timezone']}:"
        f"actual_timezone={item['actual_timezone']}:match={str(item['match']).lower()}"
        for item in state["columns"]
    ]
    index = state["index"]
    logger.error(
        "SCHEMA_CONTRACT_STATE table=%s reason=%s columns=%s "
        "index=%s:present=%s:expected_columns=verification_status:"
        "actual_columns=%s:expected_unique=false:actual_unique=%s:match=%s",
        SCHEMA_CONTRACT_TABLE,
        _schema_contract_reason(state["mismatches"]),
        ",".join(columns),
        SCHEMA_CONTRACT_INDEX,
        str(index["present"]).lower(),
        index["actual_columns"],
        index["actual_unique"],
        str(index["match"]).lower(),
    )


def _column_state(state: dict, name: str) -> dict:
    return next(item for item in state["columns"] if item["name"] == name)


def _is_exact_repairable_legacy_drift(state: dict) -> bool:
    status = _column_state(state, "verification_status")
    other_columns_match = all(
        item["match"] for item in state["columns"] if item["name"] != "verification_status"
    )
    return (
        state["table_present"]
        and other_columns_match
        and status["present"]
        and status["actual_type"] in REPAIRABLE_VARCHAR_TYPES
        and status["actual_nullable"] == "true"
        and status["actual_timezone"] == "na"
        and not state["index"]["present"]
        and state["index"]["actual_columns"] == "none"
        and state["index"]["actual_unique"] == "none"
    )


def _length_preflight(connection) -> tuple[int, int, int]:
    row = connection.execute(
        text(
            "SELECT COUNT(verification_status) AS non_null_count, "
            "COUNT(*) FILTER (WHERE char_length(verification_status) > 50) "
            "AS over_length_count, "
            "COALESCE(MAX(char_length(verification_status)), 0) AS max_length "
            "FROM mentions"
        )
    ).one()
    result = (int(row.non_null_count), int(row.over_length_count), int(row.max_length))
    logger.warning(
        "VERIFICATION_STATUS_LENGTH_PREFLIGHT non_null_count=%d "
        "over_length_count=%d max_length=%d",
        *result,
    )
    return result


def _verify_or_repair_legacy_ancestor_schema(database_heads: tuple[str, ...]) -> str:
    """Verify exact history or transactionally repair its one proven drift."""
    if database_heads != (LEGACY_ANCESTOR_REVISION,):
        raise StartupMigrationError("legacy schema repair revision is unexpected")
    with engine.begin() as connection:
        connection.execute(text("LOCK TABLE alembic_version IN SHARE MODE"))
        transaction_heads = tuple(
            sorted(MigrationContext.configure(connection).get_current_heads())
        )
        if transaction_heads != (LEGACY_ANCESTOR_REVISION,):
            raise StartupMigrationError("legacy schema repair revision changed")
        state = _legacy_schema_state(connection)
        if not state["mismatches"]:
            return "verified"
        if not _is_exact_repairable_legacy_drift(state):
            _log_schema_contract_state(state)
            raise StartupMigrationError("legacy ancestor schema verification failed")

        status = _column_state(state, "verification_status")
        logger.warning(
            "LEGACY_SCHEMA_REPAIR_START revision=%s status_type=%s index_present=false",
            LEGACY_ANCESTOR_REVISION,
            status["actual_type"],
        )
        # One transaction and an ACCESS EXCLUSIVE lock close the race between
        # the aggregate preflight and PostgreSQL's transactional DDL.
        connection.execute(text("LOCK TABLE mentions IN ACCESS EXCLUSIVE MODE"))
        _, over_length_count, _ = _length_preflight(connection)
        if over_length_count:
            logger.error(
                "LEGACY_SCHEMA_REPAIR_REJECTED reason=%s",
                SCHEMA_REASON_LENGTH_UNSAFE,
            )
            raise StartupMigrationError("verification status length preflight failed")

        connection.execute(
            text(
                "ALTER TABLE mentions ALTER COLUMN verification_status "
                "TYPE VARCHAR(50)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_mentions_verification_status "
                "ON mentions (verification_status)"
            )
        )
        repaired_state = _legacy_schema_state(connection)
        if repaired_state["mismatches"]:
            _log_schema_contract_state(repaired_state)
            raise StartupMigrationError("legacy ancestor schema repair verification failed")

        logger.warning(
            "LEGACY_SCHEMA_REPAIR_VERIFIED revision=%s status_type=varchar_50 "
            "index_present=true",
            LEGACY_ANCESTOR_REVISION,
        )
        return "repaired"


def _verify_legacy_ancestor_schema() -> None:
    """Compatibility wrapper retained for focused callers and tests."""
    with engine.connect() as connection:
        state = _legacy_schema_state(connection)
    if state["mismatches"]:
        _log_schema_contract_state(state)
        raise StartupMigrationError("legacy ancestor schema verification failed")


def _revision_ancestry(script: ScriptDirectory, revision: str) -> set[str]:
    """Return repository revision IDs reachable downward from one revision."""
    try:
        return {
            item.revision
            for item in script.iterate_revisions(revision, "base")
        }
    except Exception:  # Alembic raises for IDs absent from the repository graph.
        return set()


def _diagnose_database_heads(
    script: ScriptDirectory,
    database_heads: tuple[str, ...],
    repository_heads: tuple[str, ...],
) -> tuple[str, bool]:
    """Classify a revision set without inferring or broadening repair support."""
    if any(not REVISION_ID_PATTERN.fullmatch(revision) for revision in database_heads):
        return DIAGNOSTIC_REASON_UNKNOWN, False
    current = set(database_heads)
    if database_heads == repository_heads:
        return DIAGNOSTIC_REASON_CURRENT, True
    if database_heads == (STRANDED_REVISION,):
        return DIAGNOSTIC_REASON_STRANDED, True
    if database_heads == (LEGACY_ANCESTOR_REVISION,):
        return DIAGNOSTIC_REASON_LEGACY_ANCESTOR, True
    if current == {STRANDED_REVISION, MISSING_SIBLING_REVISION}:
        return DIAGNOSTIC_REASON_SIBLING_SET, True

    known_ancestry = set().union(
        *(_revision_ancestry(script, revision) for revision in database_heads)
    ) if database_heads else set()
    if MERGE_REVISION in current or MERGE_REVISION in known_ancestry:
        return DIAGNOSTIC_REASON_MERGEPOINT, True
    return DIAGNOSTIC_REASON_UNKNOWN, False


def _log_head_diagnostic(
    script: ScriptDirectory,
    database_heads: tuple[str, ...],
    repository_heads: tuple[str, ...],
) -> None:
    reason, mergepoint_reachable = _diagnose_database_heads(
        script, database_heads, repository_heads
    )
    safe_database_heads = tuple(
        revision for revision in sorted(database_heads)
        if REVISION_ID_PATTERN.fullmatch(revision)
    )
    safe_repository_heads = tuple(
        revision for revision in sorted(repository_heads)
        if REVISION_ID_PATTERN.fullmatch(revision)
    )
    logger.warning(
        "ALEMBIC_BOOTSTRAP_STATE database_revisions=%s repository_heads=%s "
        "stranded_present=%s sibling_present=%s mergepoint_reachable=%s reason=%s",
        ",".join(safe_database_heads) or "none",
        ",".join(safe_repository_heads) or "none",
        str(STRANDED_REVISION in database_heads).lower(),
        str(MISSING_SIBLING_REVISION in database_heads).lower(),
        str(mergepoint_reachable).lower(),
        reason,
    )


def _log_pending_legacy_schema_state() -> None:
    """Log bounded object presence for the two revisions after legacy head."""
    with engine.connect() as connection:
        inspector = inspect(connection)
        tables = set(inspector.get_table_names())
        usage_table_present = "ai_usage_logs" in tables
        model_table_present = "ai_model_config" in tables
        model_columns = (
            {column["name"] for column in inspector.get_columns("ai_model_config")}
            if model_table_present
            else set()
        )
        usage_indexes = (
            {index["name"] for index in inspector.get_indexes("ai_usage_logs")}
            if usage_table_present
            else set()
        )

    logger.warning(
        "ALEMBIC_PENDING_SCHEMA_STATE base=%s "
        "ai_usage_logs_present=%s system_prompt_present=%s "
        "usage_index_id_present=%s usage_index_model_config_present=%s "
        "usage_index_organization_present=%s usage_index_user_present=%s",
        LEGACY_ANCESTOR_REVISION,
        str(usage_table_present).lower(),
        str("system_prompt" in model_columns).lower(),
        str("ix_ai_usage_logs_id" in usage_indexes).lower(),
        str("ix_ai_usage_logs_model_config_id" in usage_indexes).lower(),
        str("ix_ai_usage_logs_organization_id" in usage_indexes).lower(),
        str("ix_ai_usage_logs_user_id" in usage_indexes).lower(),
    )


def _ensure_alembic_version_capacity(database_heads: tuple[str, ...]) -> str:
    """Widen only the canonical Alembic metadata column on the legacy path.

    The repository contains the 34-character revision identifier
    ``029_ensure_report_email_recipients``.  Alembic's historical default
    ``VARCHAR(32)`` cannot record it.  This preflight changes only metadata
    capacity; it never edits or stamps a revision value.
    """
    if database_heads not in {
        (LEGACY_ANCESTOR_REVISION,),
        (STRANDED_REVISION,),
    }:
        raise StartupMigrationError("Alembic version capacity revision is unexpected")

    with engine.begin() as connection:
        connection.execute(text("LOCK TABLE alembic_version IN ACCESS EXCLUSIVE MODE"))
        transaction_heads = tuple(
            sorted(MigrationContext.configure(connection).get_current_heads())
        )
        if transaction_heads != database_heads:
            raise StartupMigrationError("Alembic version capacity revision changed")

        inspector = inspect(connection)
        columns = inspector.get_columns(ALEMBIC_VERSION_TABLE)
        primary_key = inspector.get_pk_constraint(ALEMBIC_VERSION_TABLE)
        if (
            len(columns) != 1
            or columns[0].get("name") != ALEMBIC_VERSION_COLUMN
            or columns[0].get("nullable") is not False
            or primary_key.get("constrained_columns") != [ALEMBIC_VERSION_COLUMN]
        ):
            logger.error(
                "ALEMBIC_VERSION_CAPACITY status=rejected reason=METADATA_CONTRACT_MISMATCH"
            )
            raise StartupMigrationError("Alembic version metadata contract is unexpected")

        column_type = columns[0].get("type")
        if not isinstance(column_type, VARCHAR) or column_type.length is None:
            logger.error(
                "ALEMBIC_VERSION_CAPACITY status=rejected reason=TYPE_MISMATCH"
            )
            raise StartupMigrationError("Alembic version column type is unexpected")

        current_length = int(column_type.length)
        if current_length >= ALEMBIC_VERSION_REQUIRED_LENGTH:
            logger.info(
                "ALEMBIC_VERSION_CAPACITY status=verified length=%d",
                current_length,
            )
            return "verified"
        if current_length != ALEMBIC_VERSION_LEGACY_LENGTH:
            logger.error(
                "ALEMBIC_VERSION_CAPACITY status=rejected reason=UNSUPPORTED_LENGTH "
                "length=%d",
                current_length,
            )
            raise StartupMigrationError("Alembic version column length is unsupported")

        connection.execute(
            text(
                "ALTER TABLE alembic_version ALTER COLUMN version_num "
                "TYPE VARCHAR(64)"
            )
        )
        repaired_columns = inspect(connection).get_columns(ALEMBIC_VERSION_TABLE)
        repaired_type = (
            repaired_columns[0].get("type") if len(repaired_columns) == 1 else None
        )
        if (
            not isinstance(repaired_type, VARCHAR)
            or repaired_type.length != ALEMBIC_VERSION_REQUIRED_LENGTH
        ):
            raise StartupMigrationError("Alembic version capacity verification failed")

        logger.warning(
            "ALEMBIC_VERSION_CAPACITY status=repaired from_length=%d to_length=%d",
            current_length,
            ALEMBIC_VERSION_REQUIRED_LENGTH,
        )
        return "repaired"


def _prepare_known_lineage(config: Config, script: ScriptDirectory) -> tuple[str, ...]:
    """Prepare only exact, repository-proven historical states."""
    repository_heads = _verify_repository_contract(script)
    database_heads = _database_heads()

    if database_heads == repository_heads:
        logger.info("ALEMBIC_BOOTSTRAP_NOOP revision=%s", EXPECTED_REVISION)
        return repository_heads
    if database_heads == (LEGACY_ANCESTOR_REVISION,):
        schema_result = _verify_or_repair_legacy_ancestor_schema(database_heads)
        version_capacity_result = _ensure_alembic_version_capacity(database_heads)
        _log_pending_legacy_schema_state()
        logger.warning(
            "ALEMBIC_BOOTSTRAP_LEGACY_ANCESTOR_VERIFIED revision=%s child=%s "
            "schema_result=%s version_capacity_result=%s",
            LEGACY_ANCESTOR_REVISION,
            LEGACY_CHILD_REVISION,
            schema_result,
            version_capacity_result,
        )
        return repository_heads
    if database_heads != (STRANDED_REVISION,):
        _log_head_diagnostic(script, database_heads, repository_heads)
        raise StartupMigrationError("database migration state is not supported by bootstrap")

    version_capacity_result = _ensure_alembic_version_capacity(database_heads)
    logger.warning(
        "ALEMBIC_BOOTSTRAP_REPAIR current=%s sibling=%s "
        "version_capacity_result=%s",
        STRANDED_REVISION,
        MISSING_SIBLING_REVISION,
        version_capacity_result,
    )
    command.upgrade(config, MISSING_SIBLING_REVISION)
    sibling_heads = _database_heads()
    expected_siblings = tuple(sorted((STRANDED_REVISION, MISSING_SIBLING_REVISION)))
    if sibling_heads != expected_siblings:
        raise StartupMigrationError("missing sibling revision did not apply cleanly")
    logger.info(
        "ALEMBIC_BOOTSTRAP_SIBLINGS_VERIFIED revisions=%s,%s",
        expected_siblings[0],
        expected_siblings[1],
    )
    return repository_heads


def run_verified_startup_migrations(backend_dir: Path) -> str:
    """Prepare the known lineage, run normal Alembic, and verify exact head."""
    config = _config(backend_dir)
    script = ScriptDirectory.from_config(config)
    repository_heads = _prepare_known_lineage(config, script)

    try:
        command.upgrade(config, "head")
    except Exception as exc:
        try:
            failed_heads = tuple(
                revision
                for revision in _database_heads()
                if REVISION_ID_PATTERN.fullmatch(revision)
            )
        except Exception:
            failed_heads = ()
        logger.critical(
            "STARTUP_STATE phase=migration status=failed "
            "reason=ALEMBIC_UPGRADE_FAILED database_revisions=%s error_type=%s",
            ",".join(failed_heads) or "unknown",
            type(exc).__name__,
        )
        raise
    database_heads = _database_heads()
    if database_heads != repository_heads:
        logger.critical(
            "STARTUP_STATE phase=migration status=failed "
            "reason=FINAL_HEAD_MISMATCH database_revisions=%s",
            ",".join(
                revision
                for revision in database_heads
                if REVISION_ID_PATTERN.fullmatch(revision)
            ) or "unknown",
        )
        raise StartupMigrationError("database migration head does not match repository head")

    logger.info("ALEMBIC_HEAD_VERIFIED revision=%s", EXPECTED_REVISION)
    return EXPECTED_REVISION


def verify_exact_database_head(backend_dir: Path) -> str | None:
    """Return the exact head without entering Alembic's upgrade path.

    A superseded Render generation can still hold the migration singleton while
    the database transaction it ran has already committed the repository head.
    This read-only preflight lets the replacement generation prove that there is
    no migration work left, without waiting on that stale process lock.
    """
    config = _config(backend_dir)
    script = ScriptDirectory.from_config(config)
    repository_heads = _verify_repository_contract(script)
    database_heads = _database_heads()
    if database_heads != repository_heads:
        return None
    logger.info("ALEMBIC_HEAD_VERIFIED revision=%s path=read_only_preflight", EXPECTED_REVISION)
    return EXPECTED_REVISION

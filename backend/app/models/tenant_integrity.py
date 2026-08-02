from sqlalchemy import Column, DateTime, Integer, JSON, String, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class TenantIntegrityQuarantine(Base):
    """Evidence for a row whose tenant cannot be derived without guessing."""

    __tablename__ = "tenant_integrity_quarantine"

    id = Column(Integer, primary_key=True)
    table_name = Column(String(80), nullable=False, index=True)
    row_identifier = Column(String(255), nullable=False)
    reason_code = Column(String(80), nullable=False, index=True)
    evidence = Column(JSON, nullable=False, default=dict)
    status = Column(String(20), nullable=False, default="open", index=True)
    first_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "table_name", "row_identifier", "reason_code",
            name="uq_tenant_quarantine_row_reason",
        ),
    )


class TenantIntegrityAuditState(Base):
    """Bounded readiness signal; startup reads one row and never scans data."""

    __tablename__ = "tenant_integrity_audit_state"

    id = Column(Integer, primary_key=True)
    status = Column(String(20), nullable=False, default="unknown")
    unresolved_count = Column(Integer, nullable=False, default=0)
    conflict_count = Column(Integer, nullable=False, default=0)
    details = Column(JSON, nullable=False, default=dict)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

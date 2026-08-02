"""Explicit full tenant-integrity diagnostic for CI and operator use."""
import json

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.ownership import required_ownership_fields
from app.services.tenant_reconciliation import (
    _already_consistent,
    derive_scope_for_row,
    tenant_scoped_models,
)


def run_audit(db) -> dict:
    totals = {"inspected": 0, "null_ownership": 0, "inconsistent": 0, "tables": {}}
    for model in tenant_scoped_models():
        row_count = 0
        null_count = 0
        inconsistent_count = 0
        reasons = {}
        for row in db.execute(select(model).order_by(model.id)).scalars():
            row_count += 1
            totals["inspected"] += 1
            required = required_ownership_fields(row.__tablename__)
            if any(getattr(row, field, None) is None for field in required):
                null_count += 1
            decision = derive_scope_for_row(db, row)
            inconsistent = not decision.recoverable or not _already_consistent(row, decision.scope)
            if inconsistent:
                inconsistent_count += 1
                reason = decision.reason.value if decision.reason else "REPAIR_REQUIRED"
                reasons[reason] = reasons.get(reason, 0) + 1
        totals["tables"][model.__tablename__] = {
            "rows": row_count,
            "null_ownership": null_count,
            "inconsistent": inconsistent_count,
            "reasons": reasons,
        }
        totals["null_ownership"] += null_count
        totals["inconsistent"] += inconsistent_count
    return totals


def main() -> int:
    db = SessionLocal()
    try:
        result = run_audit(db)
        print(json.dumps(result, sort_keys=True))
        return 0 if result["inconsistent"] == 0 else 2
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

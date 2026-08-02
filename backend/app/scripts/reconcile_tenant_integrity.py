"""Owner-run tenant reconciliation. Defaults to a non-mutating dry run."""
import argparse
import json

from app.core.database import SessionLocal
from app.services.tenant_reconciliation import reconcile_tenant_integrity


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Apply deterministic repairs and write quarantine rows")
    parser.add_argument("--batch-size", type=int, default=500)
    args = parser.parse_args()
    db = SessionLocal()
    try:
        summary = reconcile_tenant_integrity(db, dry_run=not args.apply, batch_size=args.batch_size)
        print(json.dumps(summary.__dict__, sort_keys=True))
        return 0 if summary.quarantined == 0 else 2
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

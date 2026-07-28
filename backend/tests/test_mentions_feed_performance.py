"""Regression evidence for issue #221 mention-feed query behavior."""
from datetime import datetime, timezone
from unittest.mock import MagicMock
import importlib.util
from pathlib import Path

from app.api.mentions import (
    _apply_mention_cursor,
    _batch_load_mention_relations,
    _decode_mention_cursor,
    _encode_mention_cursor,
)
from app.models.mention import Mention
from sqlalchemy import select


def test_100_row_relation_load_is_three_statements_not_101():
    """Baseline was 101 relation statements: source + visit + 100 AI lookups."""
    db = MagicMock()
    source_result = MagicMock()
    source_result.scalars.return_value.all.return_value = []
    visit_result = MagicMock()
    visit_result.scalars.return_value.all.return_value = []
    analysis_result = MagicMock()
    analysis_result.scalars.return_value.all.return_value = []
    db.execute.side_effect = [source_result, visit_result, analysis_result]

    mentions = [
        MagicMock(id=index, source_id=index, collected_at=datetime.now(timezone.utc))
        for index in range(1, 101)
    ]
    _batch_load_mention_relations(db, mentions, user_id=7)

    assert db.execute.call_count == 3
    # Full page: count + page + these three relation loads = five statements.
    assert 2 + db.execute.call_count <= 5


def test_newest_cursor_round_trips_and_adds_stable_tuple_boundary():
    collected_at = datetime(2026, 7, 28, 8, 30, tzinfo=timezone.utc)
    cursor = _encode_mention_cursor(collected_at, 42)
    assert _decode_mention_cursor(cursor) == (collected_at, 42)

    query = _apply_mention_cursor(select(Mention), cursor, "newest")
    sql = str(query).lower()
    assert "mentions.collected_at <" in sql
    assert "mentions.id <" in sql


def test_oldest_cursor_uses_forward_tuple_boundary():
    collected_at = datetime(2026, 7, 28, 8, 30, tzinfo=timezone.utc)
    query = _apply_mention_cursor(
        select(Mention), _encode_mention_cursor(collected_at, 42), "oldest"
    )
    sql = str(query).lower()
    assert "mentions.collected_at >" in sql
    assert "mentions.id >" in sql


def test_index_migration_upgrade_and_downgrade_are_symmetric(monkeypatch):
    migration_path = (
        Path(__file__).parents[1]
        / "alembic"
        / "versions"
        / "d72f8a913b21_add_mention_feed_cursor_indexes.py"
    )
    spec = importlib.util.spec_from_file_location("issue_221_migration", migration_path)
    migration = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(migration)
    create_index = MagicMock()
    drop_index = MagicMock()
    monkeypatch.setattr(migration.op, "create_index", create_index)
    monkeypatch.setattr(migration.op, "drop_index", drop_index)

    migration.upgrade()
    migration.downgrade()

    assert [call.args[0] for call in create_index.call_args_list] == [
        "idx_mentions_org_collected_id",
        "idx_mentions_project_collected_id",
        "idx_mentions_keyword_collected_id",
    ]
    assert [call.args[0] for call in drop_index.call_args_list] == [
        "idx_mentions_keyword_collected_id",
        "idx_mentions_project_collected_id",
        "idx_mentions_org_collected_id",
    ]

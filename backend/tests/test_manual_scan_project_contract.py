import pytest
from fastapi import HTTPException

from app.api.crawl import ManualScanRequest, _manual_scan_project_id


def test_manual_scan_uses_explicit_project_id():
    body = ManualScanRequest(project_id=17, keyword_group_ids=[18], keywords=["signal"])
    assert _manual_scan_project_id(body) == 17


def test_manual_scan_derives_single_keyword_group_for_frontend_compatibility():
    body = ManualScanRequest(keyword_group_ids=[17, 17], keywords=["signal"])
    assert _manual_scan_project_id(body) == 17


def test_manual_scan_rejects_ambiguous_keyword_groups():
    body = ManualScanRequest(keyword_group_ids=[17, 18], keywords=["signal"])
    with pytest.raises(HTTPException) as error:
        _manual_scan_project_id(body)
    assert error.value.status_code == 400


def test_manual_scan_without_project_remains_fail_closed_for_tenant_scope():
    body = ManualScanRequest(keywords=["signal"])
    assert _manual_scan_project_id(body) is None

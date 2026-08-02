from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class CapabilityState(str, Enum):
    READY = "READY"
    CONFIG_REQUIRED = "CONFIG_REQUIRED"
    OAUTH_REQUIRED = "OAUTH_REQUIRED"
    BEST_EFFORT_UNSUPPORTED = "BEST_EFFORT_UNSUPPORTED"
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"


class ConnectorCapability(BaseModel):
    state: CapabilityState
    production_ready: bool
    action_enabled: bool = False
    action: Optional[str] = None
    reason_code: str
    missing_prerequisites: List[str] = Field(default_factory=list)
    preview_only: bool = False


class ConnectorCapabilitiesResponse(BaseModel):
    contract_version: str = "2026-08-02"
    connectors: Dict[str, ConnectorCapability]
    exports: Dict[str, ConnectorCapability]

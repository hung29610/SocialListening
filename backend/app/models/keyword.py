from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, Enum as SQLEnum
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class KeywordType(str, Enum):
    BRAND = "brand"
    PRODUCT = "product"
    COMPETITOR = "competitor"
    SENSITIVE = "sensitive"
    GENERAL = "general"


class LogicOperator(str, Enum):
    AND = "AND"
    OR = "OR"
    NOT = "NOT"


class KeywordGroup(Base):
    __tablename__ = "keyword_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    priority = Column(Integer, default=3)  # 1-5, 5 is highest
    alert_threshold = Column(Float, default=70.0)  # Risk score threshold for alerts
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    


class Keyword(Base):
    __tablename__ = "keywords"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, nullable=False, index=True)
    keyword = Column(String(500), nullable=False, index=True)
    keyword_type = Column(SQLEnum(KeywordType), default=KeywordType.GENERAL)
    logic_operator = Column(SQLEnum(LogicOperator), default=LogicOperator.OR)
    is_excluded = Column(Boolean, default=False)  # Excluded keyword
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    

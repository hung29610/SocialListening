#!/usr/bin/env python3
"""
Seed Service Catalog Data
"""

import sys
import os

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.service import (
    ServiceCategory, Service, ServiceType, Platform, RiskLevel
)
from decimal import Decimal


def seed_service_categories(db: Session):
    """Seed service categories"""
    categories = [
        {
            "name": "Crisis Consulting & Handling",
            "description": "Professional crisis assessment, response planning, and executive briefing services"
        },
        {
            "name": "Negative Content Monitoring",
            "description": "Continuous monitoring and analysis of negative mentions and high-risk content"
        },
        {
            "name": "Legal Takedown & Correction Request",
            "description": "Legal compliance services for takedown requests, corrections, and evidence collection"
        },
        {
            "name": "Press/Media Handling",
            "description": "Professional media response, correction letters, and press monitoring services"
        },
        {
            "name": "Copyright & Brand Protection",
            "description": "Brand asset monitoring and copyright violation evidence preparation"
        },
        {
            "name": "Community Response Planning",
            "description": "Public and private response drafting, comment guides, and reputation management"
        },
        {
            "name": "Monthly Reputation Management",
            "description": "Ongoing reputation health monitoring and action plan reviews"
        }
    ]
    
    for cat_data in categories:
        existing = db.query(ServiceCategory).filter(ServiceCategory.name == cat_data["name"]).first()
        if not existing:
            category = ServiceCategory(**cat_data)
            db.add(category)
    
    db.commit()
    print(f"✅ Seeded {len(categories)} service categories")


def seed_services(db: Session):
    """Seed services"""
    # Get categories
    categories = {cat.name: cat.id for cat in db.query(ServiceCategory).all()}
    
    services = [
        # Crisis Consulting & Handling
        {
            "category_id": categories["Crisis Consulting & Handling"],
            "code": "CRISIS_ASSESS",
            "name": "Crisis Situation Assessment",
            "description": "Analyze risk level from collected mentions, classify crisis level 1-5, identify key sources and recommended actions",
            "service_type": ServiceType.CRISIS_CONSULTING,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Professional consulting and risk assessment services",
            "workflow_template": {
                "steps": [
                    "Collect and review all related mentions",
                    "Analyze risk level and crisis severity",
                    "Identify key sources and influencers",
                    "Classify crisis level (1-5)",
                    "Prepare recommended action plan",
                    "Generate executive summary"
                ]
            },
            "deliverables": {
                "items": [
                    "Risk assessment report",
                    "Crisis timeline analysis",
                    "Recommended action plan",
                    "Key stakeholder identification"
                ]
            },
            "estimated_duration": "4-8 hours",
            "sla_hours": 8,
            "base_price": Decimal("5000000"),  # 5M VND
            "min_quantity": 1,
            "unit": "assessment",
            "risk_level": RiskLevel.MEDIUM,
            "requires_approval": True
        },
        {
            "category_id": categories["Crisis Consulting & Handling"],
            "code": "CRISIS_PLAN",
            "name": "Crisis Response Plan",
            "description": "Create comprehensive response strategy with department assignments and communication framework",
            "service_type": ServiceType.CRISIS_CONSULTING,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Strategic consulting and communication planning",
            "workflow_template": {
                "steps": [
                    "Review crisis assessment",
                    "Define response strategy",
                    "Assign department responsibilities",
                    "Create communication messages",
                    "Define approval workflow",
                    "Prepare implementation timeline"
                ]
            },
            "deliverables": {
                "items": [
                    "Crisis response strategy",
                    "RACI matrix",
                    "Message framework",
                    "Implementation timeline"
                ]
            },
            "estimated_duration": "1-2 days",
            "sla_hours": 48,
            "base_price": Decimal("8000000"),  # 8M VND
            "min_quantity": 1,
            "unit": "plan",
            "risk_level": RiskLevel.HIGH,
            "requires_approval": True
        },
        {
            "category_id": categories["Crisis Consulting & Handling"],
            "code": "EXEC_BRIEF",
            "name": "Executive Crisis Briefing",
            "description": "Generate concise executive report summarizing situation, risk, timeline, and proposed actions",
            "service_type": ServiceType.CRISIS_CONSULTING,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Executive reporting and strategic briefing",
            "workflow_template": {
                "steps": [
                    "Compile situation summary",
                    "Assess risk and impact",
                    "Create timeline of events",
                    "Propose immediate actions",
                    "Prepare executive presentation",
                    "Include action checklist"
                ]
            },
            "deliverables": {
                "items": [
                    "Executive brief document",
                    "Action checklist",
                    "Risk summary",
                    "Timeline visualization"
                ]
            },
            "estimated_duration": "2-4 hours",
            "sla_hours": 4,
            "base_price": Decimal("3000000"),  # 3M VND
            "min_quantity": 1,
            "unit": "briefing",
            "risk_level": RiskLevel.MEDIUM,
            "requires_approval": True
        },
        
        # Negative Content Monitoring
        {
            "category_id": categories["Negative Content Monitoring"],
            "code": "MONTHLY_MONITOR",
            "name": "Monthly Negative Mention Monitoring",
            "description": "Continuous monitoring of negative mentions by configured keywords and sources with regular reporting",
            "service_type": ServiceType.MONITORING,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Public content monitoring and analysis services",
            "workflow_template": {
                "steps": [
                    "Configure monitoring parameters",
                    "Collect mentions daily",
                    "Analyze sentiment and risk",
                    "Categorize by severity",
                    "Generate weekly summaries",
                    "Compile monthly report"
                ]
            },
            "deliverables": {
                "items": [
                    "Weekly monitoring reports",
                    "Monthly comprehensive analysis",
                    "Trend analysis",
                    "Risk alerts"
                ]
            },
            "estimated_duration": "Ongoing",
            "sla_hours": 168,  # Weekly reporting
            "base_price": Decimal("12000000"),  # 12M VND per month
            "min_quantity": 1,
            "unit": "month",
            "risk_level": RiskLevel.LOW,
            "requires_approval": False
        },
        {
            "category_id": categories["Negative Content Monitoring"],
            "code": "HIGH_RISK_REVIEW",
            "name": "High-Risk Mention Review",
            "description": "Detailed analysis of specific high-risk mentions including accuracy assessment and response recommendations",
            "service_type": ServiceType.MONITORING,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Content analysis and risk assessment",
            "workflow_template": {
                "steps": [
                    "Review mention content",
                    "Verify factual accuracy",
                    "Assess source credibility",
                    "Analyze potential impact",
                    "Recommend response strategy",
                    "Prepare detailed report"
                ]
            },
            "deliverables": {
                "items": [
                    "Detailed mention analysis",
                    "Accuracy assessment",
                    "Source influence report",
                    "Response recommendations"
                ]
            },
            "estimated_duration": "2-6 hours",
            "sla_hours": 6,
            "base_price": Decimal("2000000"),  # 2M VND
            "min_quantity": 1,
            "unit": "review",
            "risk_level": RiskLevel.MEDIUM,
            "requires_approval": False
        },
        
        # Legal Takedown & Correction Request
        {
            "category_id": categories["Legal Takedown & Correction Request"],
            "code": "LEGAL_TAKEDOWN",
            "name": "Legal Takedown Request Draft",
            "description": "Prepare legal and compliant takedown request drafts with evidence and legal basis",
            "service_type": ServiceType.LEGAL_TAKEDOWN,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Legal document preparation and compliance review",
            "workflow_template": {
                "steps": [
                    "Review content and evidence",
                    "Identify legal basis",
                    "Draft takedown request",
                    "Include supporting evidence",
                    "Legal compliance review",
                    "Prepare for human approval"
                ]
            },
            "deliverables": {
                "items": [
                    "Legal takedown request draft",
                    "Evidence package",
                    "Legal basis documentation",
                    "Compliance checklist"
                ]
            },
            "estimated_duration": "1-2 days",
            "sla_hours": 48,
            "base_price": Decimal("15000000"),  # 15M VND
            "min_quantity": 1,
            "unit": "request",
            "risk_level": RiskLevel.HIGH,
            "requires_approval": True
        },
        {
            "category_id": categories["Legal Takedown & Correction Request"],
            "code": "CORRECTION_REQ",
            "name": "Correction Request Draft",
            "description": "Create professional correction requests for false or misleading information",
            "service_type": ServiceType.LEGAL_TAKEDOWN,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Factual correction and clarification requests",
            "workflow_template": {
                "steps": [
                    "Identify inaccurate information",
                    "Gather correct facts",
                    "Draft correction request",
                    "Include supporting evidence",
                    "Review tone and approach",
                    "Prepare for approval"
                ]
            },
            "deliverables": {
                "items": [
                    "Correction request draft",
                    "Fact verification report",
                    "Supporting documentation",
                    "Communication strategy"
                ]
            },
            "estimated_duration": "4-8 hours",
            "sla_hours": 24,
            "base_price": Decimal("8000000"),  # 8M VND
            "min_quantity": 1,
            "unit": "request",
            "risk_level": RiskLevel.MEDIUM,
            "requires_approval": True
        },
        {
            "category_id": categories["Legal Takedown & Correction Request"],
            "code": "EVIDENCE_DOSSIER",
            "name": "Evidence Dossier",
            "description": "Comprehensive evidence collection including URLs, screenshots, metadata, and analysis",
            "service_type": ServiceType.EVIDENCE_COLLECTION,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Evidence collection and documentation services",
            "workflow_template": {
                "steps": [
                    "Collect all relevant URLs",
                    "Capture screenshots",
                    "Extract metadata",
                    "Document timestamps",
                    "Organize evidence",
                    "Prepare analysis summary"
                ]
            },
            "deliverables": {
                "items": [
                    "Evidence collection report",
                    "Screenshot archive",
                    "Metadata documentation",
                    "Timeline analysis"
                ]
            },
            "estimated_duration": "4-12 hours",
            "sla_hours": 24,
            "base_price": Decimal("5000000"),  # 5M VND
            "min_quantity": 1,
            "unit": "dossier",
            "risk_level": RiskLevel.LOW,
            "requires_approval": False
        },
        
        # Press/Media Handling
        {
            "category_id": categories["Press/Media Handling"],
            "code": "PRESS_RESPONSE",
            "name": "Press Response Draft",
            "description": "Professional press response drafts for media inquiries with appropriate tone and messaging",
            "service_type": ServiceType.PRESS_MEDIA,
            "platform": Platform.NEWS_MEDIA,
            "legal_basis": "Media relations and public communication",
            "workflow_template": {
                "steps": [
                    "Analyze media inquiry",
                    "Determine response tone",
                    "Draft response message",
                    "Review legal implications",
                    "Ensure brand consistency",
                    "Prepare for approval"
                ]
            },
            "deliverables": {
                "items": [
                    "Press response draft",
                    "Tone and messaging guide",
                    "Key points summary",
                    "Risk assessment"
                ]
            },
            "estimated_duration": "2-6 hours",
            "sla_hours": 12,
            "base_price": Decimal("6000000"),  # 6M VND
            "min_quantity": 1,
            "unit": "response",
            "risk_level": RiskLevel.HIGH,
            "requires_approval": True
        },
        
        # Community Response Planning
        {
            "category_id": categories["Community Response Planning"],
            "code": "PUBLIC_RESPONSE",
            "name": "Public Response Draft",
            "description": "Generate appropriate public responses to negative posts, comments, or articles",
            "service_type": ServiceType.COMMUNITY_RESPONSE,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Public communication and community management",
            "workflow_template": {
                "steps": [
                    "Analyze original content",
                    "Determine response approach",
                    "Draft public response",
                    "Review tone and messaging",
                    "Ensure compliance",
                    "Prepare for approval"
                ]
            },
            "deliverables": {
                "items": [
                    "Public response draft",
                    "Messaging strategy",
                    "Tone guidelines",
                    "Compliance review"
                ]
            },
            "estimated_duration": "1-3 hours",
            "sla_hours": 6,
            "base_price": Decimal("3000000"),  # 3M VND
            "min_quantity": 1,
            "unit": "response",
            "risk_level": RiskLevel.MEDIUM,
            "requires_approval": True
        },
        
        # Monthly Reputation Management
        {
            "category_id": categories["Monthly Reputation Management"],
            "code": "REPUTATION_REPORT",
            "name": "Monthly Reputation Health Report",
            "description": "Comprehensive monthly analysis of mentions, sentiment, risks, and response outcomes",
            "service_type": ServiceType.REPUTATION_MANAGEMENT,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Reputation analysis and reporting services",
            "workflow_template": {
                "steps": [
                    "Compile monthly data",
                    "Analyze sentiment trends",
                    "Assess risk patterns",
                    "Review incident outcomes",
                    "Generate insights",
                    "Prepare recommendations"
                ]
            },
            "deliverables": {
                "items": [
                    "Monthly reputation report",
                    "Sentiment analysis",
                    "Risk assessment",
                    "Action recommendations"
                ]
            },
            "estimated_duration": "1-2 days",
            "sla_hours": 48,
            "base_price": Decimal("10000000"),  # 10M VND
            "min_quantity": 1,
            "unit": "report",
            "risk_level": RiskLevel.LOW,
            "requires_approval": False
        }
    ]
    
    for service_data in services:
        existing = db.query(Service).filter(Service.code == service_data["code"]).first()
        if not existing:
            service = Service(**service_data)
            db.add(service)
    
    db.commit()
    print(f"✅ Seeded {len(services)} services")


def main():
    """Main seeding function"""
    print("🌱 Seeding Service Catalog...")
    
    db = SessionLocal()
    try:
        seed_service_categories(db)
        seed_services(db)
        print("✅ Service catalog seeding completed!")
    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
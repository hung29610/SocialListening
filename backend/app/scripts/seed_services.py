"""
Seed Services — chạy khi startup nếu bảng services trống.
Chỉ chứa dịch vụ hợp pháp, tuân thủ pháp luật.
"""
from sqlalchemy.orm import Session
from sqlalchemy import select, func


def seed_services_if_empty(db: Session):
    """Seed service categories and services if tables are empty."""
    from app.models.service import ServiceCategory, Service, ServiceType, Platform, RiskLevel

    # Check if already seeded
    count = db.execute(select(func.count(Service.id))).scalar() or 0
    if count > 0:
        return  # Already seeded

    print("🌱 Seeding service categories and services...")

    # ── Categories ────────────────────────────────────────────────────────────
    categories_data = [
        {"name": "Tư vấn & Xử lý khủng hoảng", "description": "Dịch vụ tư vấn và lập phương án xử lý khủng hoảng truyền thông"},
        {"name": "Giám sát & Phân tích", "description": "Theo dõi và phân tích đề cập trên mạng xã hội và báo chí"},
        {"name": "Pháp lý & Gỡ nội dung", "description": "Soạn thảo văn bản pháp lý, yêu cầu đính chính và gỡ bỏ nội dung vi phạm"},
        {"name": "Báo chí & Truyền thông", "description": "Quản lý quan hệ báo chí và soạn thảo phản hồi truyền thông"},
        {"name": "Bản quyền & Sở hữu trí tuệ", "description": "Bảo vệ thương hiệu và xử lý vi phạm bản quyền"},
        {"name": "Phản hồi cộng đồng", "description": "Soạn thảo phản hồi công khai và riêng tư cho khách hàng"},
        {"name": "Báo cáo & Phân tích sức khỏe thương hiệu", "description": "Báo cáo định kỳ về sức khỏe thương hiệu và hoạt động thương hiệu"},
    ]

    categories = {}
    for cat_data in categories_data:
        cat = db.execute(
            select(ServiceCategory).where(ServiceCategory.name == cat_data["name"])
        ).scalar_one_or_none()
        if not cat:
            cat = ServiceCategory(**cat_data, is_active=True)
            db.add(cat)
            db.flush()
        categories[cat_data["name"]] = cat

    db.commit()

    # ── Services ──────────────────────────────────────────────────────────────
    services_data = [
        # Tư vấn & Xử lý khủng hoảng
        {
            "category": "Tư vấn & Xử lý khủng hoảng",
            "code": "CRI-001",
            "name": "Đánh giá tình huống khủng hoảng",
            "description": "Phân tích và đánh giá mức độ nghiêm trọng của tình huống khủng hoảng truyền thông",
            "service_type": ServiceType.CRISIS_CONSULTING,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.HIGH,
            "estimated_duration": "4-8 giờ",
            "sla_hours": 8,
            "unit": "lần",
            "requires_approval": False,
        },
        {
            "category": "Tư vấn & Xử lý khủng hoảng",
            "code": "CRI-002",
            "name": "Lập phương án xử lý khủng hoảng",
            "description": "Xây dựng kế hoạch chi tiết để xử lý và kiểm soát khủng hoảng truyền thông",
            "service_type": ServiceType.CRISIS_CONSULTING,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.HIGH,
            "estimated_duration": "1-2 ngày",
            "sla_hours": 48,
            "unit": "lần",
            "requires_approval": True,
        },
        {
            "category": "Tư vấn & Xử lý khủng hoảng",
            "code": "CRI-003",
            "name": "Báo cáo nhanh cho lãnh đạo",
            "description": "Tổng hợp và trình bày tình hình khủng hoảng cho cấp lãnh đạo",
            "service_type": ServiceType.AI_REPORTING,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.MEDIUM,
            "estimated_duration": "2-4 giờ",
            "sla_hours": 4,
            "unit": "báo cáo",
            "requires_approval": False,
        },
        # Giám sát & Phân tích
        {
            "category": "Giám sát & Phân tích",
            "code": "MON-001",
            "name": "Theo dõi mention tiêu cực hằng tháng",
            "description": "Giám sát và phân tích các đề cập tiêu cực về thương hiệu trên các nền tảng mạng xã hội",
            "service_type": ServiceType.MONITORING,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.MEDIUM,
            "estimated_duration": "1 tháng",
            "sla_hours": 720,
            "unit": "tháng",
            "requires_approval": False,
        },
        {
            "category": "Giám sát & Phân tích",
            "code": "MON-002",
            "name": "Rà soát mention rủi ro cao",
            "description": "Phân tích chuyên sâu các đề cập có chỉ số rủi ro cao",
            "service_type": ServiceType.MONITORING,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.HIGH,
            "estimated_duration": "1-3 ngày",
            "sla_hours": 72,
            "unit": "lần",
            "requires_approval": False,
        },
        {
            "category": "Giám sát & Phân tích",
            "code": "MON-003",
            "name": "Theo dõi nguồn rủi ro",
            "description": "Giám sát các nguồn tin có khả năng phát sinh nội dung tiêu cực",
            "service_type": ServiceType.MONITORING,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.MEDIUM,
            "estimated_duration": "Liên tục",
            "sla_hours": None,
            "unit": "tháng",
            "requires_approval": False,
        },
        # Pháp lý & Gỡ nội dung
        {
            "category": "Pháp lý & Gỡ nội dung",
            "code": "LEG-001",
            "name": "Lập hồ sơ bằng chứng",
            "description": "Thu thập và tổ chức bằng chứng vi phạm để phục vụ quy trình pháp lý",
            "service_type": ServiceType.EVIDENCE_COLLECTION,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.HIGH,
            "estimated_duration": "1-3 ngày",
            "sla_hours": 72,
            "unit": "hồ sơ",
            "requires_approval": True,
        },
        {
            "category": "Pháp lý & Gỡ nội dung",
            "code": "LEG-002",
            "name": "Soạn yêu cầu đính chính",
            "description": "Soạn thảo văn bản yêu cầu đính chính thông tin sai lệch gửi tới cơ quan báo chí hoặc nền tảng",
            "service_type": ServiceType.LEGAL_TAKEDOWN,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.HIGH,
            "legal_basis": "Luật Báo chí 2016, Luật An ninh mạng 2018",
            "estimated_duration": "1-2 ngày",
            "sla_hours": 48,
            "unit": "văn bản",
            "requires_approval": True,
        },
        {
            "category": "Pháp lý & Gỡ nội dung",
            "code": "LEG-003",
            "name": "Soạn yêu cầu gỡ bỏ hợp pháp",
            "description": "Soạn thảo văn bản pháp lý yêu cầu gỡ bỏ nội dung vi phạm pháp luật",
            "service_type": ServiceType.LEGAL_TAKEDOWN,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.CRITICAL,
            "legal_basis": "Luật An ninh mạng 2018, Nghị định 13/2023/NĐ-CP",
            "estimated_duration": "2-5 ngày",
            "sla_hours": 120,
            "unit": "văn bản",
            "requires_approval": True,
        },
        {
            "category": "Pháp lý & Gỡ nội dung",
            "code": "LEG-004",
            "name": "Chuẩn bị bộ hồ sơ báo cáo nền tảng",
            "description": "Chuẩn bị đầy đủ hồ sơ để báo cáo vi phạm lên nền tảng mạng xã hội theo đúng quy trình",
            "service_type": ServiceType.LEGAL_TAKEDOWN,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.HIGH,
            "estimated_duration": "1-3 ngày",
            "sla_hours": 72,
            "unit": "bộ hồ sơ",
            "requires_approval": True,
        },
        # Báo chí & Truyền thông
        {
            "category": "Báo chí & Truyền thông",
            "code": "MED-001",
            "name": "Soạn phản hồi báo chí",
            "description": "Soạn thảo tuyên bố báo chí chính thức để phản hồi các thông tin tiêu cực",
            "service_type": ServiceType.PRESS_MEDIA,
            "platform": Platform.NEWS_MEDIA,
            "risk_level": RiskLevel.HIGH,
            "estimated_duration": "4-24 giờ",
            "sla_hours": 24,
            "unit": "văn bản",
            "requires_approval": True,
        },
        {
            "category": "Báo chí & Truyền thông",
            "code": "MED-002",
            "name": "Soạn công văn yêu cầu báo chí đính chính",
            "description": "Soạn thảo công văn chính thức yêu cầu cơ quan báo chí đính chính thông tin",
            "service_type": ServiceType.PRESS_MEDIA,
            "platform": Platform.NEWS_MEDIA,
            "risk_level": RiskLevel.HIGH,
            "legal_basis": "Luật Báo chí 2016 Điều 42",
            "estimated_duration": "1-2 ngày",
            "sla_hours": 48,
            "unit": "công văn",
            "requires_approval": True,
        },
        {
            "category": "Báo chí & Truyền thông",
            "code": "MED-003",
            "name": "Theo dõi bài báo liên quan",
            "description": "Giám sát các bài báo liên quan đến thương hiệu trên các tờ báo điện tử",
            "service_type": ServiceType.PRESS_MEDIA,
            "platform": Platform.NEWS_MEDIA,
            "risk_level": RiskLevel.MEDIUM,
            "estimated_duration": "Liên tục",
            "sla_hours": None,
            "unit": "tháng",
            "requires_approval": False,
        },
        # Bản quyền & Sở hữu trí tuệ
        {
            "category": "Bản quyền & Sở hữu trí tuệ",
            "code": "CPR-001",
            "name": "Theo dõi sử dụng tài sản thương hiệu",
            "description": "Giám sát việc sử dụng logo, tên thương hiệu và tài sản trí tuệ trên các nền tảng",
            "service_type": ServiceType.COPYRIGHT_PROTECTION,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.MEDIUM,
            "estimated_duration": "Liên tục",
            "sla_hours": None,
            "unit": "tháng",
            "requires_approval": False,
        },
        {
            "category": "Bản quyền & Sở hữu trí tuệ",
            "code": "CPR-002",
            "name": "Hồ sơ bằng chứng vi phạm bản quyền",
            "description": "Lập hồ sơ bằng chứng vi phạm bản quyền theo quy trình pháp lý",
            "service_type": ServiceType.COPYRIGHT_PROTECTION,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.HIGH,
            "legal_basis": "Luật Sở hữu trí tuệ 2005 (sửa đổi 2022)",
            "estimated_duration": "2-5 ngày",
            "sla_hours": 120,
            "unit": "hồ sơ",
            "requires_approval": True,
        },
        {
            "category": "Bản quyền & Sở hữu trí tuệ",
            "code": "CPR-003",
            "name": "Soạn yêu cầu xử lý vi phạm bản quyền",
            "description": "Soạn thảo văn bản pháp lý yêu cầu xử lý vi phạm bản quyền",
            "service_type": ServiceType.COPYRIGHT_PROTECTION,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.HIGH,
            "legal_basis": "Luật Sở hữu trí tuệ 2005, DMCA",
            "estimated_duration": "1-3 ngày",
            "sla_hours": 72,
            "unit": "văn bản",
            "requires_approval": True,
        },
        # Phản hồi cộng đồng
        {
            "category": "Phản hồi cộng đồng",
            "code": "COM-001",
            "name": "Soạn phản hồi công khai",
            "description": "Soạn thảo phản hồi công khai để đăng tải trên mạng xã hội hoặc website",
            "service_type": ServiceType.COMMUNITY_RESPONSE,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.MEDIUM,
            "estimated_duration": "4-8 giờ",
            "sla_hours": 8,
            "unit": "bài viết",
            "requires_approval": True,
        },
        {
            "category": "Phản hồi cộng đồng",
            "code": "COM-002",
            "name": "Soạn phản hồi riêng cho khách hàng",
            "description": "Soạn thảo phản hồi cá nhân hóa gửi riêng cho từng khách hàng hoặc nhóm khách hàng",
            "service_type": ServiceType.COMMUNITY_RESPONSE,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.MEDIUM,
            "estimated_duration": "2-4 giờ",
            "sla_hours": 4,
            "unit": "phản hồi",
            "requires_approval": False,
        },
        {
            "category": "Phản hồi cộng đồng",
            "code": "COM-003",
            "name": "Bộ hướng dẫn phản hồi bình luận",
            "description": "Xây dựng bộ hướng dẫn và mẫu phản hồi cho đội ngũ quản lý cộng đồng",
            "service_type": ServiceType.COMMUNITY_RESPONSE,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.LOW,
            "estimated_duration": "2-5 ngày",
            "sla_hours": 120,
            "unit": "bộ tài liệu",
            "requires_approval": False,
        },
        {
            "category": "Phản hồi cộng đồng",
            "code": "COM-004",
            "name": "Kế hoạch truyền thông pha loãng hợp pháp",
            "description": "Lập kế hoạch đăng tải nội dung tích cực hợp pháp để cân bằng thông tin trên mạng",
            "service_type": ServiceType.REPUTATION_MANAGEMENT,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.MEDIUM,
            "estimated_duration": "3-7 ngày",
            "sla_hours": 168,
            "unit": "kế hoạch",
            "requires_approval": True,
        },
        # Báo cáo & Phân tích sức khỏe thương hiệu
        {
            "category": "Báo cáo & Phân tích sức khỏe thương hiệu",
            "code": "RPT-001",
            "name": "Báo cáo sức khỏe thương hiệu hằng tháng",
            "description": "Báo cáo toàn diện về sức khỏe thương hiệu được lập hằng tháng",
            "service_type": ServiceType.AI_REPORTING,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.LOW,
            "estimated_duration": "2-3 ngày",
            "sla_hours": 72,
            "unit": "báo cáo",
            "requires_approval": False,
        },
        {
            "category": "Báo cáo & Phân tích sức khỏe thương hiệu",
            "code": "RPT-002",
            "name": "Theo dõi điểm sức khỏe thương hiệu",
            "description": "Giám sát chỉ số sức khỏe thương hiệu theo thời gian thực",
            "service_type": ServiceType.MONITORING,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.LOW,
            "estimated_duration": "Liên tục",
            "sla_hours": None,
            "unit": "tháng",
            "requires_approval": False,
        },
        {
            "category": "Báo cáo & Phân tích sức khỏe thương hiệu",
            "code": "RPT-003",
            "name": "Rà soát kế hoạch hành động",
            "description": "Đánh giá và cập nhật kế hoạch hành động dựa trên dữ liệu phân tích",
            "service_type": ServiceType.AI_REPORTING,
            "platform": Platform.ALL_PLATFORMS,
            "risk_level": RiskLevel.MEDIUM,
            "estimated_duration": "1-2 ngày",
            "sla_hours": 48,
            "unit": "lần",
            "requires_approval": False,
        },
    ]

    for svc_data in services_data:
        category_name = svc_data.pop("category")
        cat = categories.get(category_name)
        if not cat:
            continue

        existing = db.execute(
            select(Service).where(Service.code == svc_data["code"])
        ).scalar_one_or_none()

        if not existing:
            svc = Service(category_id=cat.id, is_active=True, **svc_data)
            db.add(svc)

    db.commit()
    print(f"✅ Seeded {len(services_data)} services across {len(categories_data)} categories")
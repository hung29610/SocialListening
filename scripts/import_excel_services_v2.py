#!/usr/bin/env python3
"""
Import Services from Excel to Database - Version 2
Workaround: Use existing categories or create via admin endpoint
"""

import requests
import json

# Configuration
BASE_URL = "https://social-listening-backend.onrender.com"
EMAIL = "admin@sociallistening.com"
PASSWORD = "Admin@123456"

def login():
    """Login and get access token"""
    login_data = {
        "username": EMAIL,
        "password": PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/login", data=login_data)
    if response.status_code == 200:
        token_data = response.json()
        return token_data["access_token"]
    else:
        print(f"Login failed: {response.status_code} - {response.text}")
        return None

def get_headers(token):
    """Get authorization headers"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def get_existing_categories_from_services(token):
    """Get categories from existing services"""
    headers = get_headers(token)
    
    try:
        response = requests.get(f"{BASE_URL}/api/services", headers=headers)
        if response.status_code == 200:
            services = response.json()
            categories = {}
            for svc in services:
                if 'category' in svc and svc['category']:
                    cat = svc['category']
                    categories[cat['name']] = cat['id']
            return categories
    except Exception as e:
        print(f"Error fetching services: {e}")
    
    return {}

def create_category_via_sql(token, name, description):
    """Create category via SQL (admin endpoint)"""
    # For now, we'll use a default category ID
    # In production, you'd need to add an admin endpoint to create categories
    return None

def map_excel_category_to_existing(excel_category):
    """Map Excel category names to existing categories"""
    mapping = {
        "I. Account cá nhân": "Legal Takedown & Correction Request",
        "II. Fanpage/ Group": "Legal Takedown & Correction Request",
        "III. Youtube, Tiktok": "Legal Takedown & Correction Request",
        "III. Website": "Legal Takedown & Correction Request",
        "XỬ LÝ QUAN HỆ BÁO CHÍ": "Press/Media Handling",
        "QUẢN TRỊ DANH TIẾNG & ĐỊNH HƯỚNG CỘNG ĐỒNG": "Community Response Planning",
        "BẢO VỆ BẢN QUYỀN THƯƠNG HIỆU": "Copyright & Brand Protection"
    }
    return mapping.get(excel_category, "Legal Takedown & Correction Request")

def map_category_to_service_type(category_name):
    """Map category name to service type"""
    mapping = {
        "I. Account cá nhân": "legal_takedown",
        "II. Fanpage/ Group": "legal_takedown",
        "III. Youtube, Tiktok": "legal_takedown",
        "III. Website": "legal_takedown",
        "XỬ LÝ QUAN HỆ BÁO CHÍ": "press_media",
        "QUẢN TRỊ DANH TIẾNG & ĐỊNH HƯỚNG CỘNG ĐỒNG": "reputation_management",
        "BẢO VỆ BẢN QUYỀN THƯƠNG HIỆU": "copyright_protection"
    }
    return mapping.get(category_name, "legal_takedown")

def map_category_to_platform(category_name, service_name):
    """Map category to platform"""
    if "Facebook" in service_name or "Fanpage" in service_name or "Group" in service_name:
        return "facebook"
    elif "Youtube" in service_name or "YouTube" in service_name:
        return "youtube"
    elif "Tiktok" in service_name or "TikTok" in service_name:
        return "tiktok"
    elif "Website" in service_name or "Blog" in service_name:
        return "website"
    elif "báo chí" in service_name.lower() or "BC" in service_name:
        return "news_media"
    else:
        return "all_platforms"

def parse_price(price_data):
    """Parse price from Excel data"""
    if not price_data:
        return None
    
    if isinstance(price_data, dict):
        price_type = price_data.get('type')
        if price_type == 'fixed':
            return price_data.get('min_price')
        elif price_type == 'range':
            # Use average of range
            min_p = price_data.get('min_price', 0)
            max_p = price_data.get('max_price', 0)
            if min_p and max_p:
                return (min_p + max_p) / 2
            return min_p or max_p
        elif price_type == 'negotiable':
            return None
        elif price_type == 'free':
            return 0
    
    return None

def determine_risk_level(price, category_name):
    """Determine risk level based on price and category"""
    if not price or price == 0:
        return "low"
    
    if price >= 20000000:  # >= 20M VND
        return "high"
    elif price >= 10000000:  # >= 10M VND
        return "medium"
    else:
        return "low"

def create_service(token, service_data):
    """Create a service"""
    headers = get_headers(token)
    
    # Check if service already exists
    try:
        response = requests.get(f"{BASE_URL}/api/services", headers=headers)
        if response.status_code == 200:
            services = response.json()
            for svc in services:
                if svc['code'] == service_data['code']:
                    print(f"  ⏭️  Service {service_data['code']} already exists")
                    return svc['id']
    except Exception as e:
        print(f"  ⚠️  Error checking existing services: {e}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/services",
            headers=headers,
            json=service_data
        )
        
        if response.status_code == 201:
            print(f"  ✅ Created service: {service_data['name'][:50]}...")
            return response.json()['id']
        else:
            print(f"  ❌ Failed to create service: {response.status_code}")
            print(f"     Response: {response.text[:200]}")
            return None
    except Exception as e:
        print(f"  ❌ Exception creating service: {e}")
        return None

def import_services_from_excel():
    """Import all services from Excel data"""
    print("🔧 Importing Services from Excel (Version 2)...")
    print()
    
    # Login
    print("🔐 Logging in...")
    token = login()
    if not token:
        print("❌ Login failed, exiting")
        return
    print("✅ Login successful")
    print()
    
    # Get existing categories
    print("📁 Fetching existing categories...")
    existing_categories = get_existing_categories_from_services(token)
    print(f"✅ Found {len(existing_categories)} existing categories:")
    for name, cat_id in existing_categories.items():
        print(f"   - {name} (ID: {cat_id})")
    print()
    
    # Load Excel data
    with open('data/mhc_parsed_detailed.json', 'r', encoding='utf-8') as f:
        excel_data = json.load(f)
    
    total_created = 0
    total_skipped = 0
    
    # Process each sheet
    for sheet_name, sheet_data in excel_data['sheets'].items():
        print(f"📋 Processing sheet: {sheet_name}")
        print(f"   Total services in sheet: {sheet_data['total_services']}")
        print()
        
        # Group services by category
        services_by_category = {}
        for service in sheet_data['services']:
            category = service.get('category', 'Uncategorized')
            if category not in services_by_category:
                services_by_category[category] = []
            services_by_category[category].append(service)
        
        # Process each category
        for excel_category, services in services_by_category.items():
            print(f"  📁 Excel Category: {excel_category}")
            
            # Map to existing category
            mapped_category = map_excel_category_to_existing(excel_category)
            category_id = existing_categories.get(mapped_category)
            
            if not category_id:
                print(f"    ❌ No matching category found for: {excel_category}")
                print(f"       Tried to map to: {mapped_category}")
                continue
            
            print(f"    ✅ Mapped to: {mapped_category} (ID: {category_id})")
            
            # Process each service
            for idx, service in enumerate(services, 1):
                service_name = service.get('Dịch vụ định kỳ')
                if not service_name or service_name == 'Dịch vụ định kỳ':
                    continue
                
                # Generate service code
                service_code = f"EXCEL_{excel_category[:10].upper().replace(' ', '_').replace('.', '')}_{idx}"
                
                # Parse price
                price_data = service.get('Đơn giá\n(Chưa bao gồm VAT)')
                base_price = parse_price(price_data)
                
                # Determine service type and platform
                service_type = map_category_to_service_type(excel_category)
                platform = map_category_to_platform(excel_category, service_name)
                
                # Determine risk level
                risk_level = determine_risk_level(base_price, excel_category)
                
                # Parse time estimate
                time_estimate = service.get('Thời gian dự tính', 'Thỏa thuận')
                
                # Create service data
                service_data = {
                    "category_id": category_id,
                    "code": service_code,
                    "name": service_name[:500],  # Limit to 500 chars
                    "description": service.get('Chi tiết công việc', '')[:1000] if service.get('Chi tiết công việc') else '',
                    "service_type": service_type,
                    "platform": platform,
                    "legal_basis": "Dịch vụ bảo vệ danh tiếng và xử lý khủng hoảng hợp pháp",
                    "workflow_template": {
                        "steps": [
                            "Tiếp nhận yêu cầu",
                            "Phân tích tình huống",
                            "Thực hiện dịch vụ",
                            "Báo cáo kết quả"
                        ]
                    },
                    "deliverables": {
                        "items": [
                            "Báo cáo chi tiết",
                            "Bằng chứng thực hiện"
                        ]
                    },
                    "estimated_duration": time_estimate,
                    "sla_hours": 48,  # Default 48 hours
                    "base_price": base_price,
                    "min_quantity": 1,
                    "unit": service.get('Đơn vị', 'Dịch vụ'),
                    "risk_level": risk_level,
                    "requires_approval": True,
                    "is_active": True
                }
                
                # Create service
                service_id = create_service(token, service_data)
                if service_id:
                    total_created += 1
                else:
                    total_skipped += 1
            
            print()
    
    print(f"✅ Import completed!")
    print(f"   Created: {total_created} services")
    print(f"   Skipped: {total_skipped} services")

if __name__ == "__main__":
    import_services_from_excel()

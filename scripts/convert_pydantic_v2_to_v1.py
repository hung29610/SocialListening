#!/usr/bin/env python3
"""
Convert all Pydantic v2 syntax to v1 syntax in backend
"""

import os
import re

def convert_file(filepath):
    """Convert a single file from Pydantic v2 to v1"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Convert .model_dump() to .dict()
    content = re.sub(r'\.model_dump\(\)', '.dict()', content)
    content = re.sub(r'\.model_dump\(exclude_unset=True\)', '.dict(exclude_unset=True)', content)
    
    # Convert .model_validate() to .from_orm()
    content = re.sub(r'\.model_validate\(', '.from_orm(', content)
    
    # Convert model_config to Config class
    content = re.sub(
        r'model_config = \{\s*"from_attributes": True\s*\}',
        'class Config:\n        orm_mode = True',
        content
    )
    
    content = re.sub(
        r'model_config = ConfigDict\(from_attributes=True\)',
        'class Config:\n        orm_mode = True',
        content
    )
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    print("Converting Pydantic v2 to v1 syntax...")
    print()
    
    api_dir = "../backend/app/api"
    fixed_count = 0
    
    for filename in os.listdir(api_dir):
        if filename.endswith('.py') and filename != '__init__.py':
            filepath = os.path.join(api_dir, filename)
            if convert_file(filepath):
                print(f"✅ Fixed: {filename}")
                fixed_count += 1
            else:
                print(f"⏭️  Skipped: {filename}")
    
    print()
    print(f"Fixed {fixed_count} files")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Fix all schema Config classes to use Pydantic v1 syntax
"""

import os
import re

def fix_schema_file(filepath):
    """Fix a single schema file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Replace from_attributes = True with orm_mode = True
    content = re.sub(
        r'from_attributes = True',
        'orm_mode = True',
        content
    )
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    print("Fixing schema Config classes...")
    print()
    
    schemas_dir = "../backend/app/schemas"
    fixed_count = 0
    
    for filename in os.listdir(schemas_dir):
        if filename.endswith('.py') and filename != '__init__.py':
            filepath = os.path.join(schemas_dir, filename)
            if fix_schema_file(filepath):
                print(f"✅ Fixed: {filename}")
                fixed_count += 1
            else:
                print(f"⏭️  Skipped: {filename}")
    
    print()
    print(f"Fixed {fixed_count} files")

if __name__ == "__main__":
    main()

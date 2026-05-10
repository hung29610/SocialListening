#!/usr/bin/env python3
"""
Fix All API Return Statements
Automatically add .model_validate() to all return statements
"""

import os
import re

API_DIR = "backend/app/api"

# Patterns to fix
PATTERNS = [
    # Single object returns
    (r'(\s+)return (source|keyword|mention|alert|incident|report|service|category|request|group|user|setting)$',
     r'\1return \2Response.model_validate(\2)'),
    
    # List returns
    (r'(\s+)return (sources|keywords|mentions|alerts|incidents|reports|services|categories|requests|groups|users|settings)$',
     r'\1return [\2Response.model_validate(item) for item in \2]'),
]

def fix_file(filepath):
    """Fix a single file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    for pattern, replacement in PATTERNS:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    print("=" * 80)
    print("FIXING ALL API RETURN STATEMENTS")
    print("=" * 80)
    print()
    
    fixed_count = 0
    
    for filename in os.listdir(API_DIR):
        if filename.endswith('.py') and filename != '__init__.py':
            filepath = os.path.join(API_DIR, filename)
            if fix_file(filepath):
                print(f"✅ Fixed: {filename}")
                fixed_count += 1
            else:
                print(f"⏭️  Skipped: {filename} (no changes needed)")
    
    print()
    print("=" * 80)
    print(f"DONE! Fixed {fixed_count} files")
    print("=" * 80)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Fix all schema files to add Optional[datetime] for updated_at
"""

import os
import re

def fix_schema_file(filepath):
    """Fix a single schema file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Check if already has Optional import
        if 'from typing import' in content and 'Optional' not in content:
            # Add Optional to existing typing import
            content = re.sub(
                r'from typing import ([^\n]+)',
                r'from typing import \1, Optional',
                content
            )
        elif 'from typing import' not in content and 'from datetime import datetime' in content:
            # Add new typing import
            content = content.replace(
                'from datetime import datetime',
                'from typing import Optional\nfrom datetime import datetime'
            )
        
        # Fix updated_at fields that don't have Optional
        # Pattern: updated_at: datetime (not Optional)
        content = re.sub(
            r'(\s+)updated_at:\s*datetime\s*$',
            r'\1updated_at: Optional[datetime] = None',
            content,
            flags=re.MULTILINE
        )
        
        # Also fix if it's just "datetime" without Optional
        content = re.sub(
            r'(\s+)updated_at:\s*datetime\s*\n',
            r'\1updated_at: Optional[datetime] = None\n',
            content
        )
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Fixed: {filepath}")
            return True
        else:
            print(f"⏭️  Skipped (no changes needed): {filepath}")
            return False
            
    except Exception as e:
        print(f"❌ Error fixing {filepath}: {e}")
        return False

def main():
    print("=" * 60)
    print("FIXING ALL SCHEMA FILES")
    print("=" * 60)
    print()
    
    schemas_dir = "backend/app/schemas"
    
    if not os.path.exists(schemas_dir):
        print(f"❌ Directory not found: {schemas_dir}")
        return
    
    fixed_count = 0
    skipped_count = 0
    
    # Fix all schema files
    for filename in os.listdir(schemas_dir):
        if filename.endswith('.py') and filename != '__init__.py':
            filepath = os.path.join(schemas_dir, filename)
            if fix_schema_file(filepath):
                fixed_count += 1
            else:
                skipped_count += 1
    
    print()
    print("=" * 60)
    print(f"DONE! Fixed {fixed_count} files, skipped {skipped_count} files")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Review changes: git diff")
    print("2. Deploy: deploy.bat")
    print("3. Test: python scripts/test_all_endpoints.py")

if __name__ == "__main__":
    main()

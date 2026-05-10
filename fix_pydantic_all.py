"""
Fix all Pydantic v2 to v1 in schemas
"""
import os
import re

# Get absolute path to backend
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
schemas_dir = os.path.join(backend_dir, 'app', 'schemas')

def convert_file(filepath):
    """Convert a single file from Pydantic v2 to v1"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Replace model_config = {'from_attributes': True}
    content = re.sub(
        r"model_config = \{'from_attributes': True\}",
        "class Config:\n        orm_mode = True",
        content
    )
    
    # Replace model_config = {"from_attributes": True}
    content = re.sub(
        r'model_config = \{"from_attributes": True\}',
        "class Config:\n        orm_mode = True",
        content
    )
    
    # Replace .model_validate( with .from_orm(
    content = re.sub(
        r'\.model_validate\(',
        '.from_orm(',
        content
    )
    
    # Replace .model_dump( with .dict(
    content = re.sub(
        r'\.model_dump\(',
        '.dict(',
        content
    )
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    print("Converting all Pydantic v2 to v1...")
    
    converted = []
    
    # Convert all schema files
    for filename in os.listdir(schemas_dir):
        if filename.endswith('.py') and filename != '__init__.py':
            filepath = os.path.join(schemas_dir, filename)
            if convert_file(filepath):
                converted.append(filepath)
                print(f"✅ {filename}")
    
    # Convert API files
    api_dir = os.path.join(backend_dir, 'app', 'api')
    for filename in os.listdir(api_dir):
        if filename.endswith('.py') and filename != '__init__.py':
            filepath = os.path.join(api_dir, filename)
            if convert_file(filepath):
                converted.append(filepath)
                print(f"✅ api/{filename}")
    
    print(f"\n✅ Converted {len(converted)} files")
    
    if converted:
        print("\nConverted files:")
        for f in converted:
            print(f"  - {os.path.relpath(f, backend_dir)}")

if __name__ == "__main__":
    main()

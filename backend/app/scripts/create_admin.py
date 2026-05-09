"""
Script to create an admin user
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User


async def create_admin():
    """Create admin user if not exists"""
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    async with AsyncSessionLocal() as session:
        # Check if admin exists
        result = await session.execute(
            select(User).where(User.email == "admin@example.com")
        )
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            print("✅ Admin user already exists")
            print(f"   Email: {existing_admin.email}")
            return
        
        # Create admin user
        admin = User(
            email="admin@example.com",
            hashed_password=get_password_hash("admin123"),
            full_name="System Administrator",
            is_active=True,
            is_superuser=True
        )
        
        session.add(admin)
        await session.commit()
        await session.refresh(admin)
        
        print("✅ Admin user created successfully!")
        print(f"   Email: {admin.email}")
        print(f"   Password: admin123")
        print(f"   ID: {admin.id}")
        print("\n⚠️  Please change the password after first login!")


if __name__ == "__main__":
    asyncio.run(create_admin())

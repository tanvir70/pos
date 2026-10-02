#!/usr/bin/env python3
"""
Messrs. Rajib Enterprise POS - Administrative Password Reset Utility
Usage:
    python reset_password.py <username> <new_password>
Example:
    python reset_password.py owner 'Rajib@Agro2026!'
"""
import sys
import asyncio
from sqlalchemy import select
from app.database import async_session_maker
from app.models.user import AppUser
from app.services.auth_service import hash_password

async def update_user_password(username: str, new_pass: str) -> bool:
    async with async_session_maker() as session:
        stmt = select(AppUser).where(AppUser.username == username.strip())
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            print(f"[ERROR] User '{username}' does not exist in the database.")
            return False

        user.password_hash = hash_password(new_pass)
        await session.commit()
        print(f"[SUCCESS] Password for user '{username}' has been updated successfully.")
        return True

def main():
    if len(sys.argv) < 3:
        print("Usage: python reset_password.py <username> <new_password>")
        sys.exit(1)

    username = sys.argv[1].strip()
    new_password = sys.argv[2]

    if len(new_password) < 6:
        print("[ERROR] Password must be at least 6 characters long.")
        sys.exit(1)

    success = asyncio.run(update_user_password(username, new_password))
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

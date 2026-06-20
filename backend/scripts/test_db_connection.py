import asyncio
import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

# Load .env from project root
ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL not found in .env")

# asyncpg expects a DSN without the SQLAlchemy +asyncpg driver spec
DSN = DATABASE_URL.replace("+asyncpg", "")

async def test():
    try:
        conn = await asyncpg.connect(dsn=DSN)
        await conn.execute("SELECT 1")
        await conn.close()
        print("Connection successful")
    except Exception as e:
        print("Connection failed:", e)

if __name__ == '__main__':
    asyncio.run(test())

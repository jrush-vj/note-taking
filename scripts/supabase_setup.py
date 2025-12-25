import os
import sys
from pathlib import Path


def main() -> int:
    db_url = os.getenv("SUPABASE_DB_URL")
    schema_path = Path(__file__).resolve().parents[1] / "supabase" / "schema.sql"

    if not schema_path.exists():
        print(f"schema.sql not found at: {schema_path}")
        return 1

    sql = schema_path.read_text(encoding="utf-8")

    if not db_url:
        print("SUPABASE_DB_URL is not set.")
        print("\nOption A (automatic): set SUPABASE_DB_URL and re-run:")
        print("  export SUPABASE_DB_URL='postgres://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres'")
        print("  python scripts/supabase_setup.py")
        print("\nOption B (manual): paste the SQL from supabase/schema.sql into the Supabase SQL editor.")
        return 2

    try:
        import psycopg
    except Exception:
        print("Missing dependency: psycopg")
        print("Install with: pip install psycopg[binary]")
        return 3

    print("Applying supabase/schema.sql ...")

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

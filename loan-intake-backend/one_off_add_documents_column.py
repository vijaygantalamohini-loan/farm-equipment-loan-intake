from sqlalchemy import text
from database import engine

if __name__ == "__main__":
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE loan_applications ADD COLUMN documents_and_consents_data TEXT"))
            print("Added column documents_and_consents_data to loan_applications.")
        except Exception as e:
            print(f"No change (possibly already exists): {e}")

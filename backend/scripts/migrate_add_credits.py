"""
Database migration script for adding credits system
Run this script to add the credits column to existing users and create the credit_transactions table

Usage:
    cd /home/lsnn/github/banana-slides-1/backend
    source ../.venv/bin/activate
    python scripts/migrate_add_credits.py
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import db, User
from models.credit_transaction import CreditTransaction
from sqlalchemy import text, inspect

def migrate():
    app = create_app()
    
    with app.app_context():
        print("Starting credits system migration...")
        
        # Check if credits column exists
        inspector = inspect(db.engine)
        user_columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'credits' not in user_columns:
            print("Adding 'credits' column to users table...")
            # SQLite doesn't support ALTER TABLE ADD COLUMN with NOT NULL without default
            # But since we have a default in the model, this should work
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 50'))
                conn.commit()
            print("✓ Added 'credits' column")
        else:
            print("✓ 'credits' column already exists")
        
        # Create credit_transactions table if not exists
        tables = inspector.get_table_names()
        if 'credit_transactions' not in tables:
            print("Creating 'credit_transactions' table...")
            CreditTransaction.__table__.create(db.engine)
            print("✓ Created 'credit_transactions' table")
        else:
            print("✓ 'credit_transactions' table already exists")
        
        # Initialize existing users with signup bonus transaction if they don't have one
        users_without_bonus = (
            db.session.query(User)
            .outerjoin(CreditTransaction, 
                       (CreditTransaction.user_id == User.id) & 
                       (CreditTransaction.transaction_type == 'SIGNUP_BONUS'))
            .filter(CreditTransaction.id.is_(None))
            .all()
        )
        
        if users_without_bonus:
            print(f"Creating signup bonus transactions for {len(users_without_bonus)} existing users...")
            for user in users_without_bonus:
                # Set credits to 50 if not already set
                if user.credits is None or user.credits == 0:
                    user.credits = 50
                
                # Create signup bonus transaction
                tx = CreditTransaction(
                    user_id=user.id,
                    amount=50,
                    balance_after=user.credits,
                    transaction_type='SIGNUP_BONUS',
                    description='Welcome bonus credits (migration)'
                )
                db.session.add(tx)
            
            db.session.commit()
            print(f"✓ Created signup bonus transactions for {len(users_without_bonus)} users")
        else:
            print("✓ All users already have signup bonus transactions")
        
        print("\n✅ Migration completed successfully!")
        print(f"   - Total users: {User.query.count()}")
        print(f"   - Total transactions: {CreditTransaction.query.count()}")

if __name__ == '__main__':
    migrate()

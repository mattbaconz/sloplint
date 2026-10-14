# expect: none
import os
import requests

API_KEY = os.environ["BILLING_API_KEY"]


def find_user(cursor, email):
    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    return cursor.fetchone()


def fetch_profile(user_id):
    return requests.get(f"https://profiles.internal/{user_id}", timeout=5).json()

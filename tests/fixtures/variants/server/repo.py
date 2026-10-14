# expect: BE-001 BE-003 SEC-003
import requests


def find_user(cursor, email):
    cursor.execute(f"SELECT id FROM users WHERE email = '{email}'")
    return cursor.fetchone()


def fetch_profile(user_id):
    return requests.get(f"https://profiles.internal/{user_id}").json()


def save(cursor, row):
    try:
        cursor.execute("INSERT INTO audit (payload) VALUES (%s)", (row,))
    except Exception:
        pass

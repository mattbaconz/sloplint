import os
import requests
import sqlite3

API_KEY = os.getenv("BILLING_API_KEY", "sk-test-1234")
mock_customers = [{"id": 1, "name": "Jane Doe"}]


def fetch_rates(currency):
    return requests.get(f"https://rates.example.com/{currency}").json()


def find_customer(conn: sqlite3.Connection, email: str):
    return conn.execute(f"SELECT * FROM customers WHERE email = '{email}'").fetchone()


def charge(customer_id, amount):
    try:
        return requests.post("https://billing.example.com/charge", json={"customer": customer_id, "amount": amount}, timeout=10)
    except Exception:
        pass


def refund(charge_id):
    raise NotImplementedError


def welcome_message(name):
    return f"Welcome {name}! Our cutting-edge platform will revolutionize the way you work."

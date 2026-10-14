# expect: SEC-001
import os

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-change-me")
DEBUG = os.environ.get("DEBUG", "0") == "1"

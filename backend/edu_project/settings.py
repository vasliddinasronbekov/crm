# edu_project/settings.py
from pathlib import Path
from datetime import timedelta
from decouple import config, Csv
import dj_database_url
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# -------------
# Secrets / env
# -------------
SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=False, cast=bool)

# ALLOWED_HOSTS: Allow all for development/testing
ALLOWED_HOSTS = ['*']  # Allow all hosts for development
# -----------------------
# INSTALLED APPS (local + 3rd party)
# -----------------------
INSTALLED_APPS = [
    # django builtins
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    #GameFication
    "gamification",
    # third-party
    "rest_framework",
    "rest_framework.authtoken",
    "drf_spectacular",
    "corsheaders",
    "whitenoise.runserver_nostatic",
    "rest_framework_simplejwt.token_blacklist",
    "django_extensions",
    "django_celery_beat",  # Celery Beat scheduler
    "django_celery_results",  # Celery results backend
    # local apps (qo'shgan app nomlaringga moslab tekshir)
    "users",
    "task",
    "student_profile",
    "crm",
    "messaging",
    "hr",
    "analytics",
    "core",
    "channels",
    "ai",
    "social",  # Social Learning features
    "subscriptions",  # Subscription & Payment System
]

# -----------------------
# MIDDLEWARE
# -----------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # whitenoise ensures static files served efficiently in many deployments
    "whitenoise.middleware.WhiteNoiseMiddleware",
    # CORS must be before CommonMiddleware
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # Locale middleware for i18n (must be after SessionMiddleware)
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# -----------------------
# URL / WSGI
# -----------------------
ROOT_URLCONF = "edu_project.urls"
WSGI_APPLICATION = "edu_project.wsgi.application"
ASGI_APPLICATION = "edu_project.asgi.application"  # WebSocket support via Channels

# -----------------------
# DATABASE - PostgreSQL + SQLite3 Combo
# -----------------------
# Primary database (PostgreSQL for production, SQLite for dev)
DATABASE_URL = config(
    "DATABASE_URL",
    default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
)
DATABASES = {
    "default": dj_database_url.parse(DATABASE_URL, conn_max_age=600),
    # SQLite for analytics/logs (optional, high-speed read operations)
    "analytics": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "analytics.sqlite3",
    }
}

# -----------------------
# AUTH
# -----------------------
# Agar custom User modeli bo'lsa:
AUTH_USER_MODEL = "users.User"

# -----------------------
# TEMPLATES (admin uchun kerak)
# -----------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],  # agar bor bo'lsa
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",  # admin uchun kerak
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# -----------------------
# Password validation
# -----------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# -----------------------
# Internationalization / Time
# -----------------------
from django.utils.translation import gettext_lazy as _

LANGUAGE_CODE = "uz"  # Default language
TIME_ZONE = config("TIME_ZONE", default="Asia/Tashkent")
USE_I18N = True
USE_L10N = True
USE_TZ = True

# Supported languages
LANGUAGES = [
    ('uz', _('Uzbek')),
    ('ru', _('Russian')),
    ('en', _('English')),
]

# Locale paths for translation files
LOCALE_PATHS = [
    BASE_DIR / 'locale',
]

# -----------------------
# Static & Media
# -----------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]  # agar loyihada mavjud bo'lsa

# whitenoise storage for compressed manifest (good for prod)
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# -----------------------
# Site Configuration
# -----------------------
SITE_URL = config("SITE_URL", default="https://api.crmai.uz")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# -----------------------
# CORS / CSRF
# -----------------------
# Development: Allow all origins (controlled by CORS_ALLOW_ALL_ORIGINS below)
# For production: Set CORS_ALLOW_ALL_ORIGINS=False in .env and uncomment specific origins
CORS_ALLOWED_ORIGINS = [
    'https://*',
    'http://*',
    'http://localhost:3000',
    'https://localhost:3000',
    'https://api.crmai.uz',
    'https://localhost:8008',
]


# Quick dev convenience - ALLOWS ALL ORIGINS when True (development only)
# IMPORTANT: Set CORS_ALLOW_ALL_ORIGINS=False in production .env
CORS_ALLOW_ALL_ORIGINS = config("CORS_ALLOW_ALL_ORIGINS", default=True, cast=bool)

# Allow Authorization header across CORS
from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
    "x-requested-with",
]

# CSRF trusted origins - Allows all hosts for development
# The wildcards 'https://*' and 'http://*' allow all origins
# For production: Remove wildcards and specify exact domains
CSRF_TRUSTED_ORIGINS = [
    'https://*',  # Allow all HTTPS origins (development)
    'http://*',   # Allow all HTTP origins (development)
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1',
    'https://127.0.0.1',
]

# -----------------------
# Django Rest Framework
# -----------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": config("PAGE_SIZE", default=20, cast=int),
}

# -----------------------
# Simple JWT
# -----------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=config("JWT_ACCESS_MINUTES", default=60, cast=int)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=config("JWT_REFRESH_DAYS", default=7, cast=int)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "UPDATE_LAST_LOGIN": True,
}

# NOTE: to use blacklist, ensure 'rest_framework_simplejwt.token_blacklist' in INSTALLED_APPS
# and run migrations: python manage.py migrate

# -----------------------
# drf_spectacular (swagger/openapi)
# -----------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "Edu API",
    "DESCRIPTION": "O'quv markazining REST API",
    "VERSION": "1.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # Disable enum postprocessing to avoid name-collision noise in deploy checks.
    "POSTPROCESSING_HOOKS": [],
}

# -----------------------
# REDIS Configuration
# -----------------------
REDIS_URL = config("REDIS_URL", default="redis://127.0.0.1:6379/1")

# CACHES (Redis)
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "CONNECTION_POOL_CLASS_KWARGS": {
                "max_connections": 50,
                "retry_on_timeout": True,
            }
        },
        "KEY_PREFIX": "eduvoice",
        "TIMEOUT": 300,  # 5 minutes default
    }
}

# SESSION BACKEND (Redis for distributed sessions)
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# CHANNELS (WebSocket) Configuration
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [config("REDIS_URL", default="redis://127.0.0.1:6379/1")],
            "capacity": 1500,  # Max messages to store
            "expiry": 10,      # Message expiry time in seconds
        },
    },
}

# -----------------------
# EMAIL (dev)
# -----------------------
EMAIL_BACKEND = config("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = config("EMAIL_HOST", default="")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="webmaster@localhost")

# -----------------------
# Security (production)
# -----------------------
# Production security settings
if not DEBUG:
    # Behind proxy (Heroku/nginx/load balancer)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)

    # HSTS (HTTP Strict Transport Security)
    SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=31536000, cast=int)  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # XSS and Content Type protection
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

    # Additional security headers
    SECURE_REFERRER_POLICY = 'same-origin'
else:
    # Development-friendly defaults
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    SECURE_SSL_REDIRECT = False

# -----------------------
# Logging (console + file)
# -----------------------
LOG_LEVEL = config("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "%(levelname)s %(asctime)s %(module)s %(message)s"},
        "simple": {"format": "%(levelname)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
        # optional file handler (rotate if needed)
        "file": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(BASE_DIR / "logs" / "django.log"),
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {"handlers": ["console", "file"], "level": LOG_LEVEL, "propagate": True},
        "django.request": {"handlers": ["console", "file"], "level": "ERROR", "propagate": False},
    },
}

# ensure logs dir exists (only creates on import; safe to remove if undesirable)
try:
    os.makedirs(BASE_DIR / "logs", exist_ok=True)
except Exception:
    pass

# -----------------------
# Misc helpers / 3rd party
# -----------------------
# If you use whitenoise, consider adding this:
# STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# -------------
# Quick notes
# -------------
# 1) .env example (project root):
#    SECRET_KEY=... 
#    DEBUG=True
#    DATABASE_URL=postgres://user:pass@host:5432/dbname
#    ALLOWED_HOSTS=localhost,127.0.0.1,a1effd6aac76.ngrok-free.app
#    CORS_ALLOWED_ORIGINS=http://localhost:8000,https://a1effd6aac76.ngrok-free.app
#    CSRF_TRUSTED_ORIGINS=https://a1effd6aac76.ngrok-free.app
#    REDIS_URL=redis://127.0.0.1:6379/1
#
# 2) Install required packages:
#    pip install python-decouple dj-database-url django-cors-headers whitenoise django-redis djangorestframework drf-spectacular djangorestframework-simplejwt
#
# 3) After changing INSTALLED_APPS or SIMPLE_JWT settings:
#    python manage.py makemigrations
#    python manage.py migrate
#
# 4) If you enabled token rotation & blacklist:
#    python manage.py migrate rest_framework_simplejwt
#
# 5) For production: set DEBUG=False, configure ALLOWED_HOSTS, use HTTPS, and set secure cookie flags.


CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'django-db'  # Use Django DB for results
CELERY_CACHE_BACKEND = 'default'

# Celery Beat Configuration
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Celery timezone
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True

# Custom test runner
TEST_RUNNER = 'edu_project.test_runner.VectorTestRunner'

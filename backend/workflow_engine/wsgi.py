"""
WSGI config for workflow_engine project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os
import threading
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workflow_engine.settings")

application = get_wsgi_application()

def warmup_db():
    from django.db import connection
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        print("Database warmup successful. Neon DB is awake!")
    except Exception as e:
        print(f"Database warmup failed: {e}")

threading.Thread(target=warmup_db, daemon=True).start()

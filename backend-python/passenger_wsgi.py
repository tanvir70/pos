import sys
import os

# Insert backend-python directory into sys.path
sys.path.insert(0, os.path.dirname(__file__))

# Auto-repair Bengali encoding on Passenger worker initialization if corrupted
try:
    from app.scripts.fix_utf8_bangla import auto_repair_bangla_if_needed
    auto_repair_bangla_if_needed()
except Exception as e:
    print(f"[Passenger Startup Notice] Bangla auto-check: {e}")

from a2wsgi import ASGIMiddleware
from app.main import app

# Expose WSGI application callable for cPanel Phusion Passenger
application = ASGIMiddleware(app)

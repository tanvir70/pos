import sys
import os

# Insert backend-python directory into sys.path
sys.path.insert(0, os.path.dirname(__file__))

from a2wsgi import ASGIMiddleware
from app.main import app

# Expose WSGI application callable for cPanel Phusion Passenger
application = ASGIMiddleware(app)

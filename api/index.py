import os
import sys

# Ajoute le dossier racine au PYTHONPATH pour permettre l'importation de app
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import app

"""
VINHO – Backend Flask

Lancer en local :
    pip install flask
    ADMIN_PASSWORD="vihno123" python app.py          (Linux / Mac)
    set ADMIN_PASSWORD=ton_mot_de_passe && python app.py      (Windows)

Pages :
    /            -> formulaire d'inscription (public)
    /dashboard   -> gestion des inscriptions (mot de passe)
"""

import hmac
import os
import re
import sqlite3
from functools import wraps

from flask import Flask, Response, g, jsonify, request, send_from_directory

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "vinho.db")
ADMIN_DIR = os.path.join(BASE_DIR, "admin")

# Identifiants du dashboard (le mot de passe est OBLIGATOIRE, via variable d'environnement)
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

PRIX = {"Garçon": 2500, "Fille": 1500}
TAILLES = {"XS", "S", "M", "L", "XL", "XXL"}
STATUTS = {"attente", "confirme"}

# Les fichiers publics (index.html, style.css, script.js, dashboard.js) sont dans /static
app = Flask(__name__, static_folder="static", static_url_path="")


# ---------- Base de données ----------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS inscriptions (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                nom        TEXT NOT NULL,
                prenom     TEXT NOT NULL,
                telephone  TEXT NOT NULL,
                sexe       TEXT NOT NULL,
                taille     TEXT NOT NULL,
                reference  TEXT NOT NULL UNIQUE COLLATE NOCASE,
                montant    INTEGER NOT NULL,
                statut     TEXT NOT NULL DEFAULT 'attente',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )


# ---------- Utilitaires ----------

def clean(value, max_len=80):
    """Supprime les espaces en trop et limite la longueur."""
    return " ".join(str(value or "").split())[:max_len]


def normalize_phone(raw):
    """Renvoie 8 chiffres (numéro togolais) ou None."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("228") and len(digits) == 11:
        digits = digits[3:]
    return digits if len(digits) == 8 else None


def admin_required(view):
    """Protège une route avec une authentification HTTP Basic."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        auth = request.authorization
        if ADMIN_PASSWORD and auth and auth.password is not None:
            user_ok = hmac.compare_digest(auth.username.encode(), ADMIN_USER.encode())
            pass_ok = hmac.compare_digest(auth.password.encode(), ADMIN_PASSWORD.encode())
            if user_ok and pass_ok:
                return view(*args, **kwargs)

        return Response(
            "Accès réservé à l'organisation.",
            401,
            {"WWW-Authenticate": 'Basic realm="Vinho admin"'},
        )

    return wrapped


def row_to_dict(row):
    return {key: row[key] for key in row.keys()}


# ---------- Pages ----------

@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/dashboard")
@admin_required
def dashboard():
    return send_from_directory(ADMIN_DIR, "dashboard.html")


# ---------- API ----------

@app.post("/api/inscriptions")
def create_inscription():
    data = request.get_json(silent=True) or {}

    nom = clean(data.get("nom"))
    prenom = clean(data.get("prenom"))
    sexe = clean(data.get("sexe"), 10)
    taille = clean(data.get("taille"), 5)
    reference = clean(data.get("reference"), 60)
    telephone = normalize_phone(data.get("telephone"))

    if not nom or not prenom:
        return jsonify(error="Le nom et le prénom sont obligatoires."), 400
    if not telephone:
        return jsonify(error="Numéro de téléphone invalide (8 chiffres)."), 400
    if sexe not in PRIX:
        return jsonify(error="Catégorie invalide."), 400
    if taille not in TAILLES:
        return jsonify(error="Taille de maillot invalide."), 400
    if len(reference) < 4:
        return jsonify(error="Référence TMoney invalide."), 400

    # Le montant est calculé ICI, jamais envoyé par le navigateur
    montant = PRIX[sexe]

    db = get_db()
    try:
        cursor = db.execute(
            """
            INSERT INTO inscriptions (nom, prenom, telephone, sexe, taille, reference, montant)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (nom, prenom, telephone, sexe, taille, reference, montant),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify(error="Cette référence TMoney a déjà été utilisée."), 409

    return jsonify(id=cursor.lastrowid, montant=montant), 201


@app.get("/api/inscriptions")
@admin_required
def list_inscriptions():
    rows = get_db().execute("SELECT * FROM inscriptions ORDER BY id DESC").fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.patch("/api/inscriptions/<int:inscription_id>")
@admin_required
def update_statut(inscription_id):
    statut = (request.get_json(silent=True) or {}).get("statut")
    if statut not in STATUTS:
        return jsonify(error="Statut invalide."), 400

    db = get_db()
    cursor = db.execute(
        "UPDATE inscriptions SET statut = ? WHERE id = ?", (statut, inscription_id)
    )
    db.commit()

    if cursor.rowcount == 0:
        return jsonify(error="Inscription introuvable."), 404
    return jsonify(ok=True)


@app.delete("/api/inscriptions/<int:inscription_id>")
@admin_required
def delete_inscription(inscription_id):
    db = get_db()
    cursor = db.execute("DELETE FROM inscriptions WHERE id = ?", (inscription_id,))
    db.commit()

    if cursor.rowcount == 0:
        return jsonify(error="Inscription introuvable."), 404
    return jsonify(ok=True)


# ---------- Démarrage ----------

init_db()

if __name__ == "__main__":
    if not ADMIN_PASSWORD:
        print("⚠️  ADMIN_PASSWORD n'est pas défini : le dashboard sera inaccessible.")
    app.run(debug=True)

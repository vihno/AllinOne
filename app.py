"""
VINHO – Backend Flask & API
Gestion des inscriptions pour la rencontre de football Vinho.

Compatible avec :
- Exécution locale (SQLite vinho.db)
- Déploiement serverless sur Vercel (stockage /tmp/vinho.db et réécriture vers api/index.py)
"""

import hmac
import os
import re
import shutil
import sqlite3
from functools import wraps

from flask import Flask, Response, g, jsonify, request, send_from_directory

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
ADMIN_DIR = os.path.join(BASE_DIR, "admin")

# Détection de l'environnement Vercel Serverless
IS_VERCEL = bool(os.environ.get("VERCEL"))

# Sur Vercel, le disque est en lecture seule sauf le dossier /tmp
if IS_VERCEL:
    DB_PATH = os.path.join("/tmp", "vinho.db")
    # Copier la base initiale si elle existe et n'a pas encore été copiée dans /tmp
    initial_db = os.path.join(BASE_DIR, "vinho.db")
    if os.path.exists(initial_db) and not os.path.exists(DB_PATH):
        try:
            shutil.copy2(initial_db, DB_PATH)
        except Exception:
            pass
else:
    DB_PATH = os.path.join(BASE_DIR, "vinho.db")

# Identifiants du dashboard (mot de passe configurable via variable d'environnement)
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "vinho123")

# Coordonnées de l'organisation (configurables via variables d'environnement)
WHATSAPP_NUMBER = os.environ.get("WHATSAPP_NUMBER", "22870072141")
TMONEY_NUMBER = os.environ.get("TMONEY_NUMBER", "70 07 21 41")

PRIX = {"Garçon": 2500, "Fille": 1500}
TAILLES = {"XS", "S", "M", "L", "XL", "XXL"}
STATUTS = {"attente", "confirme"}

app = Flask(__name__, static_folder="static", static_url_path="")


# ---------- Base de données ----------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH, timeout=10)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    try:
        # Assurer que le dossier parent existe (notamment pour /tmp)
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        with sqlite3.connect(DB_PATH, timeout=10) as db:
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
    except Exception as e:
        print(f"Erreur lors de l'initialisation de la base : {e}")


# Initialiser la base au démarrage
init_db()


# ---------- Utilitaires ----------

def clean(value, max_len=80):
    """Supprime les espaces superflus et limite la longueur."""
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
            "Accès réservé à l'organisation de Vinho.",
            401,
            {"WWW-Authenticate": 'Basic realm="Vinho Admin"'},
        )

    return wrapped


def row_to_dict(row):
    return {key: row[key] for key in row.keys()}


# ---------- Pages & Fichiers statiques ----------

@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/dashboard")
@admin_required
def dashboard():
    return send_from_directory(ADMIN_DIR, "dashboard.html")


# Correction du bug 404 : routes pour les fichiers CSS et JS du dashboard
@app.get("/dashboard.css")
def dashboard_css():
    return send_from_directory(ADMIN_DIR, "dashboard.css")


@app.get("/dashboard.js")
def dashboard_js():
    return send_from_directory(ADMIN_DIR, "dashboard.js")


@app.get("/admin/<path:filename>")
@admin_required
def admin_static(filename):
    return send_from_directory(ADMIN_DIR, filename)


# ---------- API ----------

@app.get("/api/health")
def api_health():
    """Vérification de l'état de l'application et de l'environnement."""
    return jsonify(
        status="ok",
        vercel=IS_VERCEL,
        db_path=DB_PATH,
    )


@app.get("/api/config")
def api_config():
    """Fournit les configurations publiques (numéro WhatsApp, TMoney, tarifs)."""
    return jsonify(
        whatsapp_number=WHATSAPP_NUMBER,
        tmoney_number=TMONEY_NUMBER,
        prix=PRIX,
    )


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
        return jsonify(error="Numéro de téléphone invalide (8 chiffres togolais requis)."), 400
    if sexe not in PRIX:
        return jsonify(error="Catégorie invalide. Choisissez Garçon ou Fille."), 400
    if taille not in TAILLES:
        return jsonify(error="Taille de maillot invalide."), 400
    if len(reference) < 4:
        return jsonify(error="Référence TMoney invalide (au moins 4 caractères)."), 400

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
        return jsonify(error="Cette référence TMoney a déjà été enregistrée."), 409
    except Exception as e:
        return jsonify(error=f"Erreur base de données : {str(e)}"), 500

    return jsonify(
        id=cursor.lastrowid,
        montant=montant,
        message="Inscription enregistrée avec succès !",
    ), 201


@app.get("/api/inscriptions")
@admin_required
def list_inscriptions():
    db = get_db()
    rows = db.execute("SELECT * FROM inscriptions ORDER BY id DESC").fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.patch("/api/inscriptions/<int:inscription_id>")
@admin_required
def update_statut(inscription_id):
    statut = (request.get_json(silent=True) or {}).get("statut")
    if statut not in STATUTS:
        return jsonify(error="Statut invalide (attente ou confirme)."), 400

    db = get_db()
    cursor = db.execute(
        "UPDATE inscriptions SET statut = ? WHERE id = ?", (statut, inscription_id)
    )
    db.commit()

    if cursor.rowcount == 0:
        return jsonify(error="Inscription introuvable."), 404
    return jsonify(ok=True, statut=statut)


@app.delete("/api/inscriptions/<int:inscription_id>")
@admin_required
def delete_inscription(inscription_id):
    db = get_db()
    cursor = db.execute("DELETE FROM inscriptions WHERE id = ?", (inscription_id,))
    db.commit()

    if cursor.rowcount == 0:
        return jsonify(error="Inscription introuvable."), 404
    return jsonify(ok=True)


# ---------- Démarrage local ----------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    if ADMIN_PASSWORD == "vinho123":
        print("💡 Note : Mot de passe admin par défaut utilisé : 'vinho123'")
        print("   Pour le personnaliser : set ADMIN_PASSWORD=votre_mot_de_passe (Windows)")
    print(f"🚀 Serveur Vinho démarré : http://0.0.0.0:{port}")
    print(f"⚽ Dashboard admin : http://0.0.0.0:{port}/dashboard (user: {ADMIN_USER})")
    app.run(host="0.0.0.0", port=port, debug=False)

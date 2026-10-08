# ⚽ VINHO FC – Inscription & Gestion de Rencontre Amicale

Application web moderne développée avec **Flask (Python)** pour l'organisation et la gestion d'événements de football amicaux avec paiement TMoney et validation WhatsApp.

---

## 🌟 Fonctionnalités

1. **Formulaire d'inscription interactif (`/`)** :
   - Inscription simplifiée avec le prénom du joueur.
   - Flocage en temps réel du maillot (prénom du joueur, numéro, taille et coloris selon l'équipe).
   - Choix de catégorie : Équipe Hommes (2 000 FCFA) / Équipe Dames (1 500 FCFA).
   - Billetterie officielle et consignes TMoney avec copie en 1 clic du numéro (`70 07 21 41`).
   - Célébration (modal "But !") et transmission directe de la preuve sur WhatsApp.

2. **Dashboard d'administration du coach (`/dashboard`)** :
   - Statistiques en direct : Effectif total, ratio garçons/filles, titulaires validés, joueurs en attente et cagnotte totale encaissée.
   - Suivi des paiements TMoney et validation des statuts en 1 clic.
   - Contact direct de chaque joueur par WhatsApp depuis le tableau.
   - Recherche instantanée et filtres par équipe / statut.
   - Export de la feuille de match en CSV pour Microsoft Excel (avec BOM UTF-8).

---

## 🚀 Lancement en local

1. Installer les dépendances :
   ```bash
   pip install -r requirements.txt
   ```

2. Lancer l'application :
   ```bash
   python app.py
   ```

3. Ouvrir dans votre navigateur :
   - **Formulaire public** : [http://127.0.0.1:5000](http://127.0.0.1:5000)
   - **Dashboard Admin** : [http://127.0.0.1:5000/dashboard](http://127.0.0.1:5000/dashboard)
     - Identifiant : `admin`
     - Mot de passe par défaut : `vinho123` (personnalisable via la variable `ADMIN_PASSWORD`)

---

## ☁️ Déploiement sur Vercel

Le projet est configuré pour un déploiement instantané sur Vercel avec :
- [`vercel.json`](vercel.json) : Routage vers l'adaptateur serverless.
- [`api/index.py`](api/index.py) : Point d'entrée de la fonction Python serverless.
- [`requirements.txt`](requirements.txt) : Dépendances requises.
- [`.vercelignore`](.vercelignore) : Exclusion des dossiers locaux inutiles (`env/`, etc.).

### Option A : Déploiement via GitHub (Recommandé)
1. Poussez ce dossier sur un dépôt GitHub (public ou privé).
2. Connectez-vous sur [vercel.com](https://vercel.com) et cliquez sur **Add New > Project**.
3. Importez votre dépôt GitHub.
4. Dans **Environment Variables**, ajoutez les variables suivantes :
   - `ADMIN_PASSWORD` : Le mot de passe de votre choix pour sécuriser le dashboard.
   - `WHATSAPP_NUMBER` *(optionnel)* : Le numéro WhatsApp de l'organisateur (ex : `22870072141`).
   - `TMONEY_NUMBER` *(optionnel)* : Le numéro TMoney affiché (ex : `70 07 21 41`).
5. Cliquez sur **Deploy** !

### Option B : Déploiement via le CLI Vercel
```bash
npm install -g vercel
vercel
```

> **Note importante sur la base de données :**
> - Sur Vercel, l'environnement de calcul est *serverless* (AWS Lambda) avec un système de fichiers en lecture seule en dehors du dossier `/tmp`.
> - L'application gère automatiquement `/tmp/vinho.db` pour fonctionner sans erreur au déploiement.
> - Pour conserver les inscriptions de manière permanente et pérenne sur le cloud sans interruption, vous pouvez connecter une base de données distante (ex : Turso pour SQLite cloud, ou Neon/Supabase pour PostgreSQL).

"use strict";

/* ==========================================================
   VINHO FC – DASHBOARD DU COACH / ADMIN
   Gestion de l'effectif, suivi des paiements TMoney & export
   ========================================================== */

const API_URL = "/api/inscriptions";
const REFRESH_MS = 30000;

const $ = (id) => document.getElementById(id);

let inscrits = [];

/* ---------- Utilitaires ---------- */

const formatFCFA = (n) => Number(n || 0).toLocaleString("fr-FR");

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Erreur ${response.status}`);
  }
  return body;
}

function cell(content) {
  const td = document.createElement("td");
  if (typeof content === "string" || typeof content === "number") {
    td.textContent = content;
  } else if (content instanceof HTMLElement) {
    td.appendChild(content);
  }
  return td;
}

/* ---------- Chargement des données ---------- */

async function charger() {
  try {
    inscrits = await api(API_URL);
    afficher();
  } catch (error) {
    console.error("Erreur de chargement de l'effectif :", error);
  }
}

/* ---------- Statistiques du Match ---------- */

function majStats() {
  const confirmes = inscrits.filter((i) => i.statut === "confirme");
  const garcons = inscrits.filter((i) => i.sexe === "Garçon");
  const filles = inscrits.filter((i) => i.sexe === "Fille");
  const montantTotal = confirmes.reduce((sum, i) => sum + (Number(i.montant) || 0), 0);

  $("statTotal").textContent = inscrits.length;
  $("statGarcons").textContent = garcons.length;
  $("statFilles").textContent = filles.length;
  $("statConfirmes").textContent = confirmes.length;
  $("statAttente").textContent = inscrits.length - confirmes.length;
  $("statMontant").innerHTML = `${formatFCFA(montantTotal)} <small>FCFA</small>`;
}

/* ---------- Filtres et Recherche ---------- */

function filtrer() {
  const recherche = ($("search").value || "").trim().toLowerCase();
  const sexe = $("filterSexe").value;
  const statut = $("filterStatut").value;

  return inscrits.filter((i) => {
    if (sexe && i.sexe !== sexe) return false;
    if (statut && i.statut !== statut) return false;
    if (!recherche) return true;

    return [i.nom, i.prenom, i.telephone, i.reference, i.taille]
      .join(" ")
      .toLowerCase()
      .includes(recherche);
  });
}

/* ---------- Affichage de la table des joueurs ---------- */

function afficher() {
  majStats();

  const liste = filtrer();
  const tbody = $("inscritsBody");
  tbody.replaceChildren();

  $("filteredCount").textContent = `${liste.length} joueur(s)`;

  liste.forEach((i, index) => {
    const tr = document.createElement("tr");

    // Dossard
    const dossardSpan = document.createElement("span");
    dossardSpan.className = "badge-dossard";
    dossardSpan.textContent = `#${index + 1}`;
    tr.appendChild(cell(dossardSpan));

    // Prénom du Joueur
    const nameCell = document.createElement("td");
    nameCell.className = "player-name-cell";
    nameCell.textContent = i.prenom ? i.prenom.toUpperCase() : (i.nom || "-");
    tr.appendChild(nameCell);

    // Téléphone avec lien WhatsApp direct
    const telCell = document.createElement("td");
    const waLink = document.createElement("a");
    const cleanPhone = i.telephone.replace(/\D/g, "");
    waLink.href = `https://wa.me/228${cleanPhone}`;
    waLink.target = "_blank";
    waLink.className = "link-wa";
    waLink.innerHTML = `💬 <span>${i.telephone}</span>`;
    telCell.appendChild(waLink);
    tr.appendChild(telCell);

    // Équipe / Catégorie
    const teamBadge = document.createElement("span");
    teamBadge.className = "badge-team";
    teamBadge.textContent = i.sexe === "Garçon" ? "👦 Garçon" : "👧 Fille";
    tr.appendChild(cell(teamBadge));

    // Taille Maillot
    const jerseyBadge = document.createElement("span");
    jerseyBadge.className = "badge-jersey";
    jerseyBadge.textContent = `Taille ${i.taille}`;
    tr.appendChild(cell(jerseyBadge));

    // Référence TMoney
    tr.appendChild(cell(i.reference));

    // Montant
    tr.appendChild(cell(`${formatFCFA(i.montant)} FCFA`));

    // Statut
    const tdStatut = document.createElement("td");
    const statusBadge = document.createElement("span");
    const isConfirme = i.statut === "confirme";
    statusBadge.className = `badge-status ${isConfirme ? "badge-confirme" : "badge-attente"}`;
    statusBadge.textContent = isConfirme ? "🟢 Titulaire" : "🟡 En attente";
    tdStatut.appendChild(statusBadge);
    tr.appendChild(tdStatut);

    // Actions rapides
    const tdActions = document.createElement("td");
    tdActions.className = "actions-cell";

    const btnToggle = document.createElement("button");
    btnToggle.type = "button";
    btnToggle.className = `btn-action ${isConfirme ? "btn-toggle-cancel" : "btn-toggle-valid"}`;
    btnToggle.textContent = isConfirme ? "Mettre en attente" : "Valider titulaire";
    btnToggle.dataset.action = "toggle";
    btnToggle.dataset.id = i.id;

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.className = "btn-action btn-delete";
    btnDelete.textContent = "Supprimer";
    btnDelete.dataset.action = "delete";
    btnDelete.dataset.id = i.id;

    tdActions.append(btnToggle, btnDelete);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  $("emptyMessage").style.display = liste.length ? "none" : "block";
  $("inscritsTable").style.display = liste.length ? "" : "none";
}

/* ---------- Gestion des actions (Confirmer / Supprimer) ---------- */

$("inscritsBody").addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const inscrit = inscrits.find((i) => i.id === id);
  if (!inscrit) return;

  try {
    if (btn.dataset.action === "toggle") {
      const nouveauStatut = inscrit.statut === "confirme" ? "attente" : "confirme";
      btn.disabled = true;
      await api(`${API_URL}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ statut: nouveauStatut }),
      });
    } else if (btn.dataset.action === "delete") {
      const nomComplet = inscrit.prenom || inscrit.nom;
      if (!confirm(`Supprimer définitivement l'inscription de ${nomComplet} ?`)) {
        return;
      }
      btn.disabled = true;
      await api(`${API_URL}/${id}`, { method: "DELETE" });
    }
    await charger();
  } catch (error) {
    alert(error.message);
    btn.disabled = false;
  }
});

/* ---------- Ajout manuel d'un joueur ---------- */

$("addForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = {
    nom: "",
    prenom: $("prenom").value.trim(),
    telephone: $("telephone").value.trim(),
    sexe: $("sexe").value,
    taille: $("taille").value,
    reference: $("reference").value.trim(),
  };

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    await api(API_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    event.target.reset();
    await charger();
  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

/* ---------- Événements de recherche et filtres ---------- */

["search", "filterSexe", "filterStatut"].forEach((id) => {
  $(id).addEventListener("input", afficher);
});

/* ---------- Export CSV pour Excel (BOM UTF-8 et point-virgule) ---------- */

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

$("exportBtn").addEventListener("click", () => {
  if (!inscrits.length) {
    alert("Aucune inscription à exporter.");
    return;
  }

  const entetes = [
    "Dossard",
    "Prénom",
    "Téléphone",
    "Catégorie",
    "Taille Maillot",
    "Réf. TMoney",
    "Montant (FCFA)",
    "Statut",
    "Date d'inscription"
  ];

  const lignes = inscrits.map((i, idx) =>
    [
      idx + 1,
      i.prenom || i.nom,
      i.telephone,
      i.sexe,
      i.taille,
      i.reference,
      i.montant,
      i.statut === "confirme" ? "Confirmé" : "En attente",
      i.created_at
    ]
      .map(csvCell)
      .join(";")
  );

  const contenu = "\uFEFF" + [entetes.map(csvCell).join(";"), ...lignes].join("\r\n");
  const blob = new Blob([contenu], { type: "text/csv;charset=utf-8" });

  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(blob);
  lien.download = `feuille-de-match-vinho-${new Date().toISOString().slice(0, 10)}.csv`;
  lien.click();
  URL.revokeObjectURL(lien.href);
});

/* ---------- Démarrage ---------- */

charger();
setInterval(charger, REFRESH_MS);

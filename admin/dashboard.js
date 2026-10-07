"use strict";

/* ==========================================================
   VINHO – Dashboard des inscriptions
   ========================================================== */

const API_URL = "/api/inscriptions";
const REFRESH_MS = 30000;

const $ = (id) => document.getElementById(id);

let inscrits = [];

/* ---------- Utilitaires ---------- */

const formatFCFA = (n) => n.toLocaleString("fr-FR");

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

// Crée une cellule avec du texte brut (textContent évite toute injection HTML)
function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function actionButton(label, action, id, className) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.dataset.action = action;
  btn.dataset.id = id;
  btn.className = className;
  return btn;
}

/* ---------- Chargement ---------- */

async function charger() {
  try {
    inscrits = await api(API_URL);
    afficher();
  } catch (error) {
    console.error(error);
  }
}

/* ---------- Statistiques ---------- */

function majStats() {
  const confirmes = inscrits.filter((i) => i.statut === "confirme");

  $("statTotal").textContent = inscrits.length;
  $("statGarcons").textContent = inscrits.filter((i) => i.sexe === "Garçon").length;
  $("statFilles").textContent = inscrits.filter((i) => i.sexe === "Fille").length;
  $("statConfirmes").textContent = confirmes.length;
  $("statAttente").textContent = inscrits.length - confirmes.length;
  $("statMontant").textContent = formatFCFA(confirmes.reduce((s, i) => s + i.montant, 0));
}

/* ---------- Tableau ---------- */

function filtrer() {
  const recherche = $("search").value.trim().toLowerCase();
  const sexe = $("filterSexe").value;
  const statut = $("filterStatut").value;

  return inscrits.filter((i) => {
    if (sexe && i.sexe !== sexe) return false;
    if (statut && i.statut !== statut) return false;
    if (!recherche) return true;

    return [i.nom, i.prenom, i.telephone, i.reference]
      .join(" ")
      .toLowerCase()
      .includes(recherche);
  });
}

function afficher() {
  majStats();

  const liste = filtrer();
  const tbody = $("inscritsBody");
  tbody.replaceChildren();

  liste.forEach((i, index) => {
    const tr = document.createElement("tr");

    tr.append(
      cell(index + 1),
      cell(i.nom),
      cell(i.prenom),
      cell(i.telephone),
      cell(i.sexe),
      cell(i.taille),
      cell(i.reference),
      cell(formatFCFA(i.montant) + " FCFA")
    );

    // Statut
    const tdStatut = document.createElement("td");
    const badge = document.createElement("span");
    const confirme = i.statut === "confirme";
    badge.className = `badge ${confirme ? "badge-confirme" : "badge-attente"}`;
    badge.textContent = confirme ? "Confirmé" : "En attente";
    tdStatut.appendChild(badge);
    tr.appendChild(tdStatut);

    // Actions
    const tdActions = document.createElement("td");
    tdActions.className = "actions";
    tdActions.append(
      actionButton(confirme ? "Annuler" : "Confirmer", "toggle", i.id, "btn-toggle"),
      actionButton("Supprimer", "delete", i.id, "btn-delete")
    );
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  $("emptyMessage").style.display = liste.length ? "none" : "block";
  $("inscritsTable").style.display = liste.length ? "" : "none";
}

/* ---------- Actions : confirmer / supprimer ---------- */

$("inscritsBody").addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const inscrit = inscrits.find((i) => i.id === id);
  if (!inscrit) return;

  try {
    if (btn.dataset.action === "toggle") {
      const statut = inscrit.statut === "confirme" ? "attente" : "confirme";
      await api(`${API_URL}/${id}`, { method: "PATCH", body: JSON.stringify({ statut }) });
    } else if (btn.dataset.action === "delete") {
      if (!confirm(`Supprimer l'inscription de ${inscrit.prenom} ${inscrit.nom} ?`)) return;
      await api(`${API_URL}/${id}`, { method: "DELETE" });
    }
    await charger();
  } catch (error) {
    alert(error.message);
  }
});

/* ---------- Ajout manuel ---------- */

$("addForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = {
    nom: $("nom").value,
    prenom: $("prenom").value,
    telephone: $("telephone").value,
    sexe: $("sexe").value,
    taille: $("taille").value,
    reference: $("reference").value,
  };

  try {
    await api(API_URL, { method: "POST", body: JSON.stringify(data) });
    event.target.reset();
    await charger();
  } catch (error) {
    alert(error.message);
  }
});

/* ---------- Recherche et filtres ---------- */

["search", "filterSexe", "filterStatut"].forEach((id) => {
  $(id).addEventListener("input", afficher);
});

/* ---------- Export CSV (lisible directement dans Excel) ---------- */

function csvCell(value) {
  let text = String(value ?? "");
  // Empêche l'exécution de formules si le fichier est ouvert dans Excel
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

$("exportBtn").addEventListener("click", () => {
  const entetes = ["Nom", "Prénom", "Téléphone", "Catégorie", "Taille", "Référence", "Montant", "Statut", "Date"];

  const lignes = inscrits.map((i) =>
    [i.nom, i.prenom, i.telephone, i.sexe, i.taille, i.reference, i.montant, i.statut, i.created_at]
      .map(csvCell)
      .join(";")
  );

  // BOM + séparateur ";" pour un affichage correct des accents dans Excel (FR)
  const contenu = "\uFEFF" + [entetes.map(csvCell).join(";"), ...lignes].join("\r\n");
  const blob = new Blob([contenu], { type: "text/csv;charset=utf-8" });

  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(blob);
  lien.download = "inscriptions-vinho.csv";
  lien.click();
  URL.revokeObjectURL(lien.href);
});

/* ---------- Démarrage ---------- */

charger();
setInterval(charger, REFRESH_MS);

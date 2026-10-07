"use strict";

/* ==========================================================
   VINHO – Formulaire d'inscription
   1. Affiche le prix selon la catégorie
   2. Enregistre l'inscription sur le serveur Flask
   3. Ouvre WhatsApp avec le message déjà rédigé
   ========================================================== */

// ⚠️ À MODIFIER : numéro WhatsApp de l'organisateur, avec l'indicatif, sans "+" ni espaces
const WHATSAPP_NUMBER = "22890000000";

const API_URL = "/api/inscriptions";
const PRIX = { "Garçon": 2500, "Fille": 1500 };

const form = document.getElementById("registrationForm");
const sexeSelect = document.getElementById("sexe");
const selectedPrice = document.getElementById("selectedPrice");
const successMessage = document.getElementById("successMessage");
const submitBtn = form.querySelector('button[type="submit"]');

/* ---------- Utilitaires ---------- */

function formatFCFA(montant) {
  return montant.toLocaleString("fr-FR") + " FCFA";
}

// Accepte "90 00 00 00", "+228 90 00 00 00", "22890000000"... Renvoie 8 chiffres ou null
function normalizePhone(raw) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("228") && digits.length === 11) {
    digits = digits.slice(3);
  }
  return digits.length === 8 ? digits : null;
}

function getFormData() {
  return {
    nom: document.getElementById("nom").value.trim(),
    prenom: document.getElementById("prenom").value.trim(),
    telephone: document.getElementById("telephone").value.trim(),
    sexe: sexeSelect.value,
    taille: document.getElementById("taille").value,
    reference: document.getElementById("reference").value.trim(),
  };
}

function buildWhatsAppUrl(data, montant) {
  const message = [
    "⚽ *Inscription – Rencontre entre amis (Vinho)*",
    "",
    `👤 Nom : ${data.nom}`,
    `👤 Prénom : ${data.prenom}`,
    `📞 Téléphone : ${data.telephone}`,
    `🚻 Catégorie : ${data.sexe}`,
    `👕 Taille du maillot : ${data.taille}`,
    `💳 Référence TMoney : ${data.reference}`,
    `💰 Montant : ${formatFCFA(montant)}`,
  ].join("\n");

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function resetSubmitButton(label) {
  submitBtn.disabled = false;
  submitBtn.textContent = label;
}

/* ---------- Affichage du prix selon la catégorie ---------- */

sexeSelect.addEventListener("change", () => {
  const montant = PRIX[sexeSelect.value];

  if (montant) {
    selectedPrice.textContent = `Montant à payer : ${formatFCFA(montant)}`;
    selectedPrice.style.display = "block";
  } else {
    selectedPrice.style.display = "none";
  }
});

/* ---------- Envoi du formulaire ---------- */

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = getFormData();
  const montant = PRIX[data.sexe];

  const telephone = normalizePhone(data.telephone);
  if (!telephone) {
    alert("Numéro de téléphone invalide : il doit contenir 8 chiffres (ex : 90 00 00 00).");
    document.getElementById("telephone").focus();
    return;
  }
  data.telephone = telephone;

  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi en cours…";

  // On ouvre l'onglet tout de suite : après un fetch, certains navigateurs
  // mobiles bloquent l'ouverture d'une nouvelle fenêtre.
  const waWindow = window.open("", "_blank");

  let saved = false;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json().catch(() => ({}));

    // Erreur de saisie ou référence déjà utilisée : on s'arrête et on explique
    if (response.status === 400 || response.status === 409) {
      if (waWindow) waWindow.close();
      alert(body.error || "Les informations saisies sont incorrectes.");
      if (response.status === 409) document.getElementById("reference").focus();
      resetSubmitButton(originalLabel);
      return;
    }

    saved = response.ok;
  } catch (error) {
    console.error("Serveur injoignable :", error);
  }

  // Dans tous les autres cas, on envoie quand même le message WhatsApp
  const url = buildWhatsAppUrl(data, montant);
  if (waWindow) {
    waWindow.location.href = url;
  } else {
    window.location.href = url;
  }

  if (!saved) {
    alert(
      "Le serveur n'a pas pu enregistrer ton inscription.\n" +
      "Envoie quand même le message WhatsApp : l'organisation la saisira manuellement."
    );
  }

  form.reset();
  selectedPrice.style.display = "none";
  successMessage.classList.add("show");
  successMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  resetSubmitButton(originalLabel);
});

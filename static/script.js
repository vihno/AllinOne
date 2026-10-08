"use strict";

/* ==========================================================
   VINHO FC – Formulaire d'inscription & Maillot Interactif
   1. Prévisualisation en direct du flocage du maillot
   2. Copie 1-clic du numéro TMoney
   3. Validation et enregistrement sur l'API Flask
   4. Célébration & transmission sur WhatsApp
   ========================================================== */

let CONFIG = {
  whatsapp_number: "22870072141",
  tmoney_number: "70 07 21 41",
  prix: { "Garçon": 2500, "Fille": 1500 }
};

const API_URL = "/api/inscriptions";

// Éléments du DOM
const form = document.getElementById("registrationForm");
const nomInput = document.getElementById("nom");
const prenomInput = document.getElementById("prenom");
const telInput = document.getElementById("telephone");
const sexeSelect = document.getElementById("sexe");
const tailleSelect = document.getElementById("taille");
const refInput = document.getElementById("reference");
const submitBtn = document.getElementById("submitBtn");

// Éléments du Maillot
const jerseyObject = document.getElementById("jerseyObject");
const jerseyName = document.getElementById("jerseyPreviewName");
const jerseyTeamBadge = document.getElementById("jerseyTeamBadge");
const jerseySizeBadge = document.getElementById("jerseyPreviewSizeBadge");

// Prix
const priceBanner = document.getElementById("selectedPrice");
const priceBannerAmount = document.getElementById("priceBannerAmount");

// TMoney
const copyBtn = document.getElementById("copyTmoneyBtn");
const copyToast = document.getElementById("copyToast");
const tmoneyDisplay = document.getElementById("tmoneyDisplay");

// Modal de célébration
const successModal = document.getElementById("successModal");
const modalWaBtn = document.getElementById("modalWaBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const passPlayerName = document.getElementById("passPlayerName");
const passJerseyInfo = document.getElementById("passJerseyInfo");
const passReference = document.getElementById("passReference");
const passMontant = document.getElementById("passMontant");


/* ---------- Initialisation de la configuration ---------- */

async function chargerConfig() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      CONFIG = { ...CONFIG, ...data };
      if (tmoneyDisplay) {
        tmoneyDisplay.textContent = CONFIG.tmoney_number;
      }
    }
  } catch (e) {
    // Utilisation des valeurs par défaut si hors-ligne
  }
}
chargerConfig();


/* ---------- Utilitaires ---------- */

function formatFCFA(montant) {
  return Number(montant || 0).toLocaleString("fr-FR") + " FCFA";
}

function normalizePhone(raw) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("228") && digits.length === 11) {
    digits = digits.slice(3);
  }
  return digits.length === 8 ? digits : null;
}

function buildWhatsAppUrl(data, montant) {
  const message = [
    "⚽ *INSCRIPTION OFFICIELLE – VINHO FC*",
    "--------------------------------",
    `👤 *Nom & Prénom :* ${data.nom.toUpperCase()} ${data.prenom}`,
    `📞 *Téléphone :* ${data.telephone}`,
    `🚻 *Équipe :* ${data.sexe}`,
    `👕 *Taille Maillot :* ${data.taille}`,
    `💳 *Réf. TMoney :* ${data.reference}`,
    `💰 *Montant :* ${formatFCFA(montant)}`,
    "--------------------------------",
    "✅ _Paiement effectué. Merci de valider ma convocation pour le match !_"
  ].join("\n");

  return `https://wa.me/${CONFIG.whatsapp_number}?text=${encodeURIComponent(message)}`;
}


/* ---------- Prévisualisation interactive du Maillot ---------- */

function updateJerseyFlocking() {
  const nom = nomInput.value.trim().toUpperCase();
  const prenom = prenomInput.value.trim();

  if (nom || prenom) {
    const initial = prenom ? `${prenom.charAt(0).toUpperCase()}. ` : "";
    jerseyName.textContent = (initial + nom) || nom || "TON NOM";
  } else {
    jerseyName.textContent = "TON NOM";
  }
}

nomInput.addEventListener("input", updateJerseyFlocking);
prenomInput.addEventListener("input", updateJerseyFlocking);

sexeSelect.addEventListener("change", () => {
  const sexe = sexeSelect.value;
  const montant = CONFIG.prix[sexe];

  if (sexe === "Fille") {
    jerseyObject.classList.add("jersey-girl");
    jerseyTeamBadge.textContent = "VINHO AWAY KIT (DAMES)";
  } else {
    jerseyObject.classList.remove("jersey-girl");
    jerseyTeamBadge.textContent = "VINHO HOME KIT (HOMMES)";
  }

  if (montant) {
    priceBannerAmount.textContent = formatFCFA(montant);
    priceBanner.style.display = "flex";
  } else {
    priceBanner.style.display = "none";
  }
});

tailleSelect.addEventListener("change", () => {
  const taille = tailleSelect.value || "M";
  jerseySizeBadge.textContent = `TAILLE ${taille}`;
});


/* ---------- Copie 1-clic TMoney ---------- */

if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    const num = (tmoneyDisplay ? tmoneyDisplay.textContent : CONFIG.tmoney_number).replace(/\s/g, "");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(num);
      } else {
        // Fallback
        const temp = document.createElement("input");
        temp.value = num;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      copyToast.classList.add("show");
      document.getElementById("copyText").textContent = "Copié !";
      setTimeout(() => {
        copyToast.classList.remove("show");
        document.getElementById("copyText").textContent = "Copier";
      }, 3000);
    } catch (err) {
      alert(`Numéro TMoney : ${num}`);
    }
  });
}


/* ---------- Soumission du formulaire & Enregistrement ---------- */

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = {
    nom: nomInput.value.trim(),
    prenom: prenomInput.value.trim(),
    telephone: telInput.value.trim(),
    sexe: sexeSelect.value,
    taille: tailleSelect.value,
    reference: refInput.value.trim()
  };

  // Validation téléphone
  const phoneNormalized = normalizePhone(data.telephone);
  if (!phoneNormalized) {
    alert("⚠️ Numéro de téléphone invalide : veuillez entrer un numéro togolais à 8 chiffres (ex : 90 00 00 00).");
    telInput.focus();
    return;
  }
  data.telephone = phoneNormalized;

  if (!data.sexe || !CONFIG.prix[data.sexe]) {
    alert("⚠️ Veuillez sélectionner une catégorie (Garçon ou Fille).");
    sexeSelect.focus();
    return;
  }

  if (!data.taille) {
    alert("⚠️ Veuillez choisir une taille pour votre maillot.");
    tailleSelect.focus();
    return;
  }

  if (data.reference.length < 4) {
    alert("⚠️ Référence TMoney trop courte : veuillez vérifier votre SMS de confirmation.");
    refInput.focus();
    return;
  }

  const montant = CONFIG.prix[data.sexe];
  const originalBtnHTML = submitBtn.innerHTML;

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>⏳ Enregistrement du dossard en cours…</span>`;

  let registrationOk = false;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));

    if (response.status === 409) {
      alert("⚠️ Cette référence TMoney a déjà été enregistrée par un autre joueur.");
      refInput.focus();
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
      return;
    }

    if (!response.ok) {
      alert(result.error || "Une erreur est survenue lors de l'enregistrement.");
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
      return;
    }

    registrationOk = true;
  } catch (error) {
    console.warn("Serveur non joignable, transmission directe vers WhatsApp :", error);
  }

  // Préparation du lien WhatsApp
  const waUrl = buildWhatsAppUrl(data, montant);

  // Remplissage du pass de match dans la modal
  passPlayerName.textContent = `${data.nom.toUpperCase()} ${data.prenom}`;
  passJerseyInfo.textContent = `${data.taille} (${data.sexe})`;
  passReference.textContent = data.reference;
  passMontant.textContent = formatFCFA(montant);
  modalWaBtn.href = waUrl;

  // Affichage de la modal de célébration
  successModal.classList.add("active");

  // Tentative d'ouverture de l'onglet WhatsApp
  window.open(waUrl, "_blank");

  // Réinitialisation du bouton
  submitBtn.disabled = false;
  submitBtn.innerHTML = originalBtnHTML;
});


/* ---------- Fermeture de la Modal de succès ---------- */

modalCloseBtn.addEventListener("click", () => {
  successModal.classList.remove("active");
  form.reset();
  priceBanner.style.display = "none";
  jerseyName.textContent = "TON NOM";
  jerseySizeBadge.textContent = "TAILLE M";
  jerseyObject.classList.remove("jersey-girl");
  jerseyTeamBadge.textContent = "VINHO HOME KIT (HOMMES)";
});

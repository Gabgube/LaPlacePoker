// =========================================================
// --- 1. CONFIGURATION & CONSTANTES ---
// =========================================================

const TYPES = {
  bar:        { nom: "Bar Red Cactus", couleur: "#dc2626" }, // Rouge jeton
  casino:     { nom: "Casino", couleur: "#18181b" },           // Noir jeton
  associatif: { nom: "Tournoi associatif", couleur: "#1d4ed8" } // Bleu jeton
};

const OFFRES_POKER = {
  cash: "Cash Game",
  tournois: "Tournois",
  les_deux: "Cash Game & Tournois",
  a_verifier: "À vérifier"
};

const URL_GEOCODAGE = "https://data.geopf.fr/geocodage/search"; 
const VILLES_AVEC_PAGE = ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg", "Bordeaux", "Lille"]; 

let lieux = [];
let ref = null; 
let suggestions = new Map();


// =========================================================
// --- 2. FONCTIONS UTILITAIRES & FORMATEURS ---
// =========================================================

const esc = s => String(s || '').replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&quot;","'":"&#39;"}[c]));

const sansAccents = s => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

// Générateur de slug propre pour les URL de fiches casinos et lieux
function slugify(texte) {
  if (!texte) return "";
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[^a-z0-9]+/g, "-")     // Remplace les espaces/caractères spéciaux par un tiret
    .replace(/^-+|-+$/g, "");        // Nettoie les tirets aux extrémités
}

const fRayon = document.getElementById("f-rayon");
const rayon = () => fRayon ? Number(fRayon.value) : 0; 
const distanceKm = l => (ref && typeof l.lat === "number" && typeof l.lng === "number") ? map.distance([ref.lat, ref.lng], [l.lat, l.lng]) / 1000 : 0;

function formerDateFr(dateIso) {
  if (!dateIso || typeof dateIso !== "string" || !dateIso.includes("-")) return dateIso || "";
  const [a, m, j] = dateIso.split('-');
  return `${j}/${m}/${a}`;
}

function composerOuCopier(e, tel) {
  if (navigator.clipboard && tel) {
    navigator.clipboard.writeText(tel).catch(() => {});
  }
}

function mettreAJourCompteursAccueil(nbBars, nbCasinos, nbAssoc, nbTotal) {
  const elTotal = document.getElementById("stat-total");
  const elBars = document.getElementById("stat-bars");
  const elCasinos = document.getElementById("stat-casinos");
  const elAssoc = document.getElementById("stat-assoc");

  if (elTotal) elTotal.textContent = nbTotal;
  if (elBars) elBars.textContent = nbBars;
  if (elCasinos) elCasinos.textContent = nbCasinos;
  if (elAssoc) elAssoc.textContent = nbAssoc;
}


// =========================================================
// --- 3. TEMPLATING HTML (BOUTONS & CARTES) ---
// =========================================================

function boutonInscription(l) {
  let boutonsHtml = "";

  if (l.type === "casino") {
    // Bouton de redirection vers la page dédiée du casino
    const urlFiche = `lieux/${slugify(l.nom)}.html`;
    boutonsHtml += `<a class="btn btn-fiche" href="${urlFiche}">Voir la fiche</a>`;
  }
  else if (l.inscription && l.inscription.valeur) {
    const libelle = l.inscription.libelle || (l.type === "associatif" ? "Voir le tournoi" : "En savoir plus");
    boutonsHtml += `<a class="btn" href="${esc(l.inscription.valeur)}" target="_blank" rel="noopener noreferrer">${esc(libelle)}</a>`;
  } 
  else if (l.url) {
    let libelle = "En savoir plus";
    if (l.type === "associatif") libelle = "Voir le tournoi";
    else if (l.type === "bar") libelle = "Voir la page du bar";

    boutonsHtml += `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(libelle)}</a>`;
  } 
  else if (l.type === "bar") {
    const urlBase = "https://poker.redcactus.fr"; 
    const rawId = String(l.id).replace(/^rc_/, '');
    const url = rawId ? `${urlBase}/bar/${rawId}` : urlBase;
    boutonsHtml += `<a class="btn" href="${url}" target="_blank" rel="noopener noreferrer">Voir la page du bar</a>`;
  }

  if (typeof l.lat === "number" && typeof l.lng === "number") {
    const urlMaps = `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`;
    boutonsHtml += ` <a class="btn btn-secondaire btn-maps" href="${urlMaps}" target="_blank" rel="noopener noreferrer">Itinéraire</a>`;
  }

  return boutonsHtml;
}

function details(l) {
  const t = TYPES[l.type] || TYPES.bar;

  let nomType = t.nom;
  if (l.type === "associatif" && l.is_caritatif) {
    nomType = "Tournoi caritatif";
  }

  let badges = `<span class="tag" style="--c:${t.couleur}">${esc(nomType)}</span>`;

  if (l.poker && OFFRES_POKER[l.poker]) {
    badges += ` <span class="tag tag-poker" style="--c:#059669">${esc(OFFRES_POKER[l.poker])}</span>`;
  }

  let infoDate = "Tournois réguliers";
  if (l.type === "associatif") {
    infoDate = l.date ? formerDateFr(l.date) : "Date inconnue";
  } else if (l.type === "casino") {
    infoDate = "Voir les dates sur la fiche";
  } else if (l.date) {
    infoDate = `Tous les ${l.date}`;
  }

  let infoPrix = "";
  if (l.type === "associatif") {
    infoPrix = l.prix || (l.gratuit ? "Gratuit" : "Payant");
  } else {
    infoPrix = l.gratuit ? "Gratuit" : "Payant";
  }

  return `${badges}
    <p class="meta">${esc(infoDate)} · ${esc(infoPrix)}</p>
    ${boutonInscription(l)}`;
}


// =========================================================
// --- 4. CONFIGURATION & INITIALISATION LEAFLET ---
// =========================================================

let map = null;
let layer = null;
let coucheRef = null;

const elMap = document.getElementById("map");

if (elMap) {
  L.Map.mergeOptions({ zoomControl: false });
  L.Map.addInitHook(function () { L.control.zoom({ position: "bottomright" }).addTo(this); });
  L.TileLayer.addInitHook(function () { this.options.attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'; });
  L.MarkerClusterGroup.mergeOptions({ showCoverageOnHover: false, maxClusterRadius: 50 });
  L.Popup.mergeOptions({ maxWidth: 320, minWidth: 260, autoPanPaddingTopLeft: [16, 16], autoPanPaddingBottomRight: [60, 16] });

  const LIMITES_FRANCE = [[41.3, -5.2], [51.1, 9.6]];
  const BORNES_FRANCE_ET_DOMTOM = [[-32, -75], [56, 70]];

  map = L.map("map", {
    minZoom: 3,
    maxBounds: BORNES_FRANCE_ET_DOMTOM,
    maxBoundsViscosity: 1.0
  }).fitBounds(LIMITES_FRANCE);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    minZoom: 3,
    noWrap: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  layer = L.markerClusterGroup({
    iconCreateFunction: function(cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div><span>${count}</span></div>`,
        className: 'custom-cluster',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
    }
  }).addTo(map);

  coucheRef = L.layerGroup().addTo(map);
}


// =========================================================
// --- 5. FONCTION PRINCIPALE D'AFFICHAGE & FILTRAGE ---
// =========================================================

function afficher() {
  const typeSelect = document.getElementById("f-type");
  const prixSelect = document.getElementById("f-prix");
  const pokerSelect = document.getElementById("f-poker");

  const type = typeSelect ? typeSelect.value : "";
  const prix = prixSelect ? prixSelect.value : "";
  const poker = pokerSelect ? pokerSelect.value : "";

  // 1. Filtrage combiné (Type, Tarif, Poker, Rayon)
  let filtres = lieux.filter(l => {
    if (type && type !== "tous" && l.type !== type) return false;
    
    if (prix && prix !== "tous" && prix !== "tous_tarifs") {
      if (prix === "gratuit" && !l.gratuit) return false;
      if (prix === "payant" && l.gratuit) return false;
    }
    
    if (poker && poker !== "tous") {
      if (poker === "cash" && l.poker !== "cash" && l.poker !== "les_deux") return false;
      if (poker === "tournois" && l.poker !== "tournois" && l.poker !== "les_deux") return false;
      if (poker === "les_deux" && l.poker !== "les_deux") return false;
    }

    if (ref && rayon() > 0 && distanceKm(l) > rayon()) {
      return false;
    }

    return true;
  });

  // 2. Tri du plus proche au plus éloigné si une référence est active
  if (ref) {
    filtres.sort((a, b) => distanceKm(a) - distanceKm(b));
  }

  // 3. Réinitialisation des calques et de la liste
  layer.clearLayers();
  const list = document.getElementById("list");
  if (list) list.innerHTML = "";

  const countEl = document.getElementById("count");
  if (countEl) {
    countEl.textContent = filtres.length + (filtres.length > 1 ? " lieux trouvés" : " lieu trouvé");
  }

  // 4. Génération des marqueurs et cartes HTML
  filtres.forEach(l => {
    const t = TYPES[l.type] || TYPES.bar;

    const icon = L.divIcon({
      className: "",
      html: `<div class="chip" style="--c:${t.couleur}"></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });

    const nomAffiche = esc(l.nom);

    const marker = L.marker([l.lat, l.lng], { icon, title: l.nom })
      .bindPopup(`<strong>${nomAffiche}</strong><br>${details(l)}`)
      .addTo(layer);

    if (list) {
      const card = document.createElement("div");
      card.className = "card";
      card.tabIndex = 0;
      card.style.setProperty("--c", t.couleur);
      card.innerHTML = `<h2>${nomAffiche}</h2>${details(l)}`;

      const ouvrir = () => { map.setView([l.lat, l.lng], 12); marker.openPopup(); };
      card.addEventListener("click", e => { if (!e.target.closest("a")) ouvrir(); });
      card.addEventListener("keydown", e => { if (e.key === "Enter" && !e.target.closest("a")) ouvrir(); });

      list.appendChild(card);
    }
  });

  // 5. Ajustement de la vue de la carte
  if (ref && !layer.getLayers().length) {
    map.fitBounds(LIMITES_FRANCE); 
  } else if (!ref && filtres.length) {
    map.fitBounds(LIMITES_FRANCE, { padding: [20, 20] });
  }
}


// =========================================================
// --- 6. CHARGEMENT ASYNCHRONE DES DONNÉES JSON ---
// =========================================================

const chargerJSON = async (url) => {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (err) {
    console.error(`Erreur sur ${url}:`, err);
    return [];
  }
};

Promise.all([
  chargerJSON("redcactus.json"),
  chargerJSON("casinos.json"),
  chargerJSON("caritatifs.json")
]).then(([dataRC, dataCasinos, dataCaritatifs]) => {
  const aujourdhui = new Date().toISOString().split('T')[0];

  const rawFeatures = dataRC.features || (Array.isArray(dataRC) ? dataRC : []);
  const redCactusFormates = rawFeatures.map(f => {
    if (f && f.geometry && Array.isArray(f.geometry.coordinates)) {
      return {
        id: f.id || f.properties?.id,
        nom: f.properties?.nom || f.properties?.name || "Bar RedCactus",
        type: "bar",
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        adresse: f.properties?.adresse || "",
        gratuit: true,
        poker: "tournois"
      };
    }
    return f;
  }).filter(f => f && typeof f.lat === "number" && typeof f.lng === "number");

  const casinosValides = (Array.isArray(dataCasinos) ? dataCasinos : []).filter(c => typeof c.lat === "number" && typeof c.lng === "number");
  
  const caritatifsValides = (Array.isArray(dataCaritatifs) ? dataCaritatifs : [])
    .filter(c => typeof c.lat === "number" && typeof c.lng === "number")
    .filter(c => !c.date || c.date >= aujourdhui);

  lieux = [...redCactusFormates, ...casinosValides, ...caritatifsValides];

  // --- MISE À JOUR DYNAMIQUE DES COMPTEURS ---
  mettreAJourCompteursAccueil(
    redCactusFormates.length,
    casinosValides.length,
    caritatifsValides.length,
    lieux.length
  );

  if (typeof map !== 'undefined' && map) {
    afficher();
  }
}).catch(err => console.error("Erreur globale :", err));


// =========================================================
// --- 7. MOTEUR DE RECHERCHE & GÉOLOCALISATION ---
// =========================================================

function afficherStatut(message) {
  const statut = document.getElementById("statut-lieu");
  if (statut) {
    statut.textContent = message || "";
    statut.hidden = !message;
  }
}

function definirReference(nouvelle) {
  ref = nouvelle;
  coucheRef.clearLayers();
  
  const blocRef = document.getElementById("bloc-ref");
  const listEl = document.getElementById("list");
  
  if (ref) {
    // --- CENTRAGE ET ZOOM AUTOMATIQUE SUR LA CARTE ---
    if (rayon() > 0) {
      const cercle = L.circle([ref.lat, ref.lng], {
        radius: rayon() * 1000,
        color: "#0e7a4f",
        weight: 1.5,
        dashArray: "6 6",
        fillColor: "#0e7a4f",
        fillOpacity: 0.04,
        interactive: false
      }).addTo(coucheRef);

      map.flyToBounds(cercle.getBounds(), { padding: [20, 20], duration: 0.5 });
    } else {
      map.flyTo([ref.lat, ref.lng], 11, { duration: 0.5 });
    }

    L.marker([ref.lat, ref.lng], {
      icon: L.divIcon({ className: "", html: '<div class="point-ref"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
      keyboard: false
    }).bindTooltip(ref.libelle === "vous" ? "Vous êtes ici" : ref.libelle).addTo(coucheRef);
    
    const refTexte = document.getElementById("ref-texte");
    if (refTexte) refTexte.textContent = ref.libelle === "vous" ? "Autour de vous" : `Autour de ${ref.libelle}`;
  }
  
  if (blocRef) blocRef.hidden = !ref;
  if (listEl) listEl.classList.toggle("autour", Boolean(ref));

  const ville = ref && VILLES_AVEC_PAGE.find(v => sansAccents(v) === sansAccents(ref.libelle));
  const lienVille = document.getElementById("lien-page-ville");
  if (lienVille) {
    lienVille.hidden = !ville;
    if (ville) {
      lienVille.href = "lieux/" + sansAccents(ville) + ".html";
      document.getElementById("lien-page-ville-texte").textContent = `Voir la page « Poker à ${ville} »`;
    }
  }

  afficher();
}

async function chercherCommunes(q, limit = 5) {
  const r = await fetch(`${URL_GEOCODAGE}?q=${encodeURIComponent(q)}&index=address&type=municipality&autocomplete=1&limit=${limit}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return (data.features || []).map(f => ({
    libelle: f.properties.city || f.properties.name,
    texte: `${f.properties.city || f.properties.name} (${f.properties.postcode})`,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1]
  }));
}

async function chercherVille(q) {
  if (!q) return;
  if (suggestions.has(q)) return definirReference(suggestions.get(q));

  afficherStatut("Recherche…");
  try {
    const [commune] = await chercherCommunes(q, 1);
    if (!commune) return afficherStatut(`Aucune commune trouvée pour « ${q} ».`);
    afficherStatut("");
    const champVille = document.getElementById("q-lieu");
    if (champVille) {
      champVille.value = commune.texte;
      champVille.blur();
    }
    definirReference(commune);
  } catch (err) {
    afficherStatut("La recherche de ville est indisponible pour le moment.");
  }
}

function localiser() {
  if (!navigator.geolocation) return afficherStatut("Votre navigateur ne permet pas la géolocalisation.");
  afficherStatut("Localisation en cours…");
  navigator.geolocation.getCurrentPosition(
    pos => {
      afficherStatut("");
      definirReference({ lat: pos.coords.latitude, lng: pos.coords.longitude, libelle: "vous" });
    },
    () => afficherStatut("Impossible de vous localiser. Vérifiez l'autorisation de localisation, ou tapez votre ville."),
    { timeout: 10000, maximumAge: 300000 }
  );
}


// =========================================================
// --- 8. MODALE & MENU BURGER DÉROULANT ---
// =========================================================

function toggleMenu(e) {
  if (e) {
    e.stopPropagation(); // Empêche la fermeture immédiate lors du clic sur le burger
  }
  const menu = document.getElementById("dropdown-content");
  if (menu) menu.classList.toggle("show");
}

// Fermeture du menu au clic/toucher n'importe où ailleurs sur mobile et desktop
["click", "touchstart"].forEach(eventType => {
  document.addEventListener(eventType, (e) => {
    const dropdown = document.querySelector(".dropdown");
    const menu = document.getElementById("dropdown-content");

    if (dropdown && menu && !dropdown.contains(e.target)) {
      menu.classList.remove("show");
    }
  });
});


// =========================================================
// --- 9. ÉCOUTEURS D'ÉVÉNEMENTS & INITIALISATION DOM ---
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  // --- A. Écouteurs des filtres de sélection ---
  const fType = document.getElementById("f-type");
  const fPrix = document.getElementById("f-prix");
  const fPoker = document.getElementById("f-poker");

  if (fType) fType.addEventListener("change", afficher);
  if (fPrix) fPrix.addEventListener("change", afficher);
  if (fPoker) fPoker.addEventListener("change", afficher);

  // --- B. Recherche de ville & Autocomplétion ---
  const champVille = document.getElementById("q-lieu");
  const formLieu = document.getElementById("form-lieu");
  const btnRefEffacer = document.getElementById("btn-ref-effacer");
  let minuterie;

  if (champVille) {
    champVille.addEventListener("input", () => {
      const q = champVille.value.trim();
      if (suggestions.has(q)) {
        definirReference(suggestions.get(q));
        champVille.blur();
        return;
      }
      clearTimeout(minuterie);
      if (q.length < 3) return;
      minuterie = setTimeout(async () => {
        try {
          const communes = await chercherCommunes(q);
          suggestions = new Map(communes.map(c => [c.texte, c]));
          const suggEl = document.getElementById("suggestions-lieu");
          if (suggEl) suggEl.replaceChildren(...communes.map(c => new Option(c.texte)));
        } catch (e) { }
      }, 250);
    });
  }

  if (formLieu) {
    formLieu.addEventListener("submit", e => {
      e.preventDefault();
      if (champVille) chercherVille(champVille.value.trim());
    });
  }

  if (fRayon) fRayon.addEventListener("change", () => definirReference(ref));
  if (btnRefEffacer) {
    btnRefEffacer.addEventListener("click", () => {
      if (champVille) champVille.value = "";
      definirReference(null);
    });
  }

  // --- C. Modale "Proposer un tournoi" ---
  const URL_FORMULAIRE = "https://docs.google.com/forms/d/e/1FAIpQLSd1D3HN-joemrjvV5pYSA-wbXtF3-YDajahuXe4At9rseTJIA/viewform?usp=dialog";
  const frame = document.getElementById("dlg-frame");
  const dlg = document.getElementById("dlg-tournoi");

  const openModal = () => {
    if (frame && !frame.src) { frame.src = URL_FORMULAIRE; frame.hidden = false; }
    if (dlg) dlg.showModal();
  };

  const btnProposer = document.getElementById("btn-proposer");
  if (btnProposer) btnProposer.addEventListener("click", openModal);
  document.querySelectorAll("[data-proposer]").forEach(btn => btn.addEventListener("click", openModal));

  const btnClose = document.getElementById("dlg-close");
  if (btnClose && dlg) btnClose.addEventListener("click", () => dlg.close());

  // --- D. Lecture des paramètres URL (?ville=Ancenis ou ?q=Ancenis) ---
  const params = new URLSearchParams(location.search);
  
  if (params.get("type") && fType) {
    fType.value = params.get("type");
  }
  
  const villeParam = params.get("ville") || params.get("q");
  if (villeParam) {
    if (champVille) champVille.value = villeParam;
    chercherVille(villeParam);
  } else if (params.get("autour")) {
    localiser();
  }

  // --- E. Routage SEO par ville (/lieux/paris.html) ---
  const currentPath = window.location.pathname.toLowerCase();
  const cityCoords = {
    'paris': [48.8566, 2.3522], 'lyon': [45.7640, 4.8357], 'marseille': [43.2965, 5.3698],
    'bordeaux': [44.8378, -0.5792], 'lille': [50.6292, 3.0573], 'nantes': [47.2184, -1.5536],
    'nice': [43.7102, 7.2620], 'strasbourg': [48.5734, 7.7521], 'toulouse': [43.6047, 1.4442],
    'montpellier': [43.6108, 3.8767]
  };

  if (currentPath.includes('/lieux/')) {
    const urlParts = currentPath.split('/');
    const cityFromUrl = urlParts[urlParts.length - 1].replace('.html', '');
    if (cityCoords[cityFromUrl] && typeof map !== 'undefined') {
      map.setView(cityCoords[cityFromUrl], 11);
    }
  }

  // --- F. Gestion du bouton Retour universel ---
  const btnRetour = document.querySelector(".btn-retour");
  if (btnRetour) {
    btnRetour.addEventListener("click", (e) => {
      if (document.referrer && document.referrer.includes(window.location.hostname)) {
        e.preventDefault();
        window.history.back();
      } 
      else if (btnRetour.getAttribute("href") === "#" || !btnRetour.getAttribute("href")) {
        e.preventDefault();
        window.location.href = "index.html";
      }
    });
  }

  // --- G. Affichage / Masquage du bloc Recherche & Filtres ---
  const btnToggleFiltres = document.getElementById("btn-toggle-filtres") || document.querySelector("[data-toggle-filtres]");
  const panneauFiltres = document.getElementById("panneau-filtres") || document.getElementById("bloc-filtres");
  const txtToggleFiltres = document.getElementById("txt-toggle-filtres");

  if (btnToggleFiltres && panneauFiltres) {
    btnToggleFiltres.addEventListener("click", () => {
      const estMasque = panneauFiltres.classList.toggle("masque");
      if (txtToggleFiltres) {
        txtToggleFiltres.textContent = estMasque ? "Afficher les options" : "Cacher les options";
      } else {
        const cibleTexte = btnToggleFiltres.querySelector("span") || btnToggleFiltres;
        cibleTexte.textContent = estMasque ? "Afficher les options" : "Cacher les options";
      }
    });
  }
});
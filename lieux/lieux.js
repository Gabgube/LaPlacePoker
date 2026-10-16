// --- Initialisation automatique au chargement de la page ---
document.addEventListener("DOMContentLoaded", () => {
  const elMiniCarte = document.getElementById("mini-carte");
  if (!elMiniCarte || typeof L === "undefined") return;

  const lat = parseFloat(elMiniCarte.dataset.lat);
  const lng = parseFloat(elMiniCarte.dataset.lng);
  const type = elMiniCarte.dataset.type; // "ville" ou "lieu"

  if (type === "ville") {
    const lieux = JSON.parse(elMiniCarte.dataset.lieux || "[]");
    initMiniCarteVille(elMiniCarte, lieux, lat, lng);
  } else {
    const nom = elMiniCarte.dataset.nom || "Lieu";
    const couleur = elMiniCarte.dataset.couleur || "#18181b";
    initMiniCarteLieu(elMiniCarte, lat, lng, nom, couleur);
  }
});

// --- Fonction pour les pages Villes ---
function initMiniCarteVille(el, lieux, centerLat, centerLng) {
  const carte = L.map(el, {
    scrollWheelZoom: false,
    dragging: !L.Browser.mobile,
    tap: false
  }).setView([centerLat, centerLng], 11);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(carte);

  lieux.forEach(([lat, lng, couleur, nom]) => {
    L.marker([lat, lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="chip" style="--c:${couleur}"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      }),
      title: nom
    }).addTo(carte);
  });

  setTimeout(() => carte.invalidateSize(), 100);
}

// --- Fonction pour les pages Fiches (Casinos) ---
function initMiniCarteLieu(el, lat, lng, nom, couleur) {
  const carte = L.map(el, {
    scrollWheelZoom: false,
    dragging: !L.Browser.mobile,
    tap: false
  }).setView([lat, lng], 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(carte);

  L.marker([lat, lng], {
    icon: L.divIcon({
      className: "",
      html: `<div class="pion pion-grand" style="--c:${couleur}"></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    }),
    title: nom
  }).addTo(carte);

  setTimeout(() => carte.invalidateSize(), 100);
}
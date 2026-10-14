/* =========================================================
   villes.js : Interactions spécifiques aux pages de villes
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Modale "Proposer un tournoi"
  const URL_FORMULAIRE = "https://docs.google.com/forms/d/e/1FAIpQLSd1D3HN-joemrjvV5pYSA-wbXtF3-YDajahuXe4At9rseTJIA/viewform?embedded=true";
  const dlg = document.getElementById("dlg-tournoi");
  const dlgClose = document.getElementById("dlg-close");

  if (dlg) {
    document.querySelectorAll("[data-proposer]").forEach(btn => {
      btn.addEventListener("click", () => {
        const frame = document.getElementById("dlg-frame");
        if (frame && !frame.src) {
          frame.src = URL_FORMULAIRE;
          frame.hidden = false;
        }
        dlg.showModal();
      });
    });

    if (dlgClose) {
      dlgClose.addEventListener("click", () => dlg.close());
    }
  }

  // 2. Gestion du bouton Retour universel
  const btnRetour = document.querySelector(".btn-retour");
  if (btnRetour) {
    btnRetour.addEventListener("click", (e) => {
      if (document.referrer && document.referrer.includes(window.location.hostname)) {
        e.preventDefault();
        window.history.back();
      }
    });
  }
});

// 3. Fonction globale d'initialisation de la mini-carte Leaflet
function initMiniCarteVille(lieux, centerLat, centerLng) {
  const elCarte = document.getElementById("mini-carte");
  if (!elCarte || typeof L === "undefined") return;

  const carte = L.map("mini-carte", {
    scrollWheelZoom: false,
    dragging: !L.Browser.mobile,
    tap: false
  });

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    className: "tuiles-douces",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(carte);

  lieux.forEach(([lat, lng, couleur, nom]) => {
    L.marker([lat, lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="pion" style="--c:${couleur}"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      }),
      title: nom
    }).bindTooltip(document.createTextNode(nom)).addTo(carte);
  });

  carte.fitBounds(L.latLng(centerLat, centerLng).toBounds(60000));
}
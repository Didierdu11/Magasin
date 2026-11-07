const $ = id => document.getElementById(id);
let magasinId = null, code = null, canal = null;

(async () => {
  const { data } = await db.from("magasins").select("*").order("nom");
  $("magasin").innerHTML = (data || []).map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join("");
})();

function bip() {
  try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination);
    o.frequency.value = 880; o.start(); o.stop(c.currentTime + 0.25); } catch (_) {}
}

async function charger(notif) {
  const { data, error } = await db.rpc("admin_liste", { p_magasin: magasinId, p_code: code });
  if (error || !data) return ($("erreur").textContent = "Erreur de connexion.");
  if (data.statut !== "ok") return deconnecter(data.statut === "bloque"
    ? "Trop d'essais. Réessayez dans 10 minutes." : "Code incorrect.");
  if (notif) { $("banner").textContent = "Nouvelle réservation : " + notif; $("banner").classList.remove("hidden"); bip();
    setTimeout(() => $("banner").classList.add("hidden"), 8000); }
  const r = data.reservations;
  $("liste").innerHTML = r.length ? r.map(x => `<div class="card">
    <div class="row" style="border:0;padding:0"><strong>${esc(x.numero)}</strong><span class="badge ${x.statut}">${x.statut === "traitee" ? "Traitée" : "En attente"}</span></div>
    <div class="info">${new Date(x.created_at).toLocaleString("fr-FR")}</div>
    <div>${esc(x.prenom)} ${esc(x.nom)} · ${esc(x.telephone)} · ${esc(x.email)}</div>
    <ul class="l">${x.lignes.map(l => `<li>${l.quantite} × ${esc(l.nom)} (${euro(l.prix)})</li>`).join("")}</ul>
    ${x.statut === "en_attente" ? `<button data-id="${x.id}">Marquer comme traitée</button>` : ""}</div>`).join("")
    : '<p class="sub">Aucune réservation pour le moment.</p>';
  document.querySelectorAll("#liste button").forEach(b => b.addEventListener("click", async () => {
    b.disabled = true;
    await db.rpc("admin_traiter", { p_magasin: magasinId, p_code: code, p_reservation: b.dataset.id });
    charger();
  }));
}

$("connexion").addEventListener("click", async () => {
  $("erreur").textContent = "";
  magasinId = $("magasin").value; code = $("code").value.trim();
  if (!/^[0-9]{4}$/.test(code)) return ($("erreur").textContent = "Saisissez 4 chiffres.");
  $("login").classList.add("hidden"); $("dash").classList.remove("hidden");
  $("titre").textContent = $("magasin").selectedOptions[0].textContent;
  await charger();
  if (!magasinId) return;
  canal = db.channel("magasin:" + magasinId)
    .on("broadcast", { event: "nouvelle_reservation" }, m => charger(m.payload.numero)).subscribe();
});

function deconnecter(msg) {
  if (canal) db.removeChannel(canal);
  magasinId = code = canal = null; $("code").value = "";
  $("dash").classList.add("hidden"); $("login").classList.remove("hidden");
  $("erreur").textContent = msg || "";
}
$("quitter").addEventListener("click", () => deconnecter());

const $ = id => document.getElementById(id);
let magasinId = null, code = null, canal = null, reservations = [];

(async () => {
  const { data } = await db.from("magasins").select("*").order("nom");
  $("magasin").innerHTML = (data || []).map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join("");
})();

function bip() {
  try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination);
    o.frequency.value = 880; o.start(); o.stop(c.currentTime + 0.25); } catch (_) {}
}

async function charger(notif) {
  const [rl, pr] = await Promise.all([
    db.rpc("admin_liste", { p_magasin: magasinId, p_code: code }),
    db.from("produits").select("nom,stock").eq("magasin_id", magasinId).order("nom")]);
  const data = rl.data;
  if (rl.error || !data) return ($("erreur").textContent = "Erreur de connexion.");
  if (data.statut !== "ok") return deconnecter(data.statut === "bloque"
    ? "Trop d'essais. Réessayez dans 10 minutes." : "Code incorrect.");
  if (notif) { $("banner").textContent = "Nouvelle réservation : " + notif; $("banner").classList.remove("hidden"); bip();
    setTimeout(() => $("banner").classList.add("hidden"), 8000); }

  $("stock").innerHTML = (pr.data || []).map(p => `<div class="row"><span class="nom">${esc(p.nom)}</span>
    ${p.stock === 0 ? '<span class="badge en_attente">Épuisé</span>' : `<strong>${p.stock} restant(s)</strong>`}</div>`).join("")
    || '<p class="sub">Aucun produit.</p>';

  reservations = data.reservations;
  $("liste").innerHTML = reservations.length ? reservations.map(x => `<div class="card">
    <div class="row" style="border:0;padding:0"><strong>${esc(x.numero)}</strong>
      <span><span class="badge ${x.statut}">${x.statut === "traitee" ? "Traitée" : "En attente"}</span>
      ${x.imprimee ? '<span class="badge traitee">Imprimé</span>' : ""}</span></div>
    <div class="info">${new Date(x.created_at).toLocaleString("fr-FR")}</div>
    <div>${esc(x.prenom)} ${esc(x.nom)} · ${esc(x.telephone)} · ${esc(x.email)}</div>
    <ul class="l">${x.lignes.map(l => `<li>${l.quantite} × ${esc(l.nom)} (${euro(l.prix)})</li>`).join("")}</ul>
    ${x.statut === "en_attente" ? `<button data-act="traiter" data-id="${x.id}">Marquer comme traitée</button> ` : ""}
    <button class="alt" data-act="pdf" data-id="${x.id}">${x.imprimee ? "Réimprimer en PDF" : "Imprimer en PDF"}</button></div>`).join("")
    : '<p class="sub">Aucune réservation pour le moment.</p>';

  document.querySelectorAll("#liste button").forEach(b => b.addEventListener("click", async () => {
    b.disabled = true;
    if (b.dataset.act === "traiter")
      await db.rpc("admin_traiter", { p_magasin: magasinId, p_code: code, p_reservation: b.dataset.id });
    else await imprimer(reservations.find(r => r.id === b.dataset.id));
    charger();
  }));
}

async function imprimer(x) {
  const doc = new jspdf.jsPDF(); let y = 20;
  const fmt = n => Number(n).toFixed(2).replace(".", ",") + " EUR";
  doc.setFontSize(18); doc.text("Bon de réservation", 20, y); y += 10; doc.setFontSize(12);
  [`N° : ${x.numero}`, `Date : ${new Date(x.created_at).toLocaleString("fr-FR")}`, `Magasin : ${$("titre").textContent}`,
   `Client : ${x.prenom} ${x.nom}`, `Téléphone : ${x.telephone}`, `E-mail : ${x.email}`].forEach(t => { doc.text(t, 20, y); y += 7; });
  y += 5; doc.setFont(undefined, "bold"); doc.text("Produit", 20, y); doc.text("Qté", 115, y); doc.text("Prix", 135, y); doc.text("Sous-total", 163, y);
  doc.setFont(undefined, "normal"); y += 7;
  let total = 0;
  x.lignes.forEach(l => { total += l.prix * l.quantite; doc.text(String(l.nom).slice(0, 45), 20, y);
    doc.text(String(l.quantite), 115, y); doc.text(fmt(l.prix), 135, y); doc.text(fmt(l.prix * l.quantite), 163, y); y += 7; });
  y += 4; doc.setFont(undefined, "bold"); doc.text("Total : " + fmt(total), 163, y);
  doc.save(x.numero + ".pdf");
  await db.rpc("admin_imprimee", { p_magasin: magasinId, p_code: code, p_reservation: x.id });
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
    .on("broadcast", { event: "nouvelle_reservation" }, m => charger(m.payload.numero))
    .on("postgres_changes", { event: "*", schema: "public", table: "produits", filter: "magasin_id=eq." + magasinId }, () => charger())
    .subscribe();
});

function deconnecter(msg) {
  if (canal) db.removeChannel(canal);
  magasinId = code = canal = null; $("code").value = "";
  $("dash").classList.add("hidden"); $("login").classList.remove("hidden");
  $("erreur").textContent = msg || "";
}
$("quitter").addEventListener("click", () => deconnecter());

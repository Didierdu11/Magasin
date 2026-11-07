const $ = id => document.getElementById(id);
let produits = [], magasins = [], canal = null, dernier = null;

async function chargerMagasins() {
  const { data, error } = await db.from("magasins").select("*").order("nom");
  if (error) return ($("erreur").textContent = "Impossible de charger les magasins.");
  magasins = data;
  $("magasin").innerHTML = '<option value="">Choisir un magasin…</option>' +
    data.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join("");
}

async function chargerProduits() {
  const id = $("magasin").value;
  const { data } = await db.from("produits").select("*").eq("magasin_id", id).order("nom");
  const saisies = {};
  document.querySelectorAll(".qte").forEach(i => saisies[i.dataset.id] = i.value);
  produits = data || [];
  $("produits").innerHTML = produits.map(p => `
    <div class="row"><div><div class="nom">${esc(p.nom)}</div>
      <div class="info">${euro(p.prix)} · ${p.stock > 0 ? p.stock + " disponible(s)" : "Épuisé"}</div></div>
      <input class="qte" type="number" min="0" max="${p.stock}" value="${Math.min(saisies[p.id] || 0, p.stock)}"
        data-id="${p.id}" ${p.stock === 0 ? "disabled" : ""} aria-label="Quantité ${esc(p.nom)}"></div>`).join("");
  document.querySelectorAll(".qte").forEach(i => i.addEventListener("input", majTotal));
  majTotal();
}

function panier() {
  return [...document.querySelectorAll(".qte")].map(i => ({ produit_id: i.dataset.id, quantite: parseInt(i.value) || 0 }))
    .filter(l => l.quantite > 0);
}
function majTotal() {
  const t = panier().reduce((s, l) => s + l.quantite * produits.find(p => p.id === l.produit_id).prix, 0);
  $("total").textContent = "Total : " + euro(t);
}

$("magasin").addEventListener("change", async () => {
  if (canal) db.removeChannel(canal);
  const id = $("magasin").value;
  $("catalogue").classList.toggle("hidden", !id);
  if (!id) return;
  await chargerProduits();
  canal = db.channel("stock-" + id)
    .on("postgres_changes", { event: "*", schema: "public", table: "produits", filter: "magasin_id=eq." + id }, chargerProduits)
    .subscribe();
});

$("form").addEventListener("submit", async e => {
  e.preventDefault(); $("erreur").textContent = "";
  const lignes = panier();
  const champs = { p_nom: $("nom").value, p_prenom: $("prenom").value, p_telephone: $("tel").value, p_email: $("email").value };
  if (!lignes.length) return ($("erreur").textContent = "Choisissez au moins un produit.");
  if (Object.values(champs).some(v => !v.trim())) return ($("erreur").textContent = "Remplissez tous les champs.");
  if (!/^\S+@\S+\.\S+$/.test(champs.p_email)) return ($("erreur").textContent = "E-mail invalide.");
  $("valider").disabled = true;
  const { data, error } = await db.rpc("creer_reservation", { p_magasin: $("magasin").value, ...champs, p_lignes: lignes });
  $("valider").disabled = false;
  if (error) {
    const m = error.message || "";
    $("erreur").textContent = m.includes("stock_insuffisant")
      ? "Stock insuffisant pour « " + m.split("stock_insuffisant:")[1].trim() + " ». Ajustez la quantité."
      : "La réservation a échoué. Réessayez.";
    return chargerProduits();
  }
  dernier = { ...data, magasin: magasins.find(m => m.id === $("magasin").value).nom, client: `${champs.p_prenom} ${champs.p_nom}`, tel: champs.p_telephone, email: champs.p_email };
  $("numero").textContent = data.numero;
  $("catalogue").classList.add("hidden"); $("confirmation").classList.remove("hidden");
  recuPDF();
});

function recuPDF() {
  const d = dernier, doc = new jspdf.jsPDF(); let y = 20;
  doc.setFontSize(18); doc.text("Bon de réservation", 20, y); y += 10;
  doc.setFontSize(12);
  [`N° : ${d.numero}`, `Date : ${new Date(d.date).toLocaleString("fr-FR")}`, `Magasin : ${d.magasin}`,
   `Client : ${d.client}`, `Téléphone : ${d.tel}`, `E-mail : ${d.email}`].forEach(t => { doc.text(t, 20, y); y += 7; });
  y += 5; doc.setFont(undefined, "bold"); doc.text("Produit", 20, y); doc.text("Qté", 115, y); doc.text("Prix", 135, y); doc.text("Sous-total", 163, y);
  doc.setFont(undefined, "normal"); y += 7;
  const fmt = n => Number(n).toFixed(2).replace(".", ",") + " EUR";
  d.lignes.forEach(l => { doc.text(String(l.nom).slice(0, 45), 20, y); doc.text(String(l.quantite), 115, y);
    doc.text(fmt(l.prix), 135, y); doc.text(fmt(l.prix * l.quantite), 163, y); y += 7; });
  y += 4; doc.setFont(undefined, "bold"); doc.text("Total : " + fmt(d.total), 163, y, { align: "left" });
  y += 14; doc.setFont(undefined, "normal"); doc.text("Présentez ce bon en magasin. Premier arrivé, premier servi.", 20, y);
  doc.save(d.numero + ".pdf");
}
$("pdf").addEventListener("click", recuPDF);
$("nouvelle").addEventListener("click", () => {
  $("confirmation").classList.add("hidden"); $("catalogue").classList.remove("hidden");
  $("form").reset(); chargerProduits();
});
chargerMagasins();

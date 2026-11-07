// Configuration Supabase
const SUPABASE_URL = "https://ujfvbkuieauowhkmwwlg.supabase.co/rest/v1/";
const SUPABASE_KEY = "sb_publishable_zZz79mzUlSQLHuK_whxXKg_BQWMNgZO";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// État de l'application
let currentMagasinId = null;
let currentVendeurMagasin = null;
let produitsData = [];

// Sélection des éléments HTML
const viewClient = document.getElementById('view-client');
const viewVendeur = document.getElementById('view-vendeur');
const btnToggleView = document.getElementById('btn-toggle-view');
const selectMagasin = document.getElementById('select-magasin');
const produitsList = document.getElementById('produits-list');
const sectionProduits = document.getElementById('section-produits');
const recapPanier = document.getElementById('recap-panier');
const totalPrixSpan = document.getElementById('total-prix');

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  await chargerMagasins();
  
  // Écouteur de changement de vue Client / Vendeur
  btnToggleView.addEventListener('click', () => {
    if (viewClient.classList.contains('active')) {
      viewClient.classList.remove('active');
      viewVendeur.classList.add('active');
      btnToggleView.textContent = "Espace Client";
    } else {
      viewVendeur.classList.remove('active');
      viewClient.classList.add('active');
      btnToggleView.textContent = "Espace Vendeur";
    }
  });
});

// Charger la liste des magasins
async function chargerMagasins() {
  const { data: magasins, error } = await supabase.from('magasins').select('*');
  if (error) return alert("Erreur lors de la récupération des magasins");

  selectMagasin.innerHTML = '<option value="">-- Sélectionnez un magasin --</option>';
  const vendeurSelect = document.getElementById('vendeur-select-magasin');
  vendeurSelect.innerHTML = '<option value="">-- Choisissez votre magasin --</option>';

  magasins.forEach(m => {
    selectMagasin.innerHTML += `<option value="${m.id}">${m.nom}</option>`;
    vendeurSelect.innerHTML += `<option value="${m.id}">${m.nom}</option>`;
  });
}

// Choix d'un magasin côté client
selectMagasin.addEventListener('change', async (e) => {
  currentMagasinId = e.target.value;
  if (!currentMagasinId) {
    sectionProduits.style.display = 'none';
    recapPanier.style.display = 'none';
    return;
  }
  await chargerProduits(currentMagasinId);
  sectionProduits.style.display = 'block';
  recapPanier.style.display = 'block';
});

// Charger la liste des produits avec le stock en temps réel
async function chargerProduits(magasinId) {
  const { data: produits, error } = await supabase
    .from('produits')
    .select('*')
    .eq('magasin_id', magasinId);

  if (error) return alert("Erreur lors du chargement des produits");
  produitsData = produits;
  afficherProduits();
}

function afficherProduits() {
  produitsList.innerHTML = '';
  produitsData.forEach(p => {
    produitsList.innerHTML += `
      <div class="produit-card">
        <h4>${p.nom}</h4>
        <p>Prix : <strong>${p.prix.toFixed(2)} €</strong></p>
        <p><span class="stock-badge">Dispo : ${p.quantite_disponible}</span></p>
        <div style="margin-top: 0.5rem;">
          <label>Quantité :</label>
          <input type="number" class="input-quantite" data-id="${p.id}" min="0" max="${p.quantite_disponible}" value="0" ${p.quantite_disponible === 0 ? 'disabled' : ''}>
        </div>
      </div>
    `;
  });

  document.querySelectorAll('.input-quantite').forEach(input => {
    input.addEventListener('input', calculerTotal);
  });
}

function calculerTotal() {
  let total = 0;
  document.querySelectorAll('.input-quantite').forEach(input => {
    const qty = parseInt(input.value) || 0;
    const p = produitsData.find(prod => prod.id === input.dataset.id);
    if (p) total += qty * p.prix;
  });
  totalPrixSpan.textContent = total.toFixed(2);
}

// Soumission du formulaire de réservation
document.getElementById('form-reservation').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const itemsToReserve = [];
  document.querySelectorAll('.input-quantite').forEach(input => {
    const qty = parseInt(input.value) || 0;
    if (qty > 0) {
      const p = produitsData.find(prod => prod.id === input.dataset.id);
      itemsToReserve.push({
        produit_id: p.id,
        nom: p.nom,
        quantite: qty,
        prix: p.prix
      });
    }
  });

  if (itemsToReserve.length === 0) {
    return alert("Veuillez choisir au moins un produit.");
  }

  const payload = {
    p_magasin_id: currentMagasinId,
    p_nom: document.getElementById('client-nom').value,
    p_prenom: document.getElementById('client-prenom').value,
    p_telephone: document.getElementById('client-tel').value,
    p_email: document.getElementById('client-email').value,
    p_items: itemsToReserve
  };

  const { data: reservationId, error } = await supabase.rpc('creer_reservation', payload);

  if (error) {
    alert("Erreur de réservation (stock probablement insuffisant) : " + error.message);
  } else {
    alert("Réservation confirmée !");
    genererPDFReservation({
      id: reservationId,
      nom: payload.p_nom,
      prenom: payload.p_prenom,
      tel: payload.p_telephone,
      email: payload.p_email,
      items: itemsToReserve,
      total: totalPrixSpan.textContent
    });
    location.reload();
  }
});

// Génération du PDF récapitulatif
function genererPDFReservation(res) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Récapitulatif de Réservation", 14, 20);

  doc.setFontSize(11);
  doc.text(`N° Réservation: ${res.id}`, 14, 30);
  doc.text(`Client: ${res.prenom} ${res.nom}`, 14, 38);
  doc.text(`Téléphone: ${res.tel}`, 14, 46);
  doc.text(`Email: ${res.email}`, 14, 54);

  doc.text("Articles réservés :", 14, 68);
  let y = 76;
  res.items.forEach(item => {
    doc.text(`- ${item.nom} x${item.quantite} : ${(item.prix * item.quantite).toFixed(2)} €`, 20, y);
    y += 8;
  });

  doc.setFontSize(14);
  doc.text(`Total à régler en magasin : ${res.total} €`, 14, y + 10);

  doc.save(`reservation_${res.nom}_${res.id.slice(0, 5)}.pdf`);
}

// ----------------- ESPACE VENDEUR -----------------
document.getElementById('btn-connexion-vendeur').addEventListener('click', async () => {
  const magasinId = document.getElementById('vendeur-select-magasin').value;
  const password = document.getElementById('vendeur-password').value;

  if (!magasinId || !password) return alert("Veuillez remplir tous les champs.");

  const { data: magasin, error } = await supabase
    .from('magasins')
    .select('*')
    .eq('id', magasinId)
    .single();

  if (error || magasin.code_vendeur !== password) {
    return alert("Mot de passe incorrect.");
  }

  currentVendeurMagasin = magasin;
  document.getElementById('vendeur-login').style.display = 'none';
  document.getElementById('vendeur-dashboard').style.display = 'block';
  document.getElementById('dashboard-title').textContent = `Magasin : ${magasin.nom}`;

  chargerReservationsVendeur();
  ecouterChangementsTempsReel();
});

async function chargerReservationsVendeur() {
  const { data: res, error } = await supabase
    .from('reservations')
    .select('*, ligne_reservations(*)')
    .eq('magasin_id', currentVendeurMagasin.id)
    .order('created_at', { ascending: false });

  if (error) return;

  const tbody = document.getElementById('reservations-tbody');
  tbody.innerHTML = '';

  let countPending = 0;
  let totalItems = 0;

  res.forEach(r => {
    if (r.statut === 'en_attente') countPending++;
    r.ligne_reservations.forEach(l => totalItems += l.quantite);

    const date = new Date(r.created_at).toLocaleString('fr-FR');
    tbody.innerHTML += `
      <tr>
        <td>${date}</td>
        <td>${r.prenom_client} ${r.nom_client}</td>
        <td>${r.telephone_client}<br><small>${r.email_client}</small></td>
        <td><strong>${r.statut === 'en_attente' ? '⏳ En attente' : '✅ Traitée'}</strong></td>
        <td>
          ${r.statut === 'en_attente' ? `<button onclick="marquerTraitee('${r.id}')" class="btn-primary">Marquer Traitée</button>` : ''}
        </td>
      </tr>
    `;
  });

  document.getElementById('kpi-count-pending').textContent = countPending;
  document.getElementById('kpi-items-count').textContent = totalItems;
}

async function marquerTraitee(reservationId) {
  await supabase.from('reservations').update({ statut: 'traitee' }).eq('id', reservationId);
  chargerReservationsVendeur();
}

function ecouterChangementsTempsReel() {
  supabase
    .channel('reservations-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
      chargerReservationsVendeur();
    })
    .subscribe();
}

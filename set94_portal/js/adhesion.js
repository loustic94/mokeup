// Module Adhésion - Inscription initiale et choix des ateliers
const AdhesionModule = {
  ateliersDisponibles: [], // [{ id, nom }]
  loading: false,

  onActivate() {
    this.chargerAteliers();
  },

  async chargerAteliers() {
    const listEl = document.getElementById('adh-ateliers-list');
    if (!listEl) return;

    listEl.innerHTML = `
      <div class="loading-ateliers" style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 1.5rem;">
        <span class="spinner spinner-dark"></span> Chargement des ateliers disponibles...
      </div>`;

    try {
      const tableAteliers = window.CONFIG.get('TABLE_ATELIERS');
      const data = await window.API.airtableFetch(
        `${encodeURIComponent(tableAteliers)}?sort[0][field]=Nom_Atelier&sort[0][direction]=asc`
      );

      this.ateliersDisponibles = data.records.map(r => ({
        id: r.id,
        nom: r.fields['Nom_Atelier'] || r.fields['Name'] || '(sans nom)'
      }));

      this.afficherAteliers();
    } catch (e) {
      console.error(e);
      listEl.innerHTML = `
        <div class="alert error" style="grid-column: 1/-1;">
          ⚠️ Impossible de charger les ateliers.<br>
          <small>${e.message}</small>
        </div>`;
    }
  },

  afficherAteliers() {
    const listEl = document.getElementById('adh-ateliers-list');
    if (!listEl) return;

    if (this.ateliersDisponibles.length === 0) {
      listEl.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:1.5rem; color:var(--muted)">Aucun atelier disponible.</div>';
      return;
    }

    listEl.innerHTML = this.ateliersDisponibles.map(a => `
      <label class="atelier-card" id="adh-lbl-${a.id}">
        <input type="checkbox" value="${a.id}" onchange="AdhesionModule.toggleAtelierCard('${a.id}', this)" />
        <span class="atelier-card-title">${a.nom}</span>
      </label>
    `).join('');
  },

  toggleAtelierCard(id, checkbox) {
    const card = document.getElementById(`adh-lbl-${id}`);
    if (card) {
      card.classList.toggle('selected', checkbox.checked);
    }
  },

  async soumettre() {
    if (this.loading) return;

    const nom = document.getElementById('adh-nom').value.trim();
    const prenom = document.getElementById('adh-prenom').value.trim();
    const email = document.getElementById('adh-email').value.trim();
    const telephone = document.getElementById('adh-telephone').value.trim();
    const adresse = document.getElementById('adh-adresse').value.trim();
    const ville = document.getElementById('adh-ville').value.trim();
    const codepostal = document.getElementById('adh-codepostal').value.trim();
    const notes = document.getElementById('adh-notes').value.trim();
    const typeRglt = document.getElementById('adh-type-rglt').value;
    const numeroRecu = document.getElementById('adh-numero-recu').value.trim();
    const montant = document.getElementById('adh-montant').value;

    const checkedCheckboxes = document.querySelectorAll('#adh-ateliers-list input[type="checkbox"]:checked');
    const ateliersCoches = Array.from(checkedCheckboxes).map(cb => cb.value);

    const alertEl = document.getElementById('adh-alert');
    const progressContainer = document.getElementById('adh-progress-container');
    const progressBar = document.getElementById('adh-progress-bar');
    const btnSubmit = document.getElementById('adh-submit-btn');

    if (alertEl) alertEl.style.display = 'none';

    // Validation
    if (!nom || !prenom || !email) {
      this.afficherAlert('error', '⚠️ Veuillez remplir les champs obligatoires (Nom, Prénom et Email).');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.afficherAlert('error', '⚠️ L\'adresse email semble incorrecte.');
      return;
    }

    if (ateliersCoches.length === 0) {
      this.afficherAlert('error', '⚠️ Veuillez sélectionner au moins un atelier pour l\'adhésion.');
      return;
    }

    // Début de l'envoi
    this.loading = true;
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span class="spinner"></span> Inscription en cours...`;
    }
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = '5%';
    this.afficherAlert('info', '⏳ Recherche ou création du membre...');

    try {
      const tableMembres = window.CONFIG.get('TABLE_MEMBRES');
      const tableInscriptions = window.CONFIG.get('TABLE_INSCRIPTIONS');

      // 1. Recherche du membre
      const formule = `AND({Email}="${email}",{Nom}="${nom}",{Prénom}="${prenom}")`;
      const searchUrl = `${encodeURIComponent(tableMembres)}?filterByFormula=${encodeURIComponent(formule)}`;
      const searchData = await window.API.airtableFetch(searchUrl);

      let membreId;
      let membreAction; // 'CREE' ou 'MIS_A_JOUR'

      const champsCommuns = {
        'Nom': nom,
        'Prénom': prenom,
        ...(telephone && { 'Téléphone': telephone }),
        ...(adresse && { 'Adresse physique': adresse }),
        ...(ville && { 'Ville': ville }),
        ...(codepostal && { 'Code postal': codepostal }),
        ...(notes && { 'Notes': notes }),
        ...(typeRglt && { 'Type membre-Rglt': typeRglt }),
        ...(numeroRecu && { 'Numéro de reçu': numeroRecu }),
        ...(montant && { 'Montant perçu': parseFloat(montant) }),
      };

      if (searchData.records && searchData.records.length > 0) {
        // Membre existant
        membreId = searchData.records[0].id;
        membreAction = 'MIS_A_JOUR';
        this.afficherAlert('info', '🔄 Membre existant trouvé — Mise à jour des coordonnées...');

        await window.API.airtableFetch(
          `${encodeURIComponent(tableMembres)}/${membreId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ fields: champsCommuns })
          }
        );
      } else {
        // Nouveau membre
        membreAction = 'CREE';
        this.afficherAlert('info', '✨ Nouveau membre — Création du profil...');

        const membreData = await window.API.airtableFetch(
          encodeURIComponent(tableMembres),
          {
            method: 'POST',
            body: JSON.stringify({
              fields: { 'Email': email, ...champsCommuns }
            })
          }
        );
        membreId = membreData.id;
      }

      if (progressBar) progressBar.style.width = '30%';

      // 2. Création des inscriptions
      const total = ateliersCoches.length;
      const aujourd_hui = new Date().toISOString().split('T')[0];

      for (let i = 0; i < total; i++) {
        const atelierId = ateliersCoches[i];
        const nomAtelier = this.ateliersDisponibles.find(a => a.id === atelierId)?.nom || '';
        
        this.afficherAlert('info', `⏳ Inscription à l'atelier ${i + 1}/${total} (${nomAtelier})...`);

        await window.API.airtableFetch(
          encodeURIComponent(tableInscriptions),
          {
            method: 'POST',
            body: JSON.stringify({
              fields: {
                'Membre': [membreId],
                'Atelier': [atelierId],
                'Date_Inscription': aujourd_hui,
                'Statut': 'Actif'
              }
            })
          }
        );

        if (progressBar) {
          progressBar.style.width = (30 + Math.round(70 * (i + 1) / total)) + '%';
        }
      }

      // Connexion automatique après l'inscription
      window.AppState.login({
        id: membreId,
        nom: nom,
        prenom: prenom,
        email: email
      });

      // 3. Succès
      const actionMsg = membreAction === 'CREE'
        ? `✅ Bienvenue ! Le compte de <strong>${prenom} ${nom}</strong> a été créé et inscrit à <strong>${total} atelier(s)</strong>.`
        : `✅ Vos coordonnées ont été mises à jour et vous avez été inscrit(e) à <strong>${total} atelier(s)</strong> supplémentaires.`;
      
      this.afficherAlert('success', actionMsg);
      this.reset();

    } catch (e) {
      console.error(e);
      this.afficherAlert('error', `❌ Une erreur est survenue lors de l'adhésion : ${e.message}`);
      if (progressContainer) progressContainer.style.display = 'none';
    } finally {
      this.loading = false;
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Soumettre l'adhésion
        `;
      }
      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
      }, 2000);
    }
  },

  afficherAlert(type, html) {
    const alertEl = document.getElementById('adh-alert');
    if (!alertEl) return;

    alertEl.style.display = 'flex';
    alertEl.className = `alert ${type}`;
    
    // Déterminer l'icône appropriée
    let icon = '';
    if (type === 'success') {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'error') {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else if (type === 'info') {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    } else if (type === 'warning') {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    }

    alertEl.innerHTML = `${icon}<div>${html}</div>`;
  },

  reset() {
    const fields = [
      'adh-nom', 'adh-prenom', 'adh-email', 'adh-telephone', 'adh-adresse', 
      'adh-ville', 'adh-codepostal', 'adh-notes', 'adh-numero-recu', 'adh-montant'
    ];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    const select = document.getElementById('adh-type-rglt');
    if (select) select.value = '';

    // Décocher les ateliers
    document.querySelectorAll('#adh-ateliers-list input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      this.toggleAtelierCard(cb.value, cb);
    });
  }
};

window.AdhesionModule = AdhesionModule;

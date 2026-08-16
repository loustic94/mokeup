// Module Séances - Réservation de créneaux d'ateliers
const SeancesModule = {
  seancesFutures: [],         // Toutes les séances futures chargées
  inscriptionsExistantes: new Set(), // IDs des séances déjà réservées
  ateliersActifsMembre: new Set(),   // IDs des ateliers actifs du membre
  loading: false,
  
  // Cache de chargement pour éviter les appels réseaux répétés à chaque activation d'onglet
  dataLoaded: false,
  
  // Filtres actifs
  filtreAtelier: 'Tous',
  filtreMesAteliersUniquement: true,

  resetDataState() {
    this.dataLoaded = false;
    this.seancesFutures = [];
    this.inscriptionsExistantes.clear();
    this.ateliersActifsMembre.clear();
  },

  onActivate() {
    this.renderLayout();
  },

  renderLayout() {
    const container = document.getElementById('tab-seances');
    if (!container) return;

    if (!window.AppState.member) {
      container.innerHTML = `
        <div class="card">
          <h2 class="card-title">Inscription aux séances</h2>
          <p class="card-description">Vous devez être identifié(e) pour réserver vos séances.</p>
          
          <div class="alert warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <div>
              <strong>Identification requise</strong> : Veuillez entrer votre email dans l'onglet <strong>Espace Membre</strong> avant de pouvoir vous inscrire aux séances.
            </div>
          </div>

          <div class="btn-wrap" style="margin-top: 1.5rem; justify-content: flex-start;">
            <button class="btn" onclick="window.AppState.switchTab('membre')">
              Aller à l'Espace Membre
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
        </div>
      `;
    } else {
      const member = window.AppState.member;
      container.innerHTML = `
        <div class="card">
          <h2 class="card-title">Inscription aux séances</h2>
          <p class="card-description">Réservez vos créneaux pour les prochains ateliers de la transition.</p>

          <div class="profile-box" style="margin-bottom: 1.5rem; padding: 1rem 1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <span style="font-size:0.95rem;">
                Membre actif : <strong>${member.prenom} ${member.nom}</strong>
              </span>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <input type="checkbox" id="sea-opt-my-workshops" ${this.filtreMesAteliersUniquement ? 'checked' : ''} onchange="SeancesModule.toggleFiltreMesAteliers(this)" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;" />
                <label for="sea-opt-my-workshops" style="margin-bottom:0; font-size:0.85rem; font-weight:600; cursor:pointer; text-transform:none;">
                  Séances de mes ateliers uniquement
                </label>
              </div>
            </div>
          </div>

          <div id="sea-filters" class="filters-bar"></div>

          <div id="sea-list" class="seances-list">
            <div class="loading-seances" style="text-align: center; color: var(--muted); padding: 2rem;">
              <span class="spinner spinner-dark"></span> Chargement des séances à venir...
            </div>
          </div>

          <div class="progress-container" id="sea-progress-container">
            <div class="progress-fill" id="sea-progress-bar"></div>
          </div>

          <div id="sea-alert" class="alert success" style="display:none; margin-top: 1.5rem;"></div>

          <div class="btn-wrap" id="sea-btn-wrap" style="display:none;">
            <button class="btn btn-secondary" onclick="SeancesModule.chargerDonnees(true)">
              Rafraîchir
            </button>
            <button class="btn" id="sea-submit-btn" onclick="SeancesModule.soumettreReservations()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Confirmer les inscriptions
            </button>
          </div>
        </div>
      `;

      if (!this.dataLoaded) {
        this.chargerDonnees();
      } else {
        this.afficherFiltres();
        this.afficherSeances();
        const btnWrap = document.getElementById('sea-btn-wrap');
        if (btnWrap) btnWrap.style.display = 'flex';
      }
    }
  },

  toggleFiltreMesAteliers(checkbox) {
    this.filtreMesAteliersUniquement = checkbox.checked;
    this.filtreAtelier = 'Tous'; // Reset filtre atelier spécifique
    this.afficherFiltres();
    this.afficherSeances();
  },

  async chargerDonnees(forceRefresh = false) {
    if (forceRefresh) this.resetDataState();
    
    this.afficherAlert('info', '⏳ Chargement des ateliers de votre profil...');
    
    try {
      const tableInscriptions = window.CONFIG.get('TABLE_INSCRIPTIONS');
      const tableInscripSeances = window.CONFIG.get('TABLE_INSCRIPTIONS_SEANCES');
      const tableSeances = window.CONFIG.get('TABLE_SEANCES');
      const memberId = window.AppState.member.id;

      // 1. Charger les ateliers actifs du membre
      if (this.ateliersActifsMembre.size === 0) {
        let offset = '';
        do {
          const url = `${encodeURIComponent(tableInscriptions)}`
            + `?fields[]=Membre&fields[]=Atelier&fields[]=Statut`
            + (offset ? `&offset=${offset}` : '');
          const data = await window.API.airtableFetch(url);
          const statutsValides = ['Actif', 'Actif+'];
          
          (data.records || []).forEach(r => {
            const membres = r.fields['Membre'] || [];
            const statut = r.fields['Statut'] || '';
            if (membres.includes(memberId) && statutsValides.includes(statut)) {
              const ateliers = r.fields['Atelier'] || [];
              ateliers.forEach(aid => this.ateliersActifsMembre.add(aid));
            }
          });
          offset = data.offset || '';
        } while (offset);
      }

      // 2. Charger les séances déjà réservées
      if (this.inscriptionsExistantes.size === 0) {
        const formuleInscr = `FIND("${memberId}", ARRAYJOIN({MEMBRES}))`;
        const urlInscr = `${encodeURIComponent(tableInscripSeances)}?filterByFormula=${encodeURIComponent(formuleInscr)}`;
        const dataInscr = await window.API.airtableFetch(urlInscr);
        
        (dataInscr.records || []).forEach(r => {
          const seances = r.fields['SEANCES'] || [];
          seances.forEach(sid => this.inscriptionsExistantes.add(sid));
        });
      }

      // 3. Charger toutes les séances futures programmées
      if (this.seancesFutures.length === 0) {
        const aujourd_hui = new Date().toISOString();
        const formuleSeances = `AND(IS_AFTER({Date_Heure}, "${aujourd_hui}"), OR({Statut}="Programmée", {Statut}=""))`;
        const urlSeances = `${encodeURIComponent(tableSeances)}`
          + `?filterByFormula=${encodeURIComponent(formuleSeances)}`
          + `&sort[0][field]=Date_Heure&sort[0][direction]=asc`;
        
        const dataSeances = await window.API.airtableFetch(urlSeances);
        this.seancesFutures = dataSeances.records || [];
      }

      this.dataLoaded = true;
      this.cacherAlert();
      
      const btnWrap = document.getElementById('sea-btn-wrap');
      if (btnWrap) btnWrap.style.display = 'flex';

      this.afficherFiltres();
      this.afficherSeances();

    } catch (e) {
      console.error(e);
      this.afficherAlert('error', `❌ Impossible de synchroniser les données : ${e.message}`);
      const listEl = document.getElementById('sea-list');
      if (listEl) {
        listEl.innerHTML = `<div class="aucune-seance" style="color:var(--error)">⚠️ Erreur réseau : ${e.message}</div>`;
      }
    }
  },

  afficherFiltres() {
    const wrap = document.getElementById('sea-filters');
    if (!wrap) return;

    // Récupérer la liste des séances filtrées par "Mes ateliers uniquement" pour construire les filtres
    const seancesInitiales = this.getSeancesFiltreesParOptionAteliers();
    
    // Extraire tous les ateliers uniques représentés dans ces séances
    const getAtelierNom = s => {
      const v = s.fields['Nom_Atelier'];
      return Array.isArray(v) ? (v[0] || '') : (v || '');
    };
    
    const ateliersNoms = [...new Set(seancesInitiales.map(getAtelierNom).filter(Boolean))].sort();

    if (ateliersNoms.length <= 1) {
      wrap.innerHTML = '';
      return;
    }

    wrap.innerHTML = [
      `<button class="filter-btn ${this.filtreAtelier === 'Tous' ? 'active' : ''}" onclick="SeancesModule.setFiltreAtelier('Tous')">Toutes les séances</button>`,
      ...ateliersNoms.map(nom => `
        <button class="filter-btn ${this.filtreAtelier === nom ? 'active' : ''}" onclick="SeancesModule.setFiltreAtelier('${nom.replace(/'/g, "\\'")}')">${nom}</button>
      `)
    ].join('');
  },

  setFiltreAtelier(nom) {
    this.filtreAtelier = nom;
    this.afficherFiltres();
    this.afficherSeances();
  },

  getSeancesFiltreesParOptionAteliers() {
    if (this.filtreMesAteliersUniquement) {
      return this.seancesFutures.filter(s => {
        const ateliersSeance = s.fields['Atelier'] || [];
        return ateliersSeance.some(aid => this.ateliersActifsMembre.has(aid));
      });
    }
    return this.seancesFutures;
  },

  afficherSeances() {
    const listEl = document.getElementById('sea-list');
    if (!listEl) return;

    const seancesFiltreesParOption = this.getSeancesFiltreesParOptionAteliers();

    const getAtelierNom = s => {
      const v = s.fields['Nom_Atelier'];
      return Array.isArray(v) ? (v[0] || '') : (v || '');
    };

    // Appliquer le filtre spécifique de l'atelier
    const filtreesFinal = this.filtreAtelier === 'Tous'
      ? seancesFiltreesParOption
      : seancesFiltreesParOption.filter(s => getAtelierNom(s) === this.filtreAtelier);

    if (this.seancesFutures.length === 0) {
      listEl.innerHTML = '<div class="aucune-seance">Aucune séance programmée dans le futur.</div>';
      return;
    }

    if (this.filtreMesAteliersUniquement && this.ateliersActifsMembre.size === 0) {
      listEl.innerHTML = `
        <div class="aucune-seance">
          ⚠️ Vous n'êtes inscrit(e) à aucun atelier actif pour le moment.<br>
          <small>Ajoutez des ateliers dans l'onglet <strong>Espace Membre</strong>, ou décochez l'option "Séances de mes ateliers uniquement" ci-dessus.</small>
        </div>`;
      return;
    }

    if (filtreesFinal.length === 0) {
      listEl.innerHTML = '<div class="aucune-seance">Aucune séance à venir correspondant aux filtres sélectionnés.</div>';
      return;
    }

    listEl.innerHTML = filtreesFinal.map(s => {
      const f = s.fields;
      const atelierVal = Array.isArray(f['Nom_Atelier']) ? f['Nom_Atelier'][0] : (f['Nom_Atelier'] || '');
      const placesLimitees = f['Places_Limitées'] === true;
      const placesMax = f['Places_Max'] || 0;
      const seanceComplete = f['Séance_Complète'] || f['Seance_Complete'] || '';
      const complet = seanceComplete.includes('COMPLET');
      const dejaInscrit = this.inscriptionsExistantes.has(s.id);
      
      const titre = f['Titre séance'] || atelierVal || 'Séance';
      const date = f['Date_Heure'] ? this.formaterDate(f['Date_Heure']) : '—';
      const heure = f['Date_Heure'] ? this.formaterHeure(f['Date_Heure']) : '';
      const lieu = f['Lieu'] || '';
      const duree = f['Durée_Minutes'] ? `${f['Durée_Minutes']} min` : '';

      let placesIndicator = '';
      if (placesLimitees) {
        placesIndicator = complet
          ? '<span style="color:var(--error); font-weight:600;">🔴 Complet</span>'
          : placesMax > 0
            ? `<span style="color:var(--accent); font-weight:500;">🟢 ${placesMax} places max</span>`
            : '<span style="color:var(--accent); font-weight:500;">🟢 Places disponibles</span>';
      }

      let cardClass = '';
      let badgeHtml = '';
      const disabled = complet || dejaInscrit;

      if (dejaInscrit) {
        cardClass = 'deja-inscrit';
        badgeHtml = '<span class="badge-status inscrit">✓ Déjà inscrit</span>';
      } else if (complet) {
        cardClass = 'complet';
        badgeHtml = '<span class="badge-status complet">Complet</span>';
      }

      return `
        <label class="seance-card ${cardClass}" id="sea-card-${s.id}">
          <input type="checkbox" value="${s.id}" ${disabled ? 'disabled' : ''} onchange="SeancesModule.toggleSeanceCard('${s.id}', this)" />
          <div class="seance-info">
            <div class="seance-card-title">${titre}</div>
            <div class="seance-card-meta">
              <span>📅 ${date}</span>
              ${heure ? `<span>🕐 ${heure}</span>` : ''}
              ${lieu ? `<span>📍 ${lieu}</span>` : ''}
              ${duree ? `<span>⏱ ${duree}</span>` : ''}
              ${placesIndicator ? `<span>${placesIndicator}</span>` : ''}
            </div>
          </div>
          ${badgeHtml}
        </label>
      `;
    }).join('');
  },

  toggleSeanceCard(id, checkbox) {
    const card = document.getElementById(`sea-card-${id}`);
    if (card) {
      card.classList.toggle('selected', checkbox.checked);
    }
  },

  async soumettreReservations() {
    if (this.loading) return;

    const checkedBoxes = document.querySelectorAll('#sea-list input[type="checkbox"]:checked');
    const seancesChoisies = Array.from(checkedBoxes).map(cb => cb.value);

    const alertEl = document.getElementById('sea-alert');
    const progressContainer = document.getElementById('sea-progress-container');
    const progressBar = document.getElementById('sea-progress-bar');
    const btnSubmit = document.getElementById('sea-submit-btn');

    if (seancesChoisies.length === 0) {
      this.afficherAlert('error', '⚠️ Veuillez sélectionner au moins une séance à réserver.');
      return;
    }

    this.loading = true;
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span class="spinner"></span> Réservation...`;
    }
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = '5%';

    const tableInscripSeances = window.CONFIG.get('TABLE_INSCRIPTIONS_SEANCES');
    const member = window.AppState.member;
    const aujourd_hui = new Date().toISOString().split('T')[0];
    const total = seancesChoisies.length;
    const erreurs = [];

    try {
      for (let i = 0; i < total; i++) {
        const seanceId = seancesChoisies[i];
        const seance = this.seancesFutures.find(s => s.id === seanceId);
        const f = seance?.fields || {};
        const atelierVal = Array.isArray(f['Nom_Atelier']) ? f['Nom_Atelier'][0] : (f['Nom_Atelier'] || '');
        const titreSeance = f['Titre séance'] || atelierVal || 'Séance';

        // Double vérification côté client
        const seanceComplete = f['Séance_Complète'] || f['Seance_Complete'] || '';
        if (seanceComplete.includes('COMPLET')) {
          erreurs.push(`❌ <strong>${titreSeance}</strong> — Complète, réservation ignorée.`);
          if (progressBar) progressBar.style.width = Math.round(100 * (i + 1) / total) + '%';
          continue;
        }

        this.afficherAlert('info', `⏳ Réservation de la séance ${i + 1}/${total} (${titreSeance})...`);

        await window.API.airtableFetch(
          encodeURIComponent(tableInscripSeances),
          {
            method: 'POST',
            body: JSON.stringify({
              fields: {
                'MEMBRES': [member.id],
                'SEANCES': [seanceId],
                'Date_Inscription': aujourd_hui,
                'Statut': 'Inscrit',
                'Adresse_Mail': member.email
              }
            })
          }
        );

        this.inscriptionsExistantes.add(seanceId); // Mise à jour cache local
        if (progressBar) {
          progressBar.style.width = Math.round(100 * (i + 1) / total) + '%';
        }
      }

      // Résumé
      const nbReussis = total - erreurs.length;
      let msgHtml = '';
      
      if (nbReussis > 0) {
        msgHtml += `✅ Inscriptions validées pour <strong>${nbReussis} séance(s)</strong> !`;
      }
      if (erreurs.length > 0) {
        msgHtml += `${nbReussis > 0 ? '<br><br>' : ''}⚠️ ${erreurs.length} séance(s) non réservée(s) :<br>` + erreurs.join('<br>');
        this.afficherAlert(nbReussis > 0 ? 'warning' : 'error', msgHtml);
      } else {
        this.afficherAlert('success', msgHtml);
      }

      // Recharger pour afficher l'état "Déjà inscrit"
      this.afficherSeances();

    } catch (e) {
      console.error(e);
      this.afficherAlert('error', `❌ Échec lors de l'enregistrement de vos réservations : ${e.message}`);
    } finally {
      this.loading = false;
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Confirmer les inscriptions
        `;
      }
      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
      }, 2000);
    }
  },

  afficherAlert(type, html) {
    const alertEl = document.getElementById('sea-alert');
    if (!alertEl) return;

    alertEl.style.display = 'flex';
    alertEl.className = `alert ${type}`;
    
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

  cacherAlert() {
    const alertEl = document.getElementById('sea-alert');
    if (alertEl) alertEl.style.display = 'none';
  },

  formaterDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  },

  formaterHeure(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
};

window.SeancesModule = SeancesModule;

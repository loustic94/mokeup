// Module Espace Membre - Identification, Profil et gestion interactive des ateliers
const MembreModule = {
  ateliersDisponibles: [], // [{ id, nom }]
  inscriptionsActives: {}, // { atelierId: inscriptionId }
  loading: false,

  onActivate() {
    this.render();
  },

  render() {
    const container = document.getElementById('tab-membre');
    if (!container) return;

    if (!window.AppState.member) {
      // ── ÉTAT DÉCONNECTÉ : Formulaire d'identification ──
      container.innerHTML = `
        <div class="card">
          <h2 class="card-title">Espace Membre</h2>
          <p class="card-description">Saisissez votre adresse e-mail pour accéder à votre profil, gérer vos inscriptions aux ateliers et réserver des séances.</p>
          
          <div class="field">
            <label for="mbr-login-email">Adresse e-mail <span class="req">*</span></label>
            <input type="email" id="mbr-login-email" placeholder="votre.nom@gmail.com" />
          </div>

          <div id="mbr-alert" class="alert error" style="display:none;"></div>

          <div class="btn-wrap" style="justify-content: flex-end;">
            <button class="btn" id="mbr-login-btn" onclick="MembreModule.identifier()">
              Rechercher mon compte
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
          </div>
        </div>
      `;

      // Déclenche la recherche avec Entrée
      const emailInput = document.getElementById('mbr-login-email');
      if (emailInput) {
        emailInput.addEventListener('keydown', e => {
          if (e.key === 'Enter') this.identifier();
        });
      }
    } else {
      // ── ÉTAT CONNECTÉ : Profil + Gestion des Ateliers ──
      const member = window.AppState.member;
      const initiales = ((member.prenom[0] || '') + (member.nom[0] || '')).toUpperCase();

      container.innerHTML = `
        <div class="card" style="margin-bottom: 2rem;">
          <div class="profile-box">
            <div class="profile-header">
              <div class="profile-avatar">${initiales}</div>
              <div>
                <div class="profile-title" id="mbr-profil-nom">${member.prenom} ${member.nom}</div>
                <div class="profile-subtitle" id="mbr-profil-email">${member.email}</div>
              </div>
              <button class="btn btn-secondary btn-sm" style="margin-left: auto; padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="window.AppState.logout()">
                Se déconnecter
              </button>
            </div>
            <p style="font-size: 0.9rem; color: var(--muted); line-height: 1.5;">
              Vous êtes bien connecté(e) à votre espace personnel. Vous pouvez modifier vos choix d'ateliers ci-dessous en temps réel.
            </p>
          </div>

          <h3 style="font-family: 'DM Serif Display', serif; font-size: 1.6rem; color: var(--accent); margin-bottom: 0.5rem;">Mes Ateliers</h3>
          <p class="card-description" style="margin-bottom: 1.5rem;">
            Cliquez sur un atelier pour vous y <strong>inscrire</strong> (il passera en vert) ou pour vous en <strong>désinscrire</strong> (il repassera en gris).
          </p>

          <div id="mbr-ateliers-grid" class="ateliers-grid">
            <div class="loading-ateliers" style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 2rem;">
              <span class="spinner spinner-dark"></span> Synchronisation de vos ateliers...
            </div>
          </div>

          <div id="mbr-action-alert" class="alert success" style="display:none; margin-top: 1.5rem;"></div>
        </div>
      `;

      this.chargerAteliersEtAbonnements();
    }
  },

  async identifier() {
    const emailInput = document.getElementById('mbr-login-email');
    const btn = document.getElementById('mbr-login-btn');
    const alertEl = document.getElementById('mbr-alert');
    
    if (!emailInput) return;
    const email = emailInput.value.trim();

    if (alertEl) alertEl.style.display = 'none';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.afficherAlert('mbr-alert', 'error', '⚠️ Veuillez saisir une adresse email valide.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Recherche en cours...`;
    }

    try {
      const tableMembres = window.CONFIG.get('TABLE_MEMBRES');
      const searchUrl = `${encodeURIComponent(tableMembres)}?filterByFormula=${encodeURIComponent(`{Email}="${email}"`)}`;
      const data = await window.API.airtableFetch(searchUrl);

      if (!data.records || data.records.length === 0) {
        this.afficherAlert('mbr-alert', 'error', `❌ Aucun membre trouvé pour l'adresse <strong>${email}</strong>. Vérifiez l'orthographe ou inscrivez-vous via l'onglet <strong>Adhésion</strong>.`);
        return;
      }

      const r = data.records[0];
      const member = {
        id: r.id,
        nom: r.fields['Nom'] || '',
        prenom: r.fields['Prénom'] || '',
        email: r.fields['Email'] || email
      };

      // Connecter l'utilisateur
      window.AppState.login(member);

    } catch (e) {
      console.error(e);
      this.afficherAlert('mbr-alert', 'error', `❌ Erreur lors de la recherche : ${e.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `Rechercher mon compte <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
      }
    }
  },

  async chargerAteliersEtAbonnements() {
    const grid = document.getElementById('mbr-ateliers-grid');
    if (!grid) return;

    try {
      const tableAteliers = window.CONFIG.get('TABLE_ATELIERS');
      const tableInscriptions = window.CONFIG.get('TABLE_INSCRIPTIONS');
      const memberId = window.AppState.member.id;

      // 1. Charger tous les ateliers disponibles
      const dataAteliers = await window.API.airtableFetch(
        `${encodeURIComponent(tableAteliers)}?sort[0][field]=Nom_Atelier&sort[0][direction]=asc`
      );
      this.ateliersDisponibles = dataAteliers.records.map(r => ({
        id: r.id,
        nom: r.fields['Nom_Atelier'] || r.fields['Name'] || '(sans nom)'
      }));

      // 2. Charger les inscriptions actives de ce membre
      this.inscriptionsActives = {};
      let offset = '';
      
      do {
        const url = `${encodeURIComponent(tableInscriptions)}`
          + `?fields[]=Membre&fields[]=Atelier&fields[]=Statut`
          + (offset ? `&offset=${offset}` : '');
        const dataInscr = await window.API.airtableFetch(url);

        (dataInscr.records || []).forEach(r => {
          const membres = r.fields['Membre'] || [];
          const statut = r.fields['Statut'] || '';
          const statutsValides = ['Actif', 'Actif+'];
          
          if (membres.includes(memberId) && statutsValides.includes(statut)) {
            const ateliers = r.fields['Atelier'] || [];
            ateliers.forEach(aid => {
              this.inscriptionsActives[aid] = r.id; // Stocke l'ID de l'inscription
            });
          }
        });

        offset = dataInscr.offset || '';
      } while (offset);

      this.afficherGrilleAteliers();
    } catch (e) {
      console.error(e);
      grid.innerHTML = `
        <div class="alert error" style="grid-column: 1/-1;">
          ⚠️ Impossible de charger les ateliers.<br>
          <small>${e.message}</small>
        </div>`;
    }
  },

  afficherGrilleAteliers() {
    const grid = document.getElementById('mbr-ateliers-grid');
    if (!grid) return;

    if (this.ateliersDisponibles.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:1.5rem; color:var(--muted)">Aucun atelier trouvé dans la base de données.</div>';
      return;
    }

    grid.innerHTML = this.ateliersDisponibles.map(a => {
      const inscrite = this.inscriptionsActives[a.id] !== undefined;
      return `
        <div class="atelier-card ${inscrite ? 'selected' : ''}" id="mbr-card-${a.id}" onclick="MembreModule.toggleAtelier('${a.id}')">
          <input type="checkbox" id="mbr-chk-${a.id}" ${inscrite ? 'checked' : ''} onclick="event.stopPropagation(); MembreModule.toggleAtelier('${a.id}')" />
          <span class="atelier-card-title">${a.nom}</span>
          ${inscrite ? '<span class="badge-in">Inscrit(e)</span>' : ''}
        </div>
      `;
    }).join('');
  },

  async toggleAtelier(atelierId) {
    if (this.loading) return;
    this.loading = true;

    const card = document.getElementById(`mbr-card-${atelierId}`);
    const chk = document.getElementById(`mbr-chk-${atelierId}`);
    const activeInscrId = this.inscriptionsActives[atelierId];
    const nomAtelier = this.ateliersDisponibles.find(a => a.id === atelierId)?.nom || '';

    // Effet visuel immédiat (optimistic UI)
    const isNowSubscribing = activeInscrId === undefined;
    if (card && chk) {
      card.classList.toggle('selected', isNowSubscribing);
      chk.checked = isNowSubscribing;
      
      // Ajouter un petit loader temporaire à la place du badge
      const badge = card.querySelector('.badge-in');
      if (isNowSubscribing) {
        card.insertAdjacentHTML('beforeend', '<span class="badge-in" id="mbr-temp-spin" style="background:var(--muted)"><span class="spinner" style="width:10px;height:10px;border-width:1.5px;"></span></span>');
      } else if (badge) {
        badge.remove();
      }
    }

    this.afficherAlert('mbr-action-alert', 'info', `⏳ Mise à jour de votre inscription à <strong>${nomAtelier}</strong>...`);

    try {
      const tableInscriptions = window.CONFIG.get('TABLE_INSCRIPTIONS');
      const memberId = window.AppState.member.id;
      const aujourd_hui = new Date().toISOString().split('T')[0];

      if (isNowSubscribing) {
        // ── S'INSCRIRE ──
        const newRecord = await window.API.airtableFetch(
          encodeURIComponent(tableInscriptions),
          {
            method: 'POST',
            body: JSON.stringify({
              fields: {
                'Membre': [memberId],
                'Atelier': [atelierId],
                'Date_Inscription': aujourd_hui,
                'Statut': 'Actif'
              }
            })
          }
        );
        this.inscriptionsActives[atelierId] = newRecord.id;
        this.afficherAlert('mbr-action-alert', 'success', `✅ Vous êtes maintenant inscrit(e) à l'atelier <strong>${nomAtelier}</strong> !`);
      } else {
        // ── SE DÉSINSCRIRE ──
        await window.API.airtableFetch(
          `${encodeURIComponent(tableInscriptions)}/${activeInscrId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              fields: {
                'Statut': 'Supprimé',
                'Date_Désinscription': aujourd_hui
              }
            })
          }
        );
        delete this.inscriptionsActives[atelierId];
        this.afficherAlert('mbr-action-alert', 'success', `ℹ️ Désinscription prise en compte pour l'atelier <strong>${nomAtelier}</strong>.`);
      }

      // Si on change les ateliers actifs, on vide le cache des séances pour forcer le rechargement
      if (window.SeancesModule) {
        window.SeancesModule.resetDataState();
      }

    } catch (e) {
      console.error(e);
      this.afficherAlert('mbr-action-alert', 'error', `❌ Échec de la modification : ${e.message}`);
      
      // Revert l'état visuel en cas d'erreur
      if (card && chk) {
        card.classList.toggle('selected', !isNowSubscribing);
        chk.checked = !isNowSubscribing;
      }
    } finally {
      // Nettoyage spinner temporaire et re-rendu propre
      const tempSpin = document.getElementById('mbr-temp-spin');
      if (tempSpin) tempSpin.remove();
      
      this.loading = false;
      this.afficherGrilleAteliers();
      
      // Cache le message d'alerte après 3 secondes
      setTimeout(() => {
        const actionAlert = document.getElementById('mbr-action-alert');
        if (actionAlert) actionAlert.style.display = 'none';
      }, 3500);
    }
  },

  afficherAlert(id, type, html) {
    const alertEl = document.getElementById(id);
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
    }

    alertEl.innerHTML = `${icon}<div>${html}</div>`;
  }
};

window.MembreModule = MembreModule;

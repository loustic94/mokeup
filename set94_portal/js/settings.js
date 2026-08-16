// Module Paramètres - Gestion des identifiants et API
const SettingsModule = {
  onActivate() {
    this.chargerParametres();
  },

  chargerParametres() {
    const provider = window.CONFIG.get('API_PROVIDER') || 'baserow';
    
    // Remplir le fournisseur
    const providerSelect = document.getElementById('set-provider');
    if (providerSelect) providerSelect.value = provider;

    // Remplir les champs
    const setVal = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.value = window.CONFIG.get(key);
    };

    setVal('set-baserow-url', 'BASEROW_URL');
    setVal('set-token', 'TOKEN');
    setVal('set-base-id', 'BASE_ID');
    setVal('set-webhook', 'WEBHOOK_ZAPIER');

    // Tables Baserow
    setVal('set-table-membres', 'TABLE_MEMBRES');
    setVal('set-table-ateliers', 'TABLE_ATELIERS');
    setVal('set-table-seances', 'TABLE_SEANCES');
    setVal('set-table-inscriptions', 'TABLE_INSCRIPTIONS');
    setVal('set-table-inscr-seances', 'TABLE_INSCRIPTIONS_SEANCES');

    this.toggleFields();
    this.afficherStatusSurcharge();
  },

  toggleFields() {
    const providerSelect = document.getElementById('set-provider');
    if (!providerSelect) return;

    const provider = providerSelect.value;
    const baserowGroup = document.getElementById('baserow-fields-group');
    const airtableGroup = document.getElementById('airtable-fields-group');
    const labelToken = document.getElementById('label-token');

    if (provider === 'baserow') {
      if (baserowGroup) baserowGroup.style.display = 'block';
      if (airtableGroup) airtableGroup.style.display = 'none';
      if (labelToken) labelToken.innerHTML = `Jeton de base de données Baserow (Database Token)<span class="req">*</span><span id="set-status-token" style="font-weight:normal;"></span>`;
    } else {
      if (baserowGroup) baserowGroup.style.display = 'none';
      if (airtableGroup) airtableGroup.style.display = 'block';
      if (labelToken) labelToken.innerHTML = `Jeton Airtable (PAT Token)<span class="req">*</span><span id="set-status-token" style="font-weight:normal;"></span>`;
    }

    this.afficherStatusSurcharge();
  },

  afficherStatusSurcharge() {
    const fields = [
      'API_PROVIDER', 'BASEROW_URL', 'TOKEN', 'BASE_ID', 'WEBHOOK_ZAPIER',
      'TABLE_MEMBRES', 'TABLE_ATELIERS', 'TABLE_SEANCES', 'TABLE_INSCRIPTIONS', 'TABLE_INSCRIPTIONS_SEANCES'
    ];
    fields.forEach(field => {
      let elId = `set-status-${field.toLowerCase().replace(/_/g, '-')}`;
      
      // Adaptations de noms d'ID HTML spécifiques
      if (field === 'TABLE_INSCRIPTIONS_SEANCES') elId = 'set-status-table-inscr-seances';

      const indicator = document.getElementById(elId);
      if (indicator) {
        if (window.CONFIG.isOverridden(field)) {
          indicator.textContent = ' (Surchargé localement)';
          indicator.style.color = 'var(--accent)';
          indicator.style.fontWeight = '600';
        } else {
          indicator.textContent = ' (Défaut)';
          indicator.style.color = 'var(--muted)';
          indicator.style.fontWeight = 'normal';
        }
      }
    });
  },

  sauvegarder() {
    const provider = document.getElementById('set-provider').value;
    const baserowUrl = document.getElementById('set-baserow-url').value.trim();
    const token = document.getElementById('set-token').value.trim();
    const baseId = document.getElementById('set-base-id').value.trim();
    const webhook = document.getElementById('set-webhook').value.trim();

    const tableMembres = document.getElementById('set-table-membres').value.trim();
    const tableAteliers = document.getElementById('set-table-ateliers').value.trim();
    const tableSeances = document.getElementById('set-table-seances').value.trim();
    const tableInscriptions = document.getElementById('set-table-inscriptions').value.trim();
    const tableInscrSeances = document.getElementById('set-table-inscr-seances').value.trim();

    try {
      window.CONFIG.set('API_PROVIDER', provider);
      window.CONFIG.set('BASEROW_URL', baserowUrl);
      window.CONFIG.set('TOKEN', token);
      window.CONFIG.set('BASE_ID', baseId);
      window.CONFIG.set('WEBHOOK_ZAPIER', webhook);

      window.CONFIG.set('TABLE_MEMBRES', tableMembres);
      window.CONFIG.set('TABLE_ATELIERS', tableAteliers);
      window.CONFIG.set('TABLE_SEANCES', tableSeances);
      window.CONFIG.set('TABLE_INSCRIPTIONS', tableInscriptions);
      window.CONFIG.set('TABLE_INSCRIPTIONS_SEANCES', tableInscrSeances);

      if (window.SeancesModule) window.SeancesModule.resetDataState();

      this.afficherAlert('success', '✅ Paramètres sauvegardés avec succès ! Rechargement en cours pour appliquer les modifications...');
      this.afficherStatusSurcharge();

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (e) {
      this.afficherAlert('error', `❌ Impossible de sauvegarder les paramètres : ${e.message}`);
    }
  },

  reinitialiser() {
    if (confirm("Voulez-vous vraiment restaurer les identifiants et API par défaut de l'association ? Vos modifications locales seront effacées.")) {
      window.CONFIG.reset();
      
      if (window.SeancesModule) window.SeancesModule.resetDataState();
      
      this.chargerParametres();
      this.afficherAlert('success', '🔄 Les valeurs par défaut ont été restaurées avec succès. Rechargement...');
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  },

  afficherAlert(type, html) {
    const alertEl = document.getElementById('set-alert');
    if (!alertEl) return;

    alertEl.style.display = 'flex';
    alertEl.className = `alert ${type}`;
    
    let icon = '';
    if (type === 'success') {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'error') {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    }

    alertEl.innerHTML = `${icon}<div>${html}</div>`;
    
    setTimeout(() => {
      alertEl.style.display = 'none';
    }, 4000);
  },

  deconnecter() {
    sessionStorage.removeItem('SET94_IS_ADMIN');
    window.AppState.switchTab('accueil');
  }
};

window.SettingsModule = SettingsModule;

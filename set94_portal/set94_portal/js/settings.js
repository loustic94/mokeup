// Module Paramètres - Gestion des identifiants et API
const SettingsModule = {
  onActivate() {
    this.chargerParametres();
  },

  chargerParametres() {
    const tokenInput = document.getElementById('set-token');
    const baseIdInput = document.getElementById('set-base-id');
    const webhookInput = document.getElementById('set-webhook');

    if (tokenInput) tokenInput.value = window.CONFIG.get('TOKEN');
    if (baseIdInput) baseIdInput.value = window.CONFIG.get('BASE_ID');
    if (webhookInput) webhookInput.value = window.CONFIG.get('WEBHOOK_ZAPIER');

    this.afficherStatusSurcharge();
  },

  afficherStatusSurcharge() {
    const fields = ['TOKEN', 'BASE_ID', 'WEBHOOK_ZAPIER'];
    fields.forEach(field => {
      const indicator = document.getElementById(`set-status-${field.toLowerCase().replace('_', '-')}`);
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
    const token = document.getElementById('set-token').value.trim();
    const baseId = document.getElementById('set-base-id').value.trim();
    const webhook = document.getElementById('set-webhook').value.trim();

    try {
      window.CONFIG.set('TOKEN', token);
      window.CONFIG.set('BASE_ID', baseId);
      window.CONFIG.set('WEBHOOK_ZAPIER', webhook);

      // Force à vider les caches de données
      if (window.SeancesModule) window.SeancesModule.resetDataState();
      if (window.MembreModule) window.MembreModule.chargerAteliersEtAbonnements().catch(() => {});

      this.afficherAlert('success', '✅ Paramètres sauvegardés avec succès ! Les modifications sont appliquées immédiatement.');
      this.afficherStatusSurcharge();
    } catch (e) {
      this.afficherAlert('error', `❌ Impossible de sauvegarder les paramètres : ${e.message}`);
    }
  },

  reinitialiser() {
    if (confirm("Voulez-vous vraiment restaurer les identifiants et API par défaut de l'association ? Vos modifications locales seront effacées.")) {
      window.CONFIG.reset();
      
      // Force à vider les caches de données
      if (window.SeancesModule) window.SeancesModule.resetDataState();
      
      this.chargerParametres();
      this.afficherAlert('success', '🔄 Les valeurs par défaut ont été restaurées avec succès.');
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

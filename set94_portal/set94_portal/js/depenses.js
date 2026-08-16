// Module Dépenses - Demandes d'achat et remboursements
const DepensesModule = {
  loading: false,

  onActivate() {
    this.initExclusionLogic();
  },

  initExclusionLogic() {
    const atelierInput = document.getElementById('dep-atelier');
    const cercleInput = document.getElementById('dep-cercle');
    
    if (!atelierInput || !cercleInput) return;

    const handler = () => {
      if (atelierInput.value.trim() !== '') {
        cercleInput.disabled = true;
        cercleInput.placeholder = 'Désactivé (Atelier renseigné)';
      } else if (cercleInput.value.trim() !== '') {
        atelierInput.disabled = true;
        atelierInput.placeholder = 'Désactivé (Cercle Projet renseigné)';
      } else {
        cercleInput.disabled = false;
        cercleInput.placeholder = 'Ex : Transition numérique, Énergie...';
        atelierInput.disabled = false;
        atelierInput.placeholder = 'Ex : Informatique, Jardin...';
      }
    };

    atelierInput.addEventListener('input', handler);
    cercleInput.addEventListener('input', handler);
  },

  async soumettre() {
    if (this.loading) return;

    const atelierInput = document.getElementById('dep-atelier');
    const cercleInput = document.getElementById('dep-cercle');
    const quiDemande = document.getElementById('dep-qui').value.trim();
    const quoi = document.getElementById('dep-quoi').value.trim();
    const questionDemande = document.getElementById('dep-desc').value.trim();
    const montant = document.getElementById('dep-montant').value;
    const lienDocument = document.getElementById('dep-lien').value.trim();

    const alertEl = document.getElementById('dep-alert');
    const btnSubmit = document.getElementById('dep-submit-btn');

    if (alertEl) alertEl.style.display = 'none';

    // 1. Validation de sécurité : au moins l'un des deux doit être rempli
    if (atelierInput.value.trim() === "" && cercleInput.value.trim() === "") {
      this.afficherAlert('error', '⚠️ Veuillez renseigner soit un Atelier, soit un Cercle Projet.');
      return;
    }

    if (!quiDemande || !quoi || !questionDemande || !montant) {
      this.afficherAlert('error', '⚠️ Veuillez remplir tous les champs obligatoires.');
      return;
    }

    this.loading = true;
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span class="spinner"></span> Transmission...`;
    }
    this.afficherAlert('info', '⏳ Envoi de votre demande de dépense...');

    try {
      // Préparation des données pour le webhook (Structure attendue par le Zapier de SET94)
      const payload = {
        "Atelier": atelierInput.value.trim(),
        "ou bien Cercle Projet": cercleInput.value.trim(),
        "Qui demande ? (Identifiez-vous avec l'adresse gmail pour la réception de la validation)": quiDemande,
        "Quoi": quoi,
        "Question/Demande": questionDemande,
        "Montant si demande d'achat/remboursement/investissement": montant,
        "Lien vers document explicatif/Suivi de projet/facture d'achat": lienDocument
      };

      await window.API.sendZapierWebhook(payload);

      this.afficherAlert('success', '✅ Votre demande d\'achat a bien été enregistrée et transmise aux valideurs de l\'association.');
      this.resetForm();

    } catch (e) {
      console.error(e);
      this.afficherAlert('error', `❌ Échec de la transmission : ${e.message}`);
    } finally {
      this.loading = false;
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Soumettre la demande';
      }
    }
  },

  afficherAlert(type, html) {
    const alertEl = document.getElementById('dep-alert');
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
  },

  resetForm() {
    const form = document.getElementById('purchaseForm');
    if (form) {
      form.reset();
      this.initExclusionLogic(); // Rétablit les placeholders et états activés
    }
  }
};

window.DepensesModule = DepensesModule;

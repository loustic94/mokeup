// Contrôleur principal de l'application SET94
const AppState = {
  member: null, // { id, nom, prenom, email }
  activeTab: 'accueil',

  init() {
    // 1. Gérer le menu mobile
    const toggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });

      // Ferme la sidebar sur clic extérieur (mobile)
      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target) && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      });
    }

    // 2. Gestion de la navigation
    document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = link.getAttribute('data-tab');
        
        if (tabName === 'settings') {
          const isAdmin = sessionStorage.getItem('SET94_IS_ADMIN') === 'true';
          if (!isAdmin) {
            const pwd = prompt("Entrez le mot de passe administrateur pour accéder à la configuration :");
            if (pwd === 'adminset94') {
              sessionStorage.setItem('SET94_IS_ADMIN', 'true');
            } else {
              if (pwd !== null) alert("Mot de passe incorrect.");
              return;
            }
          }
        }

        this.switchTab(tabName);
        
        // Ferme la sidebar sur mobile après navigation
        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      });
    });

    // 3. Charger la session membre existante
    const savedMember = sessionStorage.getItem('SET94_ACTIVE_MEMBER');
    if (savedMember) {
      try {
        this.member = JSON.parse(savedMember);
        this.updateUserBadge();
      } catch (e) {
        console.error("Erreur parsing session membre", e);
        sessionStorage.removeItem('SET94_ACTIVE_MEMBER');
      }
    }

    // 4. Activer l'onglet par défaut (Accueil ou hash de l'URL)
    const hash = window.location.hash.replace('#', '');
    let defaultTab = ['accueil', 'adhesion', 'membre', 'seances', 'depenses', 'settings'].includes(hash) ? hash : 'accueil';
    if (defaultTab === 'settings' && sessionStorage.getItem('SET94_IS_ADMIN') !== 'true') {
      defaultTab = 'accueil';
    }
    this.switchTab(defaultTab);
  },

  switchTab(tabId) {
    this.activeTab = tabId;
    window.location.hash = tabId;

    // Met à jour la classe active sur les liens
    document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
      if (link.getAttribute('data-tab') === tabId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Met à jour l'affichage des sections
    document.querySelectorAll('.tab-content').forEach(section => {
      if (section.id === `tab-${tabId}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Déclencher le chargement ou rafraîchissement spécifique à l'onglet
    this.onTabActivated(tabId);
  },

  onTabActivated(tabId) {
    if (tabId === 'adhesion') {
      if (window.AdhesionModule && typeof window.AdhesionModule.onActivate === 'function') {
        window.AdhesionModule.onActivate();
      }
    } else if (tabId === 'membre') {
      if (window.MembreModule && typeof window.MembreModule.onActivate === 'function') {
        window.MembreModule.onActivate();
      }
    } else if (tabId === 'seances') {
      if (window.SeancesModule && typeof window.SeancesModule.onActivate === 'function') {
        window.SeancesModule.onActivate();
      }
    } else if (tabId === 'depenses') {
      if (window.DepensesModule && typeof window.DepensesModule.onActivate === 'function') {
        window.DepensesModule.onActivate();
      }
    } else if (tabId === 'settings') {
      if (window.SettingsModule && typeof window.SettingsModule.onActivate === 'function') {
        window.SettingsModule.onActivate();
      }
    } else if (tabId === 'accueil') {
      this.refreshStats();
    }
  },

  login(member) {
    this.member = member;
    sessionStorage.setItem('SET94_ACTIVE_MEMBER', JSON.stringify(member));
    this.updateUserBadge();

    // Si on s'est connecté depuis l'Espace Membre, on recharge l'espace membre
    if (this.activeTab === 'membre' && window.MembreModule) {
      window.MembreModule.onActivate();
    }
    // Si on s'est connecté, rafraîchit l'Espace Séances aussi
    if (window.SeancesModule) {
      window.SeancesModule.resetDataState();
    }
  },

  logout() {
    this.member = null;
    sessionStorage.removeItem('SET94_ACTIVE_MEMBER');
    this.updateUserBadge();

    // Rediriger vers l'espace membre pour reconnexion
    if (this.activeTab === 'membre' && window.MembreModule) {
      window.MembreModule.onActivate();
    }
    if (this.activeTab === 'seances' && window.SeancesModule) {
      window.SeancesModule.onActivate();
    }
  },

  updateUserBadge() {
    const badge = document.getElementById('user-badge');
    const badgeText = document.getElementById('user-badge-text');
    
    if (badge && badgeText) {
      if (this.member) {
        badge.classList.add('connected');
        badgeText.innerHTML = `Connecté : <strong>${this.member.prenom} ${this.member.nom}</strong>`;
      } else {
        badge.classList.remove('connected');
        badgeText.innerHTML = `Espace membre déconnecté`;
      }
    }
  },

  async refreshStats() {
    // Affiche des statistiques simples à l'accueil
    const countAteliersEl = document.getElementById('stat-ateliers-count');
    const countSeancesEl = document.getElementById('stat-seances-count');
    
    if (countAteliersEl) countAteliersEl.textContent = '...';
    if (countSeancesEl) countSeancesEl.textContent = '...';

    try {
      // 1. Ateliers
      const ateliersData = await window.API.airtableFetch(
        `${encodeURIComponent(window.CONFIG.get('TABLE_ATELIERS'))}?maxRecords=100`
      );
      if (countAteliersEl) {
        countAteliersEl.textContent = ateliersData.records?.length || 0;
      }

      // 2. Séances futures
      const aujourd_hui = new Date().toISOString();
      const formuleSeances = `AND(IS_AFTER({Date_Heure}, "${aujourd_hui}"), OR({Statut}="Programmée", {Statut}=""))`;
      const seancesData = await window.API.airtableFetch(
        `${encodeURIComponent(window.CONFIG.get('TABLE_SEANCES'))}?filterByFormula=${encodeURIComponent(formuleSeances)}&maxRecords=100`
      );
      if (countSeancesEl) {
        countSeancesEl.textContent = seancesData.records?.length || 0;
      }
    } catch (e) {
      console.warn("Impossible de charger les statistiques d'accueil :", e.message);
      if (countAteliersEl) countAteliersEl.textContent = '15+';
      if (countSeancesEl) countSeancesEl.textContent = '5+';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AppState.init();
});

window.AppState = AppState;

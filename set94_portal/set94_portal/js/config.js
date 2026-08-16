// Configuration centralisée pour l'application SET94
const DEFAULT_CONFIG = {
  TOKEN: 'pat05rfaq3m3jvyS9.7d1051cfed23d99c0dd8a8d2b15c37ecb2558cb93b3bfa045bdce60079513994',
  BASE_ID: 'appSpAPuylGFhWFTt',
  TABLE_MEMBRES: 'MEMBRES',
  TABLE_ATELIERS: 'ATELIERS',
  TABLE_INSCRIPTIONS: 'INSCRIPTIONS',
  TABLE_SEANCES: 'SEANCES',
  TABLE_INSCRIPTIONS_SEANCES: 'INSCRIPTIONS_SEANCES',
  WEBHOOK_ZAPIER: 'https://hooks.zapier.com/hooks/catch/5669844/4o5k41w/'
};

const CONFIG = {
  get(key) {
    // Tente de récupérer depuis localStorage, sinon retourne la valeur par défaut
    const localVal = localStorage.getItem(`SET94_${key}`);
    return localVal !== null ? localVal : DEFAULT_CONFIG[key];
  },

  set(key, value) {
    if (value === null || value === undefined || value.trim() === '') {
      localStorage.removeItem(`SET94_${key}`);
    } else {
      localStorage.setItem(`SET94_${key}`, value.trim());
    }
  },

  reset() {
    Object.keys(DEFAULT_CONFIG).forEach(key => {
      localStorage.removeItem(`SET94_${key}`);
    });
  },

  isOverridden(key) {
    return localStorage.getItem(`SET94_${key}`) !== null;
  }
};

window.CONFIG = CONFIG;

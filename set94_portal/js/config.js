// Configuration centralisée pour l'application SET94
const DEFAULT_CONFIG_BASEROW = {
  API_PROVIDER: 'baserow',
  BASEROW_URL: 'https://api.baserow.io',
  TOKEN: '', // À saisir par l'utilisateur
  TABLE_MEMBRES: '1010820',
  TABLE_ATELIERS: '1010821',
  TABLE_SEANCES: '1010822',
  TABLE_INSCRIPTIONS: '1010823',
  TABLE_INSCRIPTIONS_SEANCES: '1010824',
  TABLE_BESOINS_URGENTS: '1010825',
  TABLE_VOTES_ACHATS: '1010826',
  TABLE_VALIDEURS_ACHATS: '1010827',
  WEBHOOK_ZAPIER: 'https://hooks.zapier.com/hooks/catch/5669844/4o5k41w/'
};

const DEFAULT_CONFIG_AIRTABLE = {
  API_PROVIDER: 'airtable',
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
    const localVal = localStorage.getItem(`SET94_${key}`);
    if (localVal !== null) return localVal;
    
    // Déterminer le fournisseur actif
    const provider = localStorage.getItem('SET94_API_PROVIDER') || 'baserow';
    const defaults = provider === 'airtable' ? DEFAULT_CONFIG_AIRTABLE : DEFAULT_CONFIG_BASEROW;
    return defaults[key] !== undefined ? defaults[key] : '';
  },

  set(key, value) {
    if (value === null || value === undefined || value.trim() === '') {
      localStorage.removeItem(`SET94_${key}`);
    } else {
      localStorage.setItem(`SET94_${key}`, value.trim());
    }
  },

  reset() {
    const keys = [
      'API_PROVIDER', 'BASEROW_URL', 'TOKEN', 'BASE_ID',
      'TABLE_MEMBRES', 'TABLE_ATELIERS', 'TABLE_INSCRIPTIONS', 'TABLE_SEANCES', 'TABLE_INSCRIPTIONS_SEANCES',
      'TABLE_BESOINS_URGENTS', 'TABLE_VOTES_ACHATS', 'TABLE_VALIDEURS_ACHATS', 'WEBHOOK_ZAPIER'
    ];
    keys.forEach(key => {
      localStorage.removeItem(`SET94_${key}`);
    });
  },

  isOverridden(key) {
    return localStorage.getItem(`SET94_${key}`) !== null;
  }
};

window.CONFIG = CONFIG;

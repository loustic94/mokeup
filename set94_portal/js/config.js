// Configuration centralisée pour l'application SET94
//
// ⚠️ CORRECTIF : les surcharges locales (localStorage) sont désormais
// scopées par fournisseur actif (SET94_baserow_TOKEN vs SET94_airtable_TOKEN,
// etc.), au lieu d'une clé unique partagée (SET94_TOKEN). Auparavant,
// surcharger un champ dans un mode "fuyait" vers l'autre mode dès qu'on
// changeait de fournisseur, car get() retrouvait la surcharge avant même
// de regarder quel provider était actif.
//
// SET94_API_PROVIDER reste volontairement une clé unique, non scopée :
// c'est elle-même qui détermine le scope à utiliser pour toutes les autres.

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

// Toutes les clés existantes, hors API_PROVIDER (gérée à part car non scopée)
const TOUTES_LES_CLES = [
  'BASEROW_URL', 'TOKEN', 'BASE_ID',
  'TABLE_MEMBRES', 'TABLE_ATELIERS', 'TABLE_INSCRIPTIONS', 'TABLE_SEANCES', 'TABLE_INSCRIPTIONS_SEANCES',
  'TABLE_BESOINS_URGENTS', 'TABLE_VOTES_ACHATS', 'TABLE_VALIDEURS_ACHATS', 'WEBHOOK_ZAPIER'
];

function providerActif() {
  return localStorage.getItem('SET94_API_PROVIDER') || 'baserow';
}

const CONFIG = {
  get(key) {
    if (key === 'API_PROVIDER') {
      return providerActif();
    }

    const provider = providerActif();
    const scopedKey = `SET94_${provider}_${key}`;
    const localVal = localStorage.getItem(scopedKey);
    if (localVal !== null) return localVal;

    const defaults = provider === 'airtable' ? DEFAULT_CONFIG_AIRTABLE : DEFAULT_CONFIG_BASEROW;
    return defaults[key] !== undefined ? defaults[key] : '';
  },

  set(key, value) {
    if (key === 'API_PROVIDER') {
      if (value === null || value === undefined || value.trim() === '') {
        localStorage.removeItem('SET94_API_PROVIDER');
      } else {
        localStorage.setItem('SET94_API_PROVIDER', value.trim());
      }
      return;
    }

    const provider = providerActif();
    const scopedKey = `SET94_${provider}_${key}`;
    if (value === null || value === undefined || value.trim() === '') {
      localStorage.removeItem(scopedKey);
    } else {
      localStorage.setItem(scopedKey, value.trim());
    }
  },

  // Réinitialise TOUT (les deux fournisseurs + le choix du fournisseur actif),
  // pour repartir sur une base saine des deux côtés.
  reset() {
    ['airtable', 'baserow'].forEach(provider => {
      TOUTES_LES_CLES.forEach(key => {
        localStorage.removeItem(`SET94_${provider}_${key}`);
      });
    });
    localStorage.removeItem('SET94_API_PROVIDER');

    // Nettoyage des anciennes clés non scopées (avant ce correctif), pour
    // éviter tout résidu fantôme d'une session précédente au comportement bugué.
    TOUTES_LES_CLES.forEach(key => {
      localStorage.removeItem(`SET94_${key}`);
    });
  },

  isOverridden(key) {
    if (key === 'API_PROVIDER') {
      return localStorage.getItem('SET94_API_PROVIDER') !== null;
    }
    const provider = providerActif();
    return localStorage.getItem(`SET94_${provider}_${key}`) !== null;
  }
};

window.CONFIG = CONFIG;
= CONFIG;

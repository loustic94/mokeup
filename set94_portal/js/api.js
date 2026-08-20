// Services API pour la communication avec Airtable / Baserow et Zapier
//
// ── ARCHITECTURE ─────────────────────────────────────────────────────────
// window.API.airtableFetch() garde exactement la même signature et le même
// format de retour qu'avant ({records: [{id, fields: {...}}]}), quel que
// soit le backend réellement utilisé. Aucun module appelant (SeancesModule,
// DepensesModule, etc.) n'a besoin d'être modifié.
//
// Cette version s'appuie directement sur window.CONFIG (API_PROVIDER, TOKEN,
// BASEROW_URL, TABLE_MEMBRES, etc.) tel que défini dans config.js — pas de
// clés séparées inventées ici : window.CONFIG.get('TOKEN') renvoie déjà la
// bonne valeur selon le fournisseur actif, grâce au scoping par provider.
//
// ⚠️ Les formules Airtable traduites dans evaluerFormuleAirtable() ne
// couvrent que celles présentes dans le code existant à ce jour. Toute
// formule non reconnue lève une erreur explicite plutôt que de renvoyer
// silencieusement un résultat faux — complétez la fonction au besoin.

const AIRTABLE_API_BASE_URL = 'https://api.airtable.com/v0';

// Note : les modules appelants (membre.js, seances.js, etc.) résolvent déjà
// eux-mêmes l'identifiant de table via window.CONFIG.get('TABLE_X') avant
// d'appeler airtableFetch(...) — cette valeur est donc déjà soit un nom de
// table Airtable ("MEMBRES"), soit un ID numérique Baserow ("1010820"),
// selon le fournisseur actif. Ce shim n'a donc pas besoin de retraduire quoi
// que ce soit : il utilise directement ce qui lui est fourni.

// ═══════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE UNIQUE (inchangé pour les modules appelants)
// ═══════════════════════════════════════════════════════════════════════
async function airtableFetch(endpoint, options = {}) {
  return window.CONFIG.get('API_PROVIDER') === 'baserow'
    ? baserowFetchViaAirtableShape(endpoint, options)
    : airtableFetchReel(endpoint, options);
}

// ═══════════════════════════════════════════════════════════════════════
// BRANCHE AIRTABLE (code d'origine, non modifié)
// ═══════════════════════════════════════════════════════════════════════
async function airtableFetchReel(endpoint, options = {}) {
  const token = window.CONFIG.get('TOKEN');
  const baseId = window.CONFIG.get('BASE_ID');

  if (!token || !baseId) {
    throw new Error("Configuration Airtable manquante (Token ou Base ID).");
  }
  const url = `${AIRTABLE_API_BASE_URL}/${baseId}/${endpoint}`;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, {
    ...options,
    headers
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.error?.message || JSON.stringify(err);
    console.error(`Airtable error [${res.status}] : ${detail}`, { endpoint, options });
    throw new Error(`[Airtable ${res.status}] ${detail}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════
// BRANCHE BASEROW (nouvelle) — parle à Baserow, mais renvoie des données
// dans le même format que les réponses Airtable ci-dessus.
// ═══════════════════════════════════════════════════════════════════════
async function baserowFetchViaAirtableShape(endpoint, options = {}) {
  const token = window.CONFIG.get('TOKEN');
  if (!token) {
    throw new Error("Configuration Baserow manquante (Token).");
  }

  const { tableName, recordId, queryParams } = parseEndpointAirtable(endpoint);
  // tableName est déjà l'ID numérique Baserow (résolu par l'appelant via
  // CONFIG.get('TABLE_X') avant l'appel à airtableFetch), pas un nom littéral.
  const tableId = tableName;
  if (!tableId) {
    throw new Error(`Identifiant de table Baserow manquant dans l'endpoint "${endpoint}".`);
  }

  const method = (options.method || 'get').toLowerCase();

  if (method === 'get') {
    return listerLignesCommeAirtable(tableId, queryParams);
  }
  if (method === 'post') {
    return creerLigneCommeAirtable(tableId, options);
  }
  if (method === 'patch') {
    return modifierLigneCommeAirtable(tableId, recordId, options);
  }

  throw new Error(`Méthode "${method}" non gérée par le shim Baserow.`);
}

// Découpe un endpoint façon Airtable, ex :
// "SEANCES?filterByFormula=...&sort[0][field]=Date_Heure"
// "INSCRIPTIONS_SEANCES" (POST)
// "INSCRIPTIONS_SEANCES/recXXX" (PATCH)
function parseEndpointAirtable(endpoint) {
  const decoded = decodeURIComponent(endpoint);
  const [pathPart, queryPart] = decoded.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const tableName = segments[0];
  const recordId = segments[1] || null;
  const queryParams = new URLSearchParams(queryPart || '');
  return { tableName, recordId, queryParams };
}

async function baserowFetchAllRows(tableId) {
  let all = [];
  const baserowUrl = window.CONFIG.get('BASEROW_URL') || 'https://api.baserow.io';
  const token = window.CONFIG.get('TOKEN');
  let url = `${baserowUrl}/api/database/rows/table/${tableId}/?user_field_names=true&size=200`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[Baserow ${res.status}] ${err.detail || JSON.stringify(err)}`);
    }
    const data = await res.json();
    all = all.concat(data.results);
    url = data.next;
  }
  return all;
}

// Convertit une ligne Baserow (champs à plat) en enregistrement Airtable
// ({id, fields}), et transforme les champs liés (tableaux de {id, value})
// en simples tableaux d'ID, comme le renvoyait Airtable.
function baserowRowVersAirtableRecord(row) {
  const fields = {};
  Object.keys(row).forEach(key => {
    if (key === 'id' || key === 'order') return;
    const v = row[key];
    if (Array.isArray(v)) {
      fields[key] = v.map(item => (item && typeof item === 'object' && 'id' in item) ? item.id : item);
    } else if (v && typeof v === 'object' && 'value' in v) {
      fields[key] = v.value;
    } else {
      fields[key] = v;
    }
  });
  return { id: row.id, fields };
}

async function listerLignesCommeAirtable(tableId, queryParams) {
  let rows = await baserowFetchAllRows(tableId);
  let records = rows.map(baserowRowVersAirtableRecord);

  const formule = queryParams.get('filterByFormula');
  if (formule) {
    records = records.filter(r => evaluerFormuleAirtable(formule, r.fields));
  }

  const sortField = queryParams.get('sort[0][field]');
  const sortDir = queryParams.get('sort[0][direction]') || 'asc';
  if (sortField) {
    records.sort((a, b) => {
      const va = a.fields[sortField];
      const vb = b.fields[sortField];
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const fieldsDemandes = queryParams.getAll('fields[]');
  if (fieldsDemandes.length > 0) {
    records = records.map(r => {
      const fieldsFiltres = {};
      fieldsDemandes.forEach(f => { if (f in r.fields) fieldsFiltres[f] = r.fields[f]; });
      return { id: r.id, fields: fieldsFiltres };
    });
  }

  return { records };
}

// Les valeurs venant du HTML (checkbox.value, etc.) sont toujours des
// chaînes de texte. Pour un champ lien Baserow, envoyer un tableau de
// chaînes numériques (ex. ["11"]) au lieu de nombres (ex. [11]) fait que
// Baserow tente une recherche par texte sur le champ primaire de la table
// liée plutôt qu'une résolution par ID — d'où l'erreur "provided text
// value '11' doesn't match any row". On convertit donc systématiquement
// les tableaux de chaînes purement numériques en tableaux de nombres.
function normaliserChampsLiesPourBaserow(donnees) {
  const resultat = {};
  Object.keys(donnees).forEach(key => {
    const v = donnees[key];
    if (Array.isArray(v)) {
      resultat[key] = v.map(item =>
        (typeof item === 'string' && /^\d+$/.test(item)) ? Number(item) : item
      );
    } else {
      resultat[key] = v;
    }
  });
  return resultat;
}

async function creerLigneCommeAirtable(tableId, options) {
  const baserowUrl = window.CONFIG.get('BASEROW_URL') || 'https://api.baserow.io';
  const token = window.CONFIG.get('TOKEN');
  const body = JSON.parse(options.body || '{}');
  const donnees = normaliserChampsLiesPourBaserow(body.fields || {});

  const res = await fetch(
    `${baserowUrl}/api/database/rows/table/${tableId}/?user_field_names=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(donnees)
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`[Baserow ${res.status}] ${err.detail || JSON.stringify(err)}`);
  }
  const row = await res.json();
  return baserowRowVersAirtableRecord(row);
}

async function modifierLigneCommeAirtable(tableId, recordId, options) {
  const baserowUrl = window.CONFIG.get('BASEROW_URL') || 'https://api.baserow.io';
  const token = window.CONFIG.get('TOKEN');
  const body = JSON.parse(options.body || '{}');
  const donnees = normaliserChampsLiesPourBaserow(body.fields || {});

  const res = await fetch(
    `${baserowUrl}/api/database/rows/table/${tableId}/${recordId}/?user_field_names=true`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(donnees)
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`[Baserow ${res.status}] ${err.detail || JSON.stringify(err)}`);
  }
  const row = await res.json();
  return baserowRowVersAirtableRecord(row);
}

// ═══════════════════════════════════════════════════════════════════════
// TRADUCTEUR DE FORMULES AIRTABLE → évaluation JS sur un objet "fields"
// ═══════════════════════════════════════════════════════════════════════
function evaluerFormuleAirtable(formule, fields) {
  // Cas 1 : égalité simple  {Champ}="valeur"
  let m = formule.match(/^\{([^}]+)\}\s*=\s*"([^"]*)"$/);
  if (m) {
    const [, champ, valeur] = m;
    return fields[champ] === valeur;
  }

  // Cas 2 : FIND("id", ARRAYJOIN({Champ}))
  m = formule.match(/^FIND\("([^"]+)",\s*ARRAYJOIN\(\{([^}]+)\}\)\)$/);
  if (m) {
    const [, id, champ] = m;
    const tableau = fields[champ] || [];
    return tableau.map(String).includes(id);
  }

  // Cas 3 : IS_AFTER({Champ}, "iso") — seule ou imbriquée dans un AND/OR générique
  m = formule.match(/^IS_AFTER\(\{([^}]+)\},\s*"([^"]+)"\)$/);
  if (m) {
    const [, champ, dateRef] = m;
    return !!fields[champ] && new Date(fields[champ]) > new Date(dateRef);
  }

  // Cas 3bis : OR(cond1, cond2, ..., condN), générique — au moins une condition vraie
  m = formule.match(/^OR\((.+)\)$/);
  if (m) {
    const conditions = splitArgumentsFormule(m[1]);
    if (conditions.length > 1) {
      return conditions.some(cond => evaluerFormuleAirtable(cond.trim(), fields));
    }
  }

  // Cas 4 (générique) : AND(cond1, cond2, ..., condN), chaque cond étant elle-même
  // une formule reconnue (typiquement des égalités simples enchaînées, comme dans
  // la recherche de membre par Email+Nom+Prénom).
  m = formule.match(/^AND\((.+)\)$/);
  if (m) {
    const conditions = splitArgumentsFormule(m[1]);
    if (conditions.length > 1) {
      return conditions.every(cond => evaluerFormuleAirtable(cond.trim(), fields));
    }
  }

  throw new Error(
    `Formule Airtable non prise en charge par le shim Baserow : "${formule}". ` +
    `Ajoutez un cas dans evaluerFormuleAirtable() (api.js).`
  );
}

// Découpe les arguments d'une fonction Airtable au niveau supérieur
// (ex. "A, B, C" → ["A", "B", "C"]), sans casser les virgules qui seraient
// à l'intérieur de parenthèses imbriquées ou de guillemets.
function splitArgumentsFormule(str) {
  const parts = [];
  let depth = 0, current = '', inQuotes = false;
  for (const char of str) {
    if (char === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (char === '(') depth++;
      if (char === ')') depth--;
    }
    if (char === ',' && depth === 0 && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// ═══════════════════════════════════════════════════════════════════════
// ZAPIER (inchangé, indépendant du backend de données)
// ═══════════════════════════════════════════════════════════════════════
async function sendZapierWebhook(data) {
  const webhookUrl = window.CONFIG.get('WEBHOOK_ZAPIER');
  if (!webhookUrl) {
    throw new Error("Webhook Zapier non configuré.");
  }
  const formData = new URLSearchParams();
  Object.keys(data).forEach(key => {
    formData.append(key, data[key]);
  });
  const response = await fetch(webhookUrl, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json'
    },
    mode: 'cors'
  });
  if (!response.ok) {
    throw new Error(`[Zapier ${response.status}] Échec de la transmission de la demande.`);
  }
  return true;
}

window.API = {
  airtableFetch,
  sendZapierWebhook
};

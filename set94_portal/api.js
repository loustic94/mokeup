// Services API pour la communication avec Airtable, Baserow et Zapier
const API_BASE_URL = 'https://api.airtable.com/v0';

// Caches pour le mapping dynamique des champs Baserow (nom -> ID numérique)
const fieldMappings = {};

async function ensureFieldMapping(tableId) {
  if (fieldMappings[tableId]) return;

  const provider = window.CONFIG.get('API_PROVIDER') || 'baserow';
  if (provider !== 'baserow') return;

  const token = window.CONFIG.get('TOKEN');
  const baserowUrl = window.CONFIG.get('BASEROW_URL') || 'https://api.baserow.io';

  if (!token) {
    throw new Error("Jeton de sécurité Baserow manquant. Veuillez configurer la connexion dans l'onglet Configuration.");
  }

  const url = `${baserowUrl}/api/database/fields/table/${tableId}/`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Token ${token}`
    }
  });

  if (!res.ok) {
    throw new Error(`[Baserow] Impossible de charger la structure de la table ${tableId} (${res.status}). Vérifiez vos identifiants.`);
  }

  const fields = await res.json();
  fieldMappings[tableId] = {};
  console.log(`[Baserow Schema] Table ${tableId} fields loaded:`, fields.map(f => `${f.name} (id: ${f.id}, type: ${f.type})`));
  fields.forEach(f => {
    fieldMappings[tableId][f.name] = `field_${f.id}`;
  });
}

function getFieldId(tableId, fieldName) {
  const tableMap = fieldMappings[tableId];
  if (!tableMap) {
    throw new Error(`Structure non chargée pour la table ${tableId}`);
  }
  const fieldId = tableMap[fieldName];
  if (!fieldId) {
    // Si le champ n'est pas trouvé dans la table, on retourne la valeur telle quelle (il se peut que ce soit déjà un field_id ou que Baserow l'accepte)
    return fieldName;
  }
  return fieldId;
}

// Convertit récursivement les chaînes numériques dans les tableaux en entiers (requis pour les relations de Baserow)
function prepareBaserowPayload(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string' && /^\d+$/.test(item.trim())) {
        return parseInt(item.trim(), 10);
      }
      return prepareBaserowPayload(item);
    });
  }
  
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (Array.isArray(val)) {
          newObj[key] = val.map(item => {
            if (typeof item === 'string' && /^\d+$/.test(item.trim())) {
              return parseInt(item.trim(), 10);
            }
            return prepareBaserowPayload(item);
          });
        } else {
          newObj[key] = prepareBaserowPayload(val);
        }
      }
    }
    return newObj;
  }
  
  return obj;
}

// Dictionnaire pour normaliser la casse et le pluriel des colonnes importées dans Baserow
const KEY_MAPPINGS = {
  'membre': 'Membre',
  'membres': 'MEMBRES',
  'atelier': 'Atelier',
  'ateliers': 'Atelier',
  'statut': 'Statut',
  'date_inscription': 'Date_Inscription',
  'date_désinscription': 'Date_Désinscription',
  'date_desinscription': 'Date_Désinscription',
  'date_heure': 'Date_Heure',
  'seances': 'SEANCES',
  'seance': 'SEANCES',
  'nom_atelier': 'Nom_Atelier',
  'nom': 'Nom',
  'prénom': 'Prénom',
  'prenom': 'Prénom',
  'email': 'Email',
  'téléphone': 'Téléphone',
  'telephone': 'Téléphone'
};

// Convertit les relations de Baserow ([{id, value}]) au format attendu par le reste du code (tableau de chaînes d'IDs)
function mapBaserowRowToAirtable(row) {
  const { id, order, ...fields } = row;
  const mappedFields = {};
  
  for (const key in fields) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      let val = fields[key];
      // Si c'est une relation (tableau d'objets avec id)
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null && 'id' in val[0]) {
        val = val.map(item => String(item.id));
      }
      
      // Normalisation du nom de la colonne
      const normalizedKey = KEY_MAPPINGS[key.toLowerCase()] || key;
      mappedFields[normalizedKey] = val;
    }
  }
  
  return { id: String(id), fields: mappedFields };
}

// Aligne les clés du payload d'écriture avec la casse exacte déclarée dans la table Baserow (insensible à la casse)
function alignPayloadKeysWithSchema(tableId, payload) {
  const tableMap = fieldMappings[tableId];
  if (!tableMap) return payload;
  
  const aligned = {};
  for (const key in payload) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const val = payload[key];
      const dbKey = Object.keys(tableMap).find(k => k.toLowerCase() === key.toLowerCase());
      if (dbKey) {
        aligned[dbKey] = val;
      } else {
        aligned[key] = val;
      }
    }
  }
  return aligned;
}

// Fonction de parsing et traduction de formules de filtres Airtable vers filtres Baserow
function translateFormula(tableId, formula) {
  if (!formula) return '';
  
  const filters = [];
  let filterType = 'AND';
  
  formula = formula.trim();
  
  let conditions = [];
  if (formula.startsWith('AND(') && formula.endsWith(')')) {
    const content = formula.slice(4, -1);
    conditions = splitFormulaConditions(content);
  } else if (formula.startsWith('OR(') && formula.endsWith(')')) {
    const content = formula.slice(3, -1);
    conditions = splitFormulaConditions(content);
    filterType = 'OR';
  } else {
    conditions = [formula];
  }
  
  conditions.forEach(cond => {
    cond = cond.trim();
    if (!cond) return;
    
    // Match: {FieldName}="Value"
    const matchEqual = cond.match(/^\{([^}]+)\}\s*=\s*"([^"]*)"$/);
    if (matchEqual) {
      const fieldName = matchEqual[1];
      const val = matchEqual[2];
      const fieldId = getFieldId(tableId, fieldName);
      filters.push(`filter__field_${fieldId.replace('field_', '')}__equal=${encodeURIComponent(val)}`);
      return;
    }
    
    // Match: {FieldName}=Value (numeric)
    const matchEqualNum = cond.match(/^\{([^}]+)\}\s*=\s*([0-9.]+)$/);
    if (matchEqualNum) {
      const fieldName = matchEqualNum[1];
      const val = matchEqualNum[2];
      const fieldId = getFieldId(tableId, fieldName);
      filters.push(`filter__field_${fieldId.replace('field_', '')}__equal=${encodeURIComponent(val)}`);
      return;
    }
    
    // Match: FIND("Value", ARRAYJOIN({FieldName}))
    const matchFind = cond.match(/^FIND\("([^"]+)"\s*,\s*ARRAYJOIN\(\{([^}]+)\}\)\)$/);
    if (matchFind) {
      const val = matchFind[1];
      const fieldName = matchFind[2];
      const fieldId = getFieldId(tableId, fieldName);
      filters.push(`filter__field_${fieldId.replace('field_', '')}__link_row_has=${encodeURIComponent(val)}`);
      return;
    }
    
    // Match: IS_AFTER({FieldName}, "Value")
    const matchIsAfter = cond.match(/^IS_AFTER\(\{([^}]+)\}\s*,\s*"([^"]*)"\)$/);
    if (matchIsAfter) {
      const fieldName = matchIsAfter[1];
      const val = matchIsAfter[2];
      const fieldId = getFieldId(tableId, fieldName);
      filters.push(`filter__field_${fieldId.replace('field_', '')}__date_after=${encodeURIComponent(val)}`);
      return;
    }
  });
  
  let queryStr = filters.join('&');
  if (filters.length > 1) {
    queryStr += `&filter_type=${filterType}`;
  }
  return queryStr;
}

// Découpe les conditions à la virgule en respectant les parenthèses et les guillemets
function splitFormulaConditions(str) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  let parenDepth = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    }
    if (!inQuotes) {
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth--;
    }
    if (char === ',' && !inQuotes && parenDepth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// Fonction Fetch principale (agit comme adaptateur transparent selon CONFIG)
async function airtableFetch(endpoint, options = {}) {
  const provider = window.CONFIG.get('API_PROVIDER') || 'baserow';
  const token = window.CONFIG.get('TOKEN');
  
  if (provider === 'airtable') {
    // ────────────── LOGIQUE AIRTABLE CLASSIQUE ──────────────
    const baseId = window.CONFIG.get('BASE_ID');
    if (!token || !baseId) {
      throw new Error("Configuration Airtable manquante (Token ou Base ID).");
    }

    const url = `${API_BASE_URL}/${baseId}/${endpoint}`;
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

  } else {
    // ────────────── LOGIQUE D'ADAPTATION BASEROW ──────────────
    const baserowUrl = window.CONFIG.get('BASEROW_URL') || 'https://api.baserow.io';
    if (!token) {
      throw new Error("Configuration Baserow manquante (Jeton API).");
    }

    // 1. Extraire la table et les paramètres de requête de l'endpoint
    let [tableIdOrPath, queryString] = endpoint.split('?');
    tableIdOrPath = decodeURIComponent(tableIdOrPath);

    // Gérer l'éventuel ID d'enregistrement (ex: tableId/recordId)
    let tableId = tableIdOrPath;
    let recordId = '';
    if (tableIdOrPath.includes('/')) {
      const parts = tableIdOrPath.split('/');
      tableId = parts[0];
      recordId = parts[1];
    }

    // Résoudre l'ID numérique de la table s'il s'agit d'une clé textuelle de secours
    if (isNaN(tableId)) {
      const configKey = `TABLE_${tableId.toUpperCase()}`;
      const resolved = window.CONFIG.get(configKey);
      if (resolved) {
        tableId = resolved;
      }
    }

    // 2. Charger dynamiquement le dictionnaire des champs de la table si nécessaire
    await ensureFieldMapping(tableId);

    // 3. Adapter les query parameters
    const searchParams = new URLSearchParams(queryString || '');
    
    // Gérer la pagination (offset -> page)
    if (searchParams.has('offset')) {
      searchParams.set('page', searchParams.get('offset'));
      searchParams.delete('offset');
    }
    
    // Gérer maxRecords -> size
    if (searchParams.has('maxRecords')) {
      searchParams.set('size', searchParams.get('maxRecords'));
      searchParams.delete('maxRecords');
    }

    // Gérer le tri (sort[0][field] & sort[0][direction] -> order_by)
    let sortField = '';
    let sortDir = 'asc';
    for (const [key, value] of searchParams.entries()) {
      if (key.includes('[field]')) {
        sortField = value;
      } else if (key.includes('[direction]')) {
        sortDir = value;
      }
    }
    if (sortField) {
      const prefix = sortDir.toLowerCase() === 'desc' ? '-' : '';
      searchParams.set('order_by', prefix + sortField);
      // Supprimer les clés de tri d'Airtable
      for (const key of Array.from(searchParams.keys())) {
        if (key.startsWith('sort[')) searchParams.delete(key);
      }
    }

    // Traduire le filtre (filterByFormula -> filtres Baserow)
    const formula = searchParams.get('filterByFormula');
    if (formula) {
      searchParams.delete('filterByFormula');
      const baserowFiltersQuery = translateFormula(tableId, formula);
      if (baserowFiltersQuery) {
        const tempParams = new URLSearchParams(baserowFiltersQuery);
        for (const [k, v] of tempParams.entries()) {
          searchParams.append(k, v);
        }
      }
    }

    // Supprimer les projections de champs inutiles pour Baserow
    for (const key of Array.from(searchParams.keys())) {
      if (key.startsWith('fields')) searchParams.delete(key);
    }

    // Forcer le formatage par noms de champs textuels
    searchParams.set('user_field_names', 'true');

    // 4. Construire l'URL Baserow finale
    let finalUrl = `${baserowUrl}/api/database/rows/table/${tableId}/`;
    if (recordId) {
      finalUrl += `${recordId}/`;
    }
    finalUrl += `?${searchParams.toString()}`;

    // 5. Adapter le payload du body (mise à plat des champs)
    const finalOptions = { ...options };
    if (options.body) {
      try {
        const bodyObj = JSON.parse(options.body);
        if (bodyObj) {
          const fieldsToProcess = bodyObj.fields || bodyObj;
          const flatFields = prepareBaserowPayload(fieldsToProcess);
          const alignedFields = alignPayloadKeysWithSchema(tableId, flatFields);
          finalOptions.body = JSON.stringify(alignedFields);
        }
      } catch (e) {
        console.warn("Erreur parsing body pour adaptation Baserow", e);
      }
    }

    // Headers Baserow
    const headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const res = await fetch(finalUrl, {
      ...finalOptions,
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = err.error?.message || JSON.stringify(err);
      console.error(`Baserow error [${res.status}] : ${detail}`, { finalUrl, options });
      throw new Error(`[Baserow ${res.status}] ${detail}`);
    }

    const data = await res.json();

    // 6. Traduire la réponse plate de Baserow au format Airtable (avec imbrication records et fields)
    if (data && data.results) {
      // Liste de lignes
      return {
        records: data.results.map(row => mapBaserowRowToAirtable(row)),
        offset: data.next ? new URL(data.next).searchParams.get('page') : null
      };
    }

    if (data && data.id) {
      // Une seule ligne (création/modification)
      return mapBaserowRowToAirtable(data);
    }

    return data;
  }
}

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

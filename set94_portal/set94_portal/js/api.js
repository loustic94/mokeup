// Services API pour la communication avec Airtable et Zapier
const API_BASE_URL = 'https://api.airtable.com/v0';

async function airtableFetch(endpoint, options = {}) {
  const token = window.CONFIG.get('TOKEN');
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
}

async function sendZapierWebhook(data) {
  const webhookUrl = window.CONFIG.get('WEBHOOK_ZAPIER');
  if (!webhookUrl) {
    throw new Error("Webhook Zapier non configuré.");
  }

  // Formatage en URLSearchParams pour éviter les blocages CORS (Identique à depenses_set.html)
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

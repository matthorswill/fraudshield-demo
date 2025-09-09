// backend/lib/aiProvider.js
// Switchable AI provider (AZURE | MISTRAL | LOCAL)
// Exports: chat(messages) => Promise<string>

/**
 * @typedef {{ role: 'system'|'user'|'assistant', content: string }} ChatMessage
 */

const DEFAULT_TIMEOUT_MS = 15000;

function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`AI timeout after ${ms}ms`)), ms);
    promise.then(v => { clearTimeout(id); resolve(v); }, e => { clearTimeout(id); reject(e); });
  });
}

async function callAzure(messages) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
  const key = process.env.AZURE_OPENAI_KEY;
  if (!endpoint || !deployment || !key) throw new Error('Azure OpenAI env missing');
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;
  const res = await withTimeout(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'api-key': key },
    body: JSON.stringify({ messages, temperature: 0.2 })
  }));
  if (!res.ok) throw new Error(`AZURE ${res.status}`);
  const js = await res.json();
  return js?.choices?.[0]?.message?.content || '';
}

async function callMistral(messages) {
  // Support OpenAI-compatible endpoint if provided
  const endpoint = process.env.MISTRAL_ENDPOINT || 'https://api.mistral.ai/v1';
  const key = process.env.MISTRAL_API_KEY;
  if (!endpoint || !key) throw new Error('Mistral env missing');
  const url = `${endpoint.replace(/\/$/, '')}/chat/completions`;
  const res = await withTimeout(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'mistral-small', messages, temperature: 0.2 })
  }));
  if (!res.ok) throw new Error(`MISTRAL ${res.status}`);
  const js = await res.json();
  return js?.choices?.[0]?.message?.content || '';
}

async function callLocal(messages) {
  const content = messages?.map(m=>`[${m.role}] ${m.content}`).join('\n') || '';
  return `[LOCAL] ${content.slice(0, 1000)}`;
}

/**
 * @param {ChatMessage[]} messages
 * @returns {Promise<string>}
 */
async function chat(messages) {
  const mode = String(process.env.AI_MODE || 'LOCAL').toUpperCase();
  try {
    if (mode === 'AZURE') return await callAzure(messages);
    if (mode === 'MISTRAL') return await callMistral(messages);
    return await callLocal(messages);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    err.message = `AI_${mode}_ERROR: ` + err.message;
    throw err;
  }
}

module.exports = { chat };


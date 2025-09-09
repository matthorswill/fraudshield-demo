// backend/lib/aiAgent.js
let client = null;
try {
  const OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch { /* openai not installed? ignore */ }

async function explain({ transaction, hits, baseScore }) {
  // Fallback local if no key
  if (!client) {
    const suggestions = [];
    if (hits.includes('KYC_OBSOLE')) suggestions.push("Mettre à jour le KYC (pièces justificatives récentes)");
    if (hits.includes('KBK_HIGH_AMOUNT_NON_URGENT') || hits.includes('HIGH_VALUE_TRANSFER')) suggestions.push("Demander justificatifs d’origine des fonds");
    if (hits.includes('FONDS_SEIN_PAYS_TIER') || hits.includes('HIGH_RISK_JURISDICTION')) suggestions.push("Renforcer screening sanctions/embargos et approbation senior");
    if (hits.includes('VIREMENT_IRREGULIER')) suggestions.push("Limiter seuils et réaliser un appel client de vérification");
    if (hits.includes('UTILISATION_CONNECTE')) suggestions.push("Forcer MFA et vérifier provenance des connexions (PSD2)");
    if (hits.includes('PBR_ATTACHED')) suggestions.push("Bloquer canal crypto non enregistré et notifier conformité");
    if (suggestions.length === 0) suggestions.push('Surveiller et demander documents complémentaires si récidive.');
    return {
      explanation: `Anomalies: ${hits.join(', ') || 'aucune'}. Montant ${transaction.amount} ${transaction.currency} via ${transaction.channel}.`,
      suggested_action: suggestions[0],
      suggested_actions: suggestions.slice(0, 3)
    };
  }

  const summary = `Tx ${transaction.tx_id} ${transaction.amount} ${transaction.currency} ${transaction.channel} ` +
                  `de ${transaction.src_type}:${transaction.src_id} vers ${transaction.dst_type}:${transaction.dst_id} ` +
                  `(${transaction.src_country}→${transaction.dst_country}) à ${transaction.timestamp}. Hits: ${hits.join(', ')}`;

  const prompt = `Tu es analyste LCB-FT (FR). Fais 2 phrases de raison de suspicion et propose 3 actions concrètes et graduées. 
Base: ${summary}. Réponds en JSON { "explanation": "...", "suggested_action": "...", "suggested_actions": ["...", "...", "..."] }.`;

  try {
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Assistant AML concis.' },
        { role: 'user', content: prompt }
      ]
    });
    const text = resp.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(text);
      return {
        explanation: parsed.explanation || text,
        suggested_action: parsed.suggested_action || (parsed.suggested_actions?.[0] || 'Revoir manuellement.'),
        suggested_actions: Array.isArray(parsed.suggested_actions) && parsed.suggested_actions.length ? parsed.suggested_actions.slice(0,3) : undefined,
      };
    } catch {
      return { explanation: text, suggested_action: 'Revoir manuellement.', suggested_actions: undefined };
    }
  } catch {
    return {
      explanation: `Anomalies: ${hits.join(', ') || 'aucune'}.`,
      suggested_action: 'Revoir manuellement.',
      suggested_actions: undefined
    };
  }
}

async function investigateAlert({ alert, transaction, neighborTx = [], entities = {} }) {
  // Local fallback: synthesize a structured investigation with heuristics
  if (!client) {
    const totalAmount = neighborTx.reduce((s,t)=>s+Number(t.amount||0),0);
    const byChannel = {};
    for (const t of neighborTx) byChannel[t.channel] = (byChannel[t.channel]||0)+1;
    const topChannel = Object.entries(byChannel).sort((a,b)=>b[1]-a[1])[0]?.[0] || transaction?.channel;
    const hits = alert?.details?.hits || [];
    const lines = [];
    lines.push(`Synthèse: entité ${alert?.entity_name || alert?.entity} notée ${alert?.score}/100.`);
    lines.push(`Transaction indexée: ${transaction?.amount} ${transaction?.currency} via ${transaction?.channel} du ${transaction?.timestamp}.`);
    lines.push(`Anomalies: ${hits.join(', ') || 'aucune'}.`);
    lines.push(`Historique proche: ${neighborTx.length} opérations, canal dominant: ${topChannel}, montant cumulé ~${Math.round(totalAmount)}.`);
    const actions = [];
    if (hits.includes('KYC_OBSOLE')) actions.push('Mettre à jour le KYC (pièces récentes)');
    if (hits.includes('HIGH_RISK_JURISDICTION')||hits.includes('FONDS_SEIN_PAYS_TIER')) actions.push('Vérifier sanctions/embargos et justificatifs commerciaux');
    if (hits.includes('PBR_ATTACHED')) actions.push('Bloquer canal crypto non enregistré, notifier conformité');
    if (!actions.length) actions.push('Surveiller et demander documents complémentaires');
    return { reportText: lines.join('\n'), actions };
  }

  const base = `Alerte ${alert?.id} pour ${alert?.entity_name || alert?.entity}, score ${alert?.score}. ` +
               `Tx ${transaction?.tx_id} ${transaction?.amount} ${transaction?.currency} ${transaction?.channel} ` +
               `(${transaction?.src_country}->${transaction?.dst_country}) ${transaction?.timestamp}. ` +
               `Règles: ${(alert?.details?.hits||[]).join(', ')}`;
  const context = `Historique voisin (${neighborTx.length}): ` + neighborTx.slice(0,10).map(t=>`${t.amount} ${t.currency} ${t.channel} ${t.src_country}->${t.dst_country}`).join(' | ');
  const prompt = `Tu es un enquêteur AML (FR). Fais un rapport concis et structuré (3-6 points) incluant: 1) synthèse des risques, 2) éléments factuels, 3) hypothèses (si pertinentes), 4) recommandations d'action.\nBase: ${base}\n${context}\nRéponds JSON: {"reportText":"...","actions":["...","..."]}`;
  try {
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', temperature: 0.2, messages: [{role:'system',content:'Enquêteur AML concis.'},{role:'user',content:prompt}] });
    const text = resp.choices?.[0]?.message?.content || '';
    try { const parsed = JSON.parse(text); return { reportText: parsed.reportText || text, actions: parsed.actions || [] }; } catch { return { reportText: text, actions: [] }; }
  } catch (e) {
    return { reportText: 'Analyse indisponible.', actions: [] };
  }
}

async function complianceAdvice({ alert }) {
  const base = `Alerte ${alert?.id} bande ${alert?.band} score ${alert?.score}. Règles: ${(alert?.details?.hits||[]).join(', ')}`;
  if (!client) {
    return { advice: `Conformité: appliquer principe KYC/AML proportionné au risque. Documenter la revue et conserver les pièces 5 ans. ${base}` };
  }
  const prompt = `Donne des recommandations conformité (FR, ACPR/CNIL) en 4 points actionnables pour: ${base}.`;
  try {
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', temperature: 0.2, messages:[{role:'system',content:'Conseiller conformité FR.'},{role:'user',content:prompt}] });
    return { advice: resp.choices?.[0]?.message?.content || '' };
  } catch { return { advice: 'Revoir manuellement les obligations KYC/AML applicables.' }; }
}

async function copilot({ question, context }) {
  if (!client) {
    return { answer: `Sans LLM externe, proposition locale: ${question || ''}. Utilisez les filtres et examinez les règles déclenchées pour les entités concernées.` };
  }
  const messages = [
    { role: 'system', content: 'Tu es un copilote AML/Fraude FR. Réponds de façon concise et actionnable.' },
    { role: 'user', content: `${question}\nContexte: ${JSON.stringify(context||{})}` }
  ];
  try { const resp = await client.chat.completions.create({ model:'gpt-4o-mini', temperature:0.2, messages }); return { answer: resp.choices?.[0]?.message?.content || '' }; } catch { return { answer: 'Réponse indisponible.' }; }
}

module.exports = { explain, investigateAlert, complianceAdvice, copilot };

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

module.exports = { explain };

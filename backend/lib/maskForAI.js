// backend/lib/maskForAI.js
// Strict PII masking for AI usage

const RULE_WHITELIST = new Set([
  'KBK_HIGH_AMOUNT_NON_URGENT','FONDS_SEIN_PAYS_TIER','VIREMENT_IRREGULIER','UTILISATION_CONNECTE',
  'KYC_OBSOLE','PBR_ATTACHED','HIGH_VALUE_TRANSFER','CASH_STRUCTURING_NEAR_THRESHOLD','CROSS_BORDER',
  'HIGH_RISK_JURISDICTION','ODD_HOUR_ACTIVITY','ROUND_NUMBER_PATTERN','HIGH_RISK_ENTITY'
]);

/**
 * Build a strictly masked view of alert and tx
 * @param {any} alert
 * @param {any} tx
 */
function maskAlertTx(alert, tx){
  const details = alert?.details || {};
  const rules = (Array.isArray(details.hits) ? details.hits : [])
    .filter(r => RULE_WHITELIST.has(String(r)));
  const src_country = details.src_country || tx?.src_country || '';
  const dst_country = details.dst_country || tx?.dst_country || '';
  const kyc_age_days = Number(details.kyc_age_days || 0);
  const is_cross_border = !!(src_country && dst_country && src_country !== dst_country);
  const masked = {
    tx: {
      amount: Number(details.amount || tx?.amount || 0),
      currency: String(details.currency || tx?.currency || ''),
      channel: String(details.channel || tx?.channel || ''),
      src_country: String(src_country || ''),
      dst_country: String(dst_country || ''),
      kyc_age_days,
      is_cross_border,
    },
    alert: {
      score: Number(alert?.score || 0),
      band: String(alert?.band || ''),
      rules
    }
  };
  return masked;
}

module.exports = { maskAlertTx };


// backend/lib/dataContext.js
let DATASETS = null; let ALERTS = []; let LAST_REPORT = null;
function setData({ datasets, alerts, lastReport }){ DATASETS = datasets; ALERTS = alerts || []; LAST_REPORT = lastReport || null; }
function getDatasets(){ return DATASETS; }
function getAlerts(){ return ALERTS; }
function getLastReport(){ return LAST_REPORT; }
module.exports = { setData, getDatasets, getAlerts, getLastReport };


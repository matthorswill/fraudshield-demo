// backend/lib/otel.js
// Optional OpenTelemetry bootstrap (no-op if deps missing)
try {
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  const sdk = new NodeSDK({ instrumentations: [getNodeAutoInstrumentations()] });
  sdk.start().catch(()=>{});
} catch {}


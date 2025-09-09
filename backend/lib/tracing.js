// Minimal OpenTelemetry tracer wrapper
let api = null;
try { api = require('@opentelemetry/api'); } catch {}

const tracer = api ? api.trace.getTracer('fraudshield') : null;

function withSpan(name, attrs, fn){
  if (!tracer || !api) return fn();
  const span = tracer.startSpan(name);
  try {
    if (attrs && typeof attrs === 'object') span.setAttributes(attrs);
    const ctx = api.trace.setSpan(api.context.active(), span);
    return api.context.with(ctx, fn);
  } finally {
    span.end();
  }
}

function getTraceId(){
  try { const span = api.trace.getActiveSpan(); return span ? span.spanContext().traceId : null; } catch { return null; }
}

module.exports = { withSpan, getTraceId };


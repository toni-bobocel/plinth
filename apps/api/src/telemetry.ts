// Loaded with `node --import` so instrumentation is in place before pg and
// http are first imported. Without an OTLP endpoint this file is a no-op,
// which keeps tests and local runs free of exporter noise.
import { register } from 'node:module'

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const { createAddHookMessageChannel } = await import('import-in-the-middle')
  const { registerOptions, waitForAllMessagesAcknowledged } = createAddHookMessageChannel()
  register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions)

  const { NodeSDK } = await import('@opentelemetry/sdk-node')
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-proto')
  const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http')
  const { PgInstrumentation } = await import('@opentelemetry/instrumentation-pg')
  const { PinoInstrumentation } = await import('@opentelemetry/instrumentation-pino')

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => req.url === '/healthz' }),
      // Bound parameters carry emails and tenant ids: they stay out of spans.
      new PgInstrumentation({ enhancedDatabaseReporting: false, requireParentSpan: true }),
      new PinoInstrumentation(),
    ],
  })
  sdk.start()
  await waitForAllMessagesAcknowledged()

  process.once('beforeExit', () => sdk.shutdown())
}

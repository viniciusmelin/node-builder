# Synthetix Configurator

Interactive Next.js configurator for Node.js and NestJS service scaffolds.

The application validates compatible selections, previews every generated file,
and downloads the selected scaffold as a ZIP containing source code,
configuration, CI, container files, and `synthetix.config.json`.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality checks

```bash
npm run lint
npm test
npm run test:coverage
npm run build
```

The generator tests validate package metadata, local imports, security defaults,
Docker commands, configuration conflicts, and the ZIP artifact.

## Generation model

- Node.js options are restricted to supported LTS release lines.
- Unsupported framework/API combinations block generation with a visible error.
- Docker and GitHub Actions commands follow the selected package manager.
- Authentication examples fail closed when required secrets are absent.
- Security, middleware, and observability presets add dependencies; their runtime
  wiring remains explicit because it depends on the chosen HTTP adapter and
  deployment threat model.

## Advanced generation

- Plugin registry: Redis, Kafka, gRPC, WebSockets, Stripe, BullMQ, pnpm
  monorepo, and AWS Serverless templates.
- Environment profiles: development, staging, and production examples validated
  with Zod, with optional AWS Secrets Manager loading.
- Connected observability: OpenTelemetry, Sentry, Datadog, Prometheus,
  readiness endpoints, Grafana provisioning, and a starter dashboard.
- Database lifecycle: PostgreSQL, MySQL, or MongoDB containers; TypeORM
  migrations; and idempotent seed commands.

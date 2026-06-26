import type { ProjectConfig } from "@/features/configurator/types";
import type { PluginFile } from "@/features/plugins/generator";

export const generateObservabilityFiles = (
  config: ProjectConfig
): PluginFile[] => {
  if (!config.observabilityLibs.length) return [];

  const imports: string[] = [];
  const initializers: string[] = [];

  if (config.observabilityLibs.includes("Datadog")) {
    imports.push("import tracer from 'dd-trace';");
    initializers.push(
      "  tracer.init({ service: process.env.DD_SERVICE, env: process.env.DD_ENV });"
    );
  }
  if (config.observabilityLibs.includes("Sentry")) {
    imports.push("import * as Sentry from '@sentry/node';");
    initializers.push(
      "  if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });"
    );
  }
  if (config.observabilityLibs.includes("OpenTelemetry")) {
    imports.push(
      "import { NodeSDK } from '@opentelemetry/sdk-node';",
      "import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';",
      "import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';"
    );
    initializers.push(
      "  const sdk = new NodeSDK({ traceExporter: new OTLPTraceExporter(), instrumentations: [getNodeAutoInstrumentations()] });",
      "  sdk.start();"
    );
  }
  if (config.observabilityLibs.includes("Prometheus")) {
    imports.push(
      "import { collectDefaultMetrics, register } from 'prom-client';"
    );
    initializers.push("  collectDefaultMetrics({ prefix: 'synthetix_' });");
  }

  const metricsExports = config.observabilityLibs.includes("Prometheus")
    ? `
export const metricsContentType = register.contentType;
export const metricsText = () => register.metrics();
`
    : `
export const metricsContentType = 'text/plain';
export const metricsText = async () => 'metrics_not_enabled 1\\n';
`;

  const files: PluginFile[] = [{
    path: "src/observability/index.ts",
    content: `${imports.join("\n")}

let initialized = false;

export async function initializeObservability() {
  if (initialized) return;
  initialized = true;
${initializers.join("\n")}
}
${metricsExports}`,
  }];

  if (config.framework === "NestJS" && config.observabilityLibs.includes("Prometheus")) {
    files.push(
      {
        path: "src/observability/metrics.controller.ts",
        content: `import { Controller, Get, Header } from '@nestjs/common';
import { metricsContentType, metricsText } from './index';

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', metricsContentType)
  getMetrics() {
    return metricsText();
  }
}`,
      },
      {
        path: "src/observability/observability.module.ts",
        content: `import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';

@Module({ controllers: [MetricsController] })
export class ObservabilityModule {}`,
      }
    );
  }

  if (config.observabilityLibs.includes("Prometheus")) {
    files.push(
      {
        path: "observability/prometheus.yml",
        content: `global:
  scrape_interval: 15s
scrape_configs:
  - job_name: synthetix-service
    static_configs:
      - targets: ["app:3000"]
`,
      },
      {
        path: "observability/grafana/provisioning/datasources/default.yml",
        content: `apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
`,
      },
      {
        path: "observability/grafana/provisioning/dashboards/default.yml",
        content: `apiVersion: 1
providers:
  - name: Synthetix
    folder: Services
    type: file
    options:
      path: /var/lib/grafana/dashboards
`,
      },
      {
        path: "observability/grafana/dashboards/service-overview.json",
        content: JSON.stringify({
          title: "Synthetix Service Overview",
          schemaVersion: 39,
          panels: [{
            type: "timeseries",
            title: "Node.js heap usage",
            targets: [{ expr: "synthetix_nodejs_heap_size_used_bytes" }],
          }],
        }, null, 2),
      }
    );
  }

  return files;
};

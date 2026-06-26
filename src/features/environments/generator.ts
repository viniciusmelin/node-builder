import type { ProjectConfig } from "@/features/configurator/types";
import type { PluginFile } from "@/features/plugins/generator";

const getEnvironmentVariables = (config: ProjectConfig) => {
  const variables: Record<string, string> = {
    NODE_ENV: "development",
    PORT: "3000",
    LOG_LEVEL: "info",
  };

  if (config.databaseEngine === "MongoDB") {
    variables.MONGO_URI = "mongodb://localhost:27017/synthetix";
  } else if (config.databaseEngine === "MySQL") {
    variables.DATABASE_URL = "mysql://app:change-me@localhost:3306/synthetix";
  } else if (config.databaseEngine === "PostgreSQL") {
    variables.DATABASE_URL = "postgresql://app:change-me@localhost:5432/synthetix";
  }
  if (config.security === "JWT Authentication") {
    variables.JWT_SECRET = "replace-with-a-random-value-at-least-32-characters";
  }
  if (config.security === "API Token") {
    variables.API_KEY = "replace-with-a-random-api-key";
  }
  if (config.templatePlugins.includes("redis") || config.templatePlugins.includes("queue")) {
    variables.REDIS_URL = "redis://localhost:6379";
  }
  if (config.templatePlugins.includes("kafka")) {
    variables.KAFKA_CLIENT_ID = "synthetix-service";
    variables.KAFKA_BROKERS = "localhost:9092";
  }
  if (config.templatePlugins.includes("grpc")) variables.GRPC_PORT = "50051";
  if (config.templatePlugins.includes("websockets")) variables.WS_PORT = "3001";
  if (config.templatePlugins.includes("payments")) {
    variables.STRIPE_SECRET_KEY = "replace-with-stripe-secret-key";
    variables.STRIPE_WEBHOOK_SECRET = "replace-with-stripe-webhook-secret";
  }
  if (config.observabilityLibs.includes("Sentry")) {
    variables.SENTRY_DSN = "replace-with-sentry-dsn";
  }
  if (config.observabilityLibs.includes("Datadog")) {
    variables.DD_SERVICE = config.projectName || "synthetix-service";
    variables.DD_ENV = "development";
  }
  if (config.secretsProvider === "AWS Secrets Manager") {
    variables.AWS_REGION = "us-east-1";
    variables.AWS_SECRET_ID = `${config.projectName || "synthetix-service"}/development`;
  }

  return variables;
};

const buildSchemaFields = (variables: Record<string, string>) =>
  Object.keys(variables)
    .map((key) => {
      if (key === "NODE_ENV") {
        return "  NODE_ENV: z.enum(['development', 'staging', 'production']),";
      }
      if (key.endsWith("_PORT") || key === "PORT") {
        return `  ${key}: z.coerce.number().int().positive(),`;
      }
      if ((key.includes("SECRET") && key !== "AWS_SECRET_ID") || key === "API_KEY") {
        return `  ${key}: z.string().min(16),`;
      }
      return `  ${key}: z.string().min(1),`;
    })
    .join("\n");

export const generateEnvironmentFiles = (config: ProjectConfig): PluginFile[] => {
  const baseVariables = getEnvironmentVariables(config);
  const files: PluginFile[] = [{
    path: ".env.example",
    content: `${Object.entries(baseVariables)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  }];

  for (const environment of config.environments) {
    const variables = {
      ...baseVariables,
      NODE_ENV: environment,
      LOG_LEVEL: environment === "production" ? "warn" : "debug",
      ...(baseVariables.DD_ENV ? { DD_ENV: environment } : {}),
      ...(baseVariables.AWS_SECRET_ID
        ? { AWS_SECRET_ID: `${config.projectName || "synthetix-service"}/${environment}` }
        : {}),
    };
    files.push({
      path: `.env.${environment}.example`,
      content: `${Object.entries(variables)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n")}\n`,
    });
    files.push({
      path: `config/environments/${environment}.json`,
      content: JSON.stringify(
        {
          environment,
          logging: { level: variables.LOG_LEVEL },
          diagnostics: {
            traces: environment !== "development",
            metrics: true,
          },
        },
        null,
        2
      ),
    });
  }

  const awsLoader =
    config.secretsProvider === "AWS Secrets Manager"
      ? `import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

async function loadSecrets() {
  const secretId = process.env.AWS_SECRET_ID;
  if (!secretId) throw new Error('AWS_SECRET_ID is required');
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const secrets = JSON.parse(response.SecretString || '{}') as Record<string, string>;
  for (const [key, value] of Object.entries(secrets)) {
    if (!process.env[key]) process.env[key] = value;
  }
}
`
      : `async function loadSecrets() {
  // Secrets are injected by the deployment platform. Never commit real .env files.
}
`;

  files.push(
    {
      path: "src/config/environment.ts",
      content: `import 'dotenv/config';
import { z } from 'zod';

${awsLoader}
const environmentSchema = z.object({
${buildSchemaFields(baseVariables)}
});

export type Environment = z.infer<typeof environmentSchema>;

export async function initializeEnvironment(): Promise<Environment> {
  await loadSecrets();
  const result = environmentSchema.safeParse(process.env);
  if (!result.success) {
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}
`,
    },
    {
      path: ".gitignore",
      content: `.env
.env.*
!.env.*.example
node_modules
dist
coverage
`,
    }
  );

  return files;
};

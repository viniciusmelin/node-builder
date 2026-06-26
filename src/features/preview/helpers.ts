import type { ProjectConfig } from "@/features/configurator/types";

export const ADDITIONAL_PACKAGE_CATALOG: Record<string, string> = {
  express: "^4.21.2",
  fastify: "^5.2.2",
  "@hapi/hapi": "^21.3.12",
  meteor: "latest",
  "class-validator": "^0.14.2",
  "class-transformer": "^0.5.1",
  zod: "^3.24.2",
  axios: "^1.8.4",
  lodash: "^4.17.21",
  dayjs: "^1.11.13",
  "date-fns": "^4.1.0",
  uuid: "^11.0.5",
  jsonwebtoken: "^9.0.2",
  bcrypt: "^5.1.1",
  helmet: "^8.1.0",
  cors: "^2.8.5",
  "express-rate-limit": "^7.5.0",
  csurf: "^1.11.0",
  "rate-limiter-flexible": "^5.0.4",
  "cookie-parser": "^1.4.7",
  compression: "^1.7.5",
  hpp: "^0.2.3",
  "pino-http": "^10.4.0",
  dotenv: "^16.4.7",
  ioredis: "^5.4.2",
  amqplib: "^0.10.5",
  bullmq: "^5.41.4",
  "@aws-sdk/client-sqs": "^3.787.0",
  "@aws-sdk/client-sns": "^3.787.0",
  prisma: "^6.6.0",
  "@prisma/client": "^6.6.0",
  pg: "^8.14.1",
  mysql2: "^3.12.0",
  redis: "^4.7.0",
  nodemailer: "^6.10.0",
  "socket.io": "^4.8.1",
  ws: "^8.18.1",
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/sdk-node": "^0.57.2",
  "dd-trace": "^5.39.0",
  "prom-client": "^15.1.3",
  "@sentry/node": "^9.15.0",
  joi: "^17.13.3",
  yup: "^1.6.1",
  qs: "^6.14.0",
};

export const createProjectSlug = (projectName: string) => {
  const normalizedName = (projectName || "my-service").trim();
  return (
    normalizedName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "my-service"
  );
};

const toKebab = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const buildCommandArgs = (config: ProjectConfig, projectSlug: string) => {
  const frameworkMap: Record<string, string> = {
    NestJS: "nestjs",
    "Simple TypeScript": "typescript",
    Express: "express",
    Hapi: "hapi",
    Meteor: "meteor",
  };

  const pmArg = config.packageManager ? `--pm=${config.packageManager}` : "";
  const nodeArg = config.nodeVersion ? `--node=${config.nodeVersion.split(" ")[0]}` : "";
  const frameworkArg = config.framework
    ? `--framework=${frameworkMap[config.framework] || config.framework.toLowerCase().replace(/\s+/g, "-")}`
    : "";
  const dbArg = config.database ? `--db=${config.database.toLowerCase()}` : "";
  const dbEngineArg = config.databaseEngine
    ? `--db-engine=${toKebab(config.databaseEngine)}`
    : "";
  const apiArg = config.apiPattern
    ? `--api=${
        config.apiPattern.includes("GraphQL")
          ? "graphql"
          : config.apiPattern.includes("Fastify")
          ? "fastify"
          : "express"
      }`
    : "";
  const docArg = config.documentation
    ? `--doc=${config.documentation === "Swagger-first" ? "spec" : "code-first"}`
    : "";
  const secArg = config.security
    ? `--auth=${config.security === "JWT Authentication" ? "jwt" : "token"}`
    : "";
  const archArg = config.architecture ? `--arch=${config.architecture.toLowerCase().replace(/ /g, "-")}` : "";
  const linterArg = config.linter ? `--linter=${config.linter.toLowerCase()}` : "";
  const testArg = config.testLibrary ? `--test=${config.testLibrary.toLowerCase()}` : "";
  const loggerArg = config.logger ? `--logger=${config.logger.toLowerCase()}` : "";
  const healthArg = config.healthcheckEnabled ? "--healthcheck" : "";
  const ciArg = config.ciCdEnabled ? "--ci=github-actions" : "";
  const dockerfileArg = config.dockerfileEnabled ? "--dockerfile" : "";
  const composeArg = config.dockerComposeEnabled ? "--docker-compose" : "";
  const securityStrategiesArg = config.securityStrategies.length
    ? `--security-strategies=${config.securityStrategies.map(toKebab).join(",")}`
    : "";
  const observabilityArg = config.observabilityLibs.length
    ? `--observability=${config.observabilityLibs.map(toKebab).join(",")}`
    : "";
  const middlewaresArg = config.middlewares.length
    ? `--middlewares=${config.middlewares.map(toKebab).join(",")}`
    : "";
  const packagesArg = config.additionalPackages.length ? `--packages=${config.additionalPackages.join(",")}` : "";
  const broker = config.messagingEnabled && config.messagingType ? `--mq=${config.messagingType.toLowerCase()}` : "";
  const migrationsArg = config.migrationsEnabled ? "--migrations" : "";
  const seedArg = config.seedEnabled ? "--seed" : "";
  const pluginsArg = config.templatePlugins.length
    ? `--plugins=${config.templatePlugins.join(",")}`
    : "";
  const environmentsArg = config.environments.length
    ? `--envs=${config.environments.join(",")}`
    : "";
  const secretsArg = `--secrets=${toKebab(config.secretsProvider)}`;

  return `npx create-synthetix-app ${projectSlug} ${pmArg} ${nodeArg} ${frameworkArg} ${apiArg} ${dbArg} ${dbEngineArg} ${docArg} ${secArg} ${archArg} ${linterArg} ${testArg} ${loggerArg} ${healthArg} ${ciArg} ${dockerfileArg} ${composeArg} ${migrationsArg} ${seedArg} ${securityStrategiesArg} ${observabilityArg} ${middlewaresArg} ${packagesArg} ${broker} ${pluginsArg} ${environmentsArg} ${secretsArg}`
    .replace(/\s+/g, " ")
    .trim();
};

export const getExtraDependencySnippet = (selectedPackages: string[], baseDependencies: Set<string>) => {
  const extraPackages = selectedPackages.filter((pkg) => !baseDependencies.has(pkg));
  if (!extraPackages.length) {
    return "";
  }

  return (
    extraPackages
      .map((pkg) => `"${pkg}": "${ADDITIONAL_PACKAGE_CATALOG[pkg] || "latest"}",`)
      .join("\n    ") + "\n    "
  );
};

export const getFrameworkPackages = (framework: string | null) => {
  if (framework === "Express") return ["express"];
  if (framework === "Hapi") return ["@hapi/hapi"];
  if (framework === "Meteor") return ["meteor"];
  return [];
};

export const getSecurityStrategyPackages = (strategies: string[]) => {
  const packages = new Set<string>();
  if (strategies.includes("Helmet")) packages.add("helmet");
  if (strategies.includes("CORS Hardening")) packages.add("cors");
  if (strategies.includes("Rate Limiting")) packages.add("express-rate-limit");
  if (strategies.includes("CSRF Protection")) packages.add("csurf");
  if (strategies.includes("Input Validation")) {
    packages.add("class-validator");
    packages.add("class-transformer");
  }
  if (strategies.includes("Brute-force Protection")) packages.add("rate-limiter-flexible");
  if (strategies.includes("Secure Cookies")) packages.add("cookie-parser");
  return Array.from(packages);
};

export const getObservabilityPackages = (libs: string[]) => {
  const packages = new Set<string>();
  if (libs.includes("OpenTelemetry")) {
    packages.add("@opentelemetry/api");
    packages.add("@opentelemetry/sdk-node");
  }
  if (libs.includes("Datadog")) packages.add("dd-trace");
  if (libs.includes("Prometheus")) packages.add("prom-client");
  if (libs.includes("Sentry")) packages.add("@sentry/node");
  return Array.from(packages);
};

export const getMiddlewarePackages = (middlewares: string[]) => {
  const packages = new Set<string>();
  if (middlewares.includes("Helmet Middleware")) packages.add("helmet");
  if (middlewares.includes("CORS Middleware")) packages.add("cors");
  if (middlewares.includes("Rate Limit Middleware")) packages.add("express-rate-limit");
  if (middlewares.includes("CSRF Middleware")) packages.add("csurf");
  if (middlewares.includes("Secure Cookies Middleware")) packages.add("cookie-parser");
  if (middlewares.includes("Compression Middleware")) packages.add("compression");
  if (middlewares.includes("HPP Middleware")) packages.add("hpp");
  if (middlewares.includes("Request Logger Middleware")) packages.add("pino-http");
  return Array.from(packages);
};

export const getMessagingPackages = (
  enabled: boolean,
  messagingType: string | null
) => {
  if (!enabled || !messagingType) return [];
  if (messagingType === "RabbitMQ") return ["amqplib"];
  if (messagingType === "BullMQ") return ["bullmq", "ioredis"];
  if (messagingType === "AWS SQS") return ["@aws-sdk/client-sqs"];
  return [];
};

export const resolveLintScripts = (linter: string | null) => {
  if (linter === "ESLint") {
    return { lintScript: "eslint . --ext .ts", lintFixScript: "eslint . --ext .ts --fix" };
  }
  if (linter === "Biome") {
    return { lintScript: "biome check .", lintFixScript: "biome check . --write" };
  }
  return { lintScript: "echo No linter selected", lintFixScript: "echo No linter selected" };
};

export const resolveTestScripts = (testLibrary: string | null) => {
  if (testLibrary === "Jest") {
    return {
      testScript: "jest --config jest.config.ts",
      testWatchScript: "jest --watch --config jest.config.ts",
    };
  }
  if (testLibrary === "Vitest") {
    return { testScript: "vitest run", testWatchScript: "vitest" };
  }
  if (testLibrary === "Mocha") {
    return {
      testScript: "mocha -r ts-node/register 'src/**/*.spec.ts'",
      testWatchScript: "mocha -r ts-node/register --watch 'src/**/*.spec.ts'",
    };
  }
  return {
    testScript: "echo No test library selected",
    testWatchScript: "echo No test library selected",
  };
};

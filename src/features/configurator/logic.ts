import type { ProjectConfig } from "./types";
import { getPluginDefinition } from "@/features/plugins/registry";

export type StarterProfileKey = "saas-api" | "worker-queue" | "bff-graphql";

export type TodoItem = {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
};

export type ConfigIssue = {
  field: keyof ProjectConfig | "compatibility";
  message: string;
};

export const NODE_VERSIONS = ["20 LTS", "22 LTS", "24 LTS"];
export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"];
export const FRAMEWORK_OPTIONS = ["NestJS", "Simple TypeScript", "Express", "Hapi"];
export const API_PATTERNS = ["REST Express", "REST Fastify", "GraphQL Apollo"];
export const LINTER_OPTIONS = ["ESLint", "Biome"];
export const TEST_LIBRARIES = ["Jest", "Vitest", "Mocha"];
export const LOGGER_OPTIONS = ["Pino", "Winston"];
export const OBSERVABILITY_OPTIONS = ["OpenTelemetry", "Datadog", "Prometheus", "Sentry"];
export const MIDDLEWARE_OPTIONS = [
  "Helmet Middleware",
  "CORS Middleware",
  "Rate Limit Middleware",
  "CSRF Middleware",
  "Secure Cookies Middleware",
  "Compression Middleware",
  "HPP Middleware",
  "Request Logger Middleware",
];
export const DOCS_OPTIONS = ["Swagger Code-first", "Swagger-first"];
export const SECURITY_OPTIONS = ["JWT Authentication", "API Token"];
export const SECURITY_STRATEGY_OPTIONS = [
  "Helmet",
  "CORS Hardening",
  "Rate Limiting",
  "CSRF Protection",
  "Input Validation",
  "Brute-force Protection",
  "Secure Cookies",
];
export const ARCHITECTURES = ["MVC", "Hexagonal", "Clean Architecture"];
export const BROKERS = ["RabbitMQ", "BullMQ", "AWS SQS"];
export const DATABASE_ENGINES = ["PostgreSQL", "MySQL", "MongoDB"];
export const ENVIRONMENTS = ["development", "staging", "production"];
export const SECRETS_PROVIDERS = ["Environment Variables", "AWS Secrets Manager"];

export const ADDITIONAL_PACKAGES = [
  "express",
  "fastify",
  "@hapi/hapi",
  "meteor",
  "class-validator",
  "class-transformer",
  "zod",
  "axios",
  "lodash",
  "dayjs",
  "date-fns",
  "uuid",
  "jsonwebtoken",
  "bcrypt",
  "helmet",
  "cors",
  "express-rate-limit",
  "csurf",
  "rate-limiter-flexible",
  "cookie-parser",
  "compression",
  "hpp",
  "pino-http",
  "dotenv",
  "ioredis",
  "amqplib",
  "bullmq",
  "@aws-sdk/client-sqs",
  "@aws-sdk/client-sns",
  "prisma",
  "@prisma/client",
  "pg",
  "mysql2",
  "redis",
  "nodemailer",
  "socket.io",
  "ws",
  "@opentelemetry/api",
  "@opentelemetry/sdk-node",
  "dd-trace",
  "prom-client",
  "@sentry/node",
  "joi",
  "yup",
  "qs",
];

export const STARTER_PROFILE_PRESETS: Record<
  StarterProfileKey,
  { title: string; summary: string; preset: Partial<ProjectConfig> }
> = {
  "saas-api": {
    title: "SaaS API",
    summary: "REST API with auth, DB, observability and CI.",
    preset: {
      packageManager: "pnpm",
      nodeVersion: "20 LTS",
      framework: "NestJS",
      apiPattern: "REST Fastify",
      database: "TypeORM",
      databaseEngine: "PostgreSQL",
      migrationsEnabled: true,
      seedEnabled: true,
      linter: "ESLint",
      testLibrary: "Vitest",
      logger: "Pino",
      healthcheckEnabled: true,
      documentation: "Swagger Code-first",
      security: "JWT Authentication",
      securityStrategies: ["Helmet", "Rate Limiting", "Input Validation", "Secure Cookies"],
      middlewares: [
        "Helmet Middleware",
        "CORS Middleware",
        "Rate Limit Middleware",
        "Compression Middleware",
        "Request Logger Middleware",
      ],
      observabilityLibs: ["OpenTelemetry", "Datadog"],
      architecture: "Hexagonal",
      ciCdEnabled: true,
      dockerfileEnabled: true,
      dockerComposeEnabled: true,
      messagingEnabled: false,
      messagingType: null,
      additionalPackages: ["prisma", "@prisma/client"],
      templatePlugins: ["redis"],
      environments: ["development", "staging", "production"],
      secretsProvider: "Environment Variables",
    },
  },
  "worker-queue": {
    title: "Worker Queue",
    summary: "Background worker with queue processing and telemetry.",
    preset: {
      packageManager: "npm",
      nodeVersion: "20 LTS",
      framework: "Simple TypeScript",
      apiPattern: null,
      database: null,
      databaseEngine: null,
      migrationsEnabled: false,
      seedEnabled: false,
      linter: "ESLint",
      testLibrary: "Jest",
      logger: "Winston",
      healthcheckEnabled: false,
      documentation: null,
      security: null,
      securityStrategies: [],
      middlewares: ["Request Logger Middleware", "Compression Middleware"],
      observabilityLibs: ["OpenTelemetry"],
      architecture: "Clean Architecture",
      ciCdEnabled: true,
      dockerfileEnabled: true,
      dockerComposeEnabled: true,
      messagingEnabled: true,
      messagingType: "BullMQ",
      additionalPackages: ["ioredis", "bullmq"],
      templatePlugins: ["queue"],
      environments: ["development", "staging", "production"],
      secretsProvider: "Environment Variables",
    },
  },
  "bff-graphql": {
    title: "BFF GraphQL",
    summary: "GraphQL backend-for-frontend with auth and tracing.",
    preset: {
      packageManager: "pnpm",
      nodeVersion: "20 LTS",
      framework: "NestJS",
      apiPattern: "GraphQL Apollo",
      database: "TypeORM",
      databaseEngine: "PostgreSQL",
      migrationsEnabled: true,
      seedEnabled: true,
      linter: "ESLint",
      testLibrary: "Vitest",
      logger: "Pino",
      healthcheckEnabled: true,
      documentation: "Swagger Code-first",
      security: "JWT Authentication",
      securityStrategies: ["Helmet", "CORS Hardening", "Input Validation"],
      middlewares: ["Helmet Middleware", "CORS Middleware", "Request Logger Middleware"],
      observabilityLibs: ["OpenTelemetry", "Sentry"],
      architecture: "Clean Architecture",
      ciCdEnabled: true,
      dockerfileEnabled: true,
      dockerComposeEnabled: true,
      messagingEnabled: false,
      messagingType: null,
      additionalPackages: ["class-validator", "class-transformer", "zod"],
      templatePlugins: ["redis"],
      environments: ["development", "staging", "production"],
      secretsProvider: "Environment Variables",
    },
  },
};

export const calculateManualAdditionalCount = (
  config: ProjectConfig,
  autoInstalledPackages: Set<string>
) => config.additionalPackages.filter((pkg) => !autoInstalledPackages.has(pkg)).length;

export const getConfigIssues = (config: ProjectConfig): ConfigIssue[] => {
  const issues: ConfigIssue[] = [];
  const nodeMajor = Number.parseInt(config.nodeVersion ?? "", 10);

  if (!config.projectName.trim()) {
    issues.push({ field: "projectName", message: "Informe um nome de projeto." });
  }
  if (!config.packageManager) {
    issues.push({ field: "packageManager", message: "Selecione um gerenciador de pacotes." });
  }
  if (!config.nodeVersion) {
    issues.push({ field: "nodeVersion", message: "Selecione uma versão do Node.js." });
  }
  if (!config.framework) {
    issues.push({ field: "framework", message: "Selecione um framework." });
  }
  if (
    config.apiPattern === "REST Fastify" &&
    Number.isFinite(nodeMajor) &&
    nodeMajor < 20
  ) {
    issues.push({
      field: "compatibility",
      message: "Fastify 5 exige Node.js 20 ou superior.",
    });
  }
  if (config.messagingEnabled && !config.messagingType) {
    issues.push({
      field: "messagingType",
      message: "Selecione um broker para habilitar mensageria.",
    });
  }
  if (config.healthcheckEnabled && !config.apiPattern) {
    issues.push({
      field: "apiPattern",
      message: "Healthcheck HTTP exige um padrão de API.",
    });
  }
  if (config.dockerComposeEnabled && !config.dockerfileEnabled) {
    issues.push({
      field: "dockerComposeEnabled",
      message: "Docker Compose exige que o Dockerfile esteja habilitado.",
    });
  }
  if (config.database === "TypeORM" && config.databaseEngine === "MongoDB") {
    issues.push({
      field: "databaseEngine",
      message: "TypeORM neste template suporta PostgreSQL ou MySQL.",
    });
  }
  if (config.database === "Mongoose" && config.databaseEngine !== "MongoDB") {
    issues.push({
      field: "databaseEngine",
      message: "Mongoose requer MongoDB.",
    });
  }
  if (!config.database && config.databaseEngine) {
    issues.push({
      field: "databaseEngine",
      message: "Selecione um ORM/ODM antes de escolher o banco.",
    });
  }
  if (config.migrationsEnabled && config.database !== "TypeORM") {
    issues.push({
      field: "migrationsEnabled",
      message: "Migrations SQL exigem TypeORM.",
    });
  }
  if (config.seedEnabled && !config.database) {
    issues.push({
      field: "seedEnabled",
      message: "Seed exige um banco configurado.",
    });
  }
  if (!config.environments.length) {
    issues.push({
      field: "environments",
      message: "Selecione ao menos um ambiente.",
    });
  }
  for (const pluginId of config.templatePlugins) {
    const plugin = getPluginDefinition(pluginId);
    if (!plugin) {
      issues.push({
        field: "templatePlugins",
        message: `Plugin desconhecido: ${pluginId}.`,
      });
      continue;
    }
    if (
      plugin.supportedFrameworks &&
      config.framework &&
      !plugin.supportedFrameworks.includes(config.framework)
    ) {
      issues.push({
        field: "compatibility",
        message: `${plugin.title} não suporta o framework ${config.framework}.`,
      });
    }
    if (
      plugin.requiredPackageManager &&
      config.packageManager !== plugin.requiredPackageManager
    ) {
      issues.push({
        field: "compatibility",
        message: `${plugin.title} requer ${plugin.requiredPackageManager}.`,
      });
    }
  }
  if (config.framework === "Express" && config.apiPattern !== "REST Express") {
    issues.push({
      field: "compatibility",
      message: "O framework Express requer o padrão REST Express.",
    });
  }
  if (config.framework === "Hapi" && config.apiPattern !== "REST Express") {
    issues.push({
      field: "compatibility",
      message: "O template Hapi suporta apenas o fluxo REST.",
    });
  }
  if (config.framework === "Meteor") {
    issues.push({
      field: "compatibility",
      message: "O template Meteor ainda não está disponível para geração.",
    });
  }
  if (
    config.framework === "Simple TypeScript" &&
    config.apiPattern === "GraphQL Apollo"
  ) {
    issues.push({
      field: "compatibility",
      message: "GraphQL Apollo está disponível no template NestJS ou Meteor.",
    });
  }

  return issues;
};

export const getTodoState = (config: ProjectConfig) => {
  const todoItems: TodoItem[] = [
    { id: "project", label: "Project Name", done: Boolean(config.projectName.trim()), required: true },
    { id: "pm", label: "Package Manager", done: Boolean(config.packageManager), required: true },
    { id: "node", label: "Node.js Version", done: Boolean(config.nodeVersion), required: true },
    { id: "framework", label: "Framework", done: Boolean(config.framework), required: true },
    { id: "api", label: "API Pattern", done: Boolean(config.apiPattern), required: false },
    { id: "database", label: "Database", done: Boolean(config.database), required: false },
    {
      id: "database-engine",
      label: "Database Engine",
      done: Boolean(config.databaseEngine),
      required: false,
    },
    { id: "security", label: "Security & Auth", done: Boolean(config.security), required: false },
    {
      id: "security-strategies",
      label: "Security Strategies",
      done: config.securityStrategies.length > 0,
      required: false,
    },
    { id: "middlewares", label: "Middlewares", done: config.middlewares.length > 0, required: false },
    {
      id: "observability",
      label: "Observability Libraries",
      done: config.observabilityLibs.length > 0,
      required: false,
    },
    {
      id: "plugins",
      label: "Plugins & Templates",
      done: config.templatePlugins.length > 0,
      required: false,
    },
    {
      id: "environments",
      label: "Environments",
      done: config.environments.length > 0,
      required: true,
    },
    { id: "tests", label: "Test Library", done: Boolean(config.testLibrary), required: false },
    {
      id: "containers",
      label: "Containerization",
      done: config.dockerfileEnabled || config.dockerComposeEnabled,
      required: false,
    },
  ];

  const completedCount = todoItems.filter((item) => item.done).length;
  const requiredPending = todoItems.filter((item) => item.required && !item.done);
  const issues = getConfigIssues(config);
  const isReadyToGenerate = requiredPending.length === 0 && issues.length === 0;

  return { todoItems, completedCount, requiredPending, issues, isReadyToGenerate };
};

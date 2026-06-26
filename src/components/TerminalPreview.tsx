import React, { useMemo, useState } from "react";
import { FolderIcon, FileIcon } from "./Icons";
import type { ProjectConfig } from "@/features/configurator/types";
import {
  ADDITIONAL_PACKAGE_CATALOG,
  buildCommandArgs,
  createProjectSlug,
  getExtraDependencySnippet,
  getFrameworkPackages,
  getMiddlewarePackages,
  getMessagingPackages,
  getObservabilityPackages,
  getSecurityStrategyPackages,
  resolveLintScripts,
  resolveTestScripts,
} from "@/features/preview/helpers";
import { generatePluginFiles, type PluginFile } from "@/features/plugins/generator";
import { generateEnvironmentFiles } from "@/features/environments/generator";
import { generateObservabilityFiles } from "@/features/observability/generator";
import { generateDatabaseFiles } from "@/features/database/generator";
import { getPluginDefinition } from "@/features/plugins/registry";

interface TerminalPreviewProps {
  config: ProjectConfig;
}

export interface FileTreeItem {
  name: string;
  isFolder: boolean;
  children?: FileTreeItem[];
  codePreview?: string;
}

const mergeGeneratedFiles = (
  tree: FileTreeItem[],
  files: PluginFile[]
): FileTreeItem[] => {
  const merged = structuredClone(tree);

  for (const file of files) {
    const parts = file.path.split("/");
    let current = merged;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const existing = current.find((item) => item.name === part);
      if (isFile) {
        if (existing) {
          existing.isFolder = false;
          existing.codePreview = file.content;
          delete existing.children;
        } else {
          current.push({ name: part, isFolder: false, codePreview: file.content });
        }
      } else if (existing?.isFolder) {
        existing.children ??= [];
        current = existing.children;
      } else {
        const folder: FileTreeItem = { name: part, isFolder: true, children: [] };
        current.push(folder);
        current = folder.children!;
      }
    });
  }

  return merged;
};

const getNodeMajor = (nodeVersion: string | null) =>
  nodeVersion?.match(/\d+/)?.[0] ?? "20";

const getPackageManagerSetup = (packageManager: string | null) => {
  if (packageManager === "pnpm") {
    return {
      setup: "RUN corepack enable",
      install: "RUN pnpm install",
      build: "RUN pnpm build",
    };
  }
  if (packageManager === "yarn") {
    return {
      setup: "RUN corepack enable",
      install: "RUN yarn install",
      build: "RUN yarn build",
    };
  }
  if (packageManager === "bun") {
    return {
      setup: "RUN npm install --global bun",
      install: "RUN bun install",
      build: "RUN bun run build",
    };
  }
  return {
    setup: "",
    install: "RUN npm install",
    build: "RUN npm run build",
  };
};

const buildDockerfile = (
  config: ProjectConfig,
  entrypoint: string,
  shouldBuild = true
) => {
  const commands = getPackageManagerSetup(config.packageManager);
  return `FROM node:${getNodeMajor(config.nodeVersion)}-alpine
WORKDIR /app
COPY package.json ./
${commands.setup ? `${commands.setup}\n` : ""}${commands.install}
COPY . .
${shouldBuild ? `${commands.build}\n` : ""}EXPOSE 3000${config.templatePlugins.includes("websockets") ? " 3001" : ""}${config.templatePlugins.includes("grpc") ? " 50051" : ""}
CMD ["node", "${entrypoint}"]`;
};

const getCiSetupStep = (packageManager: string | null) => {
  if (packageManager === "pnpm") {
    return "      - run: corepack enable";
  }
  if (packageManager === "yarn") {
    return "      - run: corepack enable";
  }
  if (packageManager === "bun") {
    return "      - uses: oven-sh/setup-bun@v2";
  }
  return "";
};

const getMessagingEnv = (messagingType: string | null) => {
  if (messagingType === "RabbitMQ") return "MESSAGING_URL=amqp://localhost:5672\n";
  if (messagingType === "BullMQ") return "MESSAGING_URL=redis://localhost:6379\n";
  if (messagingType === "AWS SQS") {
    return "AWS_ENDPOINT=http://localhost:4566\nAWS_REGION=us-east-1\n";
  }
  return "";
};

const getDatabaseCompose = (config: ProjectConfig, projectSlug: string) => {
  if (!config.database) return { env: "", dependsOn: "", service: "" };
  if (config.databaseEngine === "MongoDB") {
    return {
      env: "      - MONGO_URI=mongodb://mongo:27017/synthetix\n",
      dependsOn: "      - mongo\n",
      service: `\n  mongo:\n    image: mongo:7\n    container_name: ${projectSlug}-mongo\n    ports:\n      - "27017:27017"\n`,
    };
  }
  if (config.databaseEngine === "MySQL") {
    return {
      env: "      - DATABASE_URL=mysql://app:change-me@mysql:3306/synthetix\n",
      dependsOn: "      - mysql\n",
      service: `\n  mysql:\n    image: mysql:8.4\n    container_name: ${projectSlug}-mysql\n    environment:\n      MYSQL_USER: app\n      MYSQL_PASSWORD: change-me\n      MYSQL_DATABASE: synthetix\n      MYSQL_ROOT_PASSWORD: change-root-password\n    ports:\n      - "3306:3306"\n`,
    };
  }
  return {
    env: "      - DATABASE_URL=postgresql://app:change-me@postgres:5432/synthetix\n",
    dependsOn: "      - postgres\n",
    service: `\n  postgres:\n    image: postgres:16-alpine\n    container_name: ${projectSlug}-postgres\n    environment:\n      POSTGRES_USER: app\n      POSTGRES_PASSWORD: change-me\n      POSTGRES_DB: synthetix\n    ports:\n      - "5432:5432"\n`,
  };
};

const getExtendedComposeServices = (config: ProjectConfig) => {
  const needsRedis =
    (config.templatePlugins.includes("redis") ||
      config.templatePlugins.includes("queue")) &&
    config.messagingType !== "BullMQ";
  const redis = needsRedis
    ? `\n  redis:\n    image: redis:7-alpine\n    ports:\n      - "6379:6379"\n`
    : "";
  const kafka = config.templatePlugins.includes("kafka")
    ? `\n  kafka:\n    image: bitnami/kafka:3.9\n    environment:\n      ALLOW_PLAINTEXT_LISTENER: "yes"\n      KAFKA_CFG_NODE_ID: 1\n      KAFKA_CFG_PROCESS_ROLES: broker,controller\n      KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093\n      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092\n      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER\n      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093\n    ports:\n      - "9092:9092"\n`
    : "";
  const monitoring = config.observabilityLibs.includes("Prometheus")
    ? `\n  prometheus:\n    image: prom/prometheus:v3.2.1\n    volumes:\n      - ./observability/prometheus.yml:/etc/prometheus/prometheus.yml:ro\n    ports:\n      - "9090:9090"\n\n  grafana:\n    image: grafana/grafana:11.5.2\n    volumes:\n      - ./observability/grafana/provisioning:/etc/grafana/provisioning:ro\n      - ./observability/grafana/dashboards:/var/lib/grafana/dashboards:ro\n    ports:\n      - "${config.templatePlugins.includes("websockets") ? "3002" : "3001"}:3000"\n`
    : "";
  return `${redis}${kafka}${monitoring}`;
};

const getExtendedComposeEnv = (config: ProjectConfig) =>
  `${config.templatePlugins.some((id) => id === "redis" || id === "queue") ? "      - REDIS_URL=redis://redis:6379\n" : ""}${
    config.templatePlugins.includes("kafka") ? "      - KAFKA_BROKERS=kafka:9092\n" : ""
  }`;

const getExtendedComposeDependsOn = (config: ProjectConfig) =>
  `${config.templatePlugins.some((id) => id === "redis" || id === "queue") && config.messagingType !== "BullMQ" ? "      - redis\n" : ""}${
    config.templatePlugins.includes("kafka") ? "      - kafka\n" : ""
  }`;

const getPluginPortMappings = (config: ProjectConfig) =>
  `${config.templatePlugins.includes("websockets") ? '      - "3001:3001"\n' : ""}${
    config.templatePlugins.includes("grpc") ? '      - "50051:50051"\n' : ""
  }`;

const buildMessagingService = (messagingType: string, nest = false) => {
  const injectableImport = nest
    ? "import { Injectable, OnModuleInit } from '@nestjs/common';\n"
    : "";
  const decorator = nest ? "\n@Injectable()" : "";
  const lifecycle = nest ? " implements OnModuleInit" : "";

  if (messagingType === "RabbitMQ") {
    return `${injectableImport}import amqp, { Channel, ChannelModel } from 'amqplib';\n${decorator}\nexport class MessagingService${lifecycle} {\n  private connection?: ChannelModel;\n  private channel?: Channel;\n\n  async ${nest ? "onModuleInit" : "connect"}() {\n    this.connection = await amqp.connect(process.env.MESSAGING_URL || 'amqp://localhost:5672');\n    this.channel = await this.connection.createChannel();\n  }\n\n  async publish(queue: string, message: unknown) {\n    if (!this.channel) throw new Error('Messaging service is not connected');\n    await this.channel.assertQueue(queue, { durable: true });\n    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });\n  }\n}`;
  }
  if (messagingType === "BullMQ") {
    return `${injectableImport}import { Queue } from 'bullmq';\nimport IORedis from 'ioredis';\n${decorator}\nexport class MessagingService${lifecycle} {\n  private queue?: Queue;\n\n  async ${nest ? "onModuleInit" : "connect"}() {\n    const connection = new IORedis(process.env.MESSAGING_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });\n    this.queue = new Queue('default', { connection });\n  }\n\n  async publish(queue: string, message: unknown) {\n    if (!this.queue) throw new Error('Messaging service is not connected');\n    await this.queue.add(queue, message);\n  }\n}`;
  }
  return `${injectableImport}import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';\n${decorator}\nexport class MessagingService${lifecycle} {\n  private client?: SQSClient;\n\n  async ${nest ? "onModuleInit" : "connect"}() {\n    this.client = new SQSClient({\n      region: process.env.AWS_REGION || 'us-east-1',\n      endpoint: process.env.AWS_ENDPOINT,\n    });\n  }\n\n  async publish(queueUrl: string, message: unknown) {\n    if (!this.client) throw new Error('Messaging service is not connected');\n    await this.client.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(message) }));\n  }\n}`;
};

const buildPackageJson = (
  config: ProjectConfig,
  projectSlug: string,
  nest: boolean
) => {
  const { lintScript, lintFixScript } = resolveLintScripts(config.linter);
  const { testScript, testWatchScript } = resolveTestScripts(config.testLibrary);
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {
    "@types/node": "^20.17.0",
    typescript: "^5.7.0",
  };

  if (nest) {
    Object.assign(dependencies, {
      "@nestjs/common": "^10.4.0",
      "@nestjs/config": "^3.3.0",
      "@nestjs/core": "^10.4.0",
      "reflect-metadata": "^0.2.2",
      rxjs: "^7.8.1",
    });
    devDependencies["@nestjs/cli"] = "^10.4.0";

    if (config.apiPattern) {
      const fastify = config.apiPattern === "REST Fastify";
      dependencies[fastify ? "@nestjs/platform-fastify" : "@nestjs/platform-express"] = "^10.4.0";
      dependencies[fastify ? "fastify" : "express"] = fastify ? "^5.2.2" : "^4.21.2";
    }
    if (config.database === "Mongoose") {
      dependencies["@nestjs/mongoose"] = "^10.1.0";
      dependencies.mongoose = "^8.9.0";
    }
    if (config.database === "TypeORM") {
      dependencies["@nestjs/typeorm"] = "^10.0.2";
      dependencies.typeorm = "^0.3.20";
      dependencies[config.databaseEngine === "MySQL" ? "mysql2" : "pg"] =
        config.databaseEngine === "MySQL" ? "^3.12.0" : "^8.14.1";
    }
    if (config.security === "JWT Authentication") {
      dependencies["@nestjs/passport"] = "^10.0.3";
      dependencies.passport = "^0.7.0";
      dependencies["passport-jwt"] = "^4.0.1";
      devDependencies["@types/passport-jwt"] = "^4.0.1";
    }
    if (config.documentation) dependencies["@nestjs/swagger"] = "^7.4.2";
    if (config.apiPattern === "GraphQL Apollo") {
      dependencies["@nestjs/apollo"] = "^12.2.2";
      dependencies["@nestjs/graphql"] = "^12.2.2";
      dependencies["@apollo/server"] = "^4.11.0";
      dependencies.graphql = "^16.10.0";
    }
    if (config.messagingEnabled) dependencies["@nestjs/microservices"] = "^10.4.0";
  } else {
    dependencies.dotenv = "^16.4.7";
    dependencies["reflect-metadata"] = "^0.2.2";
    devDependencies["ts-node-dev"] = "^2.0.0";

    const fastify =
      config.framework === "Simple TypeScript" &&
      config.apiPattern === "REST Fastify";
    if (config.apiPattern) {
      if (config.framework === "Hapi") dependencies["@hapi/hapi"] = "^21.3.12";
      else if (config.framework === "Meteor") dependencies.meteor = "latest";
      else dependencies[fastify ? "fastify" : "express"] = fastify ? "^5.2.2" : "^4.21.2";
    }
    if (config.database === "Mongoose") dependencies.mongoose = "^8.9.0";
    if (config.database === "TypeORM") {
      dependencies.typeorm = "^0.3.20";
      dependencies[config.databaseEngine === "MySQL" ? "mysql2" : "pg"] =
        config.databaseEngine === "MySQL" ? "^3.12.0" : "^8.14.1";
    }
    if (config.security === "JWT Authentication") {
      dependencies.jsonwebtoken = "^9.0.2";
      devDependencies["@types/jsonwebtoken"] = "^9.0.7";
    }
    if (config.apiPattern && !fastify && config.framework !== "Hapi" && config.framework !== "Meteor") {
      devDependencies["@types/express"] = "^4.17.21";
    }
  }

  if (config.logger === "Pino") dependencies.pino = "^9.0.0";
  if (config.logger === "Winston") dependencies.winston = "^3.0.0";

  const optionPackages = [
    ...config.additionalPackages,
    ...getSecurityStrategyPackages(config.securityStrategies),
    ...getObservabilityPackages(config.observabilityLibs),
    ...getMiddlewarePackages(config.middlewares),
    ...getMessagingPackages(config.messagingEnabled, config.messagingType),
  ];
  for (const packageName of optionPackages) {
    dependencies[packageName] =
      ADDITIONAL_PACKAGE_CATALOG[packageName] ?? "latest";
  }
  for (const pluginId of config.templatePlugins) {
    const plugin = getPluginDefinition(pluginId);
    if (plugin) Object.assign(dependencies, plugin.dependencies);
  }
  dependencies.dotenv = "^16.4.7";
  dependencies.zod = "^3.24.2";
  if (config.secretsProvider === "AWS Secrets Manager") {
    dependencies["@aws-sdk/client-secrets-manager"] = "^3.787.0";
  }
  if (config.observabilityLibs.includes("OpenTelemetry")) {
    dependencies["@opentelemetry/auto-instrumentations-node"] = "^0.57.2";
    dependencies["@opentelemetry/exporter-trace-otlp-http"] = "^0.57.2";
  }
  if (config.templatePlugins.includes("websockets")) {
    devDependencies["@types/ws"] = "^8.5.14";
  }
  if (config.templatePlugins.includes("monorepo")) {
    devDependencies.turbo = "^2.3.3";
  }

  if (config.messagingType === "RabbitMQ") {
    devDependencies["@types/amqplib"] = "^0.10.7";
  }
  if (config.linter === "ESLint") {
    devDependencies.eslint = "^8.57.1";
    devDependencies["@typescript-eslint/parser"] = "^8.0.0";
    devDependencies["@typescript-eslint/eslint-plugin"] = "^8.0.0";
  }
  if (config.linter === "Biome") devDependencies["@biomejs/biome"] = "^1.9.0";
  if (config.testLibrary === "Jest") {
    devDependencies.jest = "^29.7.0";
    devDependencies["@types/jest"] = "^29.5.14";
    devDependencies["ts-jest"] = "^29.2.5";
  }
  if (config.testLibrary === "Vitest") devDependencies.vitest = "^2.1.0";
  if (config.testLibrary === "Mocha") {
    devDependencies.mocha = "^10.8.0";
    devDependencies["@types/mocha"] = "^10.0.10";
    devDependencies["ts-node"] = "^10.9.2";
  }

  const scripts: Record<string, string> = {
    build: nest ? "nest build" : "tsc",
    "start:dev": nest ? "nest start --watch" : "ts-node-dev --respawn src/index.ts",
    "start:prod": nest ? "node dist/main.js" : "node dist/index.js",
    lint: lintScript,
    "lint:fix": lintFixScript,
    test: testScript,
    "test:watch": testWatchScript,
  };
  if (config.database === "TypeORM" && config.migrationsEnabled) {
    const dataSource = nest ? "src/database/data-source.ts" : "src/config/data-source.ts";
    scripts["migration:run"] = `typeorm-ts-node-commonjs migration:run -d ${dataSource}`;
    scripts["migration:revert"] = `typeorm-ts-node-commonjs migration:revert -d ${dataSource}`;
  }
  if (config.seedEnabled) {
    scripts.seed = `ts-node ${nest ? "src/database" : "src/config"}/seed.ts`;
    devDependencies["ts-node"] = "^10.9.2";
  }
  if (config.templatePlugins.includes("monorepo")) {
    scripts["build:all"] = "turbo run build";
    scripts["test:all"] = "turbo run test";
    scripts["lint:all"] = "turbo run lint";
  }

  return JSON.stringify(
    {
      name: projectSlug,
      version: "1.0.0",
      private: true,
      scripts,
      dependencies,
      devDependencies,
    },
    null,
    2
  );
};

export const buildProjectFileTree = (config: ProjectConfig): FileTreeItem[] => {
  const projectSlug = createProjectSlug(config.projectName);
  const activeFramework = config.framework;
  const activeDatabase = config.database;
  const activeApiPattern = config.apiPattern;

  // Build file tree representation based on settings
    const isNest = activeFramework === "NestJS";
    const isSimpleTypeScript = activeFramework === "Simple TypeScript";
    const isExpressFramework = activeFramework === "Express";
    const isHapiFramework = activeFramework === "Hapi";
    const isMeteorFramework = activeFramework === "Meteor";
    const isStandardTsFramework = isSimpleTypeScript || isExpressFramework || isHapiFramework || isMeteorFramework;
    const hasDatabase = Boolean(activeDatabase);
    const hasApiPattern = Boolean(activeApiPattern);
    const isMongoose = activeDatabase === "Mongoose";
    const isFastify = activeApiPattern?.includes("Fastify") ?? false;
    const useFastifyRuntime = isFastify && !isExpressFramework && !isHapiFramework && !isMeteorFramework;
    const messagingFileBase = config.messagingType
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    const supplementalFiles = [
      ...generatePluginFiles(config),
      ...generateEnvironmentFiles(config),
      ...generateObservabilityFiles(config),
      ...generateDatabaseFiles(config),
    ];
    const hasRuntimePlugins = config.templatePlugins.some(
      (pluginId) => !["monorepo", "serverless"].includes(pluginId)
    );
    const optionDrivenPackages = Array.from(
      new Set([
        ...getFrameworkPackages(config.framework),
        ...getSecurityStrategyPackages(config.securityStrategies),
        ...getObservabilityPackages(config.observabilityLibs),
        ...getMiddlewarePackages(config.middlewares),
        ...getMessagingPackages(config.messagingEnabled, config.messagingType),
      ])
    );

    const lintConfigFiles: FileTreeItem[] = config.linter === "ESLint"
      ? [{
          name: ".eslintrc.cjs",
          isFolder: false,
          codePreview: `module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
};`,
        }]
      : config.linter === "Biome"
      ? [{
          name: "biome.json",
          isFolder: false,
          codePreview: `{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}`,
        }]
      : [];

    const testConfigFiles: FileTreeItem[] = config.testLibrary === "Jest"
      ? [{
          name: "jest.config.ts",
          isFolder: false,
          codePreview: `import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};

export default config;`,
        }]
      : config.testLibrary === "Vitest"
      ? [{
          name: "vitest.config.ts",
          isFolder: false,
          codePreview: `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});`,
        }]
      : config.testLibrary === "Mocha"
      ? [{
          name: ".mocharc.json",
          isFolder: false,
          codePreview: `{
  "extension": ["ts"],
  "spec": "src/**/*.spec.ts",
  "require": ["ts-node/register"],
  "timeout": 10000
}`,
        }]
      : [];

    const { lintScript, lintFixScript } = resolveLintScripts(config.linter);
    const { testScript, testWatchScript } = resolveTestScripts(config.testLibrary);

    if (isNest) {
      const dbFile = "src/database/database.module.ts";
      const dbPreview = isMongoose 
        ? `import { Module } from '@nestjs/common';\nimport { MongooseModule } from '@nestjs/mongoose';\n\n@Module({\n  imports: [MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/synthetix')],\n})\nexport class DatabaseModule {}`
        : `import { Module } from '@nestjs/common';\nimport { TypeOrmModule } from '@nestjs/typeorm';\n\n@Module({\n  imports: [\n    TypeOrmModule.forRoot({\n      type: '${config.databaseEngine === "MySQL" ? "mysql" : "postgres"}',\n      url: process.env.DATABASE_URL,\n      autoLoadEntities: true,\n      synchronize: process.env.NODE_ENV === 'development' && process.env.DB_SYNCHRONIZE === 'true',\n    }),\n  ],\n})\nexport class DatabaseModule {}`;

      const authFile = config.security === "JWT Authentication" 
        ? "src/auth/jwt.strategy.ts" 
        : "src/auth/token.guard.ts";
      
      const authPreview = config.security === "JWT Authentication"
        ? `import { Injectable } from '@nestjs/common';\nimport { PassportStrategy } from '@nestjs/passport';\nimport { ExtractJwt, Strategy } from 'passport-jwt';\n\nfunction getJwtSecret() {\n  const secret = process.env.JWT_SECRET;\n  if (!secret) throw new Error('JWT_SECRET is required');\n  return secret;\n}\n\n@Injectable()\nexport class JwtStrategy extends PassportStrategy(Strategy) {\n  constructor() {\n    super({\n      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),\n      secretOrKey: getJwtSecret(),\n    });\n  }\n\n  async validate(payload: { sub: string; email?: string; role?: string }) {\n    return { userId: payload.sub, email: payload.email, role: payload.role };\n  }\n}`
        : `import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';\n\n@Injectable()\nexport class TokenGuard implements CanActivate {\n  canActivate(context: ExecutionContext): boolean {\n    const request = context.switchToHttp().getRequest();\n    const token = request.headers['x-api-token'];\n    const apiKey = process.env.API_KEY;\n    return Boolean(apiKey && token && token === apiKey);\n  }\n}`;

      const permissionGuardPreview = `import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const currentRole = request.user?.role || 'guest';
    return currentRole === 'admin' || currentRole === 'user';
  }
}`;

      const authGuardFile = config.security === "JWT Authentication"
        ? "jwt-auth.guard.ts"
        : "token.guard.ts";
      const authGuardClass = config.security === "JWT Authentication"
        ? "JwtAuthGuard"
        : "TokenGuard";
      const authGuardPreview = config.security === "JWT Authentication"
        ? `import { Injectable } from '@nestjs/common';\nimport { AuthGuard } from '@nestjs/passport';\n\n@Injectable()\nexport class JwtAuthGuard extends AuthGuard('jwt') {}`
        : authPreview;
      const nestPermissionImport = config.security
        ? `import { PermissionsGuard } from '../auth/permissions.guard';\nimport { ${authGuardClass} } from '../auth/${authGuardFile.replace(".ts", "")}';\n`
        : "";
      const nestPermissionDecorator = config.security
        ? `  @UseGuards(${authGuardClass}, PermissionsGuard)\n`
        : "";
      const authModulePreview = config.security === "JWT Authentication"
        ? `import { Module } from '@nestjs/common';\nimport { PassportModule } from '@nestjs/passport';\nimport { JwtStrategy } from './jwt.strategy';\nimport { JwtAuthGuard } from './jwt-auth.guard';\nimport { PermissionsGuard } from './permissions.guard';\n\n@Module({\n  imports: [PassportModule],\n  providers: [JwtStrategy, JwtAuthGuard, PermissionsGuard],\n  exports: [JwtAuthGuard, PermissionsGuard],\n})\nexport class AuthModule {}`
        : `import { Module } from '@nestjs/common';\nimport { TokenGuard } from './token.guard';\nimport { PermissionsGuard } from './permissions.guard';\n\n@Module({\n  providers: [TokenGuard, PermissionsGuard],\n  exports: [TokenGuard, PermissionsGuard],\n})\nexport class AuthModule {}`;
      const runtimeImports = `import { initializeEnvironment } from './config/environment';\n${
        hasRuntimePlugins ? "import { initializePlugins } from './plugins';\n" : ""
      }${
        config.observabilityLibs.length
          ? "import { initializeObservability } from './observability';\n"
          : ""
      }`;
      const runtimeInitialization = `  await initializeEnvironment();\n${
        config.observabilityLibs.length ? "  await initializeObservability();\n" : ""
      }${hasRuntimePlugins ? "  await initializePlugins();\n" : ""}`;

      const mainPreview = isFastify
        ? `import { NestFactory } from '@nestjs/core';\nimport { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';\nimport { AppModule } from './app.module';\nimport { Logger } from '@nestjs/common';\n${runtimeImports}${config.documentation?.includes("Swagger") ? "import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';\n" : ""}\nasync function bootstrap() {\n${runtimeInitialization}  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());\n  app.setGlobalPrefix('api/v1');\n\n  ${
            config.documentation?.includes("Swagger")
              ? "const config = new DocumentBuilder()\n    .setTitle('Synthetix Service')\n    .setDescription('Synthetix generated API documentation')\n    .setVersion('1.0')\n    .addBearerAuth()\n    .build();\n  const document = SwaggerModule.createDocument(app, config);\n  SwaggerModule.setup('docs', app, document);\n"
              : ""
          }  const port = process.env.PORT || 3000;\n  await app.listen(port, '0.0.0.0');\n  Logger.log(\`🚀 Service running on http://localhost:\${port}/api/v1\`);\n}\nbootstrap();`
        : `import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\nimport { Logger } from '@nestjs/common';\n${runtimeImports}${config.documentation?.includes("Swagger") ? "import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';\n" : ""}\nasync function bootstrap() {\n${runtimeInitialization}  const app = await NestFactory.create(AppModule);\n  app.setGlobalPrefix('api/v1');\n\n  ${
            config.documentation?.includes("Swagger")
              ? "const config = new DocumentBuilder()\n    .setTitle('Synthetix Service')\n    .setDescription('Synthetix generated API documentation')\n    .setVersion('1.0')\n    .addBearerAuth()\n    .build();\n  const document = SwaggerModule.createDocument(app, config);\n  SwaggerModule.setup('docs', app, document);\n"
              : ""
          }  const port = process.env.PORT || 3000;\n  await app.listen(port);\n  Logger.log(\`🚀 Service running on http://localhost:\${port}/api/v1\`);\n}\nbootstrap();`;

      const appModulePreview = `import { Module } from '@nestjs/common';\nimport { ConfigModule } from '@nestjs/config';\n${
        hasDatabase ? "import { DatabaseModule } from './database/database.module';\n" : ""
      }${
        config.security ? "import { AuthModule } from './auth/auth.module';\n" : ""
      }${
        config.healthcheckEnabled ? "import { HealthModule } from './health/health.module';\n" : ""
      }${
        config.messagingEnabled ? "import { MessagingModule } from './messaging/messaging.module';\n" : ""
      }${
        config.observabilityLibs.includes("Prometheus")
          ? "import { ObservabilityModule } from './observability/observability.module';\n"
          : ""
      }${
        config.apiPattern === "GraphQL Apollo"
          ? "import { GraphQLModule } from '@nestjs/graphql';\nimport { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';\nimport { AppResolver } from './app.resolver';\n"
          : ""
      }\n@Module({\n  imports: [\n    ConfigModule.forRoot({ isGlobal: true }),\n    ${
        hasDatabase ? "DatabaseModule,\n    " : ""
      }${
        config.security ? "AuthModule,\n    " : ""
      }${
        config.healthcheckEnabled ? "HealthModule,\n    " : ""
      }${
        config.messagingEnabled ? "MessagingModule,\n    " : ""
      }${
        config.observabilityLibs.includes("Prometheus") ? "ObservabilityModule,\n    " : ""
      }${
        config.apiPattern === "GraphQL Apollo"
          ? "GraphQLModule.forRoot<ApolloDriverConfig>({ driver: ApolloDriver, autoSchemaFile: true }),"
          : ""
      }\n  ],\n  providers: [${config.apiPattern === "GraphQL Apollo" ? "AppResolver" : ""}],\n})\nexport class AppModule {}`;

      const loggerPreview = config.logger === "Winston"
        ? `import { createLogger, format, transports } from 'winston';\n\nexport const logger = createLogger({\n  level: 'info',\n  format: format.json(),\n  transports: [new transports.Console()],\n});`
        : `import pino from 'pino';\n\nexport const logger = pino({\n  level: process.env.LOG_LEVEL || 'info',\n});`;

      const healthPreview = `import { Controller, Get } from '@nestjs/common';\n\n@Controller('health')\nexport class HealthController {\n  @Get()\n  check() {\n    return { status: 'ok', service: '${projectSlug}' };\n  }\n\n  @Get('ready')\n  readiness() {\n    return { status: 'ready', checks: { process: 'up' } };\n  }\n}`;
      const healthModulePreview = `import { Module } from '@nestjs/common';\nimport { HealthController } from './health.controller';\n\n@Module({ controllers: [HealthController] })\nexport class HealthModule {}`;
      const messagingModulePreview = `import { Module } from '@nestjs/common';\nimport { MessagingService } from './${messagingFileBase}.service';\n\n@Module({\n  providers: [MessagingService],\n  exports: [MessagingService],\n})\nexport class MessagingModule {}`;

      const ciInstallCommand = config.packageManager === "pnpm"
        ? "pnpm install"
        : config.packageManager === "yarn"
        ? "yarn install"
        : config.packageManager === "bun"
        ? "bun install"
        : "npm install";
      const ciRunLint = config.packageManager === "pnpm"
        ? "pnpm lint"
        : config.packageManager === "yarn"
        ? "yarn lint"
        : config.packageManager === "bun"
        ? "bun run lint"
        : "npm run lint";
      const ciRunTest = config.packageManager === "pnpm"
        ? "pnpm test"
        : config.packageManager === "yarn"
        ? "yarn test"
        : config.packageManager === "bun"
        ? "bun test"
        : "npm test";
      const ciRunBuild = config.packageManager === "pnpm"
        ? "pnpm build"
        : config.packageManager === "yarn"
        ? "yarn build"
        : config.packageManager === "bun"
        ? "bun run build"
        : "npm run build";
      const ciPreview = `name: ci\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '${getNodeMajor(config.nodeVersion)}'\n${getCiSetupStep(config.packageManager) ? `${getCiSetupStep(config.packageManager)}\n` : ""}      - run: ${ciInstallCommand}\n      - run: ${ciRunLint}\n      - run: ${ciRunTest}\n      - run: ${ciRunBuild}`;
      // Directory tree depending on Architecture choice
      let archNodes: FileTreeItem[] = [];

      if (hasApiPattern && config.architecture === "MVC") {
        archNodes = [
          {
            name: "controllers",
            isFolder: true,
            children: [
              {
                name: "user.controller.ts",
                isFolder: false,
                codePreview: `import { Controller, Get${config.security ? ', UseGuards' : ''} } from '@nestjs/common';\nimport { UserService } from '../services/user.service';\n${nestPermissionImport}\n@Controller('users')\nexport class UserController {\n  constructor(private readonly userService: UserService) {}\n\n${nestPermissionDecorator}  @Get('profile')\n  getProfile() {\n    return this.userService.getProfile();\n  }\n}`
              }
            ]
          },
          {
            name: "services",
            isFolder: true,
            children: [
              {
                name: "user.service.ts",
                isFolder: false,
                codePreview: `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class UserService {\n  getProfile() {\n    return { id: 1, name: 'Synthetix Developer', role: 'admin' };\n  }\n}`
              }
            ]
          },
        ...(hasDatabase ? [{
          name: "models",
          isFolder: true,
          children: [
            {
              name: isMongoose ? "user.schema.ts" : "user.entity.ts",
                isFolder: false,
                codePreview: isMongoose 
                  ? `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';\nimport { Document } from 'mongoose';\n\n@Schema()\nexport class User extends Document {\n  @Prop({ required: true }) name: string;\n  @Prop({ unique: true }) email: string;\n}\nexport const UserSchema = SchemaFactory.createForClass(User);`
                  : `import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';\n\n@Entity()\nexport class User {\n  @PrimaryGeneratedColumn() id: number;\n  @Column() name: string;\n  @Column({ unique: true }) email: string;\n}`
            }
          ]
        }] : [])
        ];
      } else if (config.architecture === "Hexagonal") {
        archNodes = [
          {
            name: "domain",
            isFolder: true,
            children: [
              {
                name: "user.model.ts",
                isFolder: false,
                codePreview: `export class User {\n  constructor(\n    public readonly id: string,\n    public readonly name: string,\n    public readonly email: string\n  ) {}\n}`
              },
              {
                name: "user.repository.ts",
                isFolder: false,
                codePreview: `import { User } from './user.model';\n\nexport interface UserRepository {\n  findById(id: string): Promise<User | null>;\n  save(user: User): Promise<void>;\n}`
              }
            ]
          },
          {
            name: "application",
            isFolder: true,
            children: [
              {
                name: "get-user-profile.usecase.ts",
                isFolder: false,
                codePreview: `import { UserRepository } from '../domain/user.repository';\n\nexport class GetUserProfileUseCase {\n  constructor(private readonly userRepo: UserRepository) {}\n\n  async execute(id: string) {\n    return this.userRepo.findById(id);\n  }\n}`
              }
            ]
          },
          {
            name: "infrastructure",
            isFolder: true,
            children: [
              {
                name: "user-db.repository.ts",
                isFolder: false,
                codePreview: `import { Injectable } from '@nestjs/common';\nimport { UserRepository } from '../domain/user.repository';\nimport { User } from '../domain/user.model';\n\n@Injectable()\nexport class UserDbRepository implements UserRepository {\n  async findById(id: string): Promise<User | null> {\n    return new User(id, 'Hexagonal Developer', 'hex@dev.com');\n  }\n  async save(user: User): Promise<void> {}\n}`
              }
            ]
          }
        ];
      } else if (config.architecture === "Clean Architecture") {
        archNodes = [
          {
            name: "core",
            isFolder: true,
            children: [
              {
                name: "entities",
                isFolder: true,
                children: [
                  {
                    name: "user.ts",
                    isFolder: false,
                    codePreview: `export interface User {\n  id: string;\n  name: string;\n  email: string;\n}`
                  }
                ]
              },
              {
                name: "use-cases",
                isFolder: true,
                children: [
                  {
                    name: "user-management.ts",
                    isFolder: false,
                    codePreview: `import { User } from '../entities/user';\n\nexport class UserManagement {\n  async getUser(id: string): Promise<User> {\n    return { id, name: 'Clean Arch Developer', email: 'clean@arch.com' };\n  }\n}`
                  }
                ]
              }
            ]
          },
          {
            name: "presenters",
            isFolder: true,
            children: [
              {
                name: "user.controller.ts",
                isFolder: false,
                codePreview: `import { Controller, Get, Param } from '@nestjs/common';\nimport { UserManagement } from '../core/use-cases/user-management';\n\n@Controller('users')\nexport class UserController {\n  private userManagement = new UserManagement();\n\n  @Get(':id')\n  async get(@Param('id') id: string) {\n    return this.userManagement.getUser(id);\n  }\n}`
              }
            ]
          }
        ];
      }

      const dockerPreview = buildDockerfile(config, "dist/main.js");
      const choiceEnv = `      - PROJECT_NAME=${projectSlug}\n      - PACKAGE_MANAGER=${config.packageManager || "none"}\n      - NODE_VERSION=${config.nodeVersion?.split(" ")[0] || "none"}\n      - FRAMEWORK=${config.framework?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - API_PATTERN=${config.apiPattern?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - DATABASE_DRIVER=${config.database?.toLowerCase() || "none"}\n      - AUTH_MODE=${config.security?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - SECURITY_STRATEGIES=${config.securityStrategies.map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, "_")).join(",") || "none"}\n      - MIDDLEWARES=${config.middlewares.map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, "_")).join(",") || "none"}\n      - DOCS_MODE=${config.documentation?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - ARCHITECTURE=${config.architecture?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - LINTER=${config.linter?.toLowerCase() || "none"}\n      - TEST_LIBRARY=${config.testLibrary?.toLowerCase() || "none"}\n      - LOGGER=${config.logger?.toLowerCase() || "none"}\n      - OBSERVABILITY_LIBS=${config.observabilityLibs.map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, "_")).join(",") || "none"}\n      - HEALTHCHECK_ENABLED=${config.healthcheckEnabled ? "true" : "false"}\n      - CICD_ENABLED=${config.ciCdEnabled ? "true" : "false"}\n      - DOCKERFILE_ENABLED=${config.dockerfileEnabled ? "true" : "false"}\n      - DOCKER_COMPOSE_ENABLED=${config.dockerComposeEnabled ? "true" : "false"}\n      - MESSAGING_ENABLED=${config.messagingEnabled ? "true" : "false"}\n      - MESSAGING_TYPE=${config.messagingType?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - ADDITIONAL_PACKAGES=${config.additionalPackages.join(",") || "none"}\n`;
      const databaseCompose = getDatabaseCompose(config, projectSlug);
      const dbEnv = databaseCompose.env;
      const dbDependsOn = databaseCompose.dependsOn;
      const dbService = databaseCompose.service;
      const mqEnv = config.messagingEnabled && config.messagingType === "RabbitMQ"
        ? "      - MESSAGING_URL=amqp://rabbitmq:5672\n"
        : config.messagingEnabled && config.messagingType === "BullMQ"
        ? "      - MESSAGING_URL=redis://redis:6379\n"
        : config.messagingEnabled && config.messagingType === "AWS SQS"
        ? "      - AWS_ENDPOINT=http://localstack:4566\n      - AWS_REGION=us-east-1\n"
        : "";
      const mqDependsOn = config.messagingEnabled && config.messagingType === "RabbitMQ"
        ? "      - rabbitmq\n"
        : config.messagingEnabled && config.messagingType === "BullMQ"
        ? "      - redis\n"
        : config.messagingEnabled && config.messagingType === "AWS SQS"
        ? "      - localstack\n"
        : "";
      const mqService = config.messagingEnabled && config.messagingType === "RabbitMQ"
        ? `\n  rabbitmq:\n    image: rabbitmq:3-management-alpine\n    container_name: ${projectSlug}-rabbitmq\n    ports:\n      - \"5672:5672\"\n      - \"15672:15672\"\n`
        : config.messagingEnabled && config.messagingType === "BullMQ"
        ? `\n  redis:\n    image: redis:7-alpine\n    container_name: ${projectSlug}-redis\n    ports:\n      - \"6379:6379\"\n`
        : config.messagingEnabled && config.messagingType === "AWS SQS"
        ? `\n  localstack:\n    image: localstack/localstack:3\n    container_name: ${projectSlug}-localstack\n    environment:\n      - SERVICES=sqs\n      - AWS_DEFAULT_REGION=us-east-1\n    ports:\n      - \"4566:4566\"\n`
        : "";
      const pluginDependsOn = getExtendedComposeDependsOn(config);
      const dependsOnBlock = (dbDependsOn || mqDependsOn || pluginDependsOn)
        ? `    depends_on:\n${dbDependsOn}${mqDependsOn}${pluginDependsOn}`
        : "";
      const composePreview = `services:\n  app:\n    build: .\n    container_name: ${projectSlug}-app\n    ports:\n      - "3000:3000"\n${getPluginPortMappings(config)}    environment:\n${choiceEnv}${dbEnv}${mqEnv}${getExtendedComposeEnv(config)}${dependsOnBlock}${dbService}${mqService}${getExtendedComposeServices(config)}`.replace(/\n{3,}/g, "\n\n");

      return mergeGeneratedFiles([
        {
          name: "src",
          isFolder: true,
          children: [
            ...(config.security ? [{
              name: "auth",
              isFolder: true,
              children: [
                {
                  name: authFile.split("/").pop() || "",
                  isFolder: false,
                  codePreview: authPreview
                },
                ...(config.security === "JWT Authentication" ? [{
                  name: authGuardFile,
                  isFolder: false,
                  codePreview: authGuardPreview,
                }] : []),
                {
                  name: "permissions.guard.ts",
                  isFolder: false,
                  codePreview: permissionGuardPreview
                },
                {
                  name: "auth.module.ts",
                  isFolder: false,
                  codePreview: authModulePreview
                }
              ]
            }] : []),
            ...(hasDatabase ? [{
              name: "database",
              isFolder: true,
              children: [
                {
                  name: dbFile.split("/").pop() || "",
                  isFolder: false,
                  codePreview: dbPreview
                }
              ]
            }] : []),
            ...archNodes,
            ...(config.logger ? [{
              name: "observability",
              isFolder: true,
              children: [{
                name: "logger.ts",
                isFolder: false,
                codePreview: loggerPreview,
              }],
            }] : []),
            ...(config.healthcheckEnabled ? [{
              name: "health",
              isFolder: true,
              children: [{
                name: "health.controller.ts",
                isFolder: false,
                codePreview: healthPreview,
              }, {
                name: "health.module.ts",
                isFolder: false,
                codePreview: healthModulePreview,
              }],
            }] : []),
            ...(config.messagingEnabled && config.messagingType
              ? [
                  {
                    name: "messaging",
                    isFolder: true,
                    children: [
                      {
                        name: `${messagingFileBase}.service.ts`,
                        isFolder: false,
                        codePreview: buildMessagingService(config.messagingType, true),
                      },
                      {
                        name: "messaging.module.ts",
                        isFolder: false,
                        codePreview: messagingModulePreview,
                      }
                    ]
                  }
                ]
              : []),
            {
              name: "app.module.ts",
              isFolder: false,
              codePreview: appModulePreview
            },
            ...(config.apiPattern === "GraphQL Apollo" ? [{
              name: "app.resolver.ts",
              isFolder: false,
              codePreview: `import { Query, Resolver } from '@nestjs/graphql';\n\n@Resolver()\nexport class AppResolver {\n  @Query(() => String)\n  status() {\n    return 'ok';\n  }\n}`,
            }] : []),
            {
              name: "main.ts",
              isFolder: false,
              codePreview: mainPreview
            },
            ...(config.testLibrary ? [{
              name: config.testLibrary === "Vitest" ? "smoke.test.ts" : "smoke.spec.ts",
              isFolder: false,
              codePreview: `describe('generated project', () => {\n  it('loads its smoke test', () => {\n    expect(true).toBe(true);\n  });\n});`,
            }] : [])
          ]
        },
        {
          name: "package.json",
          isFolder: false,
          codePreview: buildPackageJson(config, projectSlug, true)
        },
        {
          name: ".env.example",
          isFolder: false,
          codePreview: `PORT=3000\nNODE_ENV=development\n${hasDatabase ? (isMongoose ? "MONGO_URI=mongodb://localhost:27017/synthetix\n" : "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthetix\n") : ""}${config.security === "JWT Authentication" ? "JWT_SECRET=replace-with-a-random-secret-at-least-32-characters\n" : config.security === "API Token" ? "API_KEY=replace-with-a-random-api-key\n" : ""}${getMessagingEnv(config.messagingType)}`
        },
        {
          name: "tsconfig.json",
          isFolder: false,
          codePreview: `{\n  "compilerOptions": {\n    "module": "commonjs",\n    "declaration": true,\n    "emitDecoratorMetadata": true,\n    "experimentalDecorators": true,\n    "esModuleInterop": true,\n    "allowSyntheticDefaultImports": true,\n    "target": "ES2022",\n    "sourceMap": true,\n    "outDir": "./dist",\n    "strict": true,\n    "strictPropertyInitialization": false,\n    "skipLibCheck": true\n  },\n  "include": ["src/**/*.ts"]\n}`,
        },
        {
          name: "nest-cli.json",
          isFolder: false,
          codePreview: `{\n  "$schema": "https://json.schemastore.org/nest-cli",\n  "sourceRoot": "src"\n}`,
        },
        ...lintConfigFiles,
        ...testConfigFiles,
        ...(config.documentation === "Swagger-first" ? [{
          name: "openapi.yaml",
          isFolder: false,
          codePreview: `openapi: 3.0.3\ninfo:\n  title: ${projectSlug}\n  version: 1.0.0\npaths:\n  /api/v1/health:\n    get:\n      responses:\n        "200":\n          description: Service is healthy\n`,
        }] : []),
        ...(config.dockerfileEnabled ? [{
          name: "Dockerfile",
          isFolder: false,
          codePreview: dockerPreview
        }] : []),
        ...(config.dockerComposeEnabled ? [{
          name: "docker-compose.yml",
          isFolder: false,
          codePreview: composePreview
        }] : []),
        ...(config.ciCdEnabled ? [{
          name: ".github/workflows/ci.yml",
          isFolder: false,
          codePreview: ciPreview,
        }] : [])
      ], supplementalFiles);
    } else {
      if (!isStandardTsFramework) {
        const ciInstallCommand = config.packageManager === "pnpm"
          ? "pnpm install"
          : config.packageManager === "yarn"
          ? "yarn install"
          : config.packageManager === "bun"
          ? "bun install"
          : "npm install";
        const ciRunLint = config.packageManager === "pnpm"
          ? "pnpm lint"
          : config.packageManager === "yarn"
          ? "yarn lint"
          : config.packageManager === "bun"
          ? "bun run lint"
          : "npm run lint";
        const ciRunTest = config.packageManager === "pnpm"
          ? "pnpm test"
          : config.packageManager === "yarn"
          ? "yarn test"
          : config.packageManager === "bun"
          ? "bun test"
          : "npm test";
        const ciRunBuild = config.packageManager === "pnpm"
          ? "pnpm build"
          : config.packageManager === "yarn"
          ? "yarn build"
          : config.packageManager === "bun"
          ? "bun run build"
          : "npm run build";
        const ciPreview = `name: ci\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '${getNodeMajor(config.nodeVersion)}'\n${getCiSetupStep(config.packageManager) ? `${getCiSetupStep(config.packageManager)}\n` : ""}      - run: ${ciInstallCommand}\n      - run: ${ciRunLint}\n      - run: ${ciRunTest}\n      - run: ${ciRunBuild}`;
        const basicBaseDependencies = new Set(["pino", "winston", "reflect-metadata"]);
        const extraBasicDependencies = getExtraDependencySnippet(
          Array.from(new Set([...config.additionalPackages, ...optionDrivenPackages])),
          basicBaseDependencies
        );

        return mergeGeneratedFiles([
          {
            name: "package.json",
            isFolder: false,
            codePreview: `{
  "name": "${projectSlug}",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "lint": "${lintScript}",
    "lint:fix": "${lintFixScript}",
    "test": "${testScript}",
    "test:watch": "${testWatchScript}"
  },
  "dependencies": {
    ${config.logger === "Pino" ? '"pino": "^9.0.0",\n    ' : ""}${config.logger === "Winston" ? '"winston": "^3.0.0",\n    ' : ""}${extraBasicDependencies}"reflect-metadata": "^0.1.13"
  },
  "devDependencies": {
    ${config.linter === "ESLint" ? '"eslint": "^9.0.0",\n    "@typescript-eslint/parser": "^8.0.0",\n    "@typescript-eslint/eslint-plugin": "^8.0.0",\n    ' : ""}${config.linter === "Biome" ? '"@biomejs/biome": "^1.9.0",\n    ' : ""}${config.testLibrary === "Jest" ? '"jest": "^29.0.0",\n    "@types/jest": "^29.0.0",\n    ' : ""}${config.testLibrary === "Vitest" ? '"vitest": "^2.0.0",\n    ' : ""}${config.testLibrary === "Mocha" ? '"mocha": "^10.0.0",\n    "@types/mocha": "^10.0.0",\n    "ts-node": "^10.9.2",\n    ' : ""}"typescript": "^5.0.0"
  }
}`
          },
          {
            name: ".env.example",
            isFolder: false,
            codePreview: `${config.security === "JWT Authentication" ? "JWT_SECRET=replace-with-a-random-secret-at-least-32-characters\n" : config.security === "API Token" ? "API_KEY=replace-with-a-random-api-key\n" : ""}${getMessagingEnv(config.messagingType)}`
          },
          ...lintConfigFiles,
          ...testConfigFiles,
          ...(config.dockerfileEnabled ? [{
            name: "Dockerfile",
            isFolder: false,
            codePreview: buildDockerfile(config, "index.js", false)
          }] : []),
          ...(config.dockerComposeEnabled ? [{
            name: "docker-compose.yml",
            isFolder: false,
            codePreview: `services:\n  app:\n    build: .\n    container_name: ${projectSlug}-app\n    ports:\n      - "3000:3000"`
          }] : []),
          ...(config.ciCdEnabled ? [{
            name: ".github/workflows/ci.yml",
            isFolder: false,
            codePreview: ciPreview,
          }] : [])
        ], supplementalFiles);
      }

      // Standard TypeScript-like project tree (Simple TS / Express / Hapi / Meteor)
      const dbFile = "src/config/database.ts";
      const dbPreview = isMongoose 
        ? `import mongoose from 'mongoose';\n\nexport async function connectDatabase() {\n  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/synthetix');\n  console.log('🔌 Connected to MongoDB');\n}`
        : `import { AppDataSource } from './data-source';\n\nexport async function connectDatabase() {\n  await AppDataSource.initialize();\n  console.log('🔌 Connected to ${config.databaseEngine || "SQL"} via TypeORM');\n}`;

      const authFile = "src/middleware/auth.middleware.ts";
      const authPreview = config.security === "JWT Authentication"
        ? isHapiFramework
          ? `import jwt from 'jsonwebtoken';\n\nexport function authMiddleware(request: any, h: any) {\n  const authHeader = request.headers.authorization;\n  const secret = process.env.JWT_SECRET;\n  if (!authHeader || !authHeader.startsWith('Bearer ') || !secret) {\n    throw new Error('Unauthorized: Missing credentials');\n  }\n  const token = authHeader.split(' ')[1];\n  const decoded = jwt.verify(token, secret);\n  request.auth = { credentials: decoded };\n  return h.continue;\n}`
          : isMeteorFramework
          ? `import jwt from 'jsonwebtoken';\n\nexport function authMiddleware(context: any) {\n  const authHeader = context?.headers?.authorization;\n  const secret = process.env.JWT_SECRET;\n  if (!authHeader || !authHeader.startsWith('Bearer ') || !secret) {\n    throw new Error('Unauthorized: Missing credentials');\n  }\n  const token = authHeader.split(' ')[1];\n  return jwt.verify(token, secret);\n}`
          : useFastifyRuntime
          ? `import jwt from 'jsonwebtoken';\n\nexport async function authMiddleware(request: any) {\n  const authHeader = request.headers.authorization;\n  const secret = process.env.JWT_SECRET;\n  if (!authHeader || !authHeader.startsWith('Bearer ') || !secret) {\n    throw new Error('Unauthorized: Missing credentials');\n  }\n  request.user = jwt.verify(authHeader.split(' ')[1], secret);\n}`
          : `import { Request, Response, NextFunction } from 'express';\nimport jwt from 'jsonwebtoken';\n\nexport function authMiddleware(req: Request, res: Response, next: NextFunction) {\n  const authHeader = req.headers.authorization;\n  const secret = process.env.JWT_SECRET;\n  if (!authHeader || !authHeader.startsWith('Bearer ') || !secret) {\n    return res.status(401).json({ message: 'Unauthorized: Missing credentials' });\n  }\n  const token = authHeader.split(' ')[1];\n  try {\n    const decoded = jwt.verify(token, secret);\n    (req as any).user = decoded;\n    next();\n  } catch (err) {\n    return res.status(401).json({ message: 'Unauthorized: Invalid token' });\n  }\n}`
        : isHapiFramework
        ? `export function authMiddleware(request: any, h: any) {\n  const apiKey = request.headers['x-api-token'];\n  const expectedApiKey = process.env.API_KEY;\n  if (!apiKey || !expectedApiKey || apiKey !== expectedApiKey) {\n    throw new Error('Unauthorized: Invalid API Key');\n  }\n  request.auth = { credentials: { role: 'user' } };\n  return h.continue;\n}`
        : isMeteorFramework
        ? `export function authMiddleware(context: any) {\n  const apiKey = context?.headers?.['x-api-token'];\n  const expectedApiKey = process.env.API_KEY;\n  if (!apiKey || !expectedApiKey || apiKey !== expectedApiKey) {\n    throw new Error('Unauthorized: Invalid API Key');\n  }\n}`
        : useFastifyRuntime
        ? `export async function authMiddleware(request: any) {\n  const apiKey = request.headers['x-api-token'];\n  const expectedApiKey = process.env.API_KEY;\n  if (!apiKey || !expectedApiKey || apiKey !== expectedApiKey) {\n    throw new Error('Unauthorized: Invalid API Key');\n  }\n  request.user = { role: 'user' };\n}`
        : `import { Request, Response, NextFunction } from 'express';\n\nexport function authMiddleware(req: Request, res: Response, next: NextFunction) {\n  const apiKey = req.headers['x-api-token'];\n  const expectedApiKey = process.env.API_KEY;\n  if (!apiKey || !expectedApiKey || apiKey !== expectedApiKey) {\n    return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });\n  }\n  (req as any).user = { role: 'user' };\n  next();\n}`;

      const permissionsFile = "src/middleware/permissions.middleware.ts";
      const permissionsPreview = isHapiFramework
        ? `export function permissionsMiddleware(request: any, h: any) {
	  const role = request.auth?.credentials?.role;
  if (!role || (role !== 'admin' && role !== 'user')) {
    throw new Error('Forbidden: Missing required role');
  }
  return h.continue;
}`
        : isMeteorFramework
        ? `export function permissionsMiddleware(context: any) {
	  const role = context?.user?.role;
  if (!role || (role !== 'admin' && role !== 'user')) {
    throw new Error('Forbidden: Missing required role');
  }
}`
        : useFastifyRuntime
        ? `export async function permissionsMiddleware(request: any) {
	  const role = request.user?.role;
  if (!role || (role !== 'admin' && role !== 'user')) {
    throw new Error('Forbidden: Missing required role');
  }
}`
        : `import { Request, Response, NextFunction } from 'express';

export function permissionsMiddleware(req: Request, res: Response, next: NextFunction) {
	  const role = (req as any).user?.role;
  if (!role || (role !== 'admin' && role !== 'user')) {
    return res.status(403).json({ message: 'Forbidden: Missing required role' });
  }
  next();
}`;

      const indexBootstrapCode = isMeteorFramework
        ? "console.log('✅ Meteor runtime initialized.');"
        : isHapiFramework
        ? "await app.start();\n    console.log(`🚀 Hapi Service running on ${app.info.uri}/api/v1`);"
        : hasApiPattern
        ? "app.listen(port, () => {\n      console.log(`🚀 TS Service running on http://localhost:${port}/api/v1`);\n    });"
        : "console.log('✅ TS worker initialized without HTTP API');";

      const indexPreview = `import app from './app';\nimport { initializeEnvironment } from './config/environment';\n${hasDatabase ? "import { connectDatabase } from './config/database';\n" : ""}${config.messagingEnabled && messagingFileBase ? `import { MessagingService } from './messaging/${messagingFileBase}.service';\n` : ""}${hasRuntimePlugins ? "import { initializePlugins } from './plugins';\n" : ""}${config.observabilityLibs.length ? "import { initializeObservability } from './observability';\n" : ""}const port = process.env.PORT || 3000;\n\nasync function bootstrap() {\n  try {\n    await initializeEnvironment();\n    ${config.observabilityLibs.length ? "await initializeObservability();\n    " : ""}${hasDatabase ? "await connectDatabase();\n    " : ""}${config.messagingEnabled ? "await new MessagingService().connect();\n    " : ""}${hasRuntimePlugins ? "await initializePlugins();\n    " : ""}${indexBootstrapCode}\n  } catch (err) {\n    console.error('❌ Bootstrap failed:', err);\n    process.exit(1);\n  }\n}\n\nbootstrap();`;

      const appPreview = !hasApiPattern
        ? `export default {};`
        : isHapiFramework
        ? `import Hapi from '@hapi/hapi';\nimport { userRoutes } from './routes/user.routes';\n${config.healthcheckEnabled ? "import { healthRoutes } from './routes/health.routes';\n" : ""}${config.observabilityLibs.includes("Prometheus") ? "import { metricsContentType, metricsText } from './observability';\n" : ""}\nconst app = Hapi.server({\n  port: Number(process.env.PORT || 3000),\n  host: '0.0.0.0',\n});\n\napp.route(${config.healthcheckEnabled ? "[...userRoutes, ...healthRoutes]" : "userRoutes"});\n${config.observabilityLibs.includes("Prometheus") ? "app.route({ method: 'GET', path: '/metrics', handler: async (_request, h) => h.response(await metricsText()).type(metricsContentType) });" : ""}\n\nexport default app;`
        : isMeteorFramework
        ? `import { Meteor } from 'meteor/meteor';\nimport { registerUserRoutes } from './routes/user.routes';\n${config.healthcheckEnabled ? "import { registerHealthRoute } from './routes/health.routes';\n" : ""}\nif (Meteor.isServer) {\n  Meteor.startup(() => {\n    registerUserRoutes();\n    ${config.healthcheckEnabled ? "registerHealthRoute();" : ""}\n  });\n}\n\nexport default Meteor;`
        : useFastifyRuntime
        ? `import fastify from 'fastify';\nimport { userRoutes } from './routes/user.routes';\n${config.healthcheckEnabled ? "import { healthRoutes } from './routes/health.routes';\n" : ""}${config.observabilityLibs.includes("Prometheus") ? "import { metricsContentType, metricsText } from './observability';\n" : ""}\nconst app = fastify({ logger: true });\n\napp.register(userRoutes, { prefix: '/api/v1' });\n${config.healthcheckEnabled ? "app.register(healthRoutes, { prefix: '/api/v1' });" : ""}\n${config.observabilityLibs.includes("Prometheus") ? "app.get('/metrics', async (_request, reply) => reply.type(metricsContentType).send(await metricsText()));" : ""}\n\nexport default app;`
        : `import express from 'express';\nimport { userRouter } from './routes/user.routes';\n${config.healthcheckEnabled ? "import { healthRouter } from './routes/health.routes';\n" : ""}${config.observabilityLibs.includes("Prometheus") ? "import { metricsContentType, metricsText } from './observability';\n" : ""}\nconst app = express();\napp.use(express.json());\n\napp.use('/api/v1/users', userRouter);\n${config.healthcheckEnabled ? "app.use('/api/v1', healthRouter);" : ""}\n${config.observabilityLibs.includes("Prometheus") ? "app.get('/metrics', async (_req, res) => { res.type(metricsContentType).send(await metricsText()); });" : ""}\n\nexport default app;`;

      const loggerPreview = config.logger === "Winston"
        ? `import { createLogger, format, transports } from 'winston';\n\nexport const logger = createLogger({\n  level: 'info',\n  format: format.simple(),\n  transports: [new transports.Console()],\n});`
        : `import pino from 'pino';\n\nexport const logger = pino({\n  level: process.env.LOG_LEVEL || 'info',\n});`;

      const healthRoutePreview = isHapiFramework
        ? `export const healthRoutes = [{\n  method: 'GET',\n  path: '/api/v1/health',\n  handler: () => ({ status: 'ok', service: '${projectSlug}' }),\n}, {\n  method: 'GET',\n  path: '/api/v1/health/ready',\n  handler: () => ({ status: 'ready', checks: { process: 'up' } }),\n}];`
        : isMeteorFramework
        ? `export function registerHealthRoute() {\n  console.log('Health route ready for ${projectSlug}');\n}`
        : useFastifyRuntime
        ? `import { FastifyInstance } from 'fastify';\n\nexport async function healthRoutes(app: FastifyInstance) {\n  app.get('/health', async () => ({ status: 'ok', service: '${projectSlug}' }));\n  app.get('/health/ready', async () => ({ status: 'ready', checks: { process: 'up' } }));\n}`
        : `import { Router } from 'express';\n\nexport const healthRouter = Router();\nhealthRouter.get('/health', (_req, res) => {\n  res.json({ status: 'ok', service: '${projectSlug}' });\n});\nhealthRouter.get('/health/ready', (_req, res) => {\n  res.json({ status: 'ready', checks: { process: 'up' } });\n});`;

      const ciInstallCommand = config.packageManager === "pnpm"
        ? "pnpm install"
        : config.packageManager === "yarn"
        ? "yarn install"
        : config.packageManager === "bun"
        ? "bun install"
        : "npm install";
      const ciRunLint = config.packageManager === "pnpm"
        ? "pnpm lint"
        : config.packageManager === "yarn"
        ? "yarn lint"
        : config.packageManager === "bun"
        ? "bun run lint"
        : "npm run lint";
      const ciRunTest = config.packageManager === "pnpm"
        ? "pnpm test"
        : config.packageManager === "yarn"
        ? "yarn test"
        : config.packageManager === "bun"
        ? "bun test"
        : "npm test";
      const ciRunBuild = config.packageManager === "pnpm"
        ? "pnpm build"
        : config.packageManager === "yarn"
        ? "yarn build"
        : config.packageManager === "bun"
        ? "bun run build"
        : "npm run build";
      const ciPreview = `name: ci\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '${getNodeMajor(config.nodeVersion)}'\n${getCiSetupStep(config.packageManager) ? `${getCiSetupStep(config.packageManager)}\n` : ""}      - run: ${ciInstallCommand}\n      - run: ${ciRunLint}\n      - run: ${ciRunTest}\n      - run: ${ciRunBuild}`;
      let archNodes: FileTreeItem[] = [];

      if (hasApiPattern && config.architecture === "MVC") {
        archNodes = [
          {
            name: "controllers",
            isFolder: true,
            children: [
              {
                name: "user.controller.ts",
                isFolder: false,
                codePreview: `import { Request, Response } from '${isFastify ? 'fastify' : 'express'}';\nimport { UserService } from '../services/user.service';\n\nexport class UserController {\n  private userService = new UserService();\n\n  async getProfile(req: Request, res: Response) {\n    const profile = await this.userService.getProfile();\n    ${isFastify ? 'res.send(profile);' : 'return res.json(profile);'}\n  }\n}`
              }
            ]
          },
          {
            name: "services",
            isFolder: true,
            children: [
              {
                name: "user.service.ts",
                isFolder: false,
                codePreview: `export class UserService {\n  async getProfile() {\n    return { id: 1, name: 'Synthetix TS Developer', role: 'admin' };\n  }\n}`
              }
            ]
          },
        ...(hasDatabase ? [{
          name: "models",
          isFolder: true,
          children: [
            {
              name: "user.model.ts",
              isFolder: false,
              codePreview: isMongoose 
                  ? `import { Schema, model } from 'mongoose';\n\nexport interface IUser {\n  name: string;\n  email: string;\n}\n\nconst userSchema = new Schema<IUser>({\n  name: { type: String, required: true },\n  email: { type: String, required: true, unique: true }\n});\n\nexport const User = model<IUser>('User', userSchema);`
                  : `import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';\n\n@Entity()\nexport class User {\n  @PrimaryGeneratedColumn() id: number;\n  @Column() name: string;\n  @Column({ unique: true }) email: string;\n}`
            }
          ]
        }] : [])
        ];
      } else if (config.architecture === "Hexagonal") {
        archNodes = [
          {
            name: "domain",
            isFolder: true,
            children: [
              {
                name: "user.model.ts",
                isFolder: false,
                codePreview: `export class User {\n  constructor(\n    public readonly id: string,\n    public readonly name: string,\n    public readonly email: string\n  ) {}\n}`
              },
              {
                name: "user.repository.ts",
                isFolder: false,
                codePreview: `import { User } from './user.model';\n\nexport interface UserRepository {\n  findById(id: string): Promise<User | null>;\n  save(user: User): Promise<void>;\n}`
              }
            ]
          },
          {
            name: "application",
            isFolder: true,
            children: [
              {
                name: "get-user-profile.usecase.ts",
                isFolder: false,
                codePreview: `import { UserRepository } from '../domain/user.repository';\n\nexport class GetUserProfileUseCase {\n  constructor(private readonly userRepo: UserRepository) {}\n\n  async execute(id: string) {\n    return this.userRepo.findById(id);\n  }\n}`
              }
            ]
          },
          {
            name: "infrastructure",
            isFolder: true,
            children: [
              {
                name: "user-db.repository.ts",
                isFolder: false,
                codePreview: `import { UserRepository } from '../domain/user.repository';\nimport { User } from '../domain/user.model';\n\nexport class UserDbRepository implements UserRepository {\n  async findById(id: string): Promise<User | null> {\n    return new User(id, 'TS Hexagonal Developer', 'ts-hex@dev.com');\n  }\n  async save(user: User): Promise<void> {}\n}`
              }
            ]
          }
        ];
      } else if (config.architecture === "Clean Architecture") {
        archNodes = [
          {
            name: "core",
            isFolder: true,
            children: [
              {
                name: "entities",
                isFolder: true,
                children: [
                  {
                    name: "user.ts",
                    isFolder: false,
                    codePreview: `export interface User {\n  id: string;\n  name: string;\n  email: string;\n}`
                  }
                ]
              },
              {
                name: "use-cases",
                isFolder: true,
                children: [
                  {
                    name: "user-management.ts",
                    isFolder: false,
                    codePreview: `import { User } from '../entities/user';\n\nexport class UserManagement {\n  async getUser(id: string): Promise<User> {\n    return { id, name: 'TS Clean Developer', email: 'ts-clean@arch.com' };\n  }\n}`
                  }
                ]
              }
            ]
          },
          {
            name: "presenters",
            isFolder: true,
            children: [
              {
                name: "user.controller.ts",
                isFolder: false,
                codePreview: `import { Request, Response } from '${isFastify ? 'fastify' : 'express'}';\nimport { UserManagement } from '../core/use-cases/user-management';\n\nexport class UserController {\n  private userManagement = new UserManagement();\n\n  async getProfile(req: Request, res: Response) {\n    const id = ${isFastify ? '(req.params as any).id' : 'req.params.id'};\n    const user = await this.userManagement.getUser(id);\n    ${isFastify ? 'res.send(user);' : 'return res.json(user);'}\n  }\n}`
              }
            ]
          }
        ];
      }

      if (!hasApiPattern || isHapiFramework || isMeteorFramework) {
        archNodes = [];
      }

      const routePreview = isHapiFramework
        ? `${config.security ? "import { authMiddleware } from '../middleware/auth.middleware';\nimport { permissionsMiddleware } from '../middleware/permissions.middleware';\n\n" : ""}export const userRoutes = [{
  method: 'GET',
  path: '/api/v1/users/profile',
  ${config.security ? `options: {
    pre: [{ method: authMiddleware }, { method: permissionsMiddleware }],
  },` : ""}
  handler: (request: any) => ({ id: 1, name: 'Hapi User' }),
}];`
        : isMeteorFramework
        ? `${config.security ? "import { authMiddleware } from '../middleware/auth.middleware';\nimport { permissionsMiddleware } from '../middleware/permissions.middleware';\n\n" : ""}export function registerUserRoutes() {
  console.log('Meteor user routes registered under /api/v1/users');
  ${config.security ? "authMiddleware({ headers: { authorization: 'Bearer sample.jwt.token' } });\n  permissionsMiddleware({ user: { role: 'user' } });" : ""}
}`
        : useFastifyRuntime
        ? `import { FastifyInstance } from 'fastify';\n${config.security ? "import { authMiddleware } from '../middleware/auth.middleware';\nimport { permissionsMiddleware } from '../middleware/permissions.middleware';\n" : ""}\nexport async function userRoutes(fastify: FastifyInstance) {\n  fastify.get('/users/profile', ${config.security ? "{ preHandler: [authMiddleware, permissionsMiddleware] }, " : ""}async () => ({ id: 1, name: 'Fastify User', role: 'user' }));\n}`
        : `import { Router } from 'express';\n${config.security ? "import { authMiddleware } from '../middleware/auth.middleware';\nimport { permissionsMiddleware } from '../middleware/permissions.middleware';\n" : ""}\nexport const userRouter = Router();\n\nuserRouter.get('/profile', ${config.security ? "authMiddleware, permissionsMiddleware, " : ""}(req, res) => {\n  res.json({ id: 1, name: 'Express User', role: 'user' });\n});`;

      const dockerPreview = buildDockerfile(config, "dist/index.js");
      const choiceEnv = `      - PROJECT_NAME=${projectSlug}\n      - PACKAGE_MANAGER=${config.packageManager || "none"}\n      - NODE_VERSION=${config.nodeVersion?.split(" ")[0] || "none"}\n      - FRAMEWORK=${config.framework?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - API_PATTERN=${config.apiPattern?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - DATABASE_DRIVER=${config.database?.toLowerCase() || "none"}\n      - AUTH_MODE=${config.security?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - SECURITY_STRATEGIES=${config.securityStrategies.map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, "_")).join(",") || "none"}\n      - MIDDLEWARES=${config.middlewares.map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, "_")).join(",") || "none"}\n      - DOCS_MODE=${config.documentation?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - ARCHITECTURE=${config.architecture?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - LINTER=${config.linter?.toLowerCase() || "none"}\n      - TEST_LIBRARY=${config.testLibrary?.toLowerCase() || "none"}\n      - LOGGER=${config.logger?.toLowerCase() || "none"}\n      - OBSERVABILITY_LIBS=${config.observabilityLibs.map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, "_")).join(",") || "none"}\n      - HEALTHCHECK_ENABLED=${config.healthcheckEnabled ? "true" : "false"}\n      - CICD_ENABLED=${config.ciCdEnabled ? "true" : "false"}\n      - DOCKERFILE_ENABLED=${config.dockerfileEnabled ? "true" : "false"}\n      - DOCKER_COMPOSE_ENABLED=${config.dockerComposeEnabled ? "true" : "false"}\n      - MESSAGING_ENABLED=${config.messagingEnabled ? "true" : "false"}\n      - MESSAGING_TYPE=${config.messagingType?.toLowerCase().replace(/\s+/g, "_") || "none"}\n      - ADDITIONAL_PACKAGES=${config.additionalPackages.join(",") || "none"}\n`;
      const databaseCompose = getDatabaseCompose(config, projectSlug);
      const dbEnv = databaseCompose.env;
      const dbDependsOn = databaseCompose.dependsOn;
      const dbService = databaseCompose.service;
      const mqEnv = config.messagingEnabled && config.messagingType === "RabbitMQ"
        ? "      - MESSAGING_URL=amqp://rabbitmq:5672\n"
        : config.messagingEnabled && config.messagingType === "BullMQ"
        ? "      - MESSAGING_URL=redis://redis:6379\n"
        : config.messagingEnabled && config.messagingType === "AWS SQS"
        ? "      - AWS_ENDPOINT=http://localstack:4566\n      - AWS_REGION=us-east-1\n"
        : "";
      const mqDependsOn = config.messagingEnabled && config.messagingType === "RabbitMQ"
        ? "      - rabbitmq\n"
        : config.messagingEnabled && config.messagingType === "BullMQ"
        ? "      - redis\n"
        : config.messagingEnabled && config.messagingType === "AWS SQS"
        ? "      - localstack\n"
        : "";
      const mqService = config.messagingEnabled && config.messagingType === "RabbitMQ"
        ? `\n  rabbitmq:\n    image: rabbitmq:3-management-alpine\n    container_name: ${projectSlug}-rabbitmq\n    ports:\n      - \"5672:5672\"\n      - \"15672:15672\"\n`
        : config.messagingEnabled && config.messagingType === "BullMQ"
        ? `\n  redis:\n    image: redis:7-alpine\n    container_name: ${projectSlug}-redis\n    ports:\n      - \"6379:6379\"\n`
        : config.messagingEnabled && config.messagingType === "AWS SQS"
        ? `\n  localstack:\n    image: localstack/localstack:3\n    container_name: ${projectSlug}-localstack\n    environment:\n      - SERVICES=sqs\n      - AWS_DEFAULT_REGION=us-east-1\n    ports:\n      - \"4566:4566\"\n`
        : "";
      const pluginDependsOn = getExtendedComposeDependsOn(config);
      const dependsOnBlock = (dbDependsOn || mqDependsOn || pluginDependsOn)
        ? `    depends_on:\n${dbDependsOn}${mqDependsOn}${pluginDependsOn}`
        : "";
      const composePreview = `services:\n  app:\n    build: .\n    container_name: ${projectSlug}-app\n    ports:\n      - "3000:3000"\n${getPluginPortMappings(config)}    environment:\n${choiceEnv}${dbEnv}${mqEnv}${getExtendedComposeEnv(config)}${dependsOnBlock}${dbService}${mqService}${getExtendedComposeServices(config)}`.replace(/\n{3,}/g, "\n\n");

      return mergeGeneratedFiles([
        {
          name: "src",
          isFolder: true,
          children: [
            ...(hasDatabase ? [{
              name: "config",
              isFolder: true,
              children: [
                {
                  name: dbFile.split("/").pop() || "",
                  isFolder: false,
                  codePreview: dbPreview
                }
              ]
            }] : []),
            ...(config.security && hasApiPattern ? [{
              name: "middleware",
              isFolder: true,
              children: [
                {
                  name: authFile.split("/").pop() || "",
                  isFolder: false,
                  codePreview: authPreview
                },
                {
                  name: permissionsFile.split("/").pop() || "",
                  isFolder: false,
                  codePreview: permissionsPreview
                }
              ]
            }] : []),
            ...(config.logger ? [{
              name: "observability",
              isFolder: true,
              children: [{
                name: "logger.ts",
                isFolder: false,
                codePreview: loggerPreview,
              }],
            }] : []),
            ...archNodes,
            ...((hasApiPattern || config.healthcheckEnabled) ? [{
              name: "routes",
              isFolder: true,
              children: [
                ...(hasApiPattern ? [{
                  name: "user.routes.ts",
                  isFolder: false,
                  codePreview: routePreview
                }] : []),
                ...(config.healthcheckEnabled && hasApiPattern
                  ? [{
                      name: "health.routes.ts",
                      isFolder: false,
                      codePreview: healthRoutePreview,
                    }]
                  : [])
              ]
            }] : []),
            ...(config.messagingEnabled && config.messagingType
              ? [
                  {
                    name: "messaging",
                    isFolder: true,
                    children: [
                      {
                        name: `${messagingFileBase}.service.ts`,
                        isFolder: false,
                        codePreview: buildMessagingService(config.messagingType),
                      }
                    ]
                  }
                ]
              : []),
            {
              name: "app.ts",
              isFolder: false,
              codePreview: appPreview
            },
            {
              name: "index.ts",
              isFolder: false,
              codePreview: indexPreview
            },
            ...(config.testLibrary ? [{
              name: config.testLibrary === "Vitest" ? "smoke.test.ts" : "smoke.spec.ts",
              isFolder: false,
              codePreview: `describe('generated project', () => {\n  it('loads its smoke test', () => {\n    expect(true).toBe(true);\n  });\n});`,
            }] : [])
          ]
        },
        {
          name: "package.json",
          isFolder: false,
          codePreview: buildPackageJson(config, projectSlug, false)
        },
        {
          name: ".env.example",
          isFolder: false,
          codePreview: `PORT=3000\nNODE_ENV=development\n${hasDatabase ? (isMongoose ? "MONGO_URI=mongodb://localhost:27017/synthetix\n" : "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthetix\n") : ""}${config.security === "JWT Authentication" ? "JWT_SECRET=replace-with-a-random-secret-at-least-32-characters\n" : config.security === "API Token" ? "API_KEY=replace-with-a-random-api-key\n" : ""}${getMessagingEnv(config.messagingType)}`
        },
        {
          name: "tsconfig.json",
          isFolder: false,
          codePreview: `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "commonjs",\n    "moduleResolution": "node",\n    "outDir": "dist",\n    "rootDir": "src",\n    "strict": true,\n    "esModuleInterop": true,\n    "experimentalDecorators": true,\n    "emitDecoratorMetadata": true,\n    "skipLibCheck": true\n  },\n  "include": ["src/**/*.ts"]\n}`,
        },
        ...lintConfigFiles,
        ...testConfigFiles,
        ...(config.dockerfileEnabled ? [{
          name: "Dockerfile",
          isFolder: false,
          codePreview: dockerPreview
        }] : []),
        ...(config.dockerComposeEnabled ? [{
          name: "docker-compose.yml",
          isFolder: false,
          codePreview: composePreview
        }] : []),
        ...(config.ciCdEnabled ? [{
          name: ".github/workflows/ci.yml",
          isFolder: false,
          codePreview: ciPreview,
        }] : [])
      ], supplementalFiles);
    }
};

export const TerminalPreview: React.FC<TerminalPreviewProps> = ({ config }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>("src/main.ts");
  const tree = useMemo(() => buildProjectFileTree(config), [config]);
  const projectSlug = createProjectSlug(config.projectName);
  const activeFramework = config.framework;

  const getCodePreviewForPath = (path: string, items: FileTreeItem[]): string => {
    const parts = path.split("/");
    let currentItems = items;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const found = currentItems.find(item => item.name === part);
      if (!found) return "";
      if (i === parts.length - 1 && !found.isFolder) {
        return found.codePreview || "";
      }
      if (found.isFolder && found.children) {
        currentItems = found.children;
      } else {
        return "";
      }
    }
    return "";
  };

  const defaultFile =
    activeFramework === "Simple TypeScript" ||
    activeFramework === "Express" ||
    activeFramework === "Hapi" ||
    activeFramework === "Meteor"
      ? "src/index.ts"
      : activeFramework === "NestJS"
      ? "src/main.ts"
      : "package.json";
  const selectedCode = selectedFile ? getCodePreviewForPath(selectedFile, tree) : "";
  const activeFile = selectedCode ? selectedFile : defaultFile;
  const codeContent = selectedCode || getCodePreviewForPath(defaultFile, tree);


  // Recursively render the tree items
  const renderTree = (items: FileTreeItem[], parentPath = "") => {
    return (
      <ul className="tree-list">
        {items.map((item) => {
          const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;
          if (item.isFolder) {
            return (
              <li key={currentPath} className="tree-item folder-node">
                <span className="node-label">
                  <FolderIcon size={14} className="node-icon folder-icon" />
                  {item.name}
                </span>
                {item.children && renderTree(item.children, currentPath)}
              </li>
            );
          } else {
            const isSelected = activeFile === currentPath;
            return (
              <li
                key={currentPath}
                className={`tree-item file-node ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedFile(currentPath)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedFile(currentPath);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
              >
                <span className="node-label">
                  <FileIcon size={14} className="node-icon file-icon" />
                  {item.name}
                </span>
              </li>
            );
          }
        })}
      </ul>
    );
  };

  return (
    <div className="terminal-preview-container">
      {/* Terminal Header */}
      <div className="terminal-header">
        <div className="window-dots">
          <span className="dot dot-red"></span>
          <span className="dot dot-yellow"></span>
          <span className="dot dot-green"></span>
        </div>
        <div className="terminal-title">synthetix-preview@terminal</div>
        <div className="terminal-size">80x24</div>
      </div>

      {/* Terminal CLI Command */}
      <div className="terminal-shell">
        <div className="shell-prompt">
          <span className="prompt-prefix">user@synthetix-shell:~$</span>
          <span className="prompt-command">{buildCommandArgs(config, projectSlug)}</span>
          <span className="terminal-blink">_</span>
        </div>
      </div>

      {/* Interactive Editor Workspace */}
      <div className="editor-workspace">
        {/* Left Side: Live File Tree */}
        <div className="file-tree-sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">PROJECT EXPLORER</span>
            <span className="badge">LIVE</span>
          </div>
          <div className="tree-container">
            {renderTree(tree)}
          </div>
        </div>

        {/* Right Side: Mock Editor Output */}
        <div className="code-editor-panel">
          <div className="editor-tab-header">
            <div className="editor-tab active">
              <FileIcon size={12} className="tab-icon" />
              <span>{activeFile ? activeFile.split("/").pop() : "No file selected"}</span>
            </div>
            <div className="editor-tab-meta">TypeScript</div>
          </div>
          <div className="editor-code-body">
            <pre className="code-pre">
              <code>
                {codeContent.split("\n").map((line, idx) => (
                  <span key={idx} className="code-line">
                    <span className="line-number">{idx + 1}</span>
                    <span className="line-content">{line}</span>
                  </span>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

import type { ProjectConfig } from "@/features/configurator/types";

export type PluginFile = {
  path: string;
  content: string;
};

const PLUGIN_FILES: Record<string, PluginFile[]> = {
  redis: [{
    path: "src/plugins/redis.ts",
    content: `import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

export async function initializeRedis() {
  if (redis.status === 'wait') await redis.connect();
}`,
  }],
  kafka: [{
    path: "src/plugins/kafka.ts",
    content: `import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'synthetix-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

export const kafkaProducer = kafka.producer({ allowAutoTopicCreation: false });
export async function initializeKafka() {
  await kafkaProducer.connect();
}`,
  }],
  grpc: [
    {
      path: "src/plugins/grpc.ts",
      content: `import { Server, ServerCredentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import path from 'node:path';

export async function initializeGrpc() {
  const definition = loadSync(path.join(__dirname, '../../proto/health.proto'));
  const descriptor = loadPackageDefinition(definition) as any;
  const server = new Server();
  server.addService(descriptor.synthetix.Health.service, {
    check: (_call: unknown, callback: (error: Error | null, result: unknown) => void) =>
      callback(null, { status: 'SERVING' }),
  });
  await new Promise<void>((resolve, reject) => {
    server.bindAsync(
      \`0.0.0.0:\${process.env.GRPC_PORT || 50051}\`,
      ServerCredentials.createInsecure(),
      (error) => error ? reject(error) : resolve()
    );
  });
  server.start();
}`,
    },
    {
      path: "proto/health.proto",
      content: `syntax = "proto3";
package synthetix;

service Health {
  rpc Check (HealthRequest) returns (HealthResponse);
}

message HealthRequest {}
message HealthResponse { string status = 1; }
`,
    },
  ],
  websockets: [{
    path: "src/plugins/websockets.ts",
    content: `import { WebSocketServer } from 'ws';

export async function initializeWebSockets() {
  const server = new WebSocketServer({ port: Number(process.env.WS_PORT || 3001) });
  server.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected' }));
  });
}`,
  }],
  payments: [{
    path: "src/plugins/payments.ts",
    content: `import Stripe from 'stripe';

export let stripe: Stripe;
export async function initializePayments() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is required');
  stripe = new Stripe(secretKey);
}`,
  }],
  queue: [{
    path: "src/plugins/queue.ts",
    content: `import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(
  process.env.REDIS_URL || 'redis://localhost:6379',
  { maxRetriesPerRequest: null }
);
export const jobsQueue = new Queue('jobs', { connection });

export function createJobsWorker(
  processor: (job: unknown) => Promise<unknown>
) {
  return new Worker('jobs', processor, { connection });
}

export async function initializeQueue() {
  await jobsQueue.waitUntilReady();
}`,
  }],
};

const INITIALIZERS: Record<string, { name: string; module: string }> = {
  redis: { name: "initializeRedis", module: "./redis" },
  kafka: { name: "initializeKafka", module: "./kafka" },
  grpc: { name: "initializeGrpc", module: "./grpc" },
  websockets: { name: "initializeWebSockets", module: "./websockets" },
  payments: { name: "initializePayments", module: "./payments" },
  queue: { name: "initializeQueue", module: "./queue" },
};

export const generatePluginFiles = (config: ProjectConfig): PluginFile[] => {
  const runtimePlugins = config.templatePlugins.filter(
    (pluginId) => INITIALIZERS[pluginId]
  );
  const files = runtimePlugins.flatMap((pluginId) => PLUGIN_FILES[pluginId] ?? []);

  if (runtimePlugins.length) {
    const imports = runtimePlugins
      .map((pluginId) => {
        const initializer = INITIALIZERS[pluginId];
        return `import { ${initializer.name} } from '${initializer.module}';`;
      })
      .join("\n");
    const calls = runtimePlugins
      .map((pluginId) => `  await ${INITIALIZERS[pluginId].name}();`)
      .join("\n");
    files.push({
      path: "src/plugins/index.ts",
      content: `${imports}

export async function initializePlugins() {
${calls}
}`,
    });
  }

  if (config.templatePlugins.includes("monorepo")) {
    files.push(
      {
        path: "pnpm-workspace.yaml",
        content: `packages:\n  - "."\n  - "packages/*"\n`,
      },
      {
        path: "turbo.json",
        content: `{\n  "$schema": "https://turbo.build/schema.json",\n  "tasks": {\n    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },\n    "test": { "dependsOn": ["build"] },\n    "lint": {}\n  }\n}`,
      },
      {
        path: "packages/shared/package.json",
        content: `{\n  "name": "@synthetix/shared",\n  "version": "0.1.0",\n  "private": true,\n  "main": "dist/index.js",\n  "types": "dist/index.d.ts",\n  "scripts": { "build": "tsc", "test": "node --test", "lint": "tsc --noEmit" }\n}`,
      },
      {
        path: "packages/shared/tsconfig.json",
        content: `{\n  "compilerOptions": { "target": "ES2022", "module": "commonjs", "declaration": true, "outDir": "dist", "strict": true },\n  "include": ["src/**/*.ts"]\n}`,
      },
      {
        path: "packages/shared/src/index.ts",
        content: `export type ServiceHealth = { status: 'ok' | 'ready' | 'degraded' };\n`,
      }
    );
  }

  if (config.templatePlugins.includes("serverless")) {
    files.push(
      {
        path: "src/serverless.ts",
        content: `import serverlessExpress from '@codegenie/serverless-express';
import app from './app';

export const handler = serverlessExpress({ app });
`,
      },
      {
        path: "serverless.yml",
        content: `service: ${config.projectName || "synthetix-service"}
provider:
  name: aws
  runtime: nodejs20.x
  environment:
    NODE_ENV: production
functions:
  api:
    handler: dist/serverless.handler
    events:
      - httpApi: "*"
`,
      }
    );
  }

  return files;
};

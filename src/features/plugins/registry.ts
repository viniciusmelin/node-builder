export type PluginDefinition = {
  id: string;
  title: string;
  description: string;
  category: "Data" | "Transport" | "Integration" | "Architecture" | "Deployment";
  dependencies: Record<string, string>;
  supportedFrameworks?: string[];
  requiredPackageManager?: string;
};

export const PLUGIN_REGISTRY: PluginDefinition[] = [
  {
    id: "redis",
    title: "Redis",
    description: "Shared cache and key-value client with connection lifecycle.",
    category: "Data",
    dependencies: { ioredis: "^5.4.2" },
  },
  {
    id: "kafka",
    title: "Kafka",
    description: "KafkaJS producer with idempotent connection setup.",
    category: "Transport",
    dependencies: { kafkajs: "^2.2.4" },
  },
  {
    id: "grpc",
    title: "gRPC",
    description: "gRPC server bootstrap and protocol definition.",
    category: "Transport",
    dependencies: {
      "@grpc/grpc-js": "^1.12.5",
      "@grpc/proto-loader": "^0.7.13",
    },
  },
  {
    id: "websockets",
    title: "WebSockets",
    description: "WebSocket server attached to the generated HTTP runtime.",
    category: "Transport",
    dependencies: { ws: "^8.18.1" },
  },
  {
    id: "payments",
    title: "Stripe Payments",
    description: "Stripe client with webhook-secret configuration.",
    category: "Integration",
    dependencies: { stripe: "^17.7.0" },
  },
  {
    id: "queue",
    title: "BullMQ Queue",
    description: "Redis-backed queue producer and worker factory.",
    category: "Transport",
    dependencies: { bullmq: "^5.41.4", ioredis: "^5.4.2" },
  },
  {
    id: "monorepo",
    title: "pnpm Monorepo",
    description: "pnpm workspace and Turborepo build orchestration.",
    category: "Architecture",
    dependencies: {},
    requiredPackageManager: "pnpm",
  },
  {
    id: "serverless",
    title: "Serverless AWS",
    description: "AWS Lambda handler and Serverless Framework manifest.",
    category: "Deployment",
    dependencies: { "@codegenie/serverless-express": "^4.16.0" },
    supportedFrameworks: ["Express"],
  },
];

export const getPluginDefinition = (pluginId: string) =>
  PLUGIN_REGISTRY.find((plugin) => plugin.id === pluginId);

import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProjectFileTree } from "@/components/TerminalPreview";
import { getConfigIssues } from "@/features/configurator/logic";
import {
  createZipBlob,
  createZipBytes,
  flattenFileTree,
} from "@/features/generator/artifact";
import { makeBaseConfig } from "@/test/fixtures";

const generate = (overrides = {}) =>
  flattenFileTree(buildProjectFileTree(makeBaseConfig(overrides)));

const getFile = (
  files: ReturnType<typeof generate>,
  filePath: string
) => {
  const file = files.find((candidate) => candidate.path === filePath);
  expect(file, `Expected generated file ${filePath}`).toBeDefined();
  return file?.content ?? "";
};

const expectLocalImportsToResolve = (files: ReturnType<typeof generate>) => {
  const paths = new Set(files.map((file) => file.path));

  for (const file of files.filter((candidate) => candidate.path.endsWith(".ts"))) {
    const imports = file.content.matchAll(/from ['"](\.{1,2}\/[^'"]+)['"]/g);
    for (const [, source] of imports) {
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(file.path), source)
      );
      const candidates = [`${resolved}.ts`, `${resolved}/index.ts`];
      expect(
        candidates.some((candidate) => paths.has(candidate)),
        `${file.path} imports missing local module ${source}`
      ).toBe(true);
    }
  }
};

describe("generated project artifacts", () => {
  it("creates a self-consistent default NestJS tree", () => {
    const files = generate();
    const paths = new Set(files.map((file) => file.path));

    expect(paths).toContain("src/database/database.module.ts");
    expect(paths).toContain("src/auth/auth.module.ts");
    expect(paths).toContain("src/health/health.module.ts");
    expect(paths).toContain("tsconfig.json");
    expect(paths).toContain("nest-cli.json");

    expectLocalImportsToResolve(files);
    expectLocalImportsToResolve(
      generate({
        framework: "Simple TypeScript",
        apiPattern: "REST Fastify",
        architecture: "Clean Architecture",
      })
    );
  });

  it("produces valid package metadata with required runtime dependencies", () => {
    const files = generate();
    const packageJson = JSON.parse(getFile(files, "package.json"));

    expect(packageJson.dependencies).toMatchObject({
      "@nestjs/config": expect.any(String),
      "@nestjs/passport": expect.any(String),
      "@nestjs/typeorm": expect.any(String),
      "passport-jwt": expect.any(String),
      pg: expect.any(String),
    });
    expect(packageJson.devDependencies).toMatchObject({
      "@nestjs/cli": expect.any(String),
      "ts-jest": expect.any(String),
    });
  });

  it("generates secure authorization without trusting role headers", () => {
    const nestFiles = generate();
    expect(getFile(nestFiles, "src/auth/permissions.guard.ts")).not.toContain(
      "x-user-role"
    );

    const expressFiles = generate({
      framework: "Express",
      apiPattern: "REST Express",
    });
    expect(
      getFile(expressFiles, "src/middleware/permissions.middleware.ts")
    ).not.toContain("x-user-role");
    expect(
      getFile(expressFiles, "src/middleware/auth.middleware.ts")
    ).not.toContain("|| 'supersecret'");
  });

  it("wires healthcheck and package-manager-aware Docker commands", () => {
    const files = generate({
      framework: "Simple TypeScript",
      apiPattern: "REST Fastify",
      packageManager: "pnpm",
      dockerfileEnabled: true,
    });

    expect(getFile(files, "src/app.ts")).toContain("app.register(healthRoutes");
    expect(getFile(files, "Dockerfile")).toContain("corepack enable");
    expect(getFile(files, "Dockerfile")).toContain("pnpm install");
    expect(getFile(files, "Dockerfile")).toContain("FROM node:20-alpine");
  });

  it("reports incompatible and incomplete configurations", () => {
    expect(
      getConfigIssues(
        makeBaseConfig({
          messagingEnabled: true,
          messagingType: null,
        })
      ).map((issue) => issue.field)
    ).toContain("messagingType");

    expect(
      getConfigIssues(
        makeBaseConfig({
          framework: "Express",
          apiPattern: "REST Fastify",
        })
      ).map((issue) => issue.field)
    ).toContain("compatibility");
  });

  it("packages generated files in a ZIP artifact", () => {
    const files = [
      { path: "hello.txt", content: "hello" },
      { path: "src/index.ts", content: "export {};" },
    ];
    const blob = createZipBlob(files);
    const bytes = createZipBytes(files);

    expect(blob.type).toBe("application/zip");
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(bytes)).toContain("hello.txt");
  });

  it("connects selected plugins and their dependencies", () => {
    const files = generate({
      framework: "Express",
      apiPattern: "REST Express",
      templatePlugins: ["redis", "kafka", "grpc", "websockets", "payments", "queue"],
    });
    const packageJson = JSON.parse(getFile(files, "package.json"));

    expectLocalImportsToResolve(files);
    expect(getFile(files, "src/index.ts")).toContain("await initializePlugins()");
    expect(getFile(files, "src/plugins/index.ts")).toContain("initializeKafka");
    expect(getFile(files, "proto/health.proto")).toContain("service Health");
    expect(packageJson.dependencies).toMatchObject({
      ioredis: expect.any(String),
      kafkajs: expect.any(String),
      "@grpc/grpc-js": expect.any(String),
      ws: expect.any(String),
      stripe: expect.any(String),
      bullmq: expect.any(String),
    });
  });

  it("generates validated environments and secure secret loading", () => {
    const files = generate({
      environments: ["development", "staging", "production"],
      secretsProvider: "AWS Secrets Manager",
      templatePlugins: ["payments"],
    });
    const packageJson = JSON.parse(getFile(files, "package.json"));

    expect(getFile(files, ".env.production.example")).toContain("NODE_ENV=production");
    expect(getFile(files, "src/config/environment.ts")).toContain("safeParse");
    expect(getFile(files, "src/config/environment.ts")).toContain("SecretsManagerClient");
    expect(getFile(files, ".gitignore")).toContain("!.env.*.example");
    expect(packageJson.dependencies["@aws-sdk/client-secrets-manager"]).toBeDefined();
  });

  it("wires observability, readiness, metrics and dashboards", () => {
    const files = generate({
      observabilityLibs: ["OpenTelemetry", "Sentry", "Prometheus", "Datadog"],
      dockerfileEnabled: true,
      dockerComposeEnabled: true,
    });

    expect(getFile(files, "src/main.ts")).toContain("initializeObservability");
    expect(getFile(files, "src/health/health.controller.ts")).toContain("@Get('ready')");
    expect(getFile(files, "src/observability/metrics.controller.ts")).toContain("metricsText");
    expect(getFile(files, "observability/prometheus.yml")).toContain("scrape_configs");
    expect(getFile(files, "docker-compose.yml")).toContain("grafana/grafana");
  });

  it("generates MySQL migrations, seed and matching container", () => {
    const files = generate({
      database: "TypeORM",
      databaseEngine: "MySQL",
      migrationsEnabled: true,
      seedEnabled: true,
      dockerfileEnabled: true,
      dockerComposeEnabled: true,
    });
    const packageJson = JSON.parse(getFile(files, "package.json"));

    expect(getFile(files, "src/database/data-source.ts")).toContain("type: 'mysql'");
    expect(getFile(files, "src/database/migrations/0001-create-users.ts")).toContain("CreateUsers0001");
    expect(getFile(files, "src/database/seed.ts")).toContain("INSERT IGNORE");
    expect(getFile(files, "docker-compose.yml")).toContain("image: mysql:8.4");
    expect(packageJson.dependencies.mysql2).toBeDefined();
    expect(packageJson.scripts["migration:run"]).toContain("data-source.ts");
  });

  it("validates plugin compatibility requirements", () => {
    const monorepoIssues = getConfigIssues(
      makeBaseConfig({ packageManager: "npm", templatePlugins: ["monorepo"] })
    );
    const serverlessIssues = getConfigIssues(
      makeBaseConfig({ framework: "NestJS", templatePlugins: ["serverless"] })
    );

    expect(monorepoIssues.some((issue) => issue.message.includes("requer pnpm"))).toBe(true);
    expect(serverlessIssues.some((issue) => issue.message.includes("não suporta"))).toBe(true);
  });

  it("generates monorepo and serverless templates when compatible", () => {
    const files = generate({
      framework: "Express",
      apiPattern: "REST Express",
      packageManager: "pnpm",
      templatePlugins: ["monorepo", "serverless"],
    });
    const packageJson = JSON.parse(getFile(files, "package.json"));

    expect(getFile(files, "pnpm-workspace.yaml")).toContain('packages/*');
    expect(getFile(files, "packages/shared/package.json")).toContain("@synthetix/shared");
    expect(getFile(files, "serverless.yml")).toContain("httpApi");
    expect(getFile(files, "src/serverless.ts")).toContain("serverlessExpress");
    expect(packageJson.scripts["build:all"]).toBe("turbo run build");
    expect(packageJson.dependencies["@codegenie/serverless-express"]).toBeDefined();
  });
});

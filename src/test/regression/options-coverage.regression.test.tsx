import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalPreview } from "@/components/TerminalPreview";
import { makeBaseConfig } from "@/test/fixtures";
import type { ProjectConfig } from "@/features/configurator/types";

type CoverageCase = {
  name: string;
  overrides: Partial<ProjectConfig>;
  includes?: string[];
  notIncludes?: string[];
};

const getCommandText = () =>
  screen.getByText((content) => content.includes("npx create-synthetix-app")).textContent || "";

describe("Options coverage regression", () => {
  const cases: CoverageCase[] = [
    { name: "framework NestJS", overrides: { framework: "NestJS" }, includes: ["--framework=nestjs"] },
    { name: "framework Simple TypeScript", overrides: { framework: "Simple TypeScript" }, includes: ["--framework=typescript"] },
    { name: "framework Express", overrides: { framework: "Express" }, includes: ["--framework=express"] },
    { name: "framework Hapi", overrides: { framework: "Hapi" }, includes: ["--framework=hapi"] },
    { name: "package manager pnpm", overrides: { packageManager: "pnpm" }, includes: ["--pm=pnpm"] },
    { name: "package manager yarn", overrides: { packageManager: "yarn" }, includes: ["--pm=yarn"] },
    { name: "package manager bun", overrides: { packageManager: "bun" }, includes: ["--pm=bun"] },
    { name: "node version 22 LTS", overrides: { nodeVersion: "22 LTS" }, includes: ["--node=22"] },
    { name: "node version 24 LTS", overrides: { nodeVersion: "24 LTS" }, includes: ["--node=24"] },
    { name: "api express", overrides: { apiPattern: "REST Express" }, includes: ["--api=express"] },
    { name: "api fastify", overrides: { apiPattern: "REST Fastify" }, includes: ["--api=fastify"] },
    { name: "api graphql", overrides: { apiPattern: "GraphQL Apollo" }, includes: ["--api=graphql"] },
    { name: "database typeorm", overrides: { database: "TypeORM" }, includes: ["--db=typeorm"] },
    { name: "database mongoose", overrides: { database: "Mongoose" }, includes: ["--db=mongoose"] },
    { name: "linter biome", overrides: { linter: "Biome" }, includes: ["--linter=biome"] },
    { name: "test mocha", overrides: { testLibrary: "Mocha" }, includes: ["--test=mocha"] },
    { name: "logger winston", overrides: { logger: "Winston" }, includes: ["--logger=winston"] },
    { name: "documentation swagger first", overrides: { documentation: "Swagger-first" }, includes: ["--doc=spec"] },
    { name: "security api token", overrides: { security: "API Token" }, includes: ["--auth=token"] },
    { name: "architecture clean", overrides: { architecture: "Clean Architecture" }, includes: ["--arch=clean-architecture"] },
    { name: "ci enabled", overrides: { ciCdEnabled: true }, includes: ["--ci=github-actions"] },
    { name: "dockerfile enabled", overrides: { dockerfileEnabled: true }, includes: ["--dockerfile"] },
    { name: "docker compose enabled", overrides: { dockerComposeEnabled: true }, includes: ["--docker-compose"] },
    {
      name: "messaging bullmq",
      overrides: { messagingEnabled: true, messagingType: "BullMQ" },
      includes: ["--mq=bullmq"],
    },
    {
      name: "security strategies",
      overrides: { securityStrategies: ["Helmet", "Rate Limiting"] },
      includes: ["--security-strategies=helmet,rate-limiting"],
    },
    {
      name: "middlewares",
      overrides: { middlewares: ["Helmet Middleware", "Compression Middleware"] },
      includes: ["--middlewares=helmet-middleware,compression-middleware"],
    },
    {
      name: "observability libs",
      overrides: { observabilityLibs: ["OpenTelemetry", "Datadog"] },
      includes: ["--observability=opentelemetry,datadog"],
    },
    {
      name: "additional packages",
      overrides: { additionalPackages: ["class-validator", "axios"] },
      includes: ["--packages=class-validator,axios"],
    },
    {
      name: "healthcheck disabled removes flag",
      overrides: { healthcheckEnabled: false },
      notIncludes: ["--healthcheck"],
    },
    {
      name: "advanced generation options",
      overrides: {
        databaseEngine: "MySQL",
        migrationsEnabled: true,
        seedEnabled: true,
        templatePlugins: ["redis", "kafka"],
        environments: ["staging", "production"],
        secretsProvider: "AWS Secrets Manager",
      },
      includes: [
        "--db-engine=mysql",
        "--migrations",
        "--seed",
        "--plugins=redis,kafka",
        "--envs=staging,production",
        "--secrets=aws-secrets-manager",
      ],
    },
  ];

  it.each(cases)("reflects $name", ({ overrides, includes = [], notIncludes = [] }) => {
    render(<TerminalPreview config={makeBaseConfig(overrides)} />);

    const command = getCommandText();

    includes.forEach((flag) => expect(command).toContain(flag));
    notIncludes.forEach((flag) => expect(command).not.toContain(flag));
  });
});

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TerminalPreview } from "@/components/TerminalPreview";
import { makeBaseConfig } from "@/test/fixtures";

describe("TerminalPreview regression", () => {
  it("keeps compose free of database and messaging services when both are unselected", () => {
    const config = makeBaseConfig({
      framework: "NestJS",
      dockerComposeEnabled: true,
      database: null,
      messagingEnabled: false,
      messagingType: null,
    });

    render(<TerminalPreview config={config} />);

    fireEvent.click(screen.getByText("docker-compose.yml"));

    const text = document.querySelector(".editor-code-body")?.textContent ?? "";

    expect(text).toContain("services:");
    expect(text).not.toContain("postgres:");
    expect(text).not.toContain("mongo:");
    expect(text).not.toContain("rabbitmq:");
    expect(text).not.toContain("redis:");
    expect(text).not.toContain("localstack:");
    expect(text).not.toContain("DATABASE_URL=");
    expect(text).not.toContain("MONGO_URI=");
    expect(text).not.toContain("MESSAGING_URL=");
    expect(text).not.toContain("AWS_ENDPOINT=");
    expect(text).not.toContain("depends_on:");
  });

  it("renders RabbitMQ compose service and env when selected", () => {
    const config = makeBaseConfig({
      framework: "Simple TypeScript",
      dockerComposeEnabled: true,
      messagingEnabled: true,
      messagingType: "RabbitMQ",
      database: "TypeORM",
    });

    render(<TerminalPreview config={config} />);

    fireEvent.click(screen.getByText("docker-compose.yml"));

    const text = document.querySelector(".editor-code-body")?.textContent ?? "";

    expect(text).toContain("rabbitmq:");
    expect(text).toContain("image: rabbitmq:3-management-alpine");
    expect(text).toContain("MESSAGING_URL=amqp://rabbitmq:5672");
    expect(text).toContain("DATABASE_URL=postgresql://app:change-me@postgres:5432/synthetix");
    expect(text).toContain("depends_on:");
    expect(text).toContain("- postgres");
    expect(text).toContain("- rabbitmq");
  });

  it("normalizes project name in generated command", () => {
    const config = makeBaseConfig({
      projectName: "  Meu Serviço API 2026  ",
      packageManager: "pnpm",
      framework: "NestJS",
      apiPattern: "GraphQL Apollo",
    });

    render(<TerminalPreview config={config} />);

    const command = screen.getByText((content) =>
      content.includes("npx create-synthetix-app")
    ).textContent;

    expect(command).toContain("npx create-synthetix-app meu-servico-api-2026");
    expect(command).toContain("--pm=pnpm");
    expect(command).toContain("--api=graphql");
  });

  it("includes selected additional packages in command and package preview", () => {
    const config = makeBaseConfig({
      framework: "NestJS",
      additionalPackages: ["class-validator", "zod", "axios"],
    });

    render(<TerminalPreview config={config} />);

    const command = screen.getByText((content) =>
      content.includes("npx create-synthetix-app")
    ).textContent;

    expect(command).toContain("--packages=class-validator,zod,axios");

    fireEvent.click(screen.getAllByText("package.json")[0]);

    const text = document.querySelector(".editor-code-body")?.textContent ?? "";
    expect(text).toContain('"class-validator": "^0.14.2"');
    expect(text).toContain('"zod": "^3.24.2"');
    expect(text).toContain('"axios": "^1.8.4"');
  });

  it("reflects framework, security strategies and observability libs in command and dependencies", () => {
    const config = makeBaseConfig({
      framework: "Hapi",
      securityStrategies: ["Helmet", "Rate Limiting"],
      middlewares: ["Compression Middleware", "Request Logger Middleware"],
      observabilityLibs: ["OpenTelemetry", "Datadog"],
      additionalPackages: [],
    });

    render(<TerminalPreview config={config} />);

    const command = screen.getByText((content) =>
      content.includes("npx create-synthetix-app")
    ).textContent;

    expect(command).toContain("--framework=hapi");
    expect(command).toContain("--security-strategies=helmet,rate-limiting");
    expect(command).toContain("--middlewares=compression-middleware,request-logger-middleware");
    expect(command).toContain("--observability=opentelemetry,datadog");

    fireEvent.click(screen.getAllByText("package.json")[0]);

    const text = document.querySelector(".editor-code-body")?.textContent ?? "";
    expect(text).toContain('"@hapi/hapi": "^21.3.12"');
    expect(text).toContain('"helmet": "^8.1.0"');
    expect(text).toContain('"express-rate-limit": "^7.5.0"');
    expect(text).toContain('"compression": "^1.7.5"');
    expect(text).toContain('"pino-http": "^10.4.0"');
    expect(text).toContain('"@opentelemetry/api": "^1.9.0"');
    expect(text).toContain('"dd-trace": "^5.39.0"');
  });

  it("creates standard src structure for Express and Hapi", () => {
    ["Express", "Hapi"].forEach((framework) => {
      const config = makeBaseConfig({
        framework,
        apiPattern: "REST Express",
      });

      const { unmount } = render(<TerminalPreview config={config} />);

      expect(screen.getByText("src")).toBeInTheDocument();
      expect(screen.getAllByText("app.ts")[0]).toBeInTheDocument();
      expect(screen.getAllByText("index.ts")[0]).toBeInTheDocument();

      unmount();
    });
  });

  it("adds permission validation middleware to protected routes when security is enabled", () => {
    const config = makeBaseConfig({
      framework: "Express",
      apiPattern: "REST Express",
      security: "JWT Authentication",
    });

    render(<TerminalPreview config={config} />);

    fireEvent.click(screen.getByText("permissions.middleware.ts"));
    const permissionText = document.querySelector(".editor-code-body")?.textContent ?? "";
    expect(permissionText).toContain("Forbidden: Missing required role");

    fireEvent.click(screen.getByText("user.routes.ts"));
    const routeText = document.querySelector(".editor-code-body")?.textContent ?? "";
    expect(routeText).toContain("authMiddleware, permissionsMiddleware");
  });

  it("includes linter and test config files based on selected tooling", () => {
    const config = makeBaseConfig({
      framework: "NestJS",
      linter: "Biome",
      testLibrary: "Vitest",
    });

    render(<TerminalPreview config={config} />);

    expect(screen.getByText("biome.json")).toBeInTheDocument();
    expect(screen.getByText("vitest.config.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByText("vitest.config.ts"));
    const vitestConfigText = document.querySelector(".editor-code-body")?.textContent ?? "";
    expect(vitestConfigText).toContain("defineConfig");
  });

  it("adapts package scripts to selected linter and test library", () => {
    const config = makeBaseConfig({
      framework: "Simple TypeScript",
      linter: "Biome",
      testLibrary: "Mocha",
    });

    render(<TerminalPreview config={config} />);

    fireEvent.click(screen.getByText("package.json"));
    const packageText = document.querySelector(".editor-code-body")?.textContent ?? "";

    expect(packageText).toContain('"lint": "biome check ."');
    expect(packageText).toContain('"lint:fix": "biome check . --write"');
    expect(packageText).toContain('"test": "mocha -r ts-node/register');
    expect(packageText).toContain('"test:watch": "mocha -r ts-node/register --watch');
  });
});

import type { ProjectConfig } from "./types";
import { getPluginDefinition } from "@/features/plugins/registry";

export const getAutoInstalledPackages = (config: ProjectConfig) => {
  const autoInstalledPackages = new Set<string>();
  const isSimpleTs = config.framework === "Simple TypeScript";
  const isFastify = config.apiPattern?.includes("Fastify");

  if (config.apiPattern) {
    autoInstalledPackages.add(isFastify ? "fastify" : "express");
  }
  if (config.database === "Mongoose") {
    autoInstalledPackages.add("mongoose");
  }
  if (config.database === "TypeORM") {
    autoInstalledPackages.add("typeorm");
  }
  if (config.logger === "Pino") {
    autoInstalledPackages.add("pino");
  }
  if (config.logger === "Winston") {
    autoInstalledPackages.add("winston");
  }
  if (isSimpleTs) {
    autoInstalledPackages.add("dotenv");
  }
  if (isSimpleTs && config.security === "JWT Authentication") {
    autoInstalledPackages.add("jsonwebtoken");
  }
  if (config.messagingEnabled && config.messagingType === "BullMQ") {
    autoInstalledPackages.add("bullmq");
  }
  if (config.messagingEnabled && config.messagingType === "RabbitMQ") {
    autoInstalledPackages.add("amqplib");
  }
  if (config.messagingEnabled && config.messagingType === "AWS SQS") {
    autoInstalledPackages.add("@aws-sdk/client-sqs");
  }
  if (config.framework === "Express") {
    autoInstalledPackages.add("express");
  }
  if (config.framework === "Hapi") {
    autoInstalledPackages.add("@hapi/hapi");
  }
  if (config.framework === "Meteor") {
    autoInstalledPackages.add("meteor");
  }
  if (config.observabilityLibs.includes("OpenTelemetry")) {
    autoInstalledPackages.add("@opentelemetry/api");
    autoInstalledPackages.add("@opentelemetry/sdk-node");
  }
  if (config.observabilityLibs.includes("Datadog")) {
    autoInstalledPackages.add("dd-trace");
  }
  if (config.observabilityLibs.includes("Prometheus")) {
    autoInstalledPackages.add("prom-client");
  }
  if (config.observabilityLibs.includes("Sentry")) {
    autoInstalledPackages.add("@sentry/node");
  }
  if (config.securityStrategies.includes("Helmet")) {
    autoInstalledPackages.add("helmet");
  }
  if (config.securityStrategies.includes("CORS Hardening")) {
    autoInstalledPackages.add("cors");
  }
  if (config.securityStrategies.includes("Rate Limiting")) {
    autoInstalledPackages.add("express-rate-limit");
  }
  if (config.securityStrategies.includes("CSRF Protection")) {
    autoInstalledPackages.add("csurf");
  }
  if (config.securityStrategies.includes("Input Validation")) {
    autoInstalledPackages.add("class-validator");
    autoInstalledPackages.add("class-transformer");
  }
  if (config.securityStrategies.includes("Brute-force Protection")) {
    autoInstalledPackages.add("rate-limiter-flexible");
  }
  if (config.securityStrategies.includes("Secure Cookies")) {
    autoInstalledPackages.add("cookie-parser");
  }
  if (config.middlewares.includes("Helmet Middleware")) {
    autoInstalledPackages.add("helmet");
  }
  if (config.middlewares.includes("CORS Middleware")) {
    autoInstalledPackages.add("cors");
  }
  if (config.middlewares.includes("Rate Limit Middleware")) {
    autoInstalledPackages.add("express-rate-limit");
  }
  if (config.middlewares.includes("CSRF Middleware")) {
    autoInstalledPackages.add("csurf");
  }
  if (config.middlewares.includes("Secure Cookies Middleware")) {
    autoInstalledPackages.add("cookie-parser");
  }
  if (config.middlewares.includes("Compression Middleware")) {
    autoInstalledPackages.add("compression");
  }
  if (config.middlewares.includes("HPP Middleware")) {
    autoInstalledPackages.add("hpp");
  }
  if (config.middlewares.includes("Request Logger Middleware")) {
    autoInstalledPackages.add("pino-http");
  }
  autoInstalledPackages.add("zod");
  for (const pluginId of config.templatePlugins) {
    const plugin = getPluginDefinition(pluginId);
    Object.keys(plugin?.dependencies ?? {}).forEach((dependency) =>
      autoInstalledPackages.add(dependency)
    );
  }
  if (config.secretsProvider === "AWS Secrets Manager") {
    autoInstalledPackages.add("@aws-sdk/client-secrets-manager");
  }

  return autoInstalledPackages;
};

import React from "react";
import type { ProjectConfig } from "@/features/configurator/types";
import {
  NodeIcon,
  FrameworkIcon,
  ApiIcon,
  DatabaseIcon,
  LinterIcon,
  TestIcon,
  PackageManagerIcon,
  ObservabilityIcon,
  CiCdIcon,
  DocumentIcon,
  SecurityIcon,
  ArchitectureIcon,
  ContainerIcon,
  MessagingIcon,
  LightningIcon,
  BackArrowIcon,
  CheckIcon,
  NestJSIcon,
  TSIcon
} from "./Icons";
import { getAutoInstalledPackages } from "@/features/configurator/autoPackages";
import {
  ADDITIONAL_PACKAGES,
  API_PATTERNS,
  ARCHITECTURES,
  BROKERS,
  DOCS_OPTIONS,
  DATABASE_ENGINES,
  ENVIRONMENTS,
  FRAMEWORK_OPTIONS,
  LINTER_OPTIONS,
  LOGGER_OPTIONS,
  MIDDLEWARE_OPTIONS,
  NODE_VERSIONS,
  OBSERVABILITY_OPTIONS,
  PACKAGE_MANAGERS,
  SECURITY_OPTIONS,
  SECURITY_STRATEGY_OPTIONS,
  SECRETS_PROVIDERS,
  STARTER_PROFILE_PRESETS,
  TEST_LIBRARIES,
  StarterProfileKey,
  calculateManualAdditionalCount,
  getTodoState,
} from "@/features/configurator/logic";
import { PLUGIN_REGISTRY } from "@/features/plugins/registry";

export type { ProjectConfig } from "@/features/configurator/types";

interface ConfiguratorProps {
  config: ProjectConfig;
  onChange: (updates: Partial<ProjectConfig>) => void;
  onGenerate: () => void;
  onReset: () => void;
}

export const Configurator: React.FC<ConfiguratorProps> = ({
  config,
  onChange,
  onGenerate,
  onReset,
}) => {
  const autoInstalledPackages = getAutoInstalledPackages(config);
  const manualAdditionalCount = calculateManualAdditionalCount(config, autoInstalledPackages);

  const starterProfiles: Record<
    StarterProfileKey,
    { title: string; summary: string; icon: React.ReactNode; preset: Partial<ProjectConfig> }
  > = {
    "saas-api": {
      ...STARTER_PROFILE_PRESETS["saas-api"],
      icon: <ApiIcon size={14} />,
    },
    "worker-queue": {
      ...STARTER_PROFILE_PRESETS["worker-queue"],
      icon: <MessagingIcon size={14} />,
    },
    "bff-graphql": {
      ...STARTER_PROFILE_PRESETS["bff-graphql"],
      icon: <FrameworkIcon size={14} />,
    },
  };

  const applyStarterProfile = (key: StarterProfileKey) => {
    onChange(starterProfiles[key].preset);
  };

  const { todoItems, completedCount, requiredPending, issues, isReadyToGenerate } = getTodoState(config);

  const frameworkOptionIcon = (framework: string) => {
    if (framework === "Express") return <ApiIcon size={12} />;
    if (framework === "Hapi") return <FrameworkIcon size={12} />;
    if (framework === "Meteor") return <LightningIcon size={12} />;
    return <FrameworkIcon size={12} />;
  };

  const securityStrategyIcon = (strategy: string) => {
    if (strategy === "Helmet") return <SecurityIcon size={12} />;
    if (strategy === "CORS Hardening") return <ApiIcon size={12} />;
    if (strategy === "Rate Limiting") return <CiCdIcon size={12} />;
    if (strategy === "CSRF Protection") return <SecurityIcon size={12} />;
    if (strategy === "Input Validation") return <TestIcon size={12} />;
    if (strategy === "Brute-force Protection") return <SecurityIcon size={12} />;
    if (strategy === "Secure Cookies") return <DocumentIcon size={12} />;
    return <SecurityIcon size={12} />;
  };

  const observabilityLibIcon = (lib: string) => {
    if (lib === "OpenTelemetry") return <ObservabilityIcon size={12} />;
    if (lib === "Datadog") return <ObservabilityIcon size={12} />;
    if (lib === "Prometheus") return <ObservabilityIcon size={12} />;
    if (lib === "Sentry") return <SecurityIcon size={12} />;
    return <ObservabilityIcon size={12} />;
  };

  const middlewareIcon = (middleware: string) => {
    if (middleware.includes("Helmet") || middleware.includes("CSRF") || middleware.includes("Secure Cookies")) return <SecurityIcon size={12} />;
    if (middleware.includes("CORS") || middleware.includes("Rate Limit") || middleware.includes("HPP")) return <ApiIcon size={12} />;
    if (middleware.includes("Request Logger")) return <ObservabilityIcon size={12} />;
    return <ContainerIcon size={12} />;
  };

  const packageOptionIcon = (pkg: string) => {
    if (pkg === "express" || pkg === "fastify" || pkg === "@hapi/hapi" || pkg === "meteor") return <FrameworkIcon size={12} />;
    if (pkg.includes("opentelemetry") || pkg === "dd-trace" || pkg === "prom-client" || pkg === "@sentry/node") return <ObservabilityIcon size={12} />;
    if (pkg === "helmet" || pkg === "cors" || pkg === "express-rate-limit" || pkg === "csurf" || pkg === "rate-limiter-flexible" || pkg === "cookie-parser") return <SecurityIcon size={12} />;
    if (pkg === "typeorm" || pkg === "mongoose" || pkg === "prisma" || pkg === "@prisma/client" || pkg === "pg" || pkg === "mysql2") return <DatabaseIcon size={12} />;
    if (pkg === "bullmq" || pkg === "amqplib" || pkg === "ioredis" || pkg.includes("sqs") || pkg.includes("sns")) return <MessagingIcon size={12} />;
    if (pkg === "jest" || pkg === "vitest" || pkg === "mocha" || pkg === "class-validator" || pkg === "class-transformer" || pkg === "zod" || pkg === "joi" || pkg === "yup") return <TestIcon size={12} />;
    return <PackageManagerIcon size={12} />;
  };

  return (
    <div className="configurator-wrapper">
      {/* Header */}
      <header className="config-header">
        <button type="button" className="back-btn" title="Voltar" aria-label="Voltar" onClick={onReset}>
          <BackArrowIcon />
        </button>
        <h1 className="header-title">Novo Projeto</h1>
        <div className="header-status">
          <span className="status-dot"></span>
          Synthetix CLI v1.0.0
        </div>
      </header>

      <div className="configurator-scroll-area">
        {/* Project Name */}
        <section className="config-section">
          <label className="label-caps" htmlFor="project-name">Project Name</label>
          <input
            id="project-name"
            type="text"
            className="config-input"
            placeholder="my-service"
            value={config.projectName}
            onChange={(e) => onChange({ projectName: e.target.value })}
          />
        </section>

        <section className="config-section">
          <div className="label-caps">
            <LightningIcon size={16} />
            Starter Profiles
          </div>
          <p className="section-instruction">Pick a starter and prefill all major settings in one click.</p>
          <div className="starter-profile-grid">
            {(Object.keys(starterProfiles) as StarterProfileKey[]).map((key) => {
              const profile = starterProfiles[key];
              return (
                <button
                  key={key}
                  type="button"
                  className="starter-profile-card"
                  onClick={() => applyStarterProfile(key)}
                >
                  <span className="starter-profile-icon">{profile.icon}</span>
                  <span className="starter-profile-title">{profile.title}</span>
                  <span className="starter-profile-summary">{profile.summary}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Node.js Version */}
        <section className="config-section">
          <div className="label-caps">
            <NodeIcon size={16} />
            Node.js Version
          </div>
          <div className="segment-control">
            {NODE_VERSIONS.map((version) => (
              <button
                key={version}
                type="button"
                aria-pressed={config.nodeVersion === version}
                className={`segment-btn ${config.nodeVersion === version ? "active" : ""}`}
                onClick={() => onChange({ nodeVersion: config.nodeVersion === version ? null : version })}
              >
                {version}
              </button>
            ))}
          </div>
        </section>

        {/* Package Manager */}
        <section className="config-section">
          <div className="label-caps">
            <PackageManagerIcon size={16} />
            Package Manager
          </div>
          <div className="segment-control">
            {PACKAGE_MANAGERS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={config.packageManager === option}
                className={`segment-btn ${config.packageManager === option ? "active" : ""}`}
                onClick={() => onChange({ packageManager: config.packageManager === option ? null : option })}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        {/* Framework */}
        <section className="config-section">
          <div className="label-caps">
            <FrameworkIcon size={16} />
            Framework
          </div>
          <div className="framework-cards">
            <button
              type="button"
              className={`framework-card nestjs-card ${config.framework === "NestJS" ? "selected" : ""}`}
              onClick={() => onChange({ framework: config.framework === "NestJS" ? null : "NestJS" })}
              aria-pressed={config.framework === "NestJS"}
            >
              <div className="framework-card-glow"></div>
              <div className="framework-card-icon" style={{ color: "#ea2849" }}>
                <NestJSIcon size={36} />
              </div>
              <div className="framework-card-info">
                <h3>NestJS</h3>
                <p>A progressive Node.js framework for building efficient, reliable and scalable server-side applications.</p>
              </div>
              {config.framework === "NestJS" && (
                <span className="selected-badge animate-check">
                  <CheckIcon size={12} />
                  LATEST
                </span>
              )}
            </button>

            <button
              type="button"
              className={`framework-card typescript-card ${config.framework === "Simple TypeScript" ? "selected" : ""}`}
              onClick={() => onChange({ framework: config.framework === "Simple TypeScript" ? null : "Simple TypeScript" })}
              aria-pressed={config.framework === "Simple TypeScript"}
            >
              <div className="framework-card-glow"></div>
              <div className="framework-card-icon" style={{ color: "#3178C6" }}>
                <TSIcon size={36} />
              </div>
              <div className="framework-card-info">
                <h3>Simple TypeScript</h3>
                <p>A clean, minimal template for a custom Node.js app built with raw TypeScript and script bindings.</p>
              </div>
              {config.framework === "Simple TypeScript" && (
                <span className="selected-badge animate-check">
                  <CheckIcon size={12} />
                  ACTIVE
                </span>
              )}
            </button>
          </div>
          <div className="segment-control" style={{ marginTop: "0.9rem" }}>
            {FRAMEWORK_OPTIONS.filter((f) => f !== "NestJS" && f !== "Simple TypeScript").map((framework) => (
              <button
                key={framework}
                type="button"
                aria-pressed={config.framework === framework}
                className={`segment-btn option-with-icon ${config.framework === framework ? "active" : ""}`}
                onClick={() => onChange({ framework: config.framework === framework ? null : framework })}
              >
                <span className="option-icon">{frameworkOptionIcon(framework)}</span>
                <span>{framework}</span>
              </button>
            ))}
          </div>
        </section>

        {/* API Pattern */}
        <section className="config-section">
          <div className="label-caps">
            <ApiIcon size={16} />
            API Pattern
          </div>
          <div className="segment-control">
            {API_PATTERNS.map((pattern) => (
              <button
                key={pattern}
                type="button"
                aria-pressed={config.apiPattern === pattern}
                className={`segment-btn ${config.apiPattern === pattern ? "active" : ""}`}
                onClick={() => onChange({ apiPattern: config.apiPattern === pattern ? null : pattern })}
              >
                {pattern}
              </button>
            ))}
          </div>
        </section>

        {/* Database */}
        <section className="config-section">
          <div className="label-caps">
            <DatabaseIcon size={16} />
            Database ORM / ODM
          </div>
          <div className="database-cards">
            {/* TypeORM */}
            <button
              type="button"
              className={`db-card ${config.database === "TypeORM" ? "active" : ""}`}
              onClick={() =>
                onChange(
                  config.database === "TypeORM"
                    ? { database: null, databaseEngine: null, migrationsEnabled: false, seedEnabled: false }
                    : {
                        database: "TypeORM",
                        databaseEngine: config.databaseEngine === "MySQL" ? "MySQL" : "PostgreSQL",
                      }
                )
              }
              aria-pressed={config.database === "TypeORM"}
            >
              <div className="db-card-header">
                <span className="db-radio">
                  {config.database === "TypeORM" && <span className="db-radio-inner"></span>}
                </span>
                <span className="db-title">TypeORM</span>
              </div>
              <p className="db-desc">SQL ORM running in NodeJS. Supports Active Record and Data Mapper pattern. Great for PostgreSQL/MySQL.</p>
              {config.database === "TypeORM" && (
                <span className="active-badge animate-check">
                  <CheckIcon size={10} /> Selected
                </span>
              )}
            </button>

            {/* Mongoose */}
            <button
              type="button"
              className={`db-card ${config.database === "Mongoose" ? "active" : ""}`}
              onClick={() =>
                onChange(
                  config.database === "Mongoose"
                    ? { database: null, databaseEngine: null, migrationsEnabled: false, seedEnabled: false }
                    : { database: "Mongoose", databaseEngine: "MongoDB", migrationsEnabled: false }
                )
              }
              aria-pressed={config.database === "Mongoose"}
            >
              <div className="db-card-header">
                <span className="db-radio">
                  {config.database === "Mongoose" && <span className="db-radio-inner"></span>}
                </span>
                <span className="db-title">Mongoose</span>
              </div>
              <p className="db-desc">MongoDB object modeling tool designed to work in an asynchronous environment. Schema-based solution.</p>
              {config.database === "Mongoose" && (
                <span className="active-badge animate-check">
                  <CheckIcon size={10} /> Selected
                </span>
              )}
            </button>
          </div>
          {config.database && (
            <div className="database-advanced-options">
              <p className="section-instruction">Database engine</p>
              <div className="segment-control">
                {DATABASE_ENGINES.map((engine) => {
                  const disabled =
                    (config.database === "Mongoose" && engine !== "MongoDB") ||
                    (config.database === "TypeORM" && engine === "MongoDB");
                  return (
                    <button
                      key={engine}
                      type="button"
                      disabled={disabled}
                      aria-pressed={config.databaseEngine === engine}
                      className={`segment-btn ${config.databaseEngine === engine ? "active" : ""}`}
                      onClick={() => onChange({ databaseEngine: engine })}
                    >
                      {engine}
                    </button>
                  );
                })}
              </div>
              <div className="database-feature-toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={config.migrationsEnabled}
                    disabled={config.database !== "TypeORM"}
                    onChange={(event) => onChange({ migrationsEnabled: event.target.checked })}
                  />
                  Generate migrations
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={config.seedEnabled}
                    onChange={(event) => onChange({ seedEnabled: event.target.checked })}
                  />
                  Generate seed
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Linter */}
        <section className="config-section">
          <div className="label-caps">
            <LinterIcon size={16} />
            Linter
          </div>
          <div className="segment-control">
            {LINTER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={config.linter === option}
                className={`segment-btn ${config.linter === option ? "active" : ""}`}
                onClick={() => onChange({ linter: config.linter === option ? null : option })}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        {/* Test Library */}
        <section className="config-section">
          <div className="label-caps">
            <TestIcon size={16} />
            Test Library
          </div>
          <div className="segment-control">
            {TEST_LIBRARIES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={config.testLibrary === option}
                className={`segment-btn ${config.testLibrary === option ? "active" : ""}`}
                onClick={() => onChange({ testLibrary: config.testLibrary === option ? null : option })}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <section className="config-section">
          <div className="label-caps">
            <PackageManagerIcon size={16} />
            Additional Packages
          </div>
          <p className="section-instruction">Select optional libraries to include in the generated dependencies.</p>
          <div className="package-chip-grid">
            {ADDITIONAL_PACKAGES.map((pkg) => {
              const selected = config.additionalPackages.includes(pkg);
              const isAutoInstalled = autoInstalledPackages.has(pkg);
              return (
                <button
                  key={pkg}
                  type="button"
                  disabled={isAutoInstalled}
                  aria-pressed={selected || isAutoInstalled}
                  className={`package-chip option-with-icon ${selected || isAutoInstalled ? "active" : ""} ${isAutoInstalled ? "auto-installed" : ""}`}
                  onClick={() =>
                    onChange({
                      additionalPackages: selected
                        ? config.additionalPackages.filter((item) => item !== pkg)
                        : [...config.additionalPackages, pkg],
                    })
                  }
                >
                  <span className="option-icon">{packageOptionIcon(pkg)}</span>
                  <span>{pkg}</span>
                  {isAutoInstalled && <span className="package-chip-badge">AUTO</span>}
                </button>
              );
            })}
          </div>
          <p className="section-instruction package-count">
            Selected: {manualAdditionalCount} extras {autoInstalledPackages.size ? `• ${autoInstalledPackages.size} already included` : ""}
          </p>
        </section>

        <section className="config-section">
          <div className="label-caps">
            <LightningIcon size={16} />
            Plugins & Templates
          </div>
          <p className="section-instruction">
            Add runtime integrations and deployment templates from the plugin registry.
          </p>
          <div className="plugin-grid">
            {PLUGIN_REGISTRY.map((plugin) => {
              const selected = config.templatePlugins.includes(plugin.id);
              return (
                <button
                  key={plugin.id}
                  type="button"
                  className={`plugin-card ${selected ? "active" : ""}`}
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      templatePlugins: selected
                        ? config.templatePlugins.filter((id) => id !== plugin.id)
                        : [...config.templatePlugins, plugin.id],
                    })
                  }
                >
                  <span className="plugin-card-header">
                    <span>{plugin.title}</span>
                    <span className="plugin-category">{plugin.category}</span>
                  </span>
                  <span className="plugin-description">{plugin.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Documentation */}
        <section className="config-section">
          <div className="label-caps">
            <ObservabilityIcon size={16} />
            Logger & Observability
          </div>
          <div className="segment-control">
            {LOGGER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={config.logger === option}
                className={`segment-btn ${config.logger === option ? "active" : ""}`}
                onClick={() => onChange({ logger: config.logger === option ? null : option })}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="messaging-header-row" style={{ marginTop: "0.75rem" }}>
            <div className="label-caps" style={{ marginBottom: 0 }}>
              <ObservabilityIcon size={16} />
              Healthcheck
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-label="Habilitar healthcheck"
                checked={config.healthcheckEnabled}
                onChange={(e) => onChange({ healthcheckEnabled: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div style={{ marginTop: "0.9rem" }}>
            <p className="section-instruction">Observability dependency presets (runtime setup remains explicit).</p>
            <div className="package-chip-grid">
              {OBSERVABILITY_OPTIONS.map((lib) => {
                const selected = config.observabilityLibs.includes(lib);
                return (
                  <button
                    key={lib}
                    type="button"
                    aria-pressed={selected}
                    className={`package-chip option-with-icon ${selected ? "active" : ""}`}
                    onClick={() =>
                      onChange({
                        observabilityLibs: selected
                          ? config.observabilityLibs.filter((item) => item !== lib)
                          : [...config.observabilityLibs, lib],
                      })
                    }
                  >
                    <span className="option-icon">{observabilityLibIcon(lib)}</span>
                    <span>{lib}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Documentation */}
        <section className="config-section">
          <div className="label-caps">
            <DocumentIcon size={16} />
            Documentation
          </div>
          <div className="segment-control">
            {DOCS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={config.documentation === option}
                className={`segment-btn ${config.documentation === option ? "active" : ""}`}
                onClick={() => onChange({ documentation: config.documentation === option ? null : option })}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        {/* Security */}
        <section className="config-section">
          <div className="label-caps">
            <SecurityIcon size={16} />
            Security & Auth
          </div>
          <div className="segment-control">
            {SECURITY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={config.security === option}
                className={`segment-btn ${config.security === option ? "active" : ""}`}
                onClick={() => onChange({ security: config.security === option ? null : option })}
              >
                {option}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "0.9rem" }}>
            <p className="section-instruction">Security dependency presets (review and wire them for your threat model).</p>
            <div className="package-chip-grid">
              {SECURITY_STRATEGY_OPTIONS.map((strategy) => {
                const selected = config.securityStrategies.includes(strategy);
                return (
                  <button
                    key={strategy}
                    type="button"
                    aria-pressed={selected}
                    className={`package-chip option-with-icon ${selected ? "active" : ""}`}
                    onClick={() =>
                      onChange({
                        securityStrategies: selected
                          ? config.securityStrategies.filter((item) => item !== strategy)
                          : [...config.securityStrategies, strategy],
                      })
                    }
                  >
                    <span className="option-icon">{securityStrategyIcon(strategy)}</span>
                    <span>{strategy}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: "0.9rem" }}>
            <p className="section-instruction">Middleware dependency presets (not all apply to every HTTP adapter).</p>
            <div className="package-chip-grid">
              {MIDDLEWARE_OPTIONS.map((middleware) => {
                const selected = config.middlewares.includes(middleware);
                return (
                  <button
                    key={middleware}
                    type="button"
                    aria-pressed={selected}
                    className={`package-chip option-with-icon ${selected ? "active" : ""}`}
                    onClick={() =>
                      onChange({
                        middlewares: selected
                          ? config.middlewares.filter((item) => item !== middleware)
                          : [...config.middlewares, middleware],
                      })
                    }
                  >
                    <span className="option-icon">{middlewareIcon(middleware)}</span>
                    <span>{middleware}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="config-section">
          <div className="label-caps">
            <ArchitectureIcon size={16} />
            Architecture
          </div>
          <div className="architecture-carousel">
            <div className="carousel-track">
              {ARCHITECTURES.map((arch) => (
                <button
                  key={arch}
                  type="button"
                  aria-pressed={config.architecture === arch}
                  className={`arch-btn ${config.architecture === arch ? "active" : ""}`}
                  onClick={() => onChange({ architecture: config.architecture === arch ? null : arch })}
                >
                  {config.architecture === arch && <span className="arch-dot"></span>}
                  {arch}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Messaging Queue */}
        <section className="config-section">
          <div className="label-caps">
            <ContainerIcon size={16} />
            Environments & Secrets
          </div>
          <p className="section-instruction">
            Generate validated, secret-free templates for each deployment environment.
          </p>
          <div className="segment-control">
            {ENVIRONMENTS.map((environment) => {
              const selected = config.environments.includes(environment);
              return (
                <button
                  key={environment}
                  type="button"
                  className={`segment-btn ${selected ? "active" : ""}`}
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      environments: selected
                        ? config.environments.filter((item) => item !== environment)
                        : [...config.environments, environment],
                    })
                  }
                >
                  {environment}
                </button>
              );
            })}
          </div>
          <p className="section-instruction environment-provider-label">Secrets provider</p>
          <div className="segment-control">
            {SECRETS_PROVIDERS.map((provider) => (
              <button
                key={provider}
                type="button"
                className={`segment-btn ${config.secretsProvider === provider ? "active" : ""}`}
                aria-pressed={config.secretsProvider === provider}
                onClick={() => onChange({ secretsProvider: provider })}
              >
                {provider}
              </button>
            ))}
          </div>
        </section>

        {/* Messaging Queue */}
        <section className="config-section">
          <div className="messaging-header-row">
            <div className="label-caps">
              <CiCdIcon size={16} />
              CI/CD (GitHub Actions)
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-label="Habilitar CI/CD com GitHub Actions"
                checked={config.ciCdEnabled}
                onChange={(e) => onChange({ ciCdEnabled: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        {/* Messaging Queue */}
        <section className="config-section">
          <div className="messaging-header-row">
            <div className="label-caps">
              <ContainerIcon size={16} />
              Dockerfile
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-label="Gerar Dockerfile"
                checked={config.dockerfileEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChange({
                    dockerfileEnabled: checked,
                    dockerComposeEnabled: checked ? config.dockerComposeEnabled : false,
                  });
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="messaging-header-row" style={{ marginTop: "0.75rem" }}>
            <div className="label-caps" style={{ marginBottom: 0 }}>
              <ContainerIcon size={16} />
              Docker Compose
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-label="Gerar Docker Compose"
                checked={config.dockerComposeEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChange({
                    dockerComposeEnabled: checked,
                    dockerfileEnabled: checked ? true : config.dockerfileEnabled,
                  });
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        {/* Messaging Queue */}
        <section className="config-section">
          <div className="messaging-header-row">
            <div className="label-caps">
              <MessagingIcon size={16} />
              Messaging Queue
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-label="Habilitar mensageria"
                checked={config.messagingEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChange({
                    messagingEnabled: checked,
                    messagingType: checked ? "RabbitMQ" : null,
                  });
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className={`messaging-options ${config.messagingEnabled ? "expanded" : ""}`}>
            <p className="section-instruction">Select a messaging broker integration:</p>
            <div className="segment-control">
              {BROKERS.map((broker) => (
                <button
                  key={broker}
                  type="button"
                  aria-pressed={config.messagingType === broker}
                  disabled={!config.messagingEnabled}
                  className={`segment-btn ${config.messagingType === broker ? "active" : ""}`}
                  onClick={() => onChange({ messagingType: config.messagingType === broker ? null : broker })}
                >
                  {broker}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="config-section todo-section">
          <div className="label-caps">
            <CheckIcon size={16} />
            Configuration Todo List
          </div>
          <div className="todo-progress-row">
            <span className="section-instruction" style={{ marginBottom: 0 }}>
              {completedCount}/{todoItems.length} completed
            </span>
            <span className={`todo-status-badge ${isReadyToGenerate ? "ready" : "pending"}`}>
              {isReadyToGenerate ? "READY" : "INCOMPLETE"}
            </span>
          </div>
          <ul className="todo-list">
            {todoItems.map((item) => (
              <li key={item.id} className={`todo-item ${item.done ? "done" : ""}`}>
                <span className="todo-item-check">{item.done ? "✓" : "○"}</span>
                <span className="todo-item-label">{item.label}</span>
                <span className={`todo-item-tag ${item.required ? "required" : "optional"}`}>
                  {item.required ? "Required" : "Optional"}
                </span>
              </li>
            ))}
          </ul>
          {!isReadyToGenerate && (
            <p className="todo-helper-text">
              {issues.length
                ? issues.map((issue) => issue.message).join(" ")
                : `Complete required items: ${requiredPending.map((item) => item.label).join(", ")}`}
            </p>
          )}
        </section>
      </div>

      {/* Footer Fixo */}
      <footer className="config-footer">
        <div className="footer-actions">
          <button type="button" className="reset-btn" onClick={onReset}>
            Resetar
          </button>
          <button className="generate-btn" onClick={onGenerate} disabled={!isReadyToGenerate}>
            <LightningIcon size={16} className="generate-icon-lightning" />
            <span>{isReadyToGenerate ? "REVIEW & GENERATE" : "COMPLETE REQUIRED ITEMS"}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

import React, { useMemo, useState, useEffect, useRef } from "react";
import { CheckIcon, CopyIcon, DownloadIcon, TerminalIcon } from "./Icons";
import type { ProjectConfig } from "@/features/configurator/types";
import { buildProjectFileTree } from "./TerminalPreview";
import {
  createZipBlob,
  flattenFileTree,
} from "@/features/generator/artifact";

interface OutputModalProps {
  config: ProjectConfig;
  onClose: () => void;
}

export const OutputModal: React.FC<OutputModalProps> = ({ config, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [buildSteps, setBuildSteps] = useState<string[]>([]);
  const [isBuilding, setIsBuilding] = useState(true);
  const [timestamp] = useState(() => new Date().toISOString());
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const projectName = (config.projectName || "my-service").trim();
  const projectSlug = projectName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "my-service";

  const configDocument = useMemo(
    () => ({
      $schema: "https://synthetix.dev/schema/v1/boilerplate.json",
      generator: "synthetix-cli",
      version: "1.0.0",
      timestamp,
      project: {
        name: projectSlug,
        packageManager: config.packageManager,
        node: config.nodeVersion,
        framework: config.framework,
        apiPattern: config.apiPattern,
        database: config.database,
        databaseEngine: config.databaseEngine,
        migrations: config.migrationsEnabled,
        seed: config.seedEnabled,
        linter: config.linter,
        testLibrary: config.testLibrary,
        additionalPackages: config.additionalPackages,
        observability: {
          logger: config.logger,
          libs: config.observabilityLibs,
          healthcheck: config.healthcheckEnabled,
        },
        documentation: config.documentation,
        security: {
          auth: config.security,
          strategies: config.securityStrategies,
          middlewares: config.middlewares,
        },
        architecture: config.architecture,
        ciCd: {
          githubActions: config.ciCdEnabled,
        },
        containerization: {
          dockerfile: config.dockerfileEnabled,
          dockerCompose: config.dockerComposeEnabled,
        },
        messaging: config.messagingEnabled
          ? {
              enabled: true,
              broker: config.messagingType,
            }
          : {
              enabled: false,
            },
        plugins: config.templatePlugins,
        environments: config.environments,
        secretsProvider: config.secretsProvider,
      },
    }),
    [config, projectSlug, timestamp]
  );
  const jsonString = useMemo(
    () => JSON.stringify(configDocument, null, 2),
    [configDocument]
  );

  const steps = useMemo(() => [
    "🔍 Validating configuration parameters...",
    "✅ Configuration verified! No conflicts found.",
    config.framework
      ? `🚀 Initializing ${config.framework} scaffold using Synthetix Engine v1.0.0...`
      : "➖ Skipping framework scaffold setup...",
    config.packageManager ? `📦 Using package manager: ${config.packageManager}` : "➖ Skipping package manager setup...",
    config.nodeVersion ? `📦 Setting target Node.js environment: ${config.nodeVersion}` : "➖ Skipping Node.js version pin...",
    config.apiPattern ? `🌐 Applying API style: ${config.apiPattern}...` : "➖ Skipping API pattern setup...",
    config.architecture ? `🧩 Applying Architecture pattern: [${config.architecture}]` : "➖ Skipping Architecture pattern...",
    config.database ? `📡 Mapping database structure: Injecting ${config.database} layer...` : "➖ Skipping database layer setup...",
    config.databaseEngine ? `🗄️ Configuring database engine: ${config.databaseEngine}...` : "➖ Skipping database engine...",
    config.migrationsEnabled ? "🧬 Generating database migrations..." : "➖ Skipping migrations...",
    config.seedEnabled ? "🌱 Generating idempotent seed..." : "➖ Skipping seed...",
    config.linter ? `🧹 Configuring linter: ${config.linter}...` : "➖ Skipping linter setup...",
    config.testLibrary ? `🧪 Configuring test library: ${config.testLibrary}...` : "➖ Skipping test library setup...",
    config.additionalPackages.length
      ? `📚 Adding additional packages: ${config.additionalPackages.join(", ")}`
      : "➖ Skipping additional packages...",
    config.securityStrategies.length
      ? `🛡️ Adding security dependency presets: ${config.securityStrategies.join(", ")}`
      : "➖ Skipping additional security strategies...",
    config.middlewares.length
      ? `🧱 Adding middleware dependency presets: ${config.middlewares.join(", ")}`
      : "➖ Skipping middleware stack setup...",
    config.observabilityLibs.length
      ? `📈 Adding observability dependency presets: ${config.observabilityLibs.join(", ")}`
      : "➖ Skipping observability libs...",
    config.logger ? `📊 Configuring logger: ${config.logger}...` : "➖ Skipping logger setup...",
    config.healthcheckEnabled ? "🩺 Generating healthcheck endpoint..." : "➖ Skipping healthcheck endpoint...",
    config.ciCdEnabled ? "⚙️ Generating CI/CD workflow (GitHub Actions)..." : "➖ Skipping CI/CD workflow generation...",
    config.dockerfileEnabled ? "🐳 Generating Dockerfile..." : "➖ Skipping Dockerfile generation...",
    config.dockerComposeEnabled ? "🐙 Generating docker-compose.yml..." : "➖ Skipping docker-compose generation...",
    config.security ? `🔐 Configuring Auth policies: Setting up ${config.security}...` : "➖ Skipping Auth & Security layer...",
    config.messagingEnabled
      ? `🔌 Mounting messaging broker middleware for ${config.messagingType}...`
      : "➖ Skipping messaging brokers integration...",
    config.templatePlugins.length
      ? `🧩 Installing plugins: ${config.templatePlugins.join(", ")}`
      : "➖ Skipping template plugins...",
    `🌍 Generating environments: ${config.environments.join(", ")}`,
    `🔑 Configuring secrets provider: ${config.secretsProvider}`,
    config.documentation ? "📂 Injecting Swagger document models..." : "➖ Skipping documentation setup...",
    "⚙️ Compiling boilerplate structures...",
    "⚡ Optimizing project layout configurations...",
    "🎉 PROJECT ARTIFACT READY FOR DOWNLOAD.",
  ], [config]);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < steps.length) {
        setBuildSteps((prev) => [...prev, steps[index]]);
        index++;
      } else {
        setIsBuilding(false);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [steps]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    closeButtonRef.current?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [buildSteps]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleDownload = () => {
    const generatedFiles = flattenFileTree(buildProjectFileTree(config));
    const blob = createZipBlob([
      ...generatedFiles,
      { path: "synthetix.config.json", content: jsonString },
    ]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectSlug}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay">
      <div
        ref={modalRef}
        className="modal-content animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generation-modal-title"
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-area">
            <span className="lightning-glow-dot"></span>
            <h2 id="generation-modal-title">Review & Generate Configuration</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            &times;
          </button>
        </div>

        {/* Modal Grid */}
        <div className="modal-body-grid">
          {/* Left panel: Build Simulator */}
          <div className="modal-panel build-terminal">
            <div className="panel-header">
              <TerminalIcon size={14} className="panel-header-icon" />
              <span>SYNTHESIZER SHELL</span>
              {isBuilding ? (
                <span className="build-badge status-loading">BUILDING...</span>
              ) : (
                <span className="build-badge status-done">FINISHED</span>
              )}
            </div>
            <div className="terminal-log-content" aria-live="polite">
              {buildSteps.map((step, idx) => (
                <div key={idx} className="log-line">
                  <span className="log-time">[{new Date().toLocaleTimeString()}]</span>
                  <span className="log-msg">{step}</span>
                </div>
              ))}
              {isBuilding && (
                <div className="log-line-current">
                  <span className="log-cursor"></span>
                </div>
              )}
              <div ref={terminalEndRef}></div>
            </div>
          </div>

          {/* Right panel: Config JSON Output */}
          <div className="modal-panel config-json-view">
            <div className="panel-header">
              <span>CONFIG JSON</span>
              <div className="panel-actions">
                <button
                  className={`action-btn ${copied ? "copied" : ""}`}
                  disabled={isBuilding}
                  onClick={handleCopy}
                  title="Copy to Clipboard"
                >
                  {copied ? (
                    <>
                      <CheckIcon size={12} />
                      <span>COPIED</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon size={12} />
                      <span>COPY</span>
                    </>
                  )}
                </button>
                <button
                  className="action-btn"
                  disabled={isBuilding}
                  onClick={handleDownload}
                  title="Download Project ZIP"
                >
                  <DownloadIcon size={12} />
                  <span>DOWNLOAD ZIP</span>
                </button>
              </div>
            </div>
            <div className="json-code-container">
              <pre className="json-code-pre">
                <code>{jsonString}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer-actions">
          {!isBuilding && (
            <div className="success-footer-message">
              <span>🎉 Boilerplate is ready for generation. Start hacking!</span>
            </div>
          )}
          <button className="primary-modal-close" onClick={onClose}>
            {isBuilding ? "Cancel Setup" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
};

"use client";

import React, { useState } from "react";
import { Configurator } from "@/components/Configurator";
import type { ProjectConfig } from "@/features/configurator/types";
import { TerminalPreview } from "@/components/TerminalPreview";
import { OutputModal } from "@/components/OutputModal";

const createDefaultConfig = (): ProjectConfig => ({
  projectName: "my-service",
  additionalPackages: [],
  middlewares: [],
  securityStrategies: [],
  observabilityLibs: [],
  packageManager: "npm",
  nodeVersion: "20 LTS",
  framework: "NestJS",
  apiPattern: "REST Express",
  database: "TypeORM",
  databaseEngine: "PostgreSQL",
  migrationsEnabled: true,
  seedEnabled: true,
  linter: "ESLint",
  testLibrary: "Jest",
  logger: "Pino",
  healthcheckEnabled: true,
  documentation: "Swagger Code-first",
  security: "JWT Authentication",
  architecture: "Hexagonal",
  ciCdEnabled: false,
  dockerfileEnabled: false,
  dockerComposeEnabled: false,
  messagingEnabled: false,
  messagingType: null,
  templatePlugins: [],
  environments: ["development", "staging", "production"],
  secretsProvider: "Environment Variables",
});

export default function Home() {
  const [config, setConfig] = useState<ProjectConfig>(createDefaultConfig);

  const [showModal, setShowModal] = useState(false);

  const handleConfigChange = (updates: Partial<ProjectConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleGenerate = () => {
    setShowModal(true);
  };

  const handleReset = () => {
    setConfig(createDefaultConfig());
    setShowModal(false);
  };

  return (
    <main className="app-container">
      {/* Left Pane - Form controls */}
      <div className="left-panel">
        <Configurator
          config={config}
          onChange={handleConfigChange}
          onGenerate={handleGenerate}
          onReset={handleReset}
        />
      </div>

      {/* Right Pane - Visual terminal code workspace */}
      <div className="right-panel">
        <TerminalPreview config={config} />
      </div>

      {/* Output review generation modal */}
      {showModal && (
        <OutputModal
          config={config}
          onClose={() => setShowModal(false)}
        />
      )}
    </main>
  );
}

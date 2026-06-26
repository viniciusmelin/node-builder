import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Configurator } from "@/components/Configurator";
import { makeBaseConfig } from "@/test/fixtures";

describe("Configurator unit behavior", () => {
  it("toggles API Pattern off when clicking selected option again", () => {
    const onChange = vi.fn();

    render(
      <Configurator
        config={makeBaseConfig({ apiPattern: "REST Express" })}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "REST Express" }));

    expect(onChange).toHaveBeenCalledWith({ apiPattern: null });
  });

  it("enables Dockerfile automatically when Docker Compose is enabled", () => {
    const onChange = vi.fn();

    render(
      <Configurator
        config={makeBaseConfig({ dockerfileEnabled: false, dockerComposeEnabled: false })}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Gerar Docker Compose" }));

    expect(onChange).toHaveBeenCalledWith({
      dockerComposeEnabled: true,
      dockerfileEnabled: true,
    });
  });

  it("resets messagingType when messaging is disabled", () => {
    const onChange = vi.fn();

    render(
      <Configurator
        config={makeBaseConfig({ messagingEnabled: true, messagingType: "BullMQ" })}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Habilitar mensageria" }));

    expect(onChange).toHaveBeenCalledWith({
      messagingEnabled: false,
      messagingType: null,
    });
  });

  it("adds and removes additional package chips", () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <Configurator
        config={makeBaseConfig({ additionalPackages: [] })}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "class-validator" }));
    expect(onChange).toHaveBeenCalledWith({ additionalPackages: ["class-validator"] });

    onChange.mockClear();

    rerender(
      <Configurator
        config={makeBaseConfig({ additionalPackages: ["class-validator"] })}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "class-validator" }));
    expect(onChange).toHaveBeenCalledWith({ additionalPackages: [] });
  });

  it("flags already included package as AUTO and disables manual selection", () => {
    const onChange = vi.fn();

    render(
      <Configurator
        config={makeBaseConfig({
          framework: "Simple TypeScript",
          security: "JWT Authentication",
          additionalPackages: [],
        })}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    const additionalPackagesTitle = screen.getByText("Additional Packages");
    const additionalPackagesSection = additionalPackagesTitle.closest("section");
    expect(additionalPackagesSection).not.toBeNull();

    const jwtChip = within(additionalPackagesSection as HTMLElement).getByRole("button", {
      name: /^jsonwebtoken\s*auto$/i,
    });
    expect(jwtChip).toBeDisabled();
    expect(within(jwtChip).getByText("AUTO")).toBeInTheDocument();

    fireEvent.click(jwtChip);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("selects a new framework option from segmented controls", () => {
    const onChange = vi.fn();

    render(
      <Configurator
        config={makeBaseConfig({ framework: "NestJS" })}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Hapi" }));
    expect(onChange).toHaveBeenCalledWith({ framework: "Hapi" });
  });

  it("disables generate button when required todo items are missing", () => {
    render(
      <Configurator
        config={makeBaseConfig({ framework: null, projectName: "", packageManager: null, nodeVersion: null })}
        onChange={vi.fn()}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /COMPLETE REQUIRED ITEMS/i })).toBeDisabled();
    expect(screen.getByText("INCOMPLETE")).toBeInTheDocument();
  });

  it("enables generate button when required todo items are completed", () => {
    render(
      <Configurator
        config={makeBaseConfig()}
        onChange={vi.fn()}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /REVIEW & GENERATE/i })).toBeEnabled();
    expect(screen.getByText("READY")).toBeInTheDocument();
  });

  it("applies SaaS API starter profile", () => {
    const onChange = vi.fn();

    render(
      <Configurator
        config={makeBaseConfig()}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /SaaS API/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        framework: "NestJS",
        apiPattern: "REST Fastify",
        database: "TypeORM",
        ciCdEnabled: true,
        dockerComposeEnabled: true,
      })
    );
  });

  it("applies Worker Queue starter profile", () => {
    const onChange = vi.fn();

    render(
      <Configurator
        config={makeBaseConfig()}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Worker Queue/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        framework: "Simple TypeScript",
        apiPattern: null,
        messagingEnabled: true,
        messagingType: "BullMQ",
      })
    );
  });

  it("applies BFF GraphQL starter profile", () => {
    const onChange = vi.fn();

    render(
      <Configurator
        config={makeBaseConfig()}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /BFF GraphQL/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        framework: "NestJS",
        apiPattern: "GraphQL Apollo",
        security: "JWT Authentication",
      })
    );
  });

  it("calls reset handler when clicking Resetar", () => {
    const onReset = vi.fn();

    render(
      <Configurator
        config={makeBaseConfig()}
        onChange={vi.fn()}
        onGenerate={vi.fn()}
        onReset={onReset}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Resetar/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("adds middleware option when selecting middleware chip", () => {
    const onChange = vi.fn();

    render(
      <Configurator
        config={makeBaseConfig({ middlewares: [] })}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Helmet Middleware/i }));

    expect(onChange).toHaveBeenCalledWith({
      middlewares: ["Helmet Middleware"],
    });
  });

  it("selects a plugin from the community registry", () => {
    const onChange = vi.fn();
    render(
      <Configurator
        config={makeBaseConfig({ templatePlugins: [] })}
        onChange={onChange}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Redis Data/i }));
    expect(onChange).toHaveBeenCalledWith({ templatePlugins: ["redis"] });
  });
});

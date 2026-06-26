import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home integration", () => {
  it("updates compose preview when enabling messaging with BullMQ", async () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Gerar Docker Compose" }));

    fireEvent.click(screen.getByRole("checkbox", { name: "Habilitar mensageria" }));

    fireEvent.click(screen.getByRole("button", { name: "BullMQ" }));

    const composeTreeLabel = screen.getAllByText("docker-compose.yml")[0];
    const composeTreeItem = composeTreeLabel.closest("li");
    expect(composeTreeItem).not.toBeNull();
    fireEvent.click(composeTreeItem!);

    const codePanel = document.querySelector(".editor-code-body");
    expect(codePanel?.textContent).toContain("image: redis:7-alpine");
    expect(codePanel?.textContent).toContain("MESSAGING_URL=redis://redis:6379");
    expect(codePanel?.textContent).toContain("depends_on:");
    expect(codePanel?.textContent).toContain("- redis");
  });

  it("opens generation modal and displays config JSON", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: /REVIEW & GENERATE/i }));

    expect(screen.getByText("Review & Generate Configuration")).toBeInTheDocument();
    expect(screen.getByText("CONFIG JSON")).toBeInTheDocument();
  });

  it("reflects additional package selection in package.json preview", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "class-validator" }));
    fireEvent.click(screen.getByText("package.json"));

    const codePanel = document.querySelector(".editor-code-body");
    expect(codePanel?.textContent).toContain('"class-validator": "^0.14.2"');
  });
});

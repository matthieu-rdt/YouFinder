import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "../src/app/page";

describe("Accueil", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("présente les limites et ne recherche pas au montage ou remontage", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const page = render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "YouFinder" })).toBeVisible();
    expect(screen.getByText(/ne représentent pas une analyse exhaustive/)).toBeVisible();
    expect(screen.getByText(/Un tri chronologique local est disponible sur les vidéos déjà chargées/)).toBeVisible();
    page.unmount();
    render(<Home />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("permet de consulter le health check via le proxy frontend", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Vérifier l’état de l’API" })).toHaveAttribute("href", "/api/health");
  });
});

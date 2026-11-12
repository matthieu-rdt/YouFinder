import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DailyAttempts } from "../src/components/daily-attempts";

describe("Plafond interne", () => {
  it("nomme la capacité restante et la distingue du quota Google", () => {
    render(<DailyAttempts remaining={7} limit={20} />);
    expect(screen.getByRole("meter", { name: "Tentatives YouFinder restantes" })).toHaveAttribute("value", "7");
    expect(screen.getByRole("meter")).toHaveAttribute("max", "20");
    expect(screen.getByText(/7 tentative.*sur 20/)).toBeVisible();
    expect(screen.getByText(/distinct du quota Google/)).toBeVisible();
  });
  it.each([{remaining: null, limit: null}, {remaining: null, limit: 20}, {remaining: 2, limit: null}, {remaining: 21, limit: 20}, {remaining: -1, limit: 20}])("ne fabrique pas de solde pour %j", props => {
    render(<DailyAttempts {...props} />);
    expect(screen.getByText(/Solde inconnu/)).toBeVisible();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
  it("gère un plafond nul sans jauge invalide", () => {
    render(<DailyAttempts remaining={0} limit={0} />);
    expect(screen.getByText(/Plafond interne nul/)).toBeVisible();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
  it.each([0, 20])("affiche la borne %i sans la remplacer", remaining => {
    render(<DailyAttempts remaining={remaining} limit={20} />);
    expect(screen.getByRole("meter")).toHaveAttribute("value", String(remaining));
  });
  it("masque une jauge périmée tout en conservant le dernier nombre connu", () => {
    render(<DailyAttempts remaining={7} limit={20} stale />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.getByText(/Dernier solde connu : 7/)).toBeVisible();
    expect(screen.getByText(/aucun rafraîchissement automatique/)).toBeVisible();
  });
  it("qualifie le solde pendant une requête", () => {
    render(<DailyAttempts remaining={7} limit={20} pending />);
    expect(screen.getByText(/Dernier solde connu/)).toBeVisible();
  });
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DailyAttempts } from "../src/components/daily-attempts";

type Props = Parameters<typeof DailyAttempts>[0];
function setup(props: Props) { return render(<dl><DailyAttempts {...props} /></dl>); }
function balance() { return within(screen.getByRole("definition")); }

describe("Plafond interne", () => {
  it("nomme la capacité restante et conserve le plafond exact sans panneau ni jauge", () => {
    const {container} = setup({remaining: 7, limit: 20});
    expect(screen.getByRole("definition", { name: "Tentatives YouFinder restantes" })).toBeVisible();
    expect(balance().getByText("7")).toBeVisible();
    expect(balance().getByText("sur 20 aujourd’hui")).toBeVisible();
    expect(balance().getByText(/Solde de la dernière réponse/)).toBeVisible();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(container.querySelector('.panel')).not.toBeInTheDocument();
  });
  it.each([{remaining: null, limit: null}, {remaining: null, limit: 20}, {remaining: 2, limit: null}, {remaining: 21, limit: 20}, {remaining: -1, limit: 20},
    {remaining: 1.5, limit: 20}, {remaining: 1, limit: 20.5}, {remaining: NaN, limit: 20}, {remaining: 1, limit: Infinity},
    {remaining: Number.MAX_SAFE_INTEGER + 1, limit: Number.MAX_SAFE_INTEGER + 1}, {remaining: 0, limit: -1},
  ])("ne fabrique pas de solde pour %j", props => {
    setup(props);
    expect(balance().getByText(/Solde inconnu/)).toBeVisible();
    expect(balance().queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
  it("gère un plafond nul sans jauge invalide", () => {
    setup({remaining: 0, limit: 0});
    expect(balance().getByText("0")).toBeVisible();
    expect(balance().getByText("sur 0 aujourd’hui")).toBeVisible();
    expect(balance().getByText(/Plafond interne nul/)).toBeVisible();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
  it.each([0, 20, Number.MAX_SAFE_INTEGER])("affiche la borne %i sans la remplacer", remaining => {
    setup({remaining, limit: remaining > 20 ? remaining : 20});
    expect(balance().getByText(String(remaining))).toBeVisible();
  });
  it("qualifie le solde périmé tout en conservant le dernier nombre connu", () => {
    setup({remaining: 7, limit: 20, stale: true});
    expect(balance().getByText("7")).toBeVisible();
    expect(balance().getByText(/Dernier solde connu/)).toBeVisible();
    expect(balance().getByText(/peut être périmé après une erreur/)).toBeVisible();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
  it("qualifie le solde pendant une requête", () => {
    setup({remaining: 7, limit: 20, pending: true});
    expect(balance().getByText("7")).toBeVisible();
    expect(balance().getByText(/Dernier solde connu/)).toBeVisible();
    expect(balance().queryByText(/périmé/)).not.toBeInTheDocument();
  });
  it("conserve le message de plafond nul même si le solde est périmé", () => {
    setup({remaining: 0, limit: 0, stale: true});
    expect(balance().getByText(/Plafond interne nul/)).toBeVisible();
    expect(balance().getByText(/périmé/)).toBeVisible();
  });
});

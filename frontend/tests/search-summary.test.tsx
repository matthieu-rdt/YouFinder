import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchSummary } from "../src/components/search-summary";

const result = { examined_count: 100, retained_count: 33, filtered_out_count: 67, omitted_count: 2, searches_remaining: 7, daily_limit: 20 };
function metric(label: string) { return screen.getByRole("definition", { name: label }).parentElement!; }
describe("Synthèse du traitement", () => {
  it("sépare cumuls, uniques, omissions et solde dans un seul panneau sans recalcul", () => {
    const { container } = render(<SearchSummary result={result} uniqueCount={29} />);
    for (const [label, value] of [["Vidéos examinées", "100"], ["Vidéos retenues", "33"], ["Vidéos uniques affichées", "29"], ["Tentatives YouFinder restantes", "7"]]) {
      expect(within(metric(label)).getByText(value)).toBeVisible();
    }
    expect(screen.getAllByRole("term")).toHaveLength(4);
    expect(screen.getAllByRole("definition")).toHaveLength(4);
    expect(screen.getByText(/Vidéos écartées/).parentElement).toHaveTextContent("Vidéos écartées : 67 par les filtres");
    expect(screen.getByText(/2 vidéo.*ont été omises/)).toHaveTextContent(/distinctes des exclusions/);
    expect(screen.getByText(/avant déduplication/)).toHaveTextContent(/doublons entre pages/);
    expect(screen.getByText(/sur 20 aujourd’hui/)).toBeVisible();
    expect(screen.getByText(/distinct du quota Google/)).toHaveTextContent(/Europe\/Paris/);
    expect(screen.getByText(/Une page demandée/)).toHaveTextContent(/aucun rafraîchissement automatique/);
    expect(container.querySelectorAll('.panel')).toHaveLength(1);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText(/Page 2/)).not.toBeInTheDocument();
  });
  it.each([{examined_count: 0, retained_count: 0, filtered_out_count: 0}, {examined_count: 50, retained_count: 50, filtered_out_count: 0}, {examined_count: 50, retained_count: 0, filtered_out_count: 50}])("représente les limites %j", counts => {
    const { container } = render(<SearchSummary result={{...result, ...counts, omitted_count: 0}} uniqueCount={counts.retained_count} />);
    expect(within(metric("Vidéos examinées")).getByText(String(counts.examined_count))).toBeVisible();
    expect(within(metric("Vidéos retenues")).getByText(String(counts.retained_count))).toBeVisible();
    expect(within(metric("Vidéos uniques affichées")).getByText(String(counts.retained_count))).toBeVisible();
    expect(screen.getByText("Vidéos écartées").parentElement).toHaveTextContent(`: ${counts.filtered_out_count} par les filtres`);
    expect(screen.queryByText(/ont été omises/)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    const bars = container.querySelectorAll('[aria-hidden="true"]');
    expect(bars).toHaveLength(counts.examined_count ? 1 : 0);
    if (!counts.examined_count) expect(screen.getByText(/Aucune vidéo examinée/)).toBeVisible();
    else {
      expect(bars[0].children[0]).toHaveStyle({width: counts.retained_count ? "100%" : "0%"});
      expect(bars[0].children[1]).toHaveStyle({width: counts.filtered_out_count ? "100%" : "0%"});
    }
  });
  it("conserve les qualifications du solde dans la synthèse", () => {
    render(<SearchSummary result={result} uniqueCount={29} stale pending />);
    const balance = within(metric("Tentatives YouFinder restantes"));
    expect(balance.getByText("7")).toBeVisible();
    expect(balance.getByText(/Dernier solde connu/)).toBeVisible();
    expect(balance.getByText(/périmé après une erreur/)).toBeVisible();
  });
});

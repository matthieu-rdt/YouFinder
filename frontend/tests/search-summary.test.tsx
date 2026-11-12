import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchSummary } from "../src/components/search-summary";

const result = { examined_count: 100, retained_count: 33, filtered_out_count: 67, omitted_count: 2 };
function metric(label: string) { return screen.getByText(label).parentElement!; }
describe("Synthèse du traitement", () => {
  it("sépare cumuls, uniques, omissions et pages sans recalculer les compteurs", () => {
    render(<SearchSummary result={result} uniqueCount={29} pages={2} />);
    for (const [label, value] of [["Vidéos examinées", "100"], ["Vidéos retenues", "33"], ["Vidéos écartées", "67"], ["Vidéos uniques affichées", "29"]]) {
      expect(within(metric(label)).getByText(value)).toBeVisible();
    }
    expect(screen.getByText(/2 vidéo.*ont été omises/)).toBeVisible();
    expect(screen.getByText(/Page 2 : chargée/)).toBeVisible();
    expect(screen.getByText(/avant déduplication/)).toBeVisible();
  });
  it.each([{examined_count: 0, retained_count: 0, filtered_out_count: 0}, {examined_count: 50, retained_count: 50, filtered_out_count: 0}, {examined_count: 50, retained_count: 0, filtered_out_count: 50}])("représente les limites %j", counts => {
    const { container } = render(<SearchSummary result={{...counts, omitted_count: 0}} uniqueCount={counts.retained_count} pages={1} />);
    expect(screen.getByText(/Page 2 : non chargée/)).toBeVisible();
    expect(screen.queryByText(/ont été omises/)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    if (!counts.examined_count) expect(screen.getByText(/Aucune vidéo examinée/)).toBeVisible();
    else expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

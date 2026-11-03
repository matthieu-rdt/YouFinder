import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoSearch } from "../src/components/video-search";
import type { Video } from "../src/lib/youtube";

// Données entièrement simulées, uniquement utilisées par les tests.
const video: Video = {
  id: "simulated", title: "Titre simulé", thumbnail_url: null,
  channel_id: "simulated-channel", channel_title: "Chaîne simulée",
  channel_url: "https://www.youtube.com/channel/simulated-channel",
  published_at: "2026-01-01T00:00:00Z", view_count: "0",
  subscriber_count: null, subscribers_hidden: null,
  duration_iso: "PT15M33S", duration_label: "15:33", broadcast_status: "none",
  youtube_url: "https://www.youtube.com/watch?v=simulated",
};

function setup(fetchMock = vi.fn()) {
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<VideoSearch />);
  fireEvent.change(screen.getByRole("textbox", { name: "Mot-clé" }), { target: { value: "python" } });
  return { ...view, fetchMock, form: view.container.querySelector("form")! };
}

function accept() {
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("Recherche", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("attend l’acceptation avant toute recherche", () => {
    const { form, fetchMock } = setup();
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envoie les dates UTC et affiche les résultats dans l’ordre reçu", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      items: [video, { ...video, id: "second", title: "Deuxième résultat" }],
      searches_remaining: 19, daily_limit: 20, omitted_count: 1, examined_count: 2, retained_count: 2, filtered_out_count: 0, notice: "Recherche non exhaustive.",
    }) });
    const { form } = setup(fetchMock);
    accept();
    fireEvent.change(screen.getByLabelText("Publié à partir du (UTC)"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Publié jusqu’au (UTC, jour inclus)"), { target: { value: "2026-02-01" } });
    fireEvent.submit(form);
    expect(await screen.findByRole("heading", { name: "Titre simulé" })).toBeVisible();
    const url = new URL(fetchMock.mock.calls[0][0], "http://test");
    expect(url.searchParams.get("q")).toBe("python");
    expect(url.searchParams.has("min_views")).toBe(false);
    expect(url.searchParams.has("max_subscribers")).toBe(false);
    expect(url.searchParams.has("min_duration_minutes")).toBe(false);
    expect(url.searchParams.get("published_after")).toBe("2026-01-01T00:00:00Z");
    expect(url.searchParams.get("published_before")).toBe("2026-02-02T00:00:00Z");
    expect(fetchMock.mock.calls[0][1]).toEqual({ cache: "no-store" });
    expect(screen.getAllByRole("heading").map(node => node.textContent)).toEqual(["Titre simulé", "Deuxième résultat"]);
    expect(screen.getAllByText("Indisponible")).toHaveLength(2);
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.getAllByText("15:33")).toHaveLength(2);
    expect(screen.getByText(/19 tentative/)).toBeVisible();
    expect(screen.getByText(/ont été omises/)).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Voir sur YouTube ↗" })[0]).toHaveAttribute("href", video.youtube_url);
  });

  it("affiche les résultats vides", async () => {
    const { form } = setup(vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], searches_remaining: 19, daily_limit: 20, omitted_count: 0, examined_count: 0, retained_count: 0, filtered_out_count: 0, notice: "Recherche non exhaustive." }) }));
    accept();
    fireEvent.submit(form);
    expect(await screen.findByText(/Aucune vidéo ne correspond/)).toBeVisible();
  });

  it.each(["Quota Google YouTube épuisé.", "Plafond quotidien YouFinder atteint.", "La recherche YouTube n’est pas configurée côté backend."])("affiche l’erreur sans retry : %s", async message => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message } }) });
    const { form } = setup(fetchMock);
    accept();
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("affiche une erreur réseau sans retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    const { form } = setup(fetchMock);
    accept();
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Connexion à l’application impossible/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuse les espaces et les dates inversées sans appeler le backend", () => {
    const { form, fetchMock } = setup();
    accept();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "python" } });
    fireEvent.change(screen.getByLabelText("Publié à partir du (UTC)"), { target: { value: "2026-02-01" } });
    fireEvent.change(screen.getByLabelText("Publié jusqu’au (UTC, jour inclus)"), { target: { value: "2026-01-01" } });
    fireEvent.submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloque les doubles soumissions pendant la requête", async () => {
    let resolve!: (value: unknown) => void;
    const fetchMock = vi.fn(() => new Promise(r => { resolve = r; }));
    const { form } = setup(fetchMock);
    accept();
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, json: async () => ({ items: [], daily_limit: 20, searches_remaining: 19, omitted_count: 0, examined_count: 0, retained_count: 0, filtered_out_count: 0, notice: "Recherche non exhaustive." }) }));
    await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
  });
});


it("transmet les filtres combinés sans perte de précision et les conserve après résultat vide et erreur", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ok: true, json: async () => ({items: [], examined_count: 10, retained_count: 0, filtered_out_count: 10, omitted_count: 0, daily_limit: 20, searches_remaining: 19, notice: "Recherche non exhaustive."})}).mockRejectedValueOnce(new Error("offline"));
  const {form} = setup(fetchMock);
  accept();
  const values = [["Vues minimum", "9007199254740993"], ["Abonnés maximum", "0"], ["Durée minimum (minutes)", "10"]];
  for (const [label, value] of values) fireEvent.change(screen.getByLabelText(label), {target: {value}});
  fireEvent.submit(form);
  expect(await screen.findByText(/10 vidéo\(s\) examinée/)).toBeVisible();
  expect(screen.getByText("Recherche non exhaustive.")).toBeVisible();
  const params = new URL(fetchMock.mock.calls[0][0], "http://test").searchParams;
  expect(params.get("min_views")).toBe("9007199254740993");
  expect(params.get("max_subscribers")).toBe("0");
  expect(params.get("min_duration_minutes")).toBe("10");
  expect((screen.getByLabelText("Vues minimum") as HTMLInputElement).value).toBe("9007199254740993");
  fireEvent.submit(form);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect((screen.getByLabelText("Durée minimum (minutes)") as HTMLInputElement).value).toBe("10");
});

it.each(["-1", "1.5"])("refuse un filtre invalide : %s", value => {
  const {form, fetchMock} = setup();
  accept();
  fireEvent.change(screen.getByLabelText("Vues minimum"), {target: {value}});
  fireEvent.submit(form);
  expect(screen.getByRole("alert")).toBeVisible();
  expect(fetchMock).not.toHaveBeenCalled();
});


it.each(["2026-07-07", "2026-06-01"])("sérialise la période inclusive du 01/06/2026 au %s avec les autres filtres", async end => {
  const {form, fetchMock} = setup(vi.fn().mockResolvedValue({ok: true, json: async () => ({items: [], examined_count: 10, retained_count: 0, filtered_out_count: 10, omitted_count: 0, daily_limit: 20, searches_remaining: 19, notice: "Recherche non exhaustive."})}));
  accept();
  fireEvent.change(screen.getByLabelText("Publié à partir du (UTC)"), {target: {value: "2026-06-01"}});
  fireEvent.change(screen.getByLabelText("Publié jusqu’au (UTC, jour inclus)"), {target: {value: end}});
  fireEvent.change(screen.getByLabelText("Vues minimum"), {target: {value: "10000"}});
  fireEvent.change(screen.getByLabelText("Durée minimum (minutes)"), {target: {value: "3"}});
  fireEvent.submit(form);
  expect(await screen.findByText(/Aucune vidéo ne correspond/)).toBeVisible();
  const params = new URL(fetchMock.mock.calls[0][0], "http://test").searchParams;
  expect(params.get("published_after")).toBe("2026-06-01T00:00:00Z");
  expect(params.get("published_before")).toBe(end === "2026-07-07" ? "2026-07-08T00:00:00Z" : "2026-06-02T00:00:00Z");
  expect(params.get("min_views")).toBe("10000");
  expect(params.get("min_duration_minutes")).toBe("3");
  expect(params.has("max_subscribers")).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

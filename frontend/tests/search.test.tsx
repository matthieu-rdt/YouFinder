import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function metric(label: string) {
  return within(screen.getByText(label, {selector: "dt"}).parentElement!);
}
function expectCount(label: string, value: number) {
  expect(metric(label).getByText(String(value), {exact: true})).toBeVisible();
}
function expectProcessing(examined: number, retained: number, filtered: number) {
  expectCount("Vidéos examinées", examined);
  expectCount("Vidéos retenues", retained);
  expect(screen.getByText("Vidéos écartées").parentElement).toHaveTextContent(`: ${filtered} par les filtres`);
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
      searches_remaining: 19, daily_limit: 20, omitted_count: 1, examined_count: 2, retained_count: 2, filtered_out_count: 0, next_page_token: null, next_page_signature: null, page_number: 1, notice: "Recherche non exhaustive.",
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
    expect(screen.getAllByRole("heading", { level: 3 }).map(node => node.textContent)).toEqual(["Titre simulé", "Deuxième résultat"]);
    expect(screen.getAllByText("Indisponible")).toHaveLength(2);
    expect(screen.getAllByRole("row").slice(1).map(row => within(row).getByRole("cell", { name: "0" }))).toHaveLength(2);
    expect(screen.getAllByText("15:33")).toHaveLength(2);
    expectCount("Tentatives YouFinder restantes", 19);
    expect(screen.getByText(/ont été omises/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Titre simulé" })).toHaveAttribute("href", video.youtube_url);
  });

  it("affiche les résultats vides", async () => {
    const { form } = setup(vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], searches_remaining: 19, daily_limit: 20, omitted_count: 0, examined_count: 0, retained_count: 0, filtered_out_count: 0, next_page_token: null, next_page_signature: null, page_number: 1, notice: "Recherche non exhaustive." }) }));
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
    await act(async () => resolve({ ok: true, json: async () => ({ items: [], daily_limit: 20, searches_remaining: 19, omitted_count: 0, examined_count: 0, retained_count: 0, filtered_out_count: 0, next_page_token: null, next_page_signature: null, page_number: 1, notice: "Recherche non exhaustive." }) }));
    await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
  });
});


it("transmet les filtres combinés sans perte de précision et les conserve après résultat vide et erreur", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ok: true, json: async () => ({items: [], examined_count: 10, retained_count: 0, filtered_out_count: 10, omitted_count: 0, daily_limit: 20, searches_remaining: 19, next_page_token: null, next_page_signature: null, page_number: 1, notice: "Recherche non exhaustive."})}).mockRejectedValueOnce(new Error("offline"));
  const {form} = setup(fetchMock);
  accept();
  const values = [["Vues minimum", "9007199254740993"], ["Abonnés maximum", "0"], ["Durée minimum (minutes)", "10"]];
  for (const [label, value] of values) fireEvent.change(screen.getByLabelText(label), {target: {value}});
  fireEvent.submit(form);
  await screen.findByRole("region", {name: "Synthèse des pages traitées"});
  expectProcessing(10, 0, 10);
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
  const {form, fetchMock} = setup(vi.fn().mockResolvedValue({ok: true, json: async () => ({items: [], examined_count: 10, retained_count: 0, filtered_out_count: 10, omitted_count: 0, daily_limit: 20, searches_remaining: 19, next_page_token: null, next_page_signature: null, page_number: 1, notice: "Recherche non exhaustive."})}));
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

const nextLabel = "Charger 50 vidéos supplémentaires";
const signature = "a".repeat(64);
function page(items: Video[], options: Record<string, unknown> = {}) {
  return { ok: true, json: async () => ({
    items, examined_count: items.length, retained_count: items.length,
    filtered_out_count: 0, omitted_count: 0, daily_limit: 20, searches_remaining: 19,
    next_page_token: null, next_page_signature: null, page_number: 1,
    notice: "Recherche non exhaustive.", ...options,
  }) };
}
async function firstPage(fetchMock: ReturnType<typeof vi.fn<() => unknown>>) {
  const view = setup(fetchMock);
  expect(fetchMock).not.toHaveBeenCalled();
  accept();
  fireEvent.submit(view.form);
  await screen.findByText(/1 page\(s\) chargée/);
  return view;
}

it("charge exactement deux pages manuelles, déduplique et cumule sans confondre vidéos uniques", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([video], {next_page_token: "opaque+/= token", next_page_signature: signature}))
    .mockResolvedValueOnce(page([video, {...video, id: "second", title: "Deuxième"}], {
      page_number: 2, searches_remaining: 18, next_page_token: "third", next_page_signature: signature,
    }));
  const {form} = await firstPage(fetchMock);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("textbox"), {target: {value: "new criteria"}});
  fireEvent.change(screen.getByLabelText("Vues minimum"), {target: {value: "100"}});
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expect(await screen.findByText(/2 page\(s\) chargée/)).toBeVisible();
  expectProcessing(3, 3, 0);
  expectCount("Vidéos uniques affichées", 2);
  expect(screen.getAllByRole("heading", { level: 3 }).map(node => node.textContent)).toEqual(["Titre simulé", "Deuxième"]);
  const params = new URL(fetchMock.mock.calls[1][0], "http://test").searchParams;
  expect(params.get("page_token")).toBe("opaque+/= token");
  expect(params.get("page_signature")).toBe(signature);
  expect(params.get("q")).toBe("python");
  expect(params.has("min_views")).toBe(false);
  expect(screen.queryByRole("button", {name: nextLabel})).not.toBeInTheDocument();
  expect(screen.getByText(/Limite de deux pages atteinte/)).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  // Nouvelle soumission : critères mis à jour, aucun ancien jeton et compteurs réinitialisés.
  fetchMock.mockResolvedValueOnce(page([], {examined_count: 4, filtered_out_count: 4}));
  fireEvent.submit(form);
  await screen.findByText(/1 page\(s\) chargée/);
  const fresh = new URL(fetchMock.mock.calls[2][0], "http://test").searchParams;
  expect(fresh.get("q")).toBe("new criteria");
  expect(fresh.get("min_views")).toBe("100");
  expect(fresh.has("page_token")).toBe(false);
  expectProcessing(4, 0, 4);
  expect(screen.queryByRole("heading", {name: "Titre simulé"})).not.toBeInTheDocument();
});

it("continue après une page entièrement filtrée puis termine sans jeton", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([], {examined_count: 50, filtered_out_count: 50, next_page_token: "next", next_page_signature: signature}))
    .mockResolvedValueOnce(page([], {page_number: 2, examined_count: 50, filtered_out_count: 50, searches_remaining: 18}));
  await firstPage(fetchMock);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  await screen.findByText(/2 page\(s\) chargée/);
  expectProcessing(100, 0, 100);
  expectCount("Vidéos uniques affichées", 0);
  expect(screen.queryByRole("button", {name: nextLabel})).not.toBeInTheDocument();
});

it("termine dès la première page sans jeton et ne recherche pas au remontage", async () => {
  const fetchMock = vi.fn().mockResolvedValue(page([video]));
  const {unmount} = await firstPage(fetchMock);
  expect(screen.getByText(/Fin de pagination/)).toBeVisible();
  expect(screen.queryByRole("button", {name: nextLabel})).not.toBeInTheDocument();
  unmount();
  render(<VideoSearch />);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each(["daily_limit_reached", "youtube_quota_exceeded", "invalid_page_token"])("conserve les résultats et bloque la continuation : %s", async code => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([video], {next_page_token: "next", next_page_signature: signature}))
    .mockResolvedValueOnce({ok: false, json: async () => ({error: {code, message: "Erreur simulée"}})});
  await firstPage(fetchMock);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Erreur simulée");
  expect(screen.getByRole("heading", {name: "Titre simulé"})).toBeVisible();
  expect(screen.getByText(/1 page\(s\) chargée/)).toBeVisible();
  expect(screen.getByRole("button", {name: nextLabel})).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("désactive la deuxième page si le solde de la première est nul", async () => {
  const fetchMock = vi.fn().mockResolvedValue(page([video], {next_page_token: "next", next_page_signature: signature, searches_remaining: 0}));
  await firstPage(fetchMock);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expect(screen.getByRole("button", {name: nextLabel})).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("conserve résultats et jeton après erreur réseau et autorise uniquement une reprise manuelle", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([video], {next_page_token: "next", next_page_signature: signature}))
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(page([], {page_number: 2, searches_remaining: 17}));
  await firstPage(fetchMock);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expect(await screen.findByRole("alert")).toHaveTextContent(/solde affiché peut être périmé/);
  expect(screen.getByRole("heading", {name: "Titre simulé"})).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  await screen.findByText(/2 page\(s\) chargée/);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[2][0]).toBe(fetchMock.mock.calls[1][0]);
});

it("bloque un double clic de continuation et une nouvelle soumission concurrente", async () => {
  let resolve!: (value: unknown) => void;
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([video], {next_page_token: "next", next_page_signature: signature}))
    .mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const {form} = await firstPage(fetchMock);
  const button = screen.getByRole("button", {name: nextLabel});
  fireEvent.click(button);
  fireEvent.click(button);
  fireEvent.submit(form);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("heading", {name: "Titre simulé"})).toBeVisible();
  expect(button).toBeDisabled();
  await act(async () => resolve(page([], {page_number: 2})));
  expect(screen.getByText(/2 page\(s\) chargée/)).toBeVisible();
});

it("arrête un jeton répété après la deuxième page", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([video], {next_page_token: "same", next_page_signature: signature}))
    .mockResolvedValueOnce(page([], {page_number: 2, next_page_token: "same", next_page_signature: signature}));
  await firstPage(fetchMock);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expect(await screen.findByRole("alert")).toHaveTextContent(/répété/);
  expect(screen.queryByRole("button", {name: nextLabel})).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each([
  {next_page_token: "", next_page_signature: signature},
  {next_page_token: 123, next_page_signature: signature},
  {next_page_token: "next", next_page_signature: null},
  {examined_count: -1}, {page_number: 3}, {items: [{id: "invalid"}]},
])("préserve la page précédente en cas de réponse invalide : %j", async invalid => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([video], {next_page_token: "next", next_page_signature: signature}))
    .mockResolvedValueOnce(page([], {page_number: 2, ...invalid}));
  await firstPage(fetchMock);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Réponse de recherche invalide/);
  expect(screen.getByRole("heading", {name: "Titre simulé"})).toBeVisible();
  expect(screen.getByText(/1 page\(s\) chargée/)).toBeVisible();
});

function expectResultPositions(count: number) {
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows).toHaveLength(count);
  expect(rows.map(row => row.querySelector(".video-results-position")?.textContent))
    .toEqual(Array.from({length: count}, (_, index) => String(index + 1)));
}

it("affiche 100 vidéos au maximum en conservant l’ordre de deux pages de 50", async () => {
  const makeVideos = (start: number) => Array.from({length: 50}, (_, index) => ({...video, id: String(start + index), title: `Vidéo ${start + index}`}));
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page(makeVideos(0), {next_page_token: "next", next_page_signature: signature}))
    .mockResolvedValueOnce(page(makeVideos(50), {page_number: 2, searches_remaining: 18}));
  await firstPage(fetchMock);
  expectResultPositions(50);
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(50);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  await screen.findByText(/2 page\(s\) chargée/);
  expectResultPositions(100);
  expect(screen.getAllByRole("heading", { level: 3 }).map(node => node.textContent)).toEqual(Array.from({length: 100}, (_, index) => `Vidéo ${index}`));
  expectCount("Vidéos uniques affichées", 100);
  expect(screen.queryByRole("button", {name: nextLabel})).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

const sortLabel = "Trier les vidéos chargées";
const withDate = (id: string, published_at: string | null): Video => ({ ...video, id, title: id, published_at });
const titles = () => screen.getAllByRole("heading", { level: 3 }).map(node => node.textContent);
function chooseSort(value: string) {
  fireEvent.change(screen.getByRole("combobox", {name: sortLabel}), {target: {value}});
}

it("trie localement les trois modes sans appel, soumission ou changement de compteur", async () => {
  const source = [withDate("middle", "2026-06-01T00:00:00Z"), withDate("old", "2025-01-01T00:00:00Z"), withDate("new", "2026-12-01T00:00:00Z")];
  const fetchMock = vi.fn().mockResolvedValue(page(source, {examined_count: 5, filtered_out_count: 2, omitted_count: 1}));
  await firstPage(fetchMock);
  const select = screen.getByRole("combobox", {name: sortLabel});
  expect(select).toHaveValue("relevance");
  expect(select.closest("form")).toBeNull();
  expect(select).toHaveAccessibleDescription(/Tri local des vidéos déjà chargées/);
  expect(screen.getByText(/pas une recherche exhaustive par date/)).toBeVisible();
  const counts = screen.getByRole("region", {name: "Synthèse des pages traitées"}).textContent;
  for (const [mode, expected] of [["date-desc", ["new", "middle", "old"]], ["date-asc", ["old", "middle", "new"]], ["relevance", ["middle", "old", "new"]]] as const) {
    chooseSort(mode);
    expect(titles()).toEqual(expected);
    expectResultPositions(3);
    expect(screen.getByRole("region", {name: "Synthèse des pages traitées"}).textContent).toBe(counts);
    expectCount("Vidéos uniques affichées", 3);
    expect(screen.getByText(/1 vidéo\(s\) devenue/)).toBeVisible();
    expectCount("Tentatives YouFinder restantes", 19);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }
  expect(new URL(fetchMock.mock.calls[0][0], "http://test").searchParams.toString()).toBe("q=python");
});

it.each([
  ["date-desc", ["new", "equal-first", "equal-second", "old", "missing", "invalid"]],
  ["date-asc", ["old", "equal-first", "equal-second", "new", "missing", "invalid"]],
] as const)("conserve %s après page 2, égalités et doublons, puis restaure la pertinence", async (mode, expected) => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([
      withDate("equal-first", "2026-06-01T00:00:00Z"), withDate("missing", null), withDate("old", "2025-01-01T00:00:00Z"),
    ], {next_page_token: "next", next_page_signature: signature}))
    .mockResolvedValueOnce(page([
      withDate("old", "2027-01-01T00:00:00Z"), // Le doublon ne remplace pas la première occurrence.
      withDate("new", "2026-12-01T00:00:00Z"), withDate("equal-second", "2026-06-01T02:00:00+02:00"), withDate("invalid", "bad"),
    ], {page_number: 2, searches_remaining: 18}));
  await firstPage(fetchMock);
  chooseSort(mode);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  await screen.findByText(/2 page\(s\) chargée/);
  expect(screen.getByRole("combobox", {name: sortLabel})).toHaveValue(mode);
  expect(titles()).toEqual(expected);
  expectResultPositions(6);
  expectProcessing(7, 7, 0);
  expectCount("Vidéos uniques affichées", 6);
  expectCount("Tentatives YouFinder restantes", 18);
  expect(screen.queryByRole("button", {name: nextLabel})).not.toBeInTheDocument();
  chooseSort("relevance");
  expect(titles()).toEqual(["equal-first", "missing", "old", "new", "equal-second", "invalid"]);
  expectResultPositions(6);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const params = new URL(fetchMock.mock.calls[1][0], "http://test").searchParams;
  expect([...params.keys()]).toEqual(["q", "page_token", "page_signature"]);
});

it("utilise le dernier mode choisi pendant une continuation en attente", async () => {
  let resolve!: (value: unknown) => void;
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([withDate("middle", "2026-06-01T00:00:00Z")], {next_page_token: "next", next_page_signature: signature}))
    .mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await firstPage(fetchMock);
  chooseSort("date-desc");
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expect(screen.getByRole("combobox", {name: sortLabel})).toBeEnabled();
  chooseSort("date-asc");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async () => resolve(page([withDate("old", "2025-01-01T00:00:00Z"), withDate("new", "2026-12-01T00:00:00Z")], {page_number: 2})));
  expect(titles()).toEqual(["old", "middle", "new"]);
  expect(screen.getByRole("combobox", {name: sortLabel})).toHaveValue("date-asc");
});

it.each(["network", "quota"])("préserve le tri après erreur de continuation : %s", async failure => {
  const fetchMock = vi.fn().mockResolvedValueOnce(page([
    withDate("old", "2025-01-01T00:00:00Z"), withDate("new", "2026-12-01T00:00:00Z"),
  ], {next_page_token: "next", next_page_signature: signature}));
  if (failure === "network") fetchMock.mockRejectedValueOnce(new TypeError("offline"));
  else fetchMock.mockResolvedValueOnce({ok: false, json: async () => ({error: {code: "daily_limit_reached", message: "Quota simulé"}})});
  await firstPage(fetchMock);
  chooseSort("date-desc");
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  await screen.findByRole("alert");
  expect(titles()).toEqual(["new", "old"]);
  expect(screen.getByRole("combobox", {name: sortLabel})).toHaveValue("date-desc");
  chooseSort("date-asc");
  expect(titles()).toEqual(["old", "new"]);
  expectProcessing(2, 2, 0);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("conserve le mode après une nouvelle recherche et repart en pertinence au remontage", async () => {
  const source = [withDate("old", "2025-01-01T00:00:00Z"), withDate("new", "2026-12-01T00:00:00Z")];
  const fetchMock = vi.fn().mockResolvedValue(page(source));
  const {form, unmount} = await firstPage(fetchMock);
  chooseSort("date-desc");
  fireEvent.change(screen.getByRole("textbox", {name: "Mot-clé"}), {target: {value: "typescript"}});
  fireEvent.submit(form);
  await screen.findByRole("combobox", {name: sortLabel});
  expect(titles()).toEqual(["new", "old"]);
  expect(screen.getByRole("combobox", {name: sortLabel})).toHaveValue("date-desc");
  expect(screen.getByText(/1 page\(s\) chargée/)).toBeVisible();
  expectProcessing(2, 2, 0);
  expect(new URL(fetchMock.mock.calls[1][0], "http://test").searchParams.toString()).toBe("q=typescript");
  unmount();
  const fresh = render(<VideoSearch />);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fireEvent.change(screen.getByRole("textbox", {name: "Mot-clé"}), {target: {value: "python"}});
  accept();
  fireEvent.submit(fresh.container.querySelector("form")!);
  await screen.findByRole("combobox", {name: sortLabel});
  expect(screen.getByRole("combobox", {name: sortLabel})).toHaveValue("relevance");
  expect(titles()).toEqual(["old", "new"]);
});

it("conserve le mode sur une page entièrement filtrée et trie la seconde", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([], {examined_count: 50, filtered_out_count: 50, next_page_token: "next", next_page_signature: signature}))
    .mockResolvedValueOnce(page([withDate("old", "2025-01-01T00:00:00Z"), withDate("new", "2026-12-01T00:00:00Z")], {page_number: 2, searches_remaining: 18}));
  await firstPage(fetchMock);
  chooseSort("date-desc");
  expect(screen.getByText(/Aucune vidéo ne correspond/)).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  await screen.findByText(/2 page\(s\) chargée/);
  expect(titles()).toEqual(["new", "old"]);
  expectProcessing(52, 2, 50);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("regroupe les filtres et associe les aides sans appel automatique", () => {
  const {fetchMock} = setup();
  fireEvent.click(screen.getByText(/Filtres avancés — 0 critères renseignés/));
  const group = screen.getByRole("group", {name: "Filtres avancés — facultatifs"});
  expect(within(group).getByLabelText("Publié jusqu’au (UTC, jour inclus)")).toHaveAccessibleDescription(/jour de fin est inclus/);
  expect(within(group).getByLabelText("Abonnés maximum")).toHaveAccessibleDescription(/trois chiffres significatifs/);
  expect(screen.getByRole("textbox", {name: "Mot-clé"})).toHaveAccessibleDescription(/1 à 200/);
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("garde un seul bouton de continuation avant le tableau et des annonces séparées", async () => {
  const fetchMock = vi.fn().mockResolvedValue(page([video], {next_page_token: "next", next_page_signature: signature}));
  await firstPage(fetchMock);
  const buttons = screen.getAllByRole("button", {name: nextLabel});
  const table = screen.getByRole("table", {name: "Résultats des pages chargées"});
  expect(buttons).toHaveLength(1);
  expect(buttons[0].compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("combobox", {name: sortLabel}).compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(table.closest('[aria-live]')).toBeNull();
  expect(screen.getByRole("status")).not.toContainElement(table);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("qualifie le solde après erreur et pendant la reprise, puis l’actualise sur succès", async () => {
  let resolve!: (value: unknown) => void;
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([video], {next_page_token: "next", next_page_signature: signature}))
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockImplementationOnce(() => new Promise(r => {resolve = r;}));
  await firstPage(fetchMock);
  expectCount("Tentatives YouFinder restantes", 19);
  expect(metric("Tentatives YouFinder restantes").getByText(/Solde de la dernière réponse/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  await screen.findByRole("alert");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  expectCount("Tentatives YouFinder restantes", 19);
  expect(metric("Tentatives YouFinder restantes").getByText(/Dernier solde connu/)).toBeVisible();
  expect(metric("Tentatives YouFinder restantes").getByText(/périmé/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expect(screen.getByRole("status")).toHaveTextContent(/deuxième page/);
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  expect(screen.getByRole("button", {name: "Rechercher sur YouTube"})).toBeDisabled();
  await act(async () => resolve(page([video], {page_number: 2, searches_remaining: 17})));
  expectCount("Tentatives YouFinder restantes", 17);
  expect(metric("Tentatives YouFinder restantes").getByText(/Solde de la dernière réponse/)).toBeVisible();
  expect(metric("Tentatives YouFinder restantes").queryByText(/périmé/)).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("restaure le focus du bouton disparu vers le résumé, puis permet de rejoindre le tri", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([video], {next_page_token: "next", next_page_signature: signature}))
    .mockResolvedValueOnce(page([video], {page_number: 2}));
  await firstPage(fetchMock);
  const button = screen.getByRole("button", {name: nextLabel});
  button.focus();
  fireEvent.click(button);
  const summary = await screen.findByText(/2 page\(s\) chargée/);
  await waitFor(() => expect(summary).toHaveFocus());
  expect(summary.compareDocumentPosition(screen.getByRole("combobox")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("ne reprend pas le focus si l’utilisateur rejoint le tri pendant la continuation", async () => {
  let resolve!: (value: unknown) => void;
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([video], {next_page_token: "next", next_page_signature: signature}))
    .mockImplementationOnce(() => new Promise(r => {resolve = r;}));
  await firstPage(fetchMock);
  const button = screen.getByRole("button", {name: nextLabel});
  button.focus(); fireEvent.click(button);
  const select = screen.getByRole("combobox");
  select.focus();
  await act(async () => resolve(page([video], {page_number: 2})));
  expect(select).toHaveFocus();
});


function filtersPanel() {
  return screen.getByText(/Filtres avancés — \d+ critère/).closest("details")!;
}

function toggleFilters() {
  fireEvent.click(filtersPanel().querySelector("summary")!);
}

it("ferme les filtres au montage et conserve les champs montés et activés au repli sans requête", () => {
  const {fetchMock} = setup();
  const panel = filtersPanel();
  expect(panel.open).toBe(false);
  toggleFilters();
  expect(panel.open).toBe(true);
  fireEvent.change(screen.getByLabelText("Vues minimum"), {target: {value: "0"}});
  toggleFilters();
  expect(panel.open).toBe(false);
  expect(screen.getByLabelText("Vues minimum")).toBeEnabled();
  expect(screen.getByLabelText("Vues minimum")).toHaveValue(0);
  expect(panel.querySelector("summary")).toHaveTextContent("Filtres avancés — 1 critère renseigné");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("compte les cinq champs individuellement sans convertir zéro ou les grands entiers", () => {
  const {fetchMock} = setup();
  toggleFilters();
  const fields = [
    ["Publié à partir du (UTC)", "2026-01-01"], ["Publié jusqu’au (UTC, jour inclus)", "2026-02-01"],
    ["Vues minimum", "9007199254740993"], ["Abonnés maximum", "0"], ["Durée minimum (minutes)", "-1"],
  ];
  fields.forEach(([label, value], i) => {
    fireEvent.change(screen.getByLabelText(label), {target: {value}});
    expect(filtersPanel().querySelector("summary")).toHaveTextContent(`${i + 1} critère`);
  });
  toggleFilters();
  expect(filtersPanel().querySelector("summary")).toHaveTextContent("5 critères renseignés");
  toggleFilters();
  fields.forEach(([label]) => fireEvent.change(screen.getByLabelText(label), {target: {value: ""}}));
  toggleFilters();
  expect(filtersPanel().querySelector("summary")).toHaveTextContent("0 critères renseignés");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("transmet les cinq critères repliés et les conserve lors d’une nouvelle recherche", async () => {
  const fetchMock = vi.fn().mockResolvedValue(page([]));
  const {form} = setup(fetchMock);
  accept();
  toggleFilters();
  const fields = [["Publié à partir du (UTC)", "2026-01-01"], ["Publié jusqu’au (UTC, jour inclus)", "2026-02-01"],
    ["Vues minimum", "9007199254740993"], ["Abonnés maximum", "0"], ["Durée minimum (minutes)", "3"]];
  fields.forEach(([label, value]) => fireEvent.change(screen.getByLabelText(label), {target: {value}}));
  toggleFilters();
  fireEvent.submit(form);
  await screen.findByText(/Aucune vidéo ne correspond/);
  expect(filtersPanel().open).toBe(false);
  const params = new URL(fetchMock.mock.calls[0][0], "http://test").searchParams;
  expect(Object.fromEntries(params)).toEqual({q: "python", published_after: "2026-01-01T00:00:00Z", published_before: "2026-02-02T00:00:00Z", min_views: "9007199254740993", max_subscribers: "0", min_duration_minutes: "3"});
  fireEvent.submit(form);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole("button", {name: "Rechercher sur YouTube"})).toBeEnabled());
  expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[0][0]);
  expect(filtersPanel().querySelector("summary")).toHaveTextContent("5 critères renseignés");
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(screen.getByRole("textbox")).toHaveValue("python");
});

it("rouvre les filtres sur invalidité native et focalise seulement le premier champ invalide", () => {
  const {fetchMock} = setup();
  const first = screen.getByLabelText("Vues minimum");
  const second = screen.getByLabelText("Abonnés maximum");
  fireEvent.change(first, {target: {value: "-1"}});
  fireEvent.change(second, {target: {value: "-2"}});
  fireEvent.invalid(first);
  fireEvent.invalid(second);
  expect(filtersPanel().open).toBe(true);
  expect(first).toHaveFocus();
  expect(first).toHaveAttribute("aria-invalid", "true");
  expect(first).toHaveAttribute("aria-errormessage", "search-error");
  expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rouvre les dates inversées repliées sans effacer les résultats ni périmer le solde", async () => {
  const fetchMock = vi.fn().mockResolvedValue(page([video]));
  const {form} = await firstPage(fetchMock);
  fireEvent.change(screen.getByLabelText("Publié à partir du (UTC)"), {target: {value: "2026-02-01"}});
  fireEvent.change(screen.getByLabelText("Publié jusqu’au (UTC, jour inclus)"), {target: {value: "2026-01-01"}});
  fireEvent.submit(form);
  expect(filtersPanel().open).toBe(true);
  expect(screen.getByLabelText("Publié jusqu’au (UTC, jour inclus)")).toHaveFocus();
  expect(screen.getByRole("row", {name: /Titre simulé/})).toBeVisible();
  expectCount("Tentatives YouFinder restantes", 19);
  expect(metric("Tentatives YouFinder restantes").getByText(/Solde de la dernière réponse/)).toBeVisible();
  expect(metric("Tentatives YouFinder restantes").queryByText(/périmé/)).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("réconcilie le compteur après restauration native signalée par pageshow sans requête", () => {
  const {fetchMock} = setup();
  (screen.getByLabelText("Abonnés maximum") as HTMLInputElement).value = "0";
  (screen.getByLabelText("Vues minimum") as HTMLInputElement).value = "9007199254740993";
  fireEvent(window, new Event("pageshow"));
  expect(filtersPanel().querySelector("summary")).toHaveTextContent("2 critères renseignés");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("conserve l’instantané soumis pour la deuxième page après modification de filtres repliés", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(page([video], {next_page_token: "next", next_page_signature: signature}))
    .mockResolvedValueOnce(page([video], {page_number: 2}));
  const {form} = setup(fetchMock);
  accept();
  fireEvent.change(screen.getByLabelText("Vues minimum"), {target: {value: "0"}});
  fireEvent.submit(form);
  await screen.findByRole("row", {name: /Titre simulé/});
  toggleFilters();
  fireEvent.change(screen.getByLabelText("Vues minimum"), {target: {value: "1000"}});
  toggleFilters();
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  await screen.findByText(/Limite de deux pages atteinte/);
  expect(new URL(fetchMock.mock.calls[1][0], "http://test").searchParams.get("min_views")).toBe("0");
  expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
});


it("ouvre une borne de fin non sérialisable sans appel et conserve sa valeur", () => {
  const {form, fetchMock} = setup();
  accept();
  const field = screen.getByLabelText("Publié jusqu’au (UTC, jour inclus)");
  fireEvent.change(field, {target: {value: "9999-12-31"}});
  fireEvent.submit(form);
  expect(filtersPanel().open).toBe(true);
  expect(field).toHaveFocus();
  expect(field).toHaveValue("9999-12-31");
  expect(screen.getByRole("alert")).toHaveTextContent(/date de fin UTC valide/);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("focalise un mot-clé invalide sans ouvrir les filtres", () => {
  const {form, fetchMock} = setup();
  accept();
  fireEvent.change(screen.getByRole("textbox"), {target: {value: "   "}});
  fireEvent.submit(form);
  expect(screen.getByRole("textbox")).toHaveFocus();
  expect(filtersPanel().open).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("présente un seul panneau statistique, quatre indicateurs et un unique repère de pages", async () => {
  const fetchMock = vi.fn().mockResolvedValue(page([video], {next_page_token: "next", next_page_signature: signature}));
  const {container} = await firstPage(fetchMock);
  const summary = screen.getByRole("region", {name: "Synthèse des pages traitées"});
  expect(within(summary).getAllByRole("definition")).toHaveLength(4);
  expect(within(summary).getByRole("definition", {name: "Tentatives YouFinder restantes"})).toHaveTextContent("19");
  expect(screen.getAllByText(/1 page\(s\) chargée/)).toHaveLength(1);
  expect(screen.queryByText(/Page 1 : chargée/)).not.toBeInTheDocument();
  expect(container.querySelector('[aria-label="Organisation et pagination des résultats"]')).not.toHaveClass("panel");
  expect(summary.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("conserve le solde inconnu après une erreur initiale sans inventer de KPI", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
  const {form} = setup(fetchMock);
  expect(screen.getByText(/Solde interne inconnu/)).toBeVisible();
  expect(screen.queryByRole("definition", {name: "Tentatives YouFinder restantes"})).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  accept(); fireEvent.submit(form);
  await screen.findByRole("alert");
  expect(screen.getByText(/Solde interne inconnu/)).toBeVisible();
  expect(screen.queryByRole("region", {name: "Synthèse des pages traitées"})).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("affiche un plafond nul et un solde nul exacts sans autoriser de continuation", async () => {
  const fetchMock = vi.fn().mockResolvedValue(page([], {daily_limit: 0, searches_remaining: 0, next_page_token: "next", next_page_signature: signature}));
  await firstPage(fetchMock);
  expectCount("Tentatives YouFinder restantes", 0);
  expect(metric("Tentatives YouFinder restantes").getByText("sur 0 aujourd’hui")).toBeVisible();
  expect(screen.getByText(/Plafond interne nul/)).toBeVisible();
  expectProcessing(0, 0, 0);
  expect(screen.getByRole("button", {name: nextLabel})).toBeDisabled();
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("qualifie le solde pendant une continuation sans erreur et ne le décrémente pas localement", async () => {
  let resolve!: (value: unknown) => void;
  const fetchMock = vi.fn().mockResolvedValueOnce(page([video], {next_page_token: "next", next_page_signature: signature}))
    .mockImplementationOnce(() => new Promise(r => {resolve = r;}));
  await firstPage(fetchMock);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expectCount("Tentatives YouFinder restantes", 19);
  expect(metric("Tentatives YouFinder restantes").getByText(/Dernier solde connu/)).toBeVisible();
  expect(metric("Tentatives YouFinder restantes").queryByText(/périmé/)).not.toBeInTheDocument();
  await act(async () => resolve(page([], {page_number: 2, searches_remaining: 18})));
  expectCount("Tentatives YouFinder restantes", 18);
  expect(metric("Tentatives YouFinder restantes").getByText(/Solde de la dernière réponse/)).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

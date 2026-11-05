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
    expect(screen.getAllByRole("heading").map(node => node.textContent)).toEqual(["Titre simulé", "Deuxième résultat"]);
    expect(screen.getAllByText("Indisponible")).toHaveLength(2);
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.getAllByText("15:33")).toHaveLength(2);
    expect(screen.getByText(/19 tentative/)).toBeVisible();
    expect(screen.getByText(/ont été omises/)).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Voir sur YouTube ↗" })[0]).toHaveAttribute("href", video.youtube_url);
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
  expect(screen.getByText(/3 vidéo\(s\) examinée\(s\), 3 retenue/)).toBeVisible();
  expect(screen.getByText(/2 vidéo\(s\) unique/)).toBeVisible();
  expect(screen.getAllByRole("heading").map(node => node.textContent)).toEqual(["Titre simulé", "Deuxième"]);
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
  expect(screen.getByText(/4 vidéo\(s\) examinée/)).toBeVisible();
  expect(screen.queryByRole("heading", {name: "Titre simulé"})).not.toBeInTheDocument();
});

it("continue après une page entièrement filtrée puis termine sans jeton", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page([], {examined_count: 50, filtered_out_count: 50, next_page_token: "next", next_page_signature: signature}))
    .mockResolvedValueOnce(page([], {page_number: 2, examined_count: 50, filtered_out_count: 50, searches_remaining: 18}));
  await firstPage(fetchMock);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  expect(await screen.findByText(/100 vidéo\(s\) examinée\(s\), 0 retenue\(s\), 100 écartée/)).toBeVisible();
  expect(screen.getByText(/0 vidéo\(s\) unique/)).toBeVisible();
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

it("affiche 100 vidéos au maximum en conservant l’ordre de deux pages de 50", async () => {
  const makeVideos = (start: number) => Array.from({length: 50}, (_, index) => ({...video, id: String(start + index), title: `Vidéo ${start + index}`}));
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(page(makeVideos(0), {next_page_token: "next", next_page_signature: signature}))
    .mockResolvedValueOnce(page(makeVideos(50), {page_number: 2, searches_remaining: 18}));
  await firstPage(fetchMock);
  expect(screen.getAllByRole("heading")).toHaveLength(50);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", {name: nextLabel}));
  await screen.findByText(/2 page\(s\) chargée/);
  expect(screen.getAllByRole("heading").map(node => node.textContent)).toEqual(Array.from({length: 100}, (_, index) => `Vidéo ${index}`));
  expect(screen.getByText(/100 vidéo\(s\) unique/)).toBeVisible();
  expect(screen.queryByRole("button", {name: nextLabel})).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

const sortLabel = "Trier les vidéos chargées";
const withDate = (id: string, published_at: string | null): Video => ({ ...video, id, title: id, published_at });
const titles = () => screen.getAllByRole("heading").map(node => node.textContent);
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
  const counts = screen.getByText(/Compteurs cumulés/).textContent;
  for (const [mode, expected] of [["date-desc", ["new", "middle", "old"]], ["date-asc", ["old", "middle", "new"]], ["relevance", ["middle", "old", "new"]]] as const) {
    chooseSort(mode);
    expect(titles()).toEqual(expected);
    expect(screen.getByText(/Compteurs cumulés/).textContent).toBe(counts);
    expect(screen.getByText(/3 vidéo\(s\) unique/)).toBeVisible();
    expect(screen.getByText(/1 vidéo\(s\) devenue/)).toBeVisible();
    expect(screen.getByText(/19 tentative/)).toBeVisible();
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
  expect(screen.getByText(/7 vidéo\(s\) examinée\(s\), 7 retenue/)).toBeVisible();
  expect(screen.getByText(/6 vidéo\(s\) unique/)).toBeVisible();
  expect(screen.getByText(/18 tentative/)).toBeVisible();
  expect(screen.queryByRole("button", {name: nextLabel})).not.toBeInTheDocument();
  chooseSort("relevance");
  expect(titles()).toEqual(["equal-first", "missing", "old", "new", "equal-second", "invalid"]);
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
  expect(screen.getByText(/2 vidéo\(s\) examinée/)).toBeVisible();
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
  expect(screen.getByText(/2 vidéo\(s\) examinée/)).toBeVisible();
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
  expect(screen.getByText(/52 vidéo\(s\) examinée\(s\), 2 retenue\(s\), 50 écartée/)).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

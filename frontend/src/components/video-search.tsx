"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { isSearchResponse, nextUtcDayStart, type SearchResponse } from "../lib/youtube";
import { sortVideos, type VideoSortMode } from "../lib/video-sort";
import { VideoCard } from "./video-card";
import { SearchSummary } from "./search-summary";
import { DailyAttempts } from "./daily-attempts";

export function VideoSearch() {
  const formRef = useRef<HTMLFormElement>(null);
  const filtersRef = useRef<HTMLDetailsElement>(null);
  const nativeInvalidPending = useRef(false);
  const [criteriaCount, setCriteriaCount] = useState(0);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const filterNames = ["after", "before", "min_views", "max_subscribers", "min_duration_minutes"];

  function updateCriteriaCount() {
    const form = formRef.current;
    if (!form) return;
    setCriteriaCount(filterNames.filter(name => (form.elements.namedItem(name) as HTMLInputElement)?.value !== "").length);
  }

  useEffect(() => {
    updateCriteriaCount();
    // pageshow also covers restoration from the browser back/forward cache.
    window.addEventListener("pageshow", updateCriteriaCount);
    return () => window.removeEventListener("pageshow", updateCriteriaCount);
  }, []);

  function fieldError(name: string) {
    return invalidField === name ? { "aria-invalid": true as const, "aria-errormessage": "search-error" } : {};
  }

  function failValidation(name: string, message: string) {
    const field = formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
    if (field && filtersRef.current?.contains(field)) filtersRef.current.open = true;
    setInvalidField(name);
    setError(message);
    field?.focus();
  }

  function handleInvalid(event: FormEvent<HTMLFormElement>) {
    // Native validation runs before submit, including inside a closed details.
    event.preventDefault();
    if (nativeInvalidPending.current) return;
    nativeInvalidPending.current = true;
    const field = event.target as HTMLInputElement;
    failValidation(field.name, field.validationMessage || "Vérifiez ce champ avant de rechercher.");
    setTimeout(() => { nativeInvalidPending.current = false; }, 0);
  }

  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceStale, setBalanceStale] = useState(false);
  const paginationFocus = useRef(false);
  const paginationButton = useRef<HTMLButtonElement>(null);
  const paginationSummary = useRef<HTMLParagraphElement>(null);
  const [accepted, setAccepted] = useState(false);
  const inFlight = useRef(false);
  const criteria = useRef<string | null>(null);
  const pagesLoaded = useRef(0);
  const [pages, setPages] = useState(0);
  const [continuationBlocked, setContinuationBlocked] = useState(false);
  const [sortMode, setSortMode] = useState<VideoSortMode>("relevance");
  const displayedVideos = sortVideos(result?.items ?? [], sortMode);

  useEffect(() => {
    if (pages === 2 && paginationFocus.current) {
      paginationSummary.current?.focus();
      paginationFocus.current = false;
    }
  }, [pages]);

  useEffect(() => {
    if (!loading) return;
    // A user moving elsewhere during continuation keeps their chosen focus.
    function cancelRestoration(event: Event) {
      if (event.target !== paginationButton.current) paginationFocus.current = false;
    }
    document.addEventListener("pointerdown", cancelRestoration);
    document.addEventListener("focusin", cancelRestoration);
    return () => {
      document.removeEventListener("pointerdown", cancelRestoration);
      document.removeEventListener("focusin", cancelRestoration);
    };
  }, [loading]);

  async function load(params: URLSearchParams, append: boolean) {
    if (inFlight.current || (append && pagesLoaded.current !== 1)) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/videos/search?${params}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        setBalanceStale(true);
        const code = body.error?.code;
        if (append && ["invalid_page_token", "daily_limit_reached", "youtube_quota_exceeded"].includes(code)) {
          setContinuationBlocked(true);
        }
        setError(`${body.error?.message ?? "La recherche a échoué."} Une tentative peut avoir été consommée ; le solde affiché peut être périmé. Aucune nouvelle tentative automatique.`);
      } else if (!isSearchResponse(body) || body.page_number !== (append ? 2 : 1)) {
        setBalanceStale(true);
        setError("Réponse de recherche invalide. Une tentative peut avoir été consommée.");
      } else {
        setBalanceStale(false);
        const repeated = append && body.next_page_token === params.get("page_token");
        if (repeated) setError("Jeton de continuation répété : parcours arrêté.");
        pagesLoaded.current = append ? 2 : 1;
        setPages(pagesLoaded.current);
        setResult(previous => {
          const incoming = append && previous ? [...previous.items, ...body.items] : body.items;
          const seen = new Set<string>();
          const items = incoming.filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          return {
            ...body, items,
            next_page_token: append ? null : body.next_page_token,
            next_page_signature: append ? null : body.next_page_signature,
            examined_count: body.examined_count + (append ? previous?.examined_count ?? 0 : 0),
            retained_count: body.retained_count + (append ? previous?.retained_count ?? 0 : 0),
            filtered_out_count: body.filtered_out_count + (append ? previous?.filtered_out_count ?? 0 : 0),
            omitted_count: body.omitted_count + (append ? previous?.omitted_count ?? 0 : 0),
          };
        });
      }
    } catch {
      setBalanceStale(true);
      setError("Connexion à l’application impossible. Une tentative peut avoir été consommée ; le solde affiché peut être périmé. Aucune nouvelle tentative automatique.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  async function loadNext() {
    if (!accepted || !result?.next_page_token || !criteria.current || continuationBlocked
      || result.searches_remaining === 0 || pagesLoaded.current !== 1) return;
    const params = new URLSearchParams(criteria.current);
    params.set("page_token", result.next_page_token);
    params.set("page_signature", result.next_page_signature!);
    await load(params, true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !accepted) return;
    const form = new FormData(event.currentTarget);
    const q = String(form.get("q") ?? "").trim();
    const after = String(form.get("after") ?? "");
    const before = String(form.get("before") ?? "");
    setError(null);
    setInvalidField(null);
    updateCriteriaCount();
    if (!q || q.length > 200 || (after && before && after > before)) {
      failValidation(!q || q.length > 200 ? "q" : "before", "Saisissez un mot-clé de 1 à 200 caractères et des dates dans l’ordre chronologique.");
      return;
    }
    const params = new URLSearchParams({ q });
    if (after) params.set("published_after", `${after}T00:00:00Z`);
    if (before) {
      try {
        params.set("published_before", nextUtcDayStart(before));
      } catch {
        failValidation("before", "Saisissez une date de fin UTC valide.");
        return;
      }
    }
    for (const name of ["min_views", "max_subscribers", "min_duration_minutes"]) {
      const value = String(form.get(name) ?? "");
      if (value && !/^[0-9]+$/.test(value)) {
        failValidation(name, "Les filtres doivent être des entiers positifs ou nuls.");
        return;
      }
      if (value) params.set(name, value);
    }
    criteria.current = params.toString();
    pagesLoaded.current = 0;
    setPages(0);
    setResult(null);
    setContinuationBlocked(false);
    await load(params, false);
  }

  // Aucun appel au montage, stockage du formulaire ou rechargement automatique.
  return (
    <section aria-label="Recherche de vidéos YouTube">
      <form ref={formRef} onSubmit={submit} onInvalidCapture={handleInvalid} onInput={updateCriteriaCount} onChange={updateCriteriaCount} aria-label="Rechercher des vidéos" aria-describedby={error ? "search-error" : undefined} className="panel grid gap-3">
        <label className="grid gap-2">Mot-clé<input {...fieldError("q")} name="q" aria-describedby="keyword-help" required maxLength={200} autoComplete="off" className="rounded bg-slate-800 p-3" /></label>
        <p id="keyword-help" className="text-sm text-slate-300">Un mot-clé de 1 à 200 caractères. Aucun appel avant votre recherche.</p>
        <details ref={filtersRef} className="advanced-filters min-w-0">
          <summary className="cursor-pointer rounded py-3 font-semibold">Filtres avancés — {criteriaCount} {criteriaCount === 1 ? "critère renseigné" : "critères renseignés"}</summary>
          <fieldset className="min-w-0 space-y-4 rounded-xl border border-slate-700 p-4 sm:p-5">
            <legend className="px-2 font-semibold">Filtres avancés — facultatifs</legend>
            <p id="date-help" className="text-sm text-slate-300">Publication en UTC : le jour de fin est inclus, quel que soit le fuseau du navigateur.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">Publié à partir du (UTC)<input type="date" aria-describedby="date-help" {...fieldError("after")} name="after" className="rounded bg-slate-800 p-3" /></label>
              <label className="grid gap-2">Publié jusqu’au (UTC, jour inclus)<input type="date" aria-describedby="date-help" {...fieldError("before")} name="before" className="rounded bg-slate-800 p-3" /></label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2">Vues minimum<input type="number" {...fieldError("min_views")} name="min_views" min="0" step="1" className="rounded bg-slate-800 p-3" /></label>
              <label className="grid gap-2">Abonnés maximum<input type="number" {...fieldError("max_subscribers")} name="max_subscribers" min="0" step="1" aria-describedby="subscriber-notice" className="rounded bg-slate-800 p-3" /></label>
              <label className="grid gap-2">Durée minimum (minutes)<input type="number" {...fieldError("min_duration_minutes")} name="min_duration_minutes" min="0" step="1" className="rounded bg-slate-800 p-3" /></label>
            </div>
            <p id="subscriber-notice" className="text-sm text-slate-300">Le filtre abonnés utilise le nombre public arrondi vers le bas à trois chiffres significatifs par YouTube. Il ne garantit pas un plafond sur le nombre exact. Les valeurs masquées ou indisponibles sont exclues lorsque ce filtre est renseigné.</p>
            <p className="text-sm text-slate-300">Tous les filtres se combinent. Une donnée indisponible est exclue si son filtre est renseigné. Le filtre durée exclut les directs en cours et programmés. Les critères restent renseignés pendant cette session de page.</p>
          </fieldset>
        </details>
        <p className="text-sm text-slate-300">Les modifications des critères s’appliquent à la prochaine recherche.</p>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="consent" required checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1" /><span>J’accepte la <a className="underline" href="/confidentialite" target="_blank" rel="noopener noreferrer">politique de confidentialité</a> et les <a className="underline" href="/conditions" target="_blank" rel="noopener noreferrer">conditions d’utilisation</a>, y compris les <a className="underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">conditions YouTube</a>.</span></label>
        <button disabled={loading || !accepted} type="submit" className="primary-button w-full sm:w-fit">{loading && !result ? "Recherche en cours…" : "Rechercher sur YouTube"}</button>
        <p className="text-sm text-slate-300">Une tentative du plafond quotidien par page, même en cas d’erreur Google. Aucun appel automatique au chargement ou au rafraîchissement.</p>
        <p className="text-sm text-slate-300">Deux pages manuelles de 50 identifiants maximum (100 au total). Recherche non exhaustive de YouTube.</p>
      </form>
      <div className="mt-6 space-y-5">
        <p role="status" className="text-sm text-sky-200">{loading ? result ? "Chargement de la deuxième page… Les résultats précédents restent affichés." : "Recherche auprès de YouTube…" : error ? "" : result ? "Résultats mis à jour." : ""}</p>
        {error && <p id="search-error" role="alert" className="rounded-xl border border-red-400 bg-slate-900 p-4">{error}</p>}
        {!result && !loading && <p className="text-sm text-slate-300">Solde interne inconnu avant une réponse valide, distinct du quota Google YouTube. Journée Europe/Paris.</p>}
        {result && <>
          <SearchSummary result={result} uniqueCount={result.items.length} pages={pages} />
          <DailyAttempts remaining={result.searches_remaining} limit={result.daily_limit} stale={balanceStale} pending={loading} />
          <div className="panel space-y-4" aria-label="Organisation et pagination des résultats">
            <h2 className="text-xl font-semibold">Résultats des pages chargées</h2>
            <p className="text-sm text-slate-300">{result.notice}</p>
            <p ref={paginationSummary} tabIndex={-1} className="rounded focus:outline-2 focus:outline-sky-300">{pages} page(s) chargée(s) sur 2 maximum — 50 identifiants par page maximum.</p>
            <p className="text-sm text-slate-300">La page suivante utilise les critères de la recherche soumise. Pour appliquer les champs modifiés, lancez une nouvelle recherche.</p>
            {pages === 1 && result.next_page_token && <button type="button" ref={paginationButton} onClick={event => { paginationFocus.current = event.currentTarget === document.activeElement; void loadNext(); }}
              disabled={loading || !accepted || continuationBlocked || result.searches_remaining === 0}
              className="primary-button w-full sm:w-fit">Charger 50 vidéos supplémentaires</button>}
            {pages === 1 && result.next_page_token && <p className="text-sm text-slate-300">Jusqu’à 50 identifiants supplémentaires — une tentative. Le nombre de nouvelles cartes peut être inférieur.</p>}
            <p>{pages === 2 ? "Limite de deux pages atteinte (100 identifiants maximum)." : !result.next_page_token ? "Fin de pagination : aucune page suivante." : result.searches_remaining === 0 ? "Plafond quotidien atteint : aucune tentative restante." : "La deuxième page est facultative et consomme une tentative."}</p>
            <label className="grid min-w-0 gap-2 sm:max-w-lg">Trier les vidéos chargées
              <select value={sortMode} onChange={event => setSortMode(event.target.value as VideoSortMode)}
                aria-describedby="local-sort-notice" className="rounded bg-slate-800 p-3">
                <option value="relevance">Pertinence YouTube : ordre initial</option>
                <option value="date-desc">Date décroissante : plus récentes d’abord</option>
                <option value="date-asc">Date croissante : plus anciennes d’abord</option>
              </select>
            </label>
            <p id="local-sort-notice" className="text-sm text-slate-300">Tri local des vidéos déjà chargées, sans nouvel appel YouTube. Ce tri n’est pas une recherche exhaustive par date sur YouTube. Les dates absentes ou invalides sont placées à la fin des tris chronologiques.</p>
          </div>
          <div aria-busy={loading}>
            {result.items.length === 0 ? <p className="panel">Aucune vidéo ne correspond aux critères parmi les vidéos examinées.</p> : <ol className="mt-5 grid gap-5 sm:grid-cols-2">{displayedVideos.map(video => <li className="min-w-0" key={video.id}><VideoCard video={video} /></li>)}</ol>}
          </div>
        </>}
      </div>
    </section>
  );
}

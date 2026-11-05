"use client";

import { useRef, useState, type FormEvent } from "react";
import { isSearchResponse, nextUtcDayStart, type SearchResponse } from "../lib/youtube";
import { sortVideos, type VideoSortMode } from "../lib/video-sort";
import { VideoCard } from "./video-card";

export function VideoSearch() {
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const inFlight = useRef(false);
  const criteria = useRef<string | null>(null);
  const pagesLoaded = useRef(0);
  const [pages, setPages] = useState(0);
  const [continuationBlocked, setContinuationBlocked] = useState(false);
  const [sortMode, setSortMode] = useState<VideoSortMode>("relevance");
  const displayedVideos = sortVideos(result?.items ?? [], sortMode);

  async function load(params: URLSearchParams, append: boolean) {
    if (inFlight.current || (append && pagesLoaded.current !== 1)) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/videos/search?${params}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        const code = body.error?.code;
        if (append && ["invalid_page_token", "daily_limit_reached", "youtube_quota_exceeded"].includes(code)) {
          setContinuationBlocked(true);
        }
        setError(`${body.error?.message ?? "La recherche a échoué."} Une tentative peut avoir été consommée ; le solde affiché peut être périmé. Aucune nouvelle tentative automatique.`);
      } else if (!isSearchResponse(body) || body.page_number !== (append ? 2 : 1)) {
        setError("Réponse de recherche invalide. Une tentative peut avoir été consommée.");
      } else {
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
    if (!q || q.length > 200 || (after && before && after > before)) {
      setError("Saisissez un mot-clé de 1 à 200 caractères et des dates dans l’ordre chronologique.");
      return;
    }
    const params = new URLSearchParams({ q });
    if (after) params.set("published_after", `${after}T00:00:00Z`);
    if (before) {
      try {
        params.set("published_before", nextUtcDayStart(before));
      } catch {
        setError("Saisissez une date de fin UTC valide.");
        return;
      }
    }
    for (const name of ["min_views", "max_subscribers", "min_duration_minutes"]) {
      const value = String(form.get(name) ?? "");
      if (value && !/^[0-9]+$/.test(value)) {
        setError("Les filtres doivent être des entiers positifs ou nuls.");
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

  // Aucun effet au montage, stockage du formulaire ou rechargement automatique.
  return (
    <section aria-label="Recherche de vidéos YouTube">
      <a href="https://www.youtube.com/" className="mb-4 inline-block" aria-label="Développé avec YouTube">
        <img src="/developed-with-youtube.png" alt="Developed with YouTube" width={233} height={82} />
      </a>
      <form onSubmit={submit} className="grid gap-4 rounded-xl border border-slate-700 p-5">
        <label className="grid gap-2">Mot-clé<input name="q" required maxLength={200} autoComplete="off" className="rounded bg-slate-800 p-3" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">Publié à partir du (UTC)<input type="date" name="after" className="rounded bg-slate-800 p-3" /></label>
          <label className="grid gap-2">Publié jusqu’au (UTC, jour inclus)<input type="date" name="before" className="rounded bg-slate-800 p-3" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2">Vues minimum<input type="number" name="min_views" min="0" step="1" className="rounded bg-slate-800 p-3" /></label>
          <label className="grid gap-2">Abonnés maximum<input type="number" name="max_subscribers" min="0" step="1" aria-describedby="subscriber-notice" className="rounded bg-slate-800 p-3" /></label>
          <label className="grid gap-2">Durée minimum (minutes)<input type="number" name="min_duration_minutes" min="0" step="1" className="rounded bg-slate-800 p-3" /></label>
        </div>
        <p id="subscriber-notice" className="text-sm text-slate-400">Le filtre abonnés utilise le nombre public arrondi vers le bas à trois chiffres significatifs par YouTube. Il ne garantit pas un plafond sur le nombre exact. Les valeurs masquées ou indisponibles sont exclues lorsque ce filtre est renseigné.</p>
        <p className="text-sm text-slate-400">Tous les filtres se combinent. Une donnée indisponible est exclue si son filtre est renseigné. Le filtre durée exclut les directs en cours et programmés. Les critères restent renseignés pendant cette session de page.</p>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1" /><span>J’accepte la <a className="underline" href="/confidentialite" target="_blank" rel="noopener noreferrer">politique de confidentialité</a> et les <a className="underline" href="/conditions" target="_blank" rel="noopener noreferrer">conditions d’utilisation</a>, y compris les <a className="underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">conditions YouTube</a>.</span></label>
        <button disabled={loading || !accepted} type="submit" className="w-fit rounded bg-red-600 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Recherche en cours…" : "Rechercher sur YouTube"}</button>
        <p className="text-sm text-slate-400">Chaque page demandée consomme une tentative du plafond quotidien, même en cas d’erreur Google. Aucun appel automatique au chargement ou au rafraîchissement de cette page.</p>
      </form>
      <div aria-live="polite" aria-busy={loading} className="mt-5">
        {loading && <p role="status">Recherche auprès de YouTube…</p>}
        {error && <p role="alert" className="rounded border border-red-400 p-4">{error}</p>}
        {result && <>
          <p>{pages} page(s) chargée(s) sur 2 maximum — 50 identifiants par page maximum.</p>
          <p>Compteurs cumulés des pages : {result.examined_count} vidéo(s) examinée(s), {result.retained_count} retenue(s), {result.filtered_out_count} écartée(s) par les filtres.</p>
          <p>{result.items.length} vidéo(s) unique(s) affichée(s). Les cumuls peuvent inclure des doublons entre pages.</p>
          <p>{result.notice}</p>
          <p>La page suivante utilise les critères de la recherche soumise. Pour appliquer les champs modifiés, lancez une nouvelle recherche.</p>
          <p>{result.searches_remaining} tentative(s) restante(s) sur {result.daily_limit} aujourd’hui (Europe/Paris).</p>
          {result.omitted_count > 0 && <p>{result.omitted_count} vidéo(s) devenue(s) indisponible(s) ont été omises.</p>}
          {pages === 1 && result.next_page_token && <button type="button" onClick={loadNext}
            disabled={loading || !accepted || continuationBlocked || result.searches_remaining === 0}
            className="mt-4 rounded bg-red-600 px-5 py-3 disabled:opacity-50">Charger 50 vidéos supplémentaires</button>}
          <p>{pages === 2 ? "Limite de deux pages atteinte (100 identifiants maximum)." : !result.next_page_token ? "Fin de pagination : aucune page suivante." : result.searches_remaining === 0 ? "Plafond quotidien atteint : aucune tentative restante." : "La deuxième page est facultative et consomme une tentative."}</p>
          <label className="mt-4 grid w-fit gap-2">Trier les vidéos chargées
            <select value={sortMode} onChange={event => setSortMode(event.target.value as VideoSortMode)}
              aria-describedby="local-sort-notice" className="rounded bg-slate-800 p-3">
              <option value="relevance">Pertinence YouTube : ordre initial</option>
              <option value="date-desc">Date décroissante : plus récentes d’abord</option>
              <option value="date-asc">Date croissante : plus anciennes d’abord</option>
            </select>
          </label>
          <p id="local-sort-notice" className="text-sm text-slate-400">Tri local des vidéos déjà chargées, sans nouvel appel YouTube. Ce tri n’est pas une recherche exhaustive par date sur YouTube. Les dates absentes ou invalides sont placées à la fin des tris chronologiques.</p>
          {result.items.length === 0 ? <p className="mt-4">Aucune vidéo ne correspond aux critères parmi les vidéos examinées.</p> : <ol className="mt-5 grid gap-5 sm:grid-cols-2">{displayedVideos.map(video => <li key={video.id}><VideoCard video={video} /></li>)}</ol>}
        </>}
      </div>
    </section>
  );
}

"use client";

import { useRef, useState, type FormEvent } from "react";
import type { SearchResponse } from "../lib/youtube";
import { VideoCard } from "./video-card";

export function VideoSearch() {
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !accepted) return;
    const form = new FormData(event.currentTarget);
    const q = String(form.get("q") ?? "").trim();
    const after = String(form.get("after") ?? "");
    const before = String(form.get("before") ?? "");
    setError(null);
    setResult(null);
    if (!q || q.length > 200 || (after && before && after > before)) {
      setError("Saisissez un mot-clé de 1 à 200 caractères et des dates dans l’ordre chronologique.");
      return;
    }
    const params = new URLSearchParams({ q });
    if (after) params.set("published_after", `${after}T00:00:00Z`);
    if (before) params.set("published_before", `${before}T23:59:59.999Z`);
    for (const name of ["min_views", "max_subscribers", "min_duration_minutes"]) {
      const value = String(form.get(name) ?? "");
      if (value && !/^[0-9]+$/.test(value)) {
        setError("Les filtres doivent être des entiers positifs ou nuls.");
        return;
      }
      if (value) params.set(name, value);
    }
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch(`/api/videos/search?${params}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "La recherche a échoué. Réessayez manuellement plus tard.");
      } else if (!Array.isArray(body.items)) {
        setError("Réponse de recherche invalide.");
      } else {
        setResult(body as SearchResponse);
      }
    } catch {
      setError("Connexion à l’application impossible. Aucune nouvelle tentative automatique.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
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
        <p className="text-sm text-slate-400">Une soumission consomme une tentative du plafond quotidien, même en cas d’erreur Google. Aucun appel automatique au chargement ou au rafraîchissement de cette page.</p>
      </form>
      <div aria-live="polite" aria-busy={loading} className="mt-5">
        {loading && <p role="status">Recherche auprès de YouTube…</p>}
        {error && <p role="alert" className="rounded border border-red-400 p-4">{error}</p>}
        {result && <>
          <p>{result.examined_count} vidéo(s) examinée(s), {result.retained_count} retenue(s), {result.filtered_out_count} écartée(s) par les filtres.</p>
          <p>{result.notice}</p>
          <p>{result.searches_remaining} tentative(s) restante(s) sur {result.daily_limit} aujourd’hui (Europe/Paris).</p>
          {result.omitted_count > 0 && <p>{result.omitted_count} vidéo(s) devenue(s) indisponible(s) ont été omises.</p>}
          {result.items.length === 0 ? <p className="mt-4">Aucune vidéo ne correspond aux critères parmi les vidéos examinées.</p> : <ol className="mt-5 grid gap-5 sm:grid-cols-2">{result.items.map(video => <li key={video.id}><VideoCard video={video} /></li>)}</ol>}
        </>}
      </div>
    </section>
  );
}

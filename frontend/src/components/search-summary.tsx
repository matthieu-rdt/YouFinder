import { useId } from "react";
import type { SearchResponse } from "../lib/youtube";
import { DailyAttempts } from "./daily-attempts";

type Summary = Pick<SearchResponse, "examined_count" | "retained_count" | "filtered_out_count" | "omitted_count" | "searches_remaining" | "daily_limit">;

export function SearchSummary({ result, uniqueCount, stale = false, pending = false }: {
  result: Summary; uniqueCount: number; stale?: boolean; pending?: boolean;
}) {
  const id = useId();
  const metrics = [
    ["Vidéos examinées", result.examined_count],
    ["Vidéos retenues", result.retained_count],
    ["Vidéos uniques affichées", uniqueCount],
  ] as const;
  return (
    <section aria-label="Synthèse des pages traitées" className="panel space-y-3">
      <h2 className="font-semibold">Synthèse des résultats</h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map(([label, count], index) => <div key={label} className="min-w-0">
          <dt id={`${id}-${index}`} className="text-sm text-slate-300">{label}</dt>
          <dd aria-labelledby={`${id}-${index}`} className="mt-1 text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]">{count}</dd>
        </div>)}
        <DailyAttempts remaining={result.searches_remaining} limit={result.daily_limit} stale={stale} pending={pending} />
      </dl>
      <div className="space-y-2 text-sm text-slate-300">
        <p><span className="font-semibold">Vidéos écartées</span> : {result.filtered_out_count} par les filtres. Répartition : retenues / écartées.</p>
        {result.examined_count > 0 ? <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-slate-700">
          <span className="bg-sky-400" style={{ width: `${result.retained_count / result.examined_count * 100}%` }} />
          <span className="bg-slate-500" style={{ width: `${result.filtered_out_count / result.examined_count * 100}%` }} />
        </div> : <p>Aucune vidéo examinée : aucune répartition à afficher.</p>}
        <p>Cumuls des pages traitées avant déduplication ; les vidéos uniques excluent les doublons entre pages.</p>
        {result.omitted_count > 0 && <p>{result.omitted_count} vidéo(s) devenue(s) indisponible(s) ont été omises, distinctes des exclusions par les filtres.</p>}
        <p>Plafond interne YouFinder, distinct du quota Google YouTube. Journée Europe/Paris. Une page demandée consomme une tentative. Solde non actualisé en temps réel ; aucun rafraîchissement automatique.</p>
      </div>
    </section>
  );
}

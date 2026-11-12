import type { SearchResponse } from "../lib/youtube";

type Summary = Pick<SearchResponse, "examined_count" | "retained_count" | "filtered_out_count" | "omitted_count">;

export function SearchSummary({ result, uniqueCount, pages }: { result: Summary; uniqueCount: number; pages: number }) {
  const metrics = [
    ["Vidéos examinées", result.examined_count],
    ["Vidéos retenues", result.retained_count],
    ["Vidéos écartées", result.filtered_out_count],
  ] as const;
  return (
    <section aria-label="Synthèse des pages traitées" className="panel space-y-5">
      <p className="font-semibold">Traitement des pages chargées</p>
      <dl className="grid gap-3 sm:grid-cols-3">
        {metrics.map(([label, count]) => <div key={label} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <dt className="text-sm text-slate-300">{label}</dt>
          <dd className="mt-2 text-3xl font-semibold tabular-nums">{count}</dd>
        </div>)}
      </dl>
      <p className="text-sm text-slate-300">Compteurs cumulés des pages : {result.examined_count} vidéo(s) examinée(s), {result.retained_count} retenue(s), {result.filtered_out_count} écartée(s) par les filtres.</p>
      {result.examined_count > 0 ? <div>
        <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-slate-700">
          <span className="bg-sky-400" style={{ width: `${result.retained_count / result.examined_count * 100}%` }} />
          <span className="bg-slate-500" style={{ width: `${result.filtered_out_count / result.examined_count * 100}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-300">Répartition : {result.retained_count} retenue(s) · {result.filtered_out_count} écartée(s). Sur les pages traitées uniquement, avant déduplication.</p>
      </div> : <p className="text-sm text-slate-300">Aucune vidéo examinée : aucune répartition à afficher.</p>}
      <div className="border-t border-slate-700 pt-5">
        <p className="mb-3 font-semibold">Affichage et parcours</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-sky-700 bg-slate-950 p-4"><dt className="text-sm text-slate-300">Vidéos uniques affichées</dt><dd className="mt-2 text-3xl font-semibold tabular-nums">{uniqueCount}</dd></div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4"><dt className="text-sm text-slate-300">Pages chargées</dt><dd className="mt-2 text-3xl font-semibold tabular-nums">{pages} <span className="text-base text-slate-300">sur 2 maximum</span></dd></div>
        </dl>
        <p className="mt-3 text-sm text-slate-300">{uniqueCount} vidéo(s) unique(s) affichée(s). Les cumuls peuvent inclure des doublons entre pages.</p>
        <ol aria-label="Pages chargées" className="mt-3 flex flex-wrap gap-2 text-sm">{[1, 2].map(page => <li key={page} className={`rounded-lg border px-3 py-2 ${page <= pages ? "border-sky-700 bg-slate-800" : "border-slate-700"}`}>Page {page} : {page <= pages ? "chargée" : "non chargée"}</li>)}</ol>
      </div>
      {result.omitted_count > 0 && <p className="rounded-lg border border-slate-600 p-3 text-sm">{result.omitted_count} vidéo(s) devenue(s) indisponible(s) ont été omises. Ces omissions sont distinctes des exclusions par les filtres.</p>}
    </section>
  );
}

import { useId } from "react";

export function DailyAttempts({ remaining, limit, stale = false, pending = false }: {
  remaining: number | null; limit: number | null; stale?: boolean; pending?: boolean;
}) {
  const id = useId();
  const known = remaining !== null && limit !== null && Number.isSafeInteger(remaining)
    && Number.isSafeInteger(limit) && remaining >= 0 && limit >= 0 && remaining <= limit;
  return (
    <div className="min-w-0">
      <dt id={id} className="text-sm text-slate-300">Tentatives YouFinder restantes</dt>
      <dd aria-labelledby={id} className="mt-1 space-y-1">
        {known ? <>
          <span className="block text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]">{remaining}</span>
          <span className="block text-sm text-slate-300 [overflow-wrap:anywhere]">sur {limit} aujourd’hui</span>
          <span className="block text-xs text-slate-300">{stale || pending ? "Dernier solde connu" : "Solde de la dernière réponse"}.</span>
          {stale && <span className="block text-sm text-amber-200">Le solde peut être périmé après une erreur.</span>}
          {limit === 0 && <span className="block text-sm text-slate-300">Plafond interne nul : aucune capacité disponible.</span>}
        </> : <span className="block text-sm text-slate-300">Solde inconnu. Disponible après une réponse de recherche valide.</span>}
      </dd>
    </div>
  );
}

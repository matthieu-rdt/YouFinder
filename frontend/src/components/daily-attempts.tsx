export function DailyAttempts({ remaining, limit, stale = false, pending = false }: {
  remaining: number | null; limit: number | null; stale?: boolean; pending?: boolean;
}) {
  const known = remaining !== null && limit !== null && Number.isSafeInteger(remaining)
    && Number.isSafeInteger(limit) && remaining >= 0 && limit >= 0 && remaining <= limit;
  return (
    <section aria-label="Plafond quotidien YouFinder" className="panel space-y-3">
      <p className="font-semibold">Tentatives YouFinder restantes aujourd’hui</p>
      <p className="text-sm text-slate-300">Plafond interne YouFinder, distinct du quota Google YouTube. Journée Europe/Paris.</p>
      {known ? <>
        <p className="font-semibold tabular-nums">{stale || pending ? "Dernier solde connu : " : "Solde de la dernière réponse : "}{remaining} tentative(s) restante(s) sur {limit} aujourd’hui (Europe/Paris).</p>
        {stale ? <p className="text-sm text-amber-200">Le solde peut être périmé après une erreur. La jauge est masquée ; aucun rafraîchissement automatique.</p>
          : limit > 0 ? <meter className="quota-meter block h-4 w-full" min={0} max={limit} value={remaining} aria-label="Tentatives YouFinder restantes" aria-valuetext={`${remaining} sur ${limit} — solde de la dernière réponse`} />
          : <p className="text-sm text-slate-300">Plafond interne nul : aucune capacité disponible.</p>}
      </> : <p className="text-sm text-slate-300">Solde inconnu. Il sera disponible après une réponse de recherche valide.</p>}
      <p className="text-sm text-slate-300">Une page demandée consomme une tentative. Ce solde n’est pas actualisé en temps réel.</p>
    </section>
  );
}

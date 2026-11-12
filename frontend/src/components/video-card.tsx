import { formatCount, formatDate, type Video } from "../lib/youtube";

export function VideoCard({ video }: { video: Video }) {
  const broadcast = video.broadcast_status === "live" ? "Direct en cours" : video.broadcast_status === "upcoming" ? "Diffusion à venir" : null;
  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-4 sm:p-5 [overflow-wrap:anywhere]">
      {video.thumbnail_url ? (
        <a href={video.youtube_url} target="_blank" rel="noopener noreferrer" aria-label={`Voir sur YouTube : ${video.title ?? "titre indisponible"}`}>
          {/* URL fournie par l’API, sans copie dans le cache d’optimisation Next.js. */}
          <img className="mb-4 aspect-video w-full rounded-lg object-contain" src={video.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
        </a>
      ) : <p>Miniature indisponible</p>}
      <h3 className="text-xl font-semibold leading-snug"><a className="underline" href={video.youtube_url} target="_blank" rel="noopener noreferrer">{video.title ?? "Titre indisponible"}</a></h3>
      <p className="mt-2 text-sm text-slate-300">Chaîne : {video.channel_url ? <a className="underline" href={video.channel_url} target="_blank" rel="noopener noreferrer">{video.channel_title ?? "Nom indisponible"}</a> : video.channel_title ?? "Indisponible"}</p>
      <dl className="my-4 grid gap-3 border-y border-slate-700 py-4 text-sm text-slate-300">
        <div><dt className="font-medium text-slate-400">Publication (UTC) : </dt><dd className="mt-1 text-slate-100">{formatDate(video.published_at)}</dd></div>
        <div><dt className="font-medium text-slate-400">Vues publiques : </dt><dd className="mt-1 text-slate-100">{formatCount(video.view_count)}</dd></div>
        <div><dt className="font-medium text-slate-400">Abonnés publics (arrondis par YouTube) : </dt><dd className="mt-1 text-slate-100">{video.subscribers_hidden ? "Masqués" : formatCount(video.subscriber_count)}</dd></div>
        <div><dt className="font-medium text-slate-400">Durée fournie par YouTube : </dt><dd className="mt-1 text-slate-100">{broadcast ?? video.duration_label ?? "Indisponible"}</dd></div>
      </dl>
      <a className="mt-auto inline-block self-start py-2 text-red-300 underline" href={video.youtube_url} target="_blank" rel="noopener noreferrer" aria-describedby={`external-${video.id}`}>Voir sur YouTube ↗</a>
      <span id={`external-${video.id}`} className="sr-only">Ouvre un nouvel onglet.</span>
    </article>
  );
}

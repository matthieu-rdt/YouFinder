import { formatCount, formatDate, type Video } from "../lib/youtube";

export function VideoCard({ video }: { video: Video }) {
  const broadcast = video.broadcast_status === "live" ? "Direct en cours" : video.broadcast_status === "upcoming" ? "Diffusion à venir" : null;
  return (
    <article className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      {video.thumbnail_url ? (
        <a href={video.youtube_url} target="_blank" rel="noopener noreferrer" aria-label={`Voir sur YouTube : ${video.title ?? "titre indisponible"}`}>
          {/* URL fournie par l’API, sans copie dans le cache d’optimisation Next.js. */}
          <img className="mb-4 aspect-video w-full rounded-lg object-contain" src={video.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
        </a>
      ) : <p>Miniature indisponible</p>}
      <h2 className="text-xl font-semibold"><a className="underline" href={video.youtube_url} target="_blank" rel="noopener noreferrer">{video.title ?? "Titre indisponible"}</a></h2>
      <p className="mt-2">Chaîne : {video.channel_url ? <a className="underline" href={video.channel_url} target="_blank" rel="noopener noreferrer">{video.channel_title ?? "Nom indisponible"}</a> : video.channel_title ?? "Indisponible"}</p>
      <dl className="mt-3 grid gap-2 text-sm text-slate-300">
        <div><dt className="inline">Publication (UTC) : </dt><dd className="inline">{formatDate(video.published_at)}</dd></div>
        <div><dt className="inline">Vues publiques : </dt><dd className="inline">{formatCount(video.view_count)}</dd></div>
        <div><dt className="inline">Abonnés publics (arrondis par YouTube) : </dt><dd className="inline">{video.subscribers_hidden ? "Masqués" : formatCount(video.subscriber_count)}</dd></div>
        <div><dt className="inline">Durée fournie par YouTube : </dt><dd className="inline">{broadcast ?? video.duration_label ?? "Indisponible"}</dd></div>
      </dl>
      <a className="mt-4 inline-block text-red-300 underline" href={video.youtube_url} target="_blank" rel="noopener noreferrer">Voir sur YouTube ↗</a>
    </article>
  );
}

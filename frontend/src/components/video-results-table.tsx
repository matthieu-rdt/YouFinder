import { useId, useState } from "react";
import { formatCount, formatDate, type Video } from "../lib/youtube";

function VideoIdentity({ video, position, externalHint }: { video: Video; position: number; externalHint: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const title = video.title ?? "Titre indisponible";
  const thumbnail = video.thumbnail_url;
  const missingThumbnail = <span>Miniature indisponible</span>;

  return (
    <div className="video-results-identity">
      <span className="video-results-position" aria-hidden="true">{position}</span>
      {thumbnail ? (
        <a className="video-results-thumbnail" href={video.youtube_url} target="_blank" rel="noopener noreferrer"
          aria-label={`Voir sur YouTube : ${video.title ?? "titre indisponible"}`} aria-describedby={externalHint}>
          {/* URL directe fournie par l’API, sans cache d’optimisation Next.js. */}
          {failedUrl === thumbnail ? missingThumbnail : <img src={thumbnail} alt="" loading="lazy"
            referrerPolicy="no-referrer" onError={() => setFailedUrl(thumbnail)} />}
        </a>
      ) : <div className="video-results-thumbnail">{missingThumbnail}</div>}
      <div className="min-w-0">
        <h3 className="font-semibold leading-snug">
          <a className="underline" href={video.youtube_url} target="_blank" rel="noopener noreferrer" aria-describedby={externalHint}>{title}</a>
        </h3>
        <p className="mt-1 text-slate-300">
          {video.channel_url
            ? <a className="underline" href={video.channel_url} target="_blank" rel="noopener noreferrer"
                aria-describedby={externalHint}>{video.channel_title ?? "Nom indisponible"}</a>
            : video.channel_title ?? "Indisponible"}
        </p>
      </div>
    </div>
  );
}

export function VideoResultsTable({ videos, labelledBy }: { videos: readonly Video[]; labelledBy: string }) {
  const externalHint = useId();

  return (
    <>
      <span id={externalHint} className="sr-only">Ouvre un nouvel onglet.</span>
      <table className="video-results-table" aria-labelledby={labelledBy}>
        <thead>
          <tr>
            <th scope="col">Vidéo / Chaîne</th>
            <th scope="col" className="video-results-number">Vues</th>
            <th scope="col" className="video-results-number">Abonnés</th>
            <th scope="col">Publication</th>
            <th scope="col">Durée</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((video, index) => {
            const publication = formatDate(video.published_at);
            const broadcast = video.broadcast_status === "live" ? "Direct en cours"
              : video.broadcast_status === "upcoming" ? "Diffusion à venir" : null;

            return (
              <tr key={video.id}>
                <td><VideoIdentity key={video.thumbnail_url} video={video} position={index + 1} externalHint={externalHint} /></td>
                <td className="video-results-number">
                  <span className="video-results-label" aria-hidden="true">Vues</span>
                  {formatCount(video.view_count)}
                </td>
                <td className="video-results-number">
                  <span className="video-results-label" aria-hidden="true">Abonnés</span>
                  {video.subscribers_hidden ? "Masqués" : formatCount(video.subscriber_count)}
                </td>
                <td>
                  <span className="video-results-label" aria-hidden="true">Publication</span>
                  {video.published_at && publication !== "Indisponible"
                    ? <time dateTime={video.published_at}>{publication}</time> : publication}
                </td>
                <td>
                  <span className="video-results-label" aria-hidden="true">Durée</span>
                  {broadcast ?? video.duration_label ?? "Indisponible"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

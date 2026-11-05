import type { Video } from "./youtube";

export type VideoSortMode = "relevance" | "date-desc" | "date-asc";

type Instant = { seconds: number; fraction: string };

function publicationInstant(value: string | null): Instant | null {
  // RFC 3339 avec fuseau explicite ; aucune normalisation des dates impossibles.
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|([+-])(\d{2}):(\d{2}))$/);
  if (!match || match[0] !== value) return null;
  const [, year, month, day, hour, minute, second, fraction, , sign, offsetHour, offsetMinute] = match;
  const [y, mo, d, h, mi, s] = [year, month, day, hour, minute, second].map(Number);
  const oh = Number(offsetHour ?? 0);
  const om = Number(offsetMinute ?? 0);
  if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59 || oh > 23 || om > 59) return null;
  const date = new Date(0);
  // setUTCFullYear évite le traitement spécial des années 00 à 99 de Date.UTC.
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, mi, s, 0);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const offset = (oh * 60 + om) * (sign === "-" ? -1 : 1);
  return {
    seconds: date.getTime() / 1000 - offset * 60,
    // Conserver toute la précision fournie, sans arrondi flottant ni date inventée.
    fraction: (fraction ?? "").replace(/0+$/, ""),
  };
}

/** Trie une copie ; les égalités gardent l'ordre YouTube de première apparition. */
export function sortVideos(videos: readonly Video[], mode: VideoSortMode): Video[] {
  if (mode === "relevance") return [...videos];
  return videos.map((video, index) => ({ video, index, instant: publicationInstant(video.published_at) }))
    .sort((a, b) => {
      if (!a.instant || !b.instant) {
        if (!a.instant && !b.instant) return a.index - b.index;
        return a.instant ? -1 : 1; // Dates indisponibles en fin, dans les deux sens.
      }
      const seconds = a.instant.seconds - b.instant.seconds;
      const fraction = a.instant.fraction < b.instant.fraction ? -1 : a.instant.fraction > b.instant.fraction ? 1 : 0;
      const order = seconds || fraction;
      return order ? (mode === "date-desc" ? -order : order) : a.index - b.index;
    })
    .map(({ video }) => video);
}

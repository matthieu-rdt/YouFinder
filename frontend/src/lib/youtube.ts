export type Video = {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  channel_id: string | null;
  channel_title: string | null;
  channel_url: string | null;
  published_at: string | null;
  view_count: string | null;
  subscriber_count: string | null;
  subscribers_hidden: boolean | null;
  duration_iso: string | null;
  duration_label: string | null;
  broadcast_status: string | null;
  youtube_url: string;
};

export type SearchResponse = {
  next_page_token: string | null;
  next_page_signature: string | null;
  page_number: number;
  items: Video[];
  omitted_count: number;
  examined_count: number;
  retained_count: number;
  filtered_out_count: number;
  daily_limit: number;
  searches_remaining: number;
  notice: string;
};

export function formatCount(value: string | null): string {
  return value !== null && /^\d+$/.test(value)
    ? BigInt(value).toLocaleString("fr-FR")
    : "Indisponible";
}

export function formatDate(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return "Indisponible";
  return new Date(value).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}


export function nextUtcDayStart(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
    throw new Error("Jour UTC invalide.");
  }
  date.setUTCDate(date.getUTCDate() + 1);
  const result = date.toISOString().replace(".000Z", "Z");
  if (!/^[0-9]{4}-/.test(result)) throw new Error("Borne UTC hors limites.");
  return result;
}

function isVideo(value: unknown): value is Video {
  if (!value || typeof value !== "object") return false;
  const video = value as Record<string, unknown>;
  const nullableStrings = ["title", "thumbnail_url", "channel_id", "channel_title", "channel_url",
    "published_at", "view_count", "subscriber_count", "duration_iso", "duration_label", "broadcast_status"];
  return typeof video.id === "string" && video.id.length > 0 && typeof video.youtube_url === "string"
    && nullableStrings.every(key => video[key] === null || typeof video[key] === "string")
    && (video.subscribers_hidden === null || typeof video.subscribers_hidden === "boolean");
}

// Valider toute la page avant de modifier les résultats déjà affichés.
export function isSearchResponse(value: unknown): value is SearchResponse {
  if (!value || typeof value !== "object") return false;
  const body = value as SearchResponse;
  const counts = [body.examined_count, body.retained_count, body.filtered_out_count,
    body.omitted_count, body.daily_limit, body.searches_remaining];
  return Array.isArray(body.items) && body.items.every(isVideo)
    && counts.every(count => Number.isSafeInteger(count) && count >= 0)
    && body.searches_remaining <= body.daily_limit
    && body.retained_count === body.items.length
    && body.examined_count === body.retained_count + body.filtered_out_count
    && body.examined_count + body.omitted_count <= 50
    && (body.page_number === 1 || body.page_number === 2)
    && typeof body.notice === "string"
    && ((body.next_page_token === null && body.next_page_signature === null)
      || (typeof body.next_page_token === "string" && body.next_page_token.length > 0
        && body.next_page_token.length <= 2048 && typeof body.next_page_signature === "string"
        && /^[0-9a-f]{64}$/.test(body.next_page_signature)));
}

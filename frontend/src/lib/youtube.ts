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

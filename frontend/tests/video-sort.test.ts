import { describe, expect, it } from "vitest";
import { sortVideos, type VideoSortMode } from "../src/lib/video-sort";
import type { Video } from "../src/lib/youtube";

// Données entièrement simulées ; le tri n'utilise que published_at.
function video(id: string, published_at: string | null): Video {
  return {
    id, published_at, title: id, thumbnail_url: null, channel_id: null, channel_title: null,
    channel_url: null, view_count: null, subscriber_count: null, subscribers_hidden: null,
    duration_iso: null, duration_label: null, broadcast_status: null,
    youtube_url: `https://www.youtube.com/watch?v=${id}`,
  };
}
const ids = (videos: Video[]) => videos.map(item => item.id);
const modes: VideoSortMode[] = ["relevance", "date-desc", "date-asc"];

describe("Tri local des publications enrichies", () => {
  const videos = [video("middle", "2026-06-01T00:00:00Z"), video("old", "2025-01-01T00:00:00Z"), video("new", "2026-12-01T00:00:00Z")];

  it.each([
    ["relevance", ["middle", "old", "new"]],
    ["date-desc", ["new", "middle", "old"]],
    ["date-asc", ["old", "middle", "new"]],
  ] as const)("applique %s", (mode, expected) => {
    expect(ids(sortVideos(videos, mode))).toEqual(expected);
  });

  it.each(modes)("ne modifie ni le tableau source ni les objets : %s", mode => {
    const source = Object.freeze(videos.map(item => Object.freeze({ ...item })));
    const before = JSON.stringify(source);
    const sorted = sortVideos(source, mode);
    expect(sorted).not.toBe(source);
    expect(JSON.stringify(source)).toBe(before);
    expect(sorted.every(item => source.includes(item))).toBe(true);
    expect(ids(sortVideos(source, "relevance"))).toEqual(["middle", "old", "new"]);
  });

  it.each(["date-desc", "date-asc"] as const)("conserve l'ordre source des dates identiques : %s", mode => {
    const source = [video("first", "2026-01-01T00:00:00Z"), video("second", "2026-01-01T01:00:00+01:00"), video("third", "2025-12-31T19:00:00-05:00")];
    expect(ids(sortVideos(source, mode))).toEqual(["first", "second", "third"]);
  });

  it("compare les instants et les heures, pas le jour ou le texte affiché", () => {
    const source = [video("late", "2026-01-01T00:30:00-01:00"), video("early", "2026-01-01T01:00:00+02:00"), video("middle", "2026-01-01T00:00:00Z")];
    expect(ids(sortVideos(source, "date-asc"))).toEqual(["early", "middle", "late"]);
    expect(ids(sortVideos(source, "date-desc"))).toEqual(["late", "middle", "early"]);
  });

  it("conserve toute la précision des fractions, y compris sous la milliseconde", () => {
    const source = [
      video("second", "2026-01-01T00:00:00.10000000000000000002Z"),
      video("first", "2026-01-01T00:00:00.10000000000000000001Z"),
      video("zero", "2026-01-01T00:00:00Z"),
      video("short", "2026-01-01T00:00:00.1Z"),
      video("same", "2026-01-01T01:00:00.10000+01:00"),
      video("next", "2026-01-01T00:00:01Z"),
    ];
    expect(ids(sortVideos(source, "date-asc"))).toEqual(["zero", "short", "same", "first", "second", "next"]);
    expect(ids(sortVideos(source, "date-desc"))).toEqual(["next", "second", "first", "short", "same", "zero"]);
  });

  const invalidDates = [null, "", "invalid", "2026-01-01", "2026-01-01T00:00:00", "2026-02-30T00:00:00Z", "2026-04-31T00:00:00Z", "2026-02-29T00:00:00Z", "1900-02-29T00:00:00Z", "2026-13-01T00:00:00Z", "2026-00-01T00:00:00Z", "2026-01-00T00:00:00Z", "2026-01-01T24:00:00Z", "2026-01-01T00:60:00Z", "2026-01-01T00:00:60Z", "2026-01-01T00:00:00+24:00", "2026-01-01T00:00:00+00:60", "0000-01-01T00:00:00Z", " 2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z\n"];
  it.each(["date-desc", "date-asc"] as const)("place toutes les dates indisponibles en fin sans les réordonner : %s", mode => {
    const invalid = invalidDates.map((date, index) => video(String(index), date));
    const source = [invalid[0], videos[0], ...invalid.slice(1), videos[1]];
    const validOrder = mode === "date-asc" ? ["old", "middle"] : ["middle", "old"];
    expect(ids(sortVideos(source, mode))).toEqual([...validOrder, ...invalid.map(item => item.id)]);
    expect(ids(sortVideos(source, "relevance"))).toEqual(source.map(item => item.id));
  });

  it("accepte les jours bissextiles et les années à deux premiers chiffres nuls sans les transformer", () => {
    const source = [video("leap", "2000-02-29T00:00:00Z"), video("ancient", "0099-01-01t00:00:00z"), video("leap-next", "2028-02-29T00:00:00Z")];
    expect(ids(sortVideos(source, "date-asc"))).toEqual(["ancient", "leap", "leap-next"]);
  });

  it.each(modes)("gère les listes vide, unitaire et sans date valide : %s", mode => {
    expect(sortVideos([], mode)).toEqual([]);
    const one = [video("one", null)];
    expect(sortVideos(one, mode)).toEqual(one);
    const none = [video("missing", null), video("invalid", "bad")];
    expect(sortVideos(none, mode)).toEqual(none);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VideoCard } from "../src/components/video-card";
import { formatCount, formatDate, type Video } from "../src/lib/youtube";

describe("Données publiques", () => {
  it("préserve les grands entiers, zéro et les valeurs indisponibles", () => {
    expect(formatCount("9007199254740993").replace(/\s/g, "")).toBe("9007199254740993");
    expect(formatCount("0")).toBe("0");
    expect(formatCount(null)).toBe("Indisponible");
    expect(formatDate(null)).toBe("Indisponible");
    expect(formatDate("invalid")).toBe("Indisponible");
  });

  it("affiche les abonnés masqués et un direct sans durée définitive", () => {
    const video: Video = {
      id: "simulated", title: null, thumbnail_url: null, channel_id: null,
      channel_title: null, channel_url: null, published_at: null,
      view_count: null, subscriber_count: null, subscribers_hidden: true,
      duration_iso: "PT0S", duration_label: null, broadcast_status: "live",
      youtube_url: "https://www.youtube.com/watch?v=simulated",
    };
    render(<VideoCard video={video} />);
    expect(screen.getByText("Masqués")).toBeVisible();
    expect(screen.getByText("Direct en cours")).toBeVisible();
    expect(screen.getByText("Titre indisponible")).toBeVisible();
  });
});

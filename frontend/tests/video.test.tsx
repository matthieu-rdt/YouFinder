import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VideoResultsTable } from "../src/components/video-results-table";
import { formatCount, formatDate, type Video } from "../src/lib/youtube";

const video: Video = {
  id: "simulated", title: "Titre simulé", thumbnail_url: "https://example.test/thumbnail.jpg",
  channel_id: "channel", channel_title: "Chaîne simulée",
  channel_url: "https://www.youtube.com/channel/channel",
  published_at: "2026-01-01T23:45:00-02:00",
  view_count: "9007199254740993", subscriber_count: "0", subscribers_hidden: false,
  duration_iso: "PT15M33S", duration_label: "15:33", broadcast_status: "none",
  youtube_url: "https://www.youtube.com/watch?v=simulated",
};

function renderVideos(...videos: Video[]) {
  render(<><h2 id="results-heading">Résultats</h2><VideoResultsTable videos={videos} labelledBy="results-heading" /></>);
}

describe("Données publiques", () => {
  it("préserve les grands entiers, zéro et les valeurs indisponibles", () => {
    expect(formatCount("9007199254740993").replace(/\s/g, "")).toBe("9007199254740993");
    expect(formatCount("0")).toBe("0");
    expect(formatCount(null)).toBe("Indisponible");
    expect(formatDate(null)).toBe("Indisponible");
    expect(formatDate("invalid")).toBe("Indisponible");
  });

  it("associe les cinq colonnes aux valeurs publiques complètes et à la date UTC", () => {
    renderVideos(video, { ...video, id: "large", subscriber_count: "90071992547409931234567890" });
    const table = screen.getByRole("table", { name: "Résultats" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers).toHaveLength(5);
    headers.forEach(header => expect(header).toHaveAttribute("scope", "col"));
    const labels = ["Vidéo / Chaîne", "Vues", "Abonnés", "Publication", "Durée"];
    expect(headers.map(header => header.textContent)).toEqual(labels);
    headers.forEach((header, index) => expect(header).toHaveAccessibleName(labels[index]));
    const [, row, large] = within(table).getAllByRole("row");
    const [identity, views, subscribers, publication, duration] = within(row).getAllByRole("cell");
    expect(within(identity).getByText("1")).toHaveAttribute("aria-hidden", "true");
    expect(within(identity).getByRole("link", { name: "Chaîne simulée" }).parentElement).toHaveTextContent(/^Chaîne simulée$/);
    expect(views.textContent?.replace(/[^\d]/g, "")).toBe(video.view_count);
    expect(subscribers).toHaveAccessibleName("0");
    expect(within(large).getAllByRole("cell")[2].textContent?.replace(/[^\d]/g, ""))
      .toBe("90071992547409931234567890");
    expect(within(publication).getByText("02/01/2026")).toHaveAttribute("datetime", video.published_at);
    expect(duration).toHaveAccessibleName("15:33");
  });

  it("conserve les liens externes et remplace la miniature en erreur sans retirer son lien", () => {
    renderVideos(video);
    const thumbnailLink = screen.getByRole("link", { name: "Voir sur YouTube : Titre simulé" });
    const titleLink = screen.getByRole("link", { name: video.title! });
    const channelLink = screen.getByRole("link", { name: video.channel_title! });
    for (const [link, href] of [[thumbnailLink, video.youtube_url], [titleLink, video.youtube_url], [channelLink, video.channel_url]] as const) {
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAccessibleDescription("Ouvre un nouvel onglet.");
    }
    const thumbnail = within(thumbnailLink).getByAltText("");
    expect(thumbnail).toHaveAttribute("src", video.thumbnail_url);
    expect(thumbnail).toHaveAttribute("referrerpolicy", "no-referrer");
    fireEvent.error(thumbnail);
    expect(thumbnail).not.toBeInTheDocument();
    expect(within(thumbnailLink).getByText("Miniature indisponible")).toBeVisible();
  });

  it("affiche les abonnés masqués, les directs et les données absentes", () => {
    renderVideos({
      ...video, title: null, thumbnail_url: null, channel_id: null,
      channel_title: null, channel_url: null, published_at: null,
      view_count: null, subscriber_count: null, subscribers_hidden: true,
      duration_iso: "PT0S", duration_label: null, broadcast_status: "live",
    }, { ...video, id: "upcoming", duration_label: null, broadcast_status: "upcoming" });
    const [, live] = screen.getAllByRole("row");
    expect(within(live).getByText("Masqués")).toBeVisible();
    expect(within(live).getByText("Direct en cours")).toBeVisible();
    expect(within(live).getByRole("link", { name: "Titre indisponible" })).toBeVisible();
    expect(within(live).getByText("Miniature indisponible")).toBeVisible();
    expect(within(live).getAllByRole("cell", { name: "Indisponible" })).toHaveLength(2);
    expect(within(live).getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Diffusion à venir")).toBeVisible();
  });
});

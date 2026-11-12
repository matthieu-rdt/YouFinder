import { VideoSearch } from "../components/video-search";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">YouFinder</h1>
        <a href="https://www.youtube.com/" className="inline-block" aria-label="Développé avec YouTube">
          <img src="/developed-with-youtube.png" alt="Developed with YouTube" width={233} height={82} />
        </a>
      </header>
      <VideoSearch />
      <footer className="flex flex-wrap gap-5 border-t border-slate-700 pt-5 text-sm text-slate-300">
        <a className="underline" href="https://www.youtube.com/">Données : YouTube</a>
        <a className="underline" href="/confidentialite">Confidentialité</a>
        <a className="underline" href="/conditions">Conditions d’utilisation</a>
        <a className="underline" href="/api/health">Vérifier l’état de l’API</a>
      </footer>
    </main>
  );
}

import { VideoSearch } from "../components/video-search";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-red-400">Projet personnel</p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">YouFinder</h1>
      <p className="text-lg text-slate-300">Recherchez des vidéos avec les données publiques de YouTube.</p>
      <p className="rounded border border-slate-700 p-4">Deux pages de 50 identifiants maximum, soit 100 au total, chargées manuellement, dans l’ordre renvoyé par YouTube. Ces résultats ne représentent pas une analyse exhaustive de YouTube.</p>
      <VideoSearch />
      <footer className="flex flex-wrap gap-5 border-t border-slate-700 pt-5 text-sm text-slate-400">
        <a className="underline" href="https://www.youtube.com/">Données : YouTube</a>
        <a className="underline" href="/confidentialite">Confidentialité</a>
        <a className="underline" href="/conditions">Conditions d’utilisation</a>
        <a className="underline" href="/api/health">Vérifier l’état de l’API</a>
      </footer>
    </main>
  );
}

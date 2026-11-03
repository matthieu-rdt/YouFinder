export default function Terms() {
  return <main className="mx-auto grid max-w-3xl gap-5 px-6 py-12">
    <h1 className="text-3xl font-bold">Conditions d’utilisation</h1>
    <p>En utilisant YouFinder, vous acceptez d’être lié aux <a className="underline" href="https://www.youtube.com/t/terms">conditions d’utilisation de YouTube</a> et acceptez notre <a className="underline" href="/confidentialite">politique de confidentialité</a>.</p>
    <p>Cette application personnelle affiche jusqu’à 10 résultats publics par recherche, dans l’ordre fourni par YouTube. Il ne s’agit pas d’une analyse exhaustive de la plateforme. Aucun contenu audiovisuel n’est téléchargé et aucun score ou indicateur dérivé n’est calculé.</p>
    <p>Les statistiques sont celles disponibles auprès de YouTube au moment de la requête. Les abonnés publics sont arrondis par YouTube. Les valeurs absentes restent indisponibles. La durée fournie par l’API peut différer légèrement de la lecture réelle ; les directs en cours n’ont pas de durée définitive.</p>
    <p>Un plafond quotidien interne limite les tentatives de recherche, indépendamment des quotas Google. Des interruptions, erreurs et retraits de vidéos peuvent survenir. Il n’existe aucune nouvelle tentative automatique.</p>
    <a className="underline" href="/">Retour à YouFinder</a>
  </main>;
}

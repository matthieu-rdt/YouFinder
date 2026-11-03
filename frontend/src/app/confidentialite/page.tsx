export default function Privacy() {
  return <main className="mx-auto grid max-w-3xl gap-5 px-6 py-12">
    <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
    <p>YouFinder est une application personnelle utilisant les services API YouTube. Lorsque vous soumettez une recherche, le backend transmet à Google le mot-clé et les dates renseignées. Google reçoit également l’adresse IP sortante du backend.</p>
    <p>Les résultats publics sont affichés temporairement dans la page. YouFinder ne conserve ni historique, ni résultats dans une base de données ou dans le stockage du navigateur. Aucun compte Google, cookie applicatif ou outil d’analyse d’audience n’est utilisé.</p>
    <p>Seuls le jour et le nombre de tentatives quotidiennes sont enregistrés localement côté backend pour appliquer le plafond. Les journaux techniques du serveur peuvent contenir l’adresse IP et l’URL demandée, y compris les mots-clés et dates. Évitez de saisir des informations personnelles ; la durée de conservation dépend de la configuration locale des journaux.</p>
    <p>Après une recherche, les miniatures sont chargées directement depuis les serveurs indiqués par YouTube ; ces serveurs reçoivent votre adresse IP et les informations techniques du navigateur, qui peut mettre ces images en cache. Les liens externes ouvrent les sites YouTube ou Google, soumis à leurs propres pratiques.</p>
    <p>Consultez les <a className="underline" href="https://policies.google.com/privacy">règles de confidentialité Google</a> et les <a className="underline" href="https://www.youtube.com/t/terms">conditions d’utilisation YouTube</a>.</p>
    <p>Pour effacer les résultats affichés, fermez ou rechargez la page. Le compteur ne contient aucun identifiant personnel. Cette version est destinée à un usage local personnel ; toute ouverture à d’autres utilisateurs nécessitera une révision de cette politique et des modalités de contact.</p>
    <a className="underline" href="/">Retour à YouFinder</a>
  </main>;
}

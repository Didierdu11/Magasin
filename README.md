# Déploiement

1. **Supabase** : créez un projet gratuit sur supabase.com. Ouvrez *SQL Editor*, collez tout `schema.sql`, cliquez *Run*.
2. **Clés** : *Project Settings > API*. Copiez l'URL et la clé `anon public` dans `config.js`. N'utilisez jamais la clé `service_role`.
3. **Codes vendeur** : les codes d'exemple sont 1111, 2222, 3333. Changez-les dans *Table Editor > codes_vendeur*.
4. **Magasins et produits** : modifiez les tables `magasins` et `produits` (stock et prix par magasin) dans *Table Editor*.
5. **GitHub Pages** : créez un dépôt public, déposez les 6 fichiers (`index.html`, `admin.html`, `style.css`, `config.js`, `app.js`, `admin.js`) à la racine. *Settings > Pages > Deploy from a branch > main / root*.
6. **Test** : `https://VOTRE-NOM.github.io/VOTRE-DEPOT/` (client) et `/admin.html` (vendeur).

## Sécurité
- Les codes sont dans une table inaccessible au navigateur et vérifiés par des fonctions SQL.
- Un code à 4 chiffres reste faible : après 5 échecs en 10 minutes, l'accès du magasin est bloqué.
- Les réservations (données clients) ne sont lisibles qu'avec le code vendeur.

# L'Ombre du Seigneur Démon - Montée de niveau

🇬🇧 [English version](README.md)

Module Foundry VTT pour **L'Ombre du Seigneur Démon** : un assistant pour passer au niveau suivant sans rien oublier.

**Compatibilité :** Foundry VTT v13+ (testé sur v14) | Système `demonlord` v6.1.0+

**Langues :** français et anglais, selon la langue choisie dans Foundry.

## Le problème

Dans le système `demonlord`, changer le niveau d'un personnage ajoute les talents du niveau, mais :
- les **choix** (attributs à augmenter, talent ou sort à choisir dans une liste) se font en cochant des cases **dans la fiche de la voie, avant** de monter de niveau, sinon ils sont ignorés ;
- les talents « à choisir » qui n'ont **qu'une option**, comme *Déterminé* au niveau 4 de l'humain, ne sont jamais ajoutés tant qu'on ne les a pas cochés ;
- au niveau 3 et au niveau 7, il faut penser à ajouter soi-même la voie d'expert ou de maître.

## Ce que fait l'assistant

Un bouton **Monter de niveau** apparaît dans le menu de l'en-tête de la fiche de personnage (pour le MJ et le propriétaire du personnage). Il ouvre une fenêtre qui montre, pour le niveau suivant :

1. **La voie à choisir** au niveau 1 (novice), 3 (expert), 7 (maître) ou 11 (légendaire), parmi les voies du monde et de tous les compendiums, avec sa description.
2. **Les gains d'office** de chaque voie et de l'ascendance : Santé, Défense, Pouvoir…, talents, langues, et le talent ou sort qui est le seul « à choisir ».
3. **Les choix du niveau** : attributs (« deux au choix », « trois au choix », « deux ensembles »), talent ou sort dans une liste. Ceux déjà acquis sont grisés. Chaque bloc passe au vert une fois complet.
4. **La magie** : les phrases du type « découvrez une tradition ou apprenez un sort » deviennent des choix guidés (les 44 formulations du livre de base sont reconnues) :
   - **découvrir une tradition** : une tradition pas encore connue, puis l'un de ses sorts de rang 0 ;
   - **apprendre un sort** : d'une tradition connue (ou découverte juste avant, au même niveau), de rang inférieur ou égal à la **Puissance après ce niveau** ;
   - les voies liées à une tradition (Pyromancien : Feu) ne proposent qu'elle ; pour le prêtre, un rappel de choisir une tradition de sa religion ;
   - les talents qui accordent de la magie (*Magie légendaire*, la *Magie* du roublard…) ajoutent leurs choix au niveau dès qu'on les sélectionne ;
   - **magie noire** (Démence, Démonologie, Interdit, Malédiction, Mort, Nécromancie) : +1 Corruption par tradition découverte, et un d6 par sort appris (+1 si le résultat est inférieur au total de sorts noirs appris), comme dans le livre.
   - **possession** (*Compagnon*, Démonologie) : pour chaque sort de Démonologie gagné, un d6 secret ; s'il est inférieur à la Corruption, le MJ reçoit un message privé avec un bouton pour appliquer l'effet *Possédé* quand il le souhaite.
5. **Les choix à faire soi-même**, que le livre décrit seulement en texte (langues et professions), en rappel.

**Plusieurs niveaux d'un coup** : le drapeau de l'en-tête fixe le niveau visé. L'assistant enchaîne les niveaux un par un (les choix d'un niveau dépendent du précédent), poste une carte de chat par niveau, et se ferme une fois le niveau visé atteint.

**Niveaux légendaires** : avec la voie légendaire du *Parangon* (*Philosophie occulte*), l'assistant va jusqu'au niveau 20 : Santé +1 et un talent légendaire par niveau ; les talents cumulables (Agilité légendaire, Santé légendaire…) peuvent être repris. Le MJ peut couper ces niveaux dans les paramètres du module (*Niveaux légendaires*).

Le bouton **Passer au niveau N** coche les choix dans la voie, ajoute les talents, sorts et langues du niveau avec les mêmes marqueurs que le système (redescendre de niveau les retire comme d'habitude), puis change le niveau. Un résumé est posté dans le chat.

Les noms et descriptions sont lus dans les compendiums : avec la traduction française, ils s'affichent en français.

## Pour les macros et les autres modules

```js
game.modules.get("sodl-level-up").api.open(actor);
```

## Limites

- Les choix de langue ou de profession restent à faire sur la fiche : l'assistant les rappelle.
- L'échange d'un sort contre un autre (OSD01, *Échanger des sorts*) n'est pas proposé.
- Les traditions liées à une religion ne sont pas filtrées : le joueur choisit celle de sa religion.
- La création du personnage (ascendance, attributs de départ) n'est pas couverte : l'assistant commence au passage du niveau 0 au niveau 1.

## Installation

Dans Foundry : *Modules complémentaires → Installer un module*, puis collez l'URL du manifeste :

```
https://raw.githubusercontent.com/Stphn-Wrn/sodl-level-up/main/module.json
```

## Développement

```sh
npm test
```

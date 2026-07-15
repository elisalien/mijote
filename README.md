# 🍲 Mijote — planificateur de repas végétariens de saison

**Mijote** est une webapp légère (un seul fichier HTML, sans serveur ni installation) pour planifier ses repas et ses courses de la semaine, en privilégiant les **produits végétariens et vegan de saison** disponibles localement à **Lyon, France**.

👉 **[Ouvrir l'application](https://elisalien.github.io/mijote/)**

## Fonctionnalités

- **Recettes selon le frigo** — propose des recettes à partir des aliments déjà présents chez vous, pour limiter le gaspillage.
- **Planning de la semaine** — composez vos repas jour par jour selon la saison.
- **Liste de courses automatique** — générée à partir du planning, simple et regroupée.
- **Alternatives vegan** — chaque ingrédient d'origine animale est facilement remplaçable (swap en un clic).
- **Convertisseur de denrées** — mesurez vos ingrédients avec ce que vous avez sous la main (ex. de la farine en cl avec un écocup), conversions poids ↔ volume.
- **Saisonnalité Lyon** — les suggestions s'adaptent aux produits de saison de la région.

## Préférences de goûts intégrées

L'outil tient compte de préférences personnelles : pas d'olives (mais huile d'olive ok), pas de tomates ni d'oignons crus (cuits ok), pas de camembert / brie / chèvre, pas de yaourts ni de flocons d'avoine.

## Utilisation (web)

Aucune installation. Ouvrez simplement le lien ci-dessus, ou téléchargez `index.html` et ouvrez-le dans n'importe quel navigateur. Vos données restent dans votre navigateur (stockage local), rien n'est envoyé sur un serveur.

Sur mobile / écran étroit, la navigation passe en barre du bas (Accueil, Frigo, Recettes, Semaine, Courses + menu Plus pour Convertisseur et Réglages).

## Android (APK)

L'app est aussi empaquetée avec **Capacitor** pour Android. Toutes les fonctionnalités web sont disponibles hors-ligne dans l'APK (sauf l'import de recettes par URL, qui nécessite Internet). Le bookmarklet « Siphonner » reste réservé au navigateur desktop.

### Prérequis

- Node.js 18+
- Android Studio (ou Android SDK + JDK 17/21)
- Variables `ANDROID_HOME` / `JAVA_HOME` configurées

### Build

```bash
npm install
npm run cap:sync          # copie index.html → www/ puis sync Android
npx cap open android      # ouvre le projet dans Android Studio
```

Depuis le dossier `android/` :

```bash
./gradlew assembleDebug     # APK debug : android/app/build/outputs/apk/debug/
./gradlew assembleRelease   # APK release (signer avant publication)
```

Package id : `fr.mijote.app`

## Technique

- 100 % HTML / CSS / JavaScript vanilla pour l'UI.
- Capacitor 7 pour le shell Android (Clipboard, Share, Filesystem, App back button, StatusBar).
- Fonctionne hors-ligne une fois la page chargée / l'APK installé.
- Hébergé gratuitement via **GitHub Pages** (web).

## Licence

[MIT](LICENSE) — libre d'utilisation et de modification.

# 🍲 Mijote — planificateur de repas végétariens de saison

**Mijote** aide à planifier repas et courses de la semaine, en privilégiant les **produits végétariens et vegan de saison** disponibles localement à **Lyon, France**.

## Produit : Android APK

La **source de vérité produit** est l’application Android (`fr.mijote.app`), empaquetée avec **Capacitor**. Les nouvelles fonctionnalités (dont le **mode partagé**) ciblent l’APK.

### Prototype web (figé)

La page GitHub Pages ([ouvrir](https://elisalien.github.io/mijote/)) reste un **prototype figé** : pas de nouvelles features web. `index.html` n’est modifié que comme **asset WebView** pour l’APK (`npm run cap:sync` → `www/`).

## Fonctionnalités

- **Recettes selon le frigo** — propose des recettes à partir des aliments déjà présents, pour limiter le gaspillage.
- **Planning de la semaine** — composez vos repas jour par jour selon la saison.
- **Liste de courses automatique** — générée à partir du planning, simple et regroupée.
- **Mode partagé (APK)** — foyer synchronisé en temps réel (courses, recettes, goûts **par personne**).
- **Alternatives vegan** — swap en un clic pour les ingrédients d’origine animale.
- **Convertisseur de denrées** — conversions poids ↔ volume.
- **Saisonnalité Lyon** — suggestions adaptées aux produits de saison de la région.

## Mode partagé (foyer)

Sur l’APK, dans **Réglages → Mode partagé** :

1. Configurer Supabase (voir [`supabase/README.md`](supabase/README.md) et `sync.config.example.js`).
2. **Créer un foyer** (nom de ton profil) → obtenir un code `MIJOTE-XXXXXX` à partager.
3. Les autres appareils **rejoignent** avec le code et choisissent / créent leur profil.
4. Courses, semaine, frigo, recettes ajoutées et goûts de chaque profil se synchronisent automatiquement (plus besoin d’échanger un JSON).

Les goûts sont **par personne** ; le filtre recettes / semaine utilise l’**union** des profils actifs (désactive un profil s’il est absent ce soir).

## Android — build

### Prérequis

- Node.js 18+
- Android Studio (ou Android SDK + JDK 17/21)
- Variables `ANDROID_HOME` / `JAVA_HOME` configurées
- (Mode partagé) projet Supabase + `sync.config.js`

### Build

```bash
npm install
cp sync.config.example.js sync.config.js   # puis renseigner url + anon key
npm run cap:sync          # index.html (+ sync.config.js) → www/ puis sync Android
npx cap open android      # ouvre le projet dans Android Studio
```

Depuis le dossier `android/` :

```bash
./gradlew assembleDebug     # APK debug : android/app/build/outputs/apk/debug/
./gradlew assembleRelease   # APK release (signer avant publication)
```

Package id : `fr.mijote.app`

## Technique

- UI : HTML / CSS / JavaScript vanilla (asset Capacitor).
- Capacitor 7 : Clipboard, Share, Filesystem, App back button, StatusBar.
- Sync foyer : Supabase (Postgres + Realtime), schéma dans `supabase/migrations/`.
- Hors ligne : cache `localStorage` ; flush sync à la reconnexion.
- Prototype web : GitHub Pages (non maintenu pour les nouvelles features).

## Licence

[MIT](LICENSE) — libre d'utilisation et de modification.

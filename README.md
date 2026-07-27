# 🍲 Mijote — planificateur de repas végétariens de saison

**Mijote** aide à planifier repas et courses de la semaine, en privilégiant les **produits végétariens et vegan de saison** disponibles localement à **Lyon, France**.

👉 **[Ouvrir la webapp](https://elisalien.github.io/mijote/)** · **[Télécharger l’APK Android](release/mijote-1.1.0-glass-sync-debug.apk)**

## Web + Android — même app, même sync

| Surface | Rôle |
| --- | --- |
| **Web** (GitHub Pages) | Navigateur : planning, frigo, courses, mode partagé |
| **APK** (`fr.mijote.app`) | App Android Capacitor : même UI, hors-ligne, partage natif |

Les deux partagent le **même `index.html`** et le **même protocole de sync foyer** (Supabase). Un code `MIJOTE-XXXXXX` créé sur le téléphone fonctionne dans le navigateur (et inversement), à condition d’utiliser le **même projet Supabase**.

## Fonctionnalités

- **Recettes selon le frigo** — propose des recettes à partir des aliments déjà présents, pour limiter le gaspillage.
- **Planning de la semaine** — composez vos repas jour par jour selon la saison.
- **Liste de courses automatique** — générée à partir du planning, simple et regroupée.
- **Mode partagé (web ↔ APK)** — foyer synchronisé (courses, recettes, goûts **par personne**).
- **Alternatives vegan** — swap en un clic pour les ingrédients d’origine animale.
- **Convertisseur de denrées** — conversions poids ↔ volume.
- **Saisonnalité Lyon** — suggestions adaptées aux produits de saison de la région.

## Mode partagé (foyer)

Dans **Réglages → Mode partagé** (web ou APK) :

1. Configurer Supabase (panneau intégré, ou `sync.config.js` — voir [`supabase/README.md`](supabase/README.md)).
2. **Créer un foyer** (nom de profil) → code `MIJOTE-XXXXXX` à partager.
3. Sur l’autre appareil (web ou APK) : **même config Supabase** → **Rejoindre** avec le code → choisir / créer le profil.
4. Courses, semaine, frigo, recettes et goûts se synchronisent (plus besoin d’échanger un JSON).

Les goûts sont **par personne** ; le filtre recettes / semaine utilise l’**union** des profils actifs.

## Android — build & APK

### APK prêt à installer

Un build debug synchro est versionné ici :

- [`release/mijote-1.1.0-glass-sync-debug.apk`](release/mijote-1.1.0-glass-sync-debug.apk)

Pour une release Play Store, préférer un **AAB signé** (voir plus bas).

### Prérequis build

- Node.js 18+
- Android Studio (ou Android SDK + JDK 17/21)
- Variables `ANDROID_HOME` / `JAVA_HOME` configurées
- (Mode partagé) projet Supabase + `sync.config.js` **ou** config saisie dans l’app

### Build

```bash
npm install
cp sync.config.example.js sync.config.js   # optionnel : url + anon key
npm run cap:sync          # index.html (+ sync.config.js) → www/ puis sync Android
npx cap open android      # ouvre le projet dans Android Studio
```

Depuis le dossier `android/` :

```bash
./gradlew assembleDebug     # APK debug : android/app/build/outputs/apk/debug/
./gradlew bundleRelease     # AAB release signé : android/app/build/outputs/bundle/release/
```

Package id : `fr.mijote.app`

### Publier sur le Google Play Store

Google Play exige un **Android App Bundle (.aab)** signé (plus l'APK) pour toute nouvelle app.

1. **Compte développeur** : créer un compte sur [Google Play Console](https://play.google.com/console) (25 $, paiement unique).
2. **Clé de signature** (une seule fois, à conserver précieusement — sans elle, impossible de publier une mise à jour) :
   ```bash
   keytool -genkeypair -v -keystore mijote-release.keystore -alias mijote \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   Place le fichier à la racine du repo (il est gitignoré), puis :
   ```bash
   cp android/keystore.properties.example android/keystore.properties
   # éditer android/keystore.properties avec les mots de passe choisis
   ```
   `android/keystore.properties` et `*.keystore` sont gitignorés — **ne jamais les committer**. Sauvegarde le fichier `.keystore` + les mots de passe dans un gestionnaire de mots de passe ou un coffre hors-ligne.
   Alternative sans fichier local : variables d'env `MIJOTE_KEYSTORE_PATH`, `MIJOTE_KEYSTORE_PASSWORD`, `MIJOTE_KEY_ALIAS`, `MIJOTE_KEY_PASSWORD`.
3. **Bump la version** avant chaque nouvel envoi : `versionCode` (entier, doit strictement augmenter) et `versionName` dans `android/app/build.gradle`.
4. **Build** :
   ```bash
   npm run cap:sync
   cd android && ./gradlew bundleRelease
   ```
   Artefact : `android/app/build/outputs/bundle/release/app-release.aab`.
5. **Play Console** : Créer l'app → Production (ou test interne) → Créer une version → uploader l'AAB → fiche store (textes, captures, classification du contenu, politique de confidentialité).

## Technique

- UI : HTML / CSS / JavaScript vanilla (asset Capacitor + GitHub Pages).
- Capacitor 7 : Clipboard, Share, Filesystem, App back button, StatusBar.
- Sync foyer : Supabase (Postgres RPC + poll), schéma dans `supabase/migrations/`.
- Config sync : panneau Réglages (localStorage) et/ou `sync.config.js` (gitignoré).
- Hors ligne : cache `localStorage` ; flush sync à la reconnexion.

## Licence

[MIT](LICENSE) — libre d'utilisation et de modification.

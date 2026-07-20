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
   Sortie : `android/app/build/outputs/bundle/release/app-release.aab`.
5. **Play Console** → créer l'app → première version envoyée dans une piste de test interne (recommandé avant la production) → activer **Play App Signing** (Google gère alors la clé de signature finale ; tu ne gères que la « clé d'upload », récupérable via Google si perdue — fortement recommandé pour une nouvelle app).
6. Remplir la fiche store : description, captures d'écran, icône, **politique de confidentialité** (obligatoire, même pour une app locale-first), classification de contenu, formulaire de sécurité des données.
7. Soumettre à la revue (généralement quelques heures à 1-2 jours).

## Technique

- UI : HTML / CSS / JavaScript vanilla (asset Capacitor).
- Capacitor 7 : Clipboard, Share, Filesystem, App back button, StatusBar.
- Sync foyer : Supabase (Postgres + Realtime), schéma dans `supabase/migrations/`.
- Hors ligne : cache `localStorage` ; flush sync à la reconnexion.
- Prototype web : GitHub Pages (non maintenu pour les nouvelles features).

## Licence

[MIT](LICENSE) — libre d'utilisation et de modification.

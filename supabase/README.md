# Supabase — mode partagé Mijote (web + APK)

Le même projet Supabase sert la **webapp** (GitHub Pages) et l’**APK Android**. Un foyer créé d’un côté se rejoint de l’autre avec le code `MIJOTE-XXXXXX`.

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`migrations/20260716140000_households.sql`](migrations/20260716140000_households.sql).
3. In **Database → Replication**, ensure `households` is enabled for Realtime (the migration tries to add it).
4. Copy project URL + **anon** key from **Settings → API**.
5. Configure clients (pick one or both) :

### Dans l’app (recommandé pour le web)

**Réglages → Mode partagé → Configurer la synchronisation** : coller URL + clé anon. Stocké en `localStorage` (`mijote_sync_cfg`), valable web et APK sans rebuild.

### Fichier de build (APK / Pages)

```bash
cp sync.config.example.js sync.config.js
# edit sync.config.js with url + anon key
npm run cap:sync   # copie aussi vers www/ pour l’APK
```

`sync.config.js` is gitignored — never commit real keys. The anon key is public by design; do **not** use the service_role key.

## Security model

Household rows are reachable with the anon key; the **unlisted code** (`MIJOTE-XXXXXX`) is the access secret. Fine for a small private foyer, not for public multi-tenant data.

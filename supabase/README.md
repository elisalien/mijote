# Supabase — mode partagé Mijote (APK)

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`migrations/20260716140000_households.sql`](migrations/20260716140000_households.sql).
3. In **Database → Replication**, ensure `households` is enabled for Realtime (the migration tries to add it).
4. Copy project URL + **anon** key from **Settings → API**.
5. At the repo root:

```bash
cp sync.config.example.js sync.config.js
# edit sync.config.js with url + anonKey
npm run cap:sync
```

## Security model

Household rows are reachable with the anon key; the **unlisted code** (`MIJOTE-XXXXXX`) is the access secret. Fine for a small private foyer, not for public multi-tenant data.

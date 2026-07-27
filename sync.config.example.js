// Copy to sync.config.js and fill with your Supabase project values.
// sync.config.js is gitignored — never commit real keys.
// Use the anon/public key only (Project Settings → API). Never put the service_role key in the app.
//
// Same url + anonKey on web and APK → shared household sync via MIJOTE-XXXXXX codes.
// Alternative without a file: Réglages → Mode partagé → Configurer la synchronisation (localStorage).
window.MIJOTE_SYNC = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};

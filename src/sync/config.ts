// Supabase project for optional cloud sync. Both values are public by design:
// the publishable key only allows what Row Level Security permits, and every
// row is restricted to its signed-in owner (see supabase/schema.sql).
// Build-time env vars override these (used by tests).
const projectUrl = "";
const publishableKey = "";
export const supabaseUrl: string =
  import.meta.env.VITE_SUPABASE_URL || projectUrl;
export const supabaseKey: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || publishableKey;
export const cloudConfigured = Boolean(supabaseUrl && supabaseKey);

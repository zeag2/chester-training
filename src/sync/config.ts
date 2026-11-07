/** Where Chester's shared copy lives. The publishable key is meant to ship in the app; access is guarded by row-level security. */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? '';
export const sharingConfigured = () => !!(SUPABASE_URL && SUPABASE_KEY);

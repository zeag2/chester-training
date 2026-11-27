/** Where Chester's shared copy lives. The publishable key is meant to ship in the app; access is guarded by row-level security. */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://vtcufhddooqzckjcpzwn.supabase.co';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_TZ3YYXmWu84Gx29K_SF9EA_5ZW1OhlF';
/** Web Push's public (VAPID) key: public by design; its private half lives only in the project's Vault
    (push_vapid_private, read by send-push). Generated 2026-11-26, replacing the 2026-11-23 key whose private half was
    lost; phones subscribed with the old key re-subscribe on start (src/lib/push.ts). Empty turns notifications off. */
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? 'BFTJa8EHSDMdgvhIOi3cjahSM1ea_7E4lU3nheO2pWcAXWvp5F_IQ25dRJ0iyw_Bd1bA04_mwvGnoHCn5KAZsgs';
export const sharingConfigured = () => !!(SUPABASE_URL && SUPABASE_KEY);

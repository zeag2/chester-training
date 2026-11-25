/** Where Chester's shared copy lives. The publishable key is meant to ship in the app; access is guarded by row-level security. */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://vtcufhddooqzckjcpzwn.supabase.co';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_TZ3YYXmWu84Gx29K_SF9EA_5ZW1OhlF';
/** Web Push's public (VAPID) key: public by design; its private half is a secret of the send-push Edge Function.
    Generated 2026-11-23 (docs/plans/2026-11-23-push-notifications.md). Empty turns notifications off in the app. */
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? 'BEhGzXYFCt6eMQrQiZrrvo_6lMgt1g6mlbMpOqP045osOH_GaFG6l7OeC6AHsuXwfuOLcqysbwz_M-rJAPn2650';
export const sharingConfigured = () => !!(SUPABASE_URL && SUPABASE_KEY);

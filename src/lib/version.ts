declare const __APP_VERSION__: string;
/** This build's version ("0.1.0 (a1b2c3d)"), set in vite.config.ts. Sent with "Contact us" messages. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

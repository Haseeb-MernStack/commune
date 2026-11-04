/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Address of the realtime (Socket.IO) service. Leave unset to use polling only. */
  readonly VITE_REALTIME_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_FEED_SLOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

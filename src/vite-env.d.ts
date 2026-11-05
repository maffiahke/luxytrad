/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_LIVE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

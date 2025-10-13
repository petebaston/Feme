/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_B2B_URL: string;
  readonly VITE_STORE_HASH: string;
  readonly VITE_CHANNEL_ID: string;
  readonly VITE_LOCAL_APP_CLIENT_ID: string;
  readonly VITE_IS_LOCAL_ENVIRONMENT: string;
  readonly VITE_ASSETS_ABSOLUTE_PATH: string;
  readonly VITE_DISABLE_BUILD_HASH: string;
  readonly REPL_SLUG: string;
  readonly REPL_OWNER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface B3CheckoutConfig {
  routes: {
    dashboard: string;
  };
}

interface B3Settings {
  setting: {
    store_hash: string;
    channel_id: number;
  };
  'dom.checkoutRegisterParentElement': string;
  'dom.registerElement': string;
  'dom.openB3Checkout': string;
  before_login_goto_page: string;
  checkout_super_clear_session: string;
  'dom.navUserLoginElement': string;
}

declare global {
  interface Window {
    b3CheckoutConfig: B3CheckoutConfig;
    B3: B3Settings;
  }
}

export {};

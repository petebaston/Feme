export const config = {
  b2bApiUrl: import.meta.env.VITE_B2B_URL || 'https://api-b2b.bigcommerce.com',
  storeHash: import.meta.env.VITE_STORE_HASH || '',
  channelId: import.meta.env.VITE_CHANNEL_ID || '1',
  appClientId: import.meta.env.VITE_LOCAL_APP_CLIENT_ID || '',
  isLocalEnvironment: import.meta.env.VITE_IS_LOCAL_ENVIRONMENT === 'TRUE',
  assetsAbsolutePath: import.meta.env.VITE_ASSETS_ABSOLUTE_PATH || '',
  disableBuildHash: import.meta.env.VITE_DISABLE_BUILD_HASH === 'TRUE',
};

export const getBigCommerceConfig = () => {
  const repl = import.meta.env.REPL_SLUG;
  const replOwner = import.meta.env.REPL_OWNER;
  
  return {
    ...config,
    // Use Replit URL if available for development
    baseUrl: repl && replOwner ? `https://${repl}.${replOwner}.repl.co` : window.location.origin,
  };
};

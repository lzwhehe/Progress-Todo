import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.vibecoding.progresstodo',
  appName: 'Progress Todo',
  webDir: 'ios-web-fallback',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: false,
      }
    : undefined,
  ios: {
    contentInset: 'automatic',
  },
};

export default config;

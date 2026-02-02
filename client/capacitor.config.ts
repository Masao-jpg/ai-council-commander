import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aicouncil.commander',
  appName: 'AI Council Commander',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true // Allow HTTP connections to localhost/LAN
  }
};

export default config;

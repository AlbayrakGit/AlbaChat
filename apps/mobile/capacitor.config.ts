import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.albachat.mobile',
  appName: 'AlbaChat',
  webDir: '../web/dist',
  server: {
    // Sunucuyu doğrudan yükle — relative path'ler (/api, /socket.io) çalışır
    url: 'http://95.0.18.60:8080',
    cleartext: true, // HTTP (non-SSL) bağlantıya izin ver
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#1e3a5f',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1e3a5f',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;

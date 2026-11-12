import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.nextelecom.redenex',
  appName: 'Rede Nex',
  webDir: 'dist',
  server: {
    url: 'https://rede.nextelecom.net.br',
    cleartext: false,
    allowNavigation: ['rede.nextelecom.net.br'],
    errorPath: 'native-offline.html'
  },
  plugins: {
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'DARK' }
  },
  android: {
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0f172a'
  }
};

export default config;

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.nextelecom.redenex',
  appName: 'Rede Nex',
  webDir: 'dist',
  server: {
    url: 'https://rede.nextelecom.net.br',
    cleartext: false,
    allowNavigation: ['rede.nextelecom.net.br']
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0f172a'
  }
};

export default config;

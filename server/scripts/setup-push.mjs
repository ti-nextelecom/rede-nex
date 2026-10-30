import '../src/env.js';
import { setupPushKeys,pushKeysPath } from '../src/browser-push.mjs';
setupPushKeys();
console.log('Chaves Web Push persistentes prontas em: '+pushKeysPath());

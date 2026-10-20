import './env.js';
import { resolve } from 'node:path';

// Defaults deliberately preserve the existing VM layout. Changing these variables
// does NOT move old files: copy/verify them in a maintenance window first.
export const mediaUploadsDir = resolve(process.env.UPLOADS_DIR || '/opt/rede-nex/uploads');
export const jrhUploadsDir = resolve(process.env.JRH_UPLOADS_DIR || '/opt/rede-nex/deploy_v2/uploads/jrh');
export const pcUploadsDir = resolve(process.env.PC_UPLOADS_DIR || 'public/uploads/pc-anexos');
export const downloadsDir = resolve(process.env.DOWNLOADS_DIR || '/opt/rede-nex/downloads');

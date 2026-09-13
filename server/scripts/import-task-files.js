#!/usr/bin/env node
// import-task-files.js
// Imports Bitrix24 task attachments into the task_files table.
// Requires BITRIX_WEBHOOK_URL in .env and must run from /opt/rede-nex/deploy_v2/
// Usage: node server/scripts/import-task-files.js [--dry-run] [--limit N]

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../src/env.js';
import { pool } from '../src/db.js';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_ARG >= 0 ? parseInt(process.argv[LIMIT_ARG + 1], 10) : null;
const DELAY_MS = 500; // 2 req/s max to Bitrix

const BITRIX_BASE = (process.env.BITRIX_WEBHOOK_URL || '').replace(/\/$/, '');
if (!BITRIX_BASE) {
  console.error('BITRIX_WEBHOOK_URL não configurado no .env');
  process.exit(1);
}

async function callBitrix(method, params = {}) {
  const url = `${BITRIX_BASE}/${method}.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Bitrix HTTP ${res.status} em ${method}`);
  const payload = await res.json();
  if (payload.error) throw new Error(`${payload.error}: ${payload.error_description || ''}`);
  return payload;
}

async function getTaskFiles(bitrixTaskId) {
  try {
    const payload = await callBitrix('tasks.task.files.get', { taskId: bitrixTaskId });
    return (payload.result?.files || []);
  } catch {
    // fallback: tasks.task.get with UF_FILE
    try {
      const t = await callBitrix('tasks.task.get', {
        taskId: bitrixTaskId,
        select: ['ID', 'UF_FILE'],
      });
      const fileIds = t.result?.task?.UF_FILE || [];
      if (!fileIds.length) return [];
      // Resolve each file ID to metadata
      const files = [];
      for (const fid of fileIds) {
        try {
          const f = await callBitrix('disk.file.get', { id: fid });
          const file = f.result;
          files.push({
            ID: String(file.ID),
            NAME: file.NAME,
            DOWNLOAD_URL: file.DOWNLOAD_URL || null,
            SIZE: file.SIZE ? parseInt(file.SIZE, 10) : null,
            EXTENSION: file.EXTENSION || null,
          });
        } catch {}
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
      return files;
    } catch {
      return [];
    }
  }
}

async function run() {
  const client = await pool.connect();
  try {
    // Load tasks with bitrix_id that don't already have files imported
    const { rows: tasks } = await client.query(
      `SELECT t.id, t.bitrix_id, t.title,
              (SELECT COUNT(*) FROM task_files tf WHERE tf.task_id = t.id AND tf.bitrix_file_id IS NOT NULL) AS existing_files
       FROM tasks t
       WHERE t.bitrix_id IS NOT NULL
       ORDER BY t.created_at DESC
       ${LIMIT ? `LIMIT ${LIMIT}` : ''}`
    );

    console.log(`Tasks with Bitrix ID: ${tasks.length}${LIMIT ? ` (limited to ${LIMIT})` : ''}`);
    if (DRY_RUN) console.log('[DRY-RUN mode — no writes]');

    let imported = 0, skipped = 0, errors = 0, totalFiles = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (parseInt(task.existing_files, 10) > 0) {
        skipped++;
        continue;
      }

      process.stdout.write(`[${i + 1}/${tasks.length}] Task ${task.bitrix_id}: ${task.title.slice(0, 40)}... `);

      let files;
      try {
        files = await getTaskFiles(task.bitrix_id);
      } catch (e) {
        console.log(`ERROR: ${e.message}`);
        errors++;
        await new Promise(r => setTimeout(r, DELAY_MS));
        continue;
      }

      if (!files.length) {
        console.log('no files');
        await new Promise(r => setTimeout(r, DELAY_MS));
        continue;
      }

      console.log(`${files.length} file(s)`);
      totalFiles += files.length;

      if (!DRY_RUN) {
        for (const file of files) {
          try {
            await client.query(
              `INSERT INTO task_files (task_id, name, file_url, file_type, file_size, bitrix_file_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT DO NOTHING`,
              [
                task.id,
                file.NAME || `arquivo_${file.ID}`,
                file.DOWNLOAD_URL || '',
                file.EXTENSION ? `.${file.EXTENSION.toLowerCase()}` : null,
                file.SIZE || null,
                String(file.ID),
              ]
            );
          } catch (e) {
            console.error(`  DB error for file ${file.ID}: ${e.message}`);
          }
        }
      }

      imported++;
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log(`\n=== Done ===`);
    console.log(`Tasks processed: ${imported} | Skipped (already imported): ${skipped} | Errors: ${errors}`);
    console.log(`Total files imported: ${totalFiles}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

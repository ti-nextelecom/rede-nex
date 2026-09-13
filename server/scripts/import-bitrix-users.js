import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../src/env.js';
import { fetchBitrixUsers } from '../src/bitrix.client.js';
import { importBitrixUsers } from '../src/bitrix.repository.js';
import { pool } from '../src/db.js';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function splitCsvLine(line, separator) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values.map(value => value.replace(/^"|"$/g, ''));
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(lines[0], separator);

  return lines.slice(1).map(line => {
    const values = splitCsvLine(line, separator);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function parseFile(filePath) {
  const content = readFileSync(resolve(filePath), 'utf8');
  if (filePath.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.users || parsed.result || [];
  }
  return parseCsv(content);
}

async function main() {
  const file = argValue('--file');
  const source = file ? (file.endsWith('.json') ? 'json' : 'csv') : 'webhook';
  const users = file ? parseFile(file) : await fetchBitrixUsers();

  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('Nenhum usuario encontrado para importar.');
  }

  const result = await importBitrixUsers(users, source);
  console.log(JSON.stringify({
    received: users.length,
    imported: result.imported.length,
    skipped: result.skipped,
    import_id: result.import.id,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

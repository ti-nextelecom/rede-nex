import './env.js';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query('CREATE TABLE IF NOT EXISTS nav_settings (role_name VARCHAR(100) PRIMARY KEY, visible_routes JSONB, updated_at TIMESTAMPTZ DEFAULT now())');
  const r = await pool.query("SELECT to_regclass('nav_settings') as t");
  console.log('OK table:', r.rows[0].t);
} catch(e) { console.error('ERR:', e.message); }
finally { await pool.end(); }

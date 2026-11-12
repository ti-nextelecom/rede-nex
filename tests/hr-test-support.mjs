// Isolated test cluster only. No .env import, production URL or real personal data.
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hrTransaction, saveHrRecord } from '../server/src/hr.js';
export const ids = { admin:'10000000-0000-4000-8000-000000000001',employee:'10000000-0000-4000-8000-000000000002',manager:'10000000-0000-4000-8000-000000000003',blocked:'10000000-0000-4000-8000-000000000004',adminRole:'20000000-0000-4000-8000-000000000001',employeeRole:'20000000-0000-4000-8000-000000000002',managerRole:'20000000-0000-4000-8000-000000000003' };
export async function createHrTestDb() {
  const adminPool = new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_test',database:'postgres',connectionTimeoutMillis:3000});
  const database = 'rh_module_test_'+process.pid+'_'+Date.now();
  if (!(await adminPool.query("SELECT 1 FROM pg_roles WHERE rolname='rh_app'")).rowCount) await adminPool.query('CREATE ROLE rh_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE');
  await adminPool.query(`CREATE DATABASE ${database} OWNER rh_app`);
  const pool = new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_app',database,connectionTimeoutMillis:3000});
  await pool.query('CREATE TABLE public.roles(id uuid PRIMARY KEY,name text NOT NULL); CREATE TABLE public.departments(id uuid PRIMARY KEY,name text); CREATE TABLE public.users(id uuid PRIMARY KEY,name text NOT NULL,email text,role_id uuid REFERENCES public.roles(id),status text NOT NULL,photo_url text,position text,admission_date date,department_id uuid REFERENCES public.departments(id))');
  await pool.query('INSERT INTO roles VALUES($1,\'Administrador\'),($2,\'Colaborador\'),($3,\'Gestor\')',[ids.adminRole,ids.employeeRole,ids.managerRole]);
  for (const [id,name,role] of [[ids.admin,'Admin RH de Teste',ids.adminRole],[ids.employee,'Ana Teste RH',ids.employeeRole],[ids.manager,'Bruno Teste Gestor',ids.managerRole],[ids.blocked,'Carla Sem Acesso',ids.employeeRole]]) await pool.query('INSERT INTO users(id,name,email,role_id,status) VALUES($1,$2,$3,$4,\'active\')',[id,name,'teste@example.invalid',role]);
  const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#ffe4d1"/><circle cx="32" cy="24" r="12" fill="#ea580c"/><path d="M9 64a23 23 0 0 1 46 0" fill="#ea580c"/></svg>');
  await pool.query('UPDATE users SET photo_url=$1,position=\'Cargo fictício\',admission_date=\'2020-01-01\' WHERE id=$2',[photo,ids.employee]);
  const migration = await readFile(new URL('../server/migrations/20261016_hr_module.sql',import.meta.url),'utf8');
  await pool.query(migration); await pool.query(migration); // idempotency under FORCE RLS
  await pool.query(await readFile(new URL('../server/migrations/20261027_hr_employee_termination.sql',import.meta.url),'utf8'));
  await hrTransaction(pool,ids.admin,async client => {
    const employee = await saveHrRecord(client,'employees',{user_id:ids.employee,employee_code:'TESTE-001',team:'Equipe de Teste',position:'Cargo de Teste'});
    await saveHrRecord(client,'asos',{employee_id:employee.id,last_exam_on:'2024-01-01',periodicity_months:12,notes:'Registro inteiramente fictício.'});
    await saveHrRecord(client,'vacations',{employee_id:employee.id,acquisition_start:'2024-01-01',acquisition_end:'2024-12-31',concession_end:'2025-12-31',balance_days:'30',leave_days:20,bonus_days:10,status:'draft'});
  });
  await adminPool.end();
  return {pool,database,id:randomUUID};
}

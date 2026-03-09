import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Client } = pg;

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query('SELECT count(*) FROM auth.users');
    console.log('Users:', res.rows[0].count);
    const res2 = await client.query('SELECT * FROM public.site_settings');
    console.log('Settings:', res2.rows);
    console.log('Connection successful!');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

test();

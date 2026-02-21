import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Missing DATABASE_URL in .env');
  console.error('   Get it from: Supabase Dashboard → Settings → Database → URI');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const SQL = `
-- Create profiles linked to auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  favorite_tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Config for Admin Theming
CREATE TABLE IF NOT EXISTS site_settings (
  id INT PRIMARY KEY DEFAULT 1,
  primary_color TEXT DEFAULT '#8b5cf6',
  background_dark TEXT DEFAULT '#0f172a',
  theme_mode TEXT DEFAULT 'dark'
);
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Base tables
CREATE TABLE IF NOT EXISTS manga (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  cover TEXT,
  genre TEXT[] DEFAULT '{}',
  rating NUMERIC(3,1) DEFAULT 0,
  status TEXT DEFAULT 'Ongoing',
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Library table linked to profiles
CREATE TABLE IF NOT EXISTS library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  manga_id UUID REFERENCES manga(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, manga_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  chapter TEXT,
  status TEXT DEFAULT 'Scraping',
  progress INT DEFAULT 0,
  cover TEXT,
  time_remaining TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  chapter TEXT,
  source TEXT,
  date TEXT,
  status TEXT DEFAULT 'Completed',
  cover TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for automatically creating a profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger just in case
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- We can't automatically seed history/tasks easily without a user_id now, so we'll skip seeding them for now,
-- or we let them be null if we alter them instead. For safety, we added user_id but we need to alter existing tables gracefully.
-- So let's alter existing tables to add user_id instead of just creating.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
`;

async function main() {
  console.log('🔌 Connecting to Supabase database...');
  await client.connect();
  console.log('✅ Connected!\n');
  console.log('🏗️  Creating tables and seeding data...');
  await client.query(SQL);
  console.log('✅ Tables created and data seeded!\n');
  console.log('🎉 Database is ready. Restart your server: npx tsx server.ts');
  await client.end();
}

main().catch(async (err) => {
  console.error('❌ Error:', err.message);
  await client.end();
  process.exit(1);
});

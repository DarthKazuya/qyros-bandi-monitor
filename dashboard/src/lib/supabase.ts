import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url) {
  throw new Error('VITE_SUPABASE_URL non è impostata (vedi .env.example)');
}
if (!anonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY non è impostata (vedi .env.example)');
}

export const supabase = createClient(url, anonKey);


import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Supabase Configuration
const SUPABASE_PROJECT_URL = process.env.SUPABASE_URL || 'https://ypvwihbpyduwyamvcznp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdndpaGJweWR1d3lhbXZjem5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODY3MTEsImV4cCI6MjA5MDg2MjcxMX0.gzzjuVEFSlgJLXV7nxjA_lS9Wq0sif2Lbt8U6JKybpg';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = {
  projectUrl: SUPABASE_PROJECT_URL,
  anonKey: SUPABASE_ANON_KEY,
  serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY
};

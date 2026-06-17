// Configuração do cliente Supabase
const SUPABASE_URL = "https://zqirtoukooxnvwceurtb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxaXJ0b3Vrb294bnZ3Y2V1cnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDM5OTcsImV4cCI6MjA5NzI3OTk5N30.QPO0KbnEYuSk606pT4XW7Tk_EjDTCsf0ZMeNRcTktsE";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabaseClient;
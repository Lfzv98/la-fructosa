// Configuración de Supabase para La Fructosa
const SUPABASE_URL = "https://bkausossugbbyfsersmb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yNEvh9BPnRoTVDbfQAa0ZQ_AF3gJgVE";

// Inicializar cliente de Supabase
if (typeof supabase !== 'undefined') {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error("Supabase SDK no está cargado.");
}


// Remplacez par les valeurs de Supabase > Project Settings > API
const SUPABASE_URL = "https://syaiqtkcdnusuyannkoa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HfBJOSOMbUXmLxVdr4zwvw_S_Zzjog0";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const euro = n => Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

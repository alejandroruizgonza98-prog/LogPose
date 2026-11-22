/* Log Pose · configuración.
   Pon aquí la URL de tu proyecto de Supabase y su clave "publishable" (o "anon").
   Las dos están en Supabase → Project Settings → API. Son públicas por diseño:
   lo que protege los datos son las reglas del archivo schema.sql y el código de tripulación.
   Si las dejas vacías, la app funciona solo en este móvil (sin sincronizar). */
window.LP_CONFIG = {
  SUPABASE_URL: 'https://zbtzqahsmysvhidqmtsa.supabase.co',
  SUPABASE_KEY: 'sb_publishable_bx9ZHxfdarxLGFkOwN0UMA_oE6bKdTA',
  // dirección pública de la web: la usan los enlaces de invitación (también desde el APK)
  PUBLIC_URL: 'https://alejandroruizgonza98-prog.github.io/LogPose/',
  DEFAULT_EVENT: { id: 'ev-alicante-2026', name: 'Regional de Alicante', date: '2026-11-28', city: 'Elche (Alicante)', rounds: 0, mins: 35 },
};

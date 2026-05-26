/**
 * First-time Firestore seed UI (Initialize on login). Hidden in production unless explicitly enabled,
 * so student/faculty login never shows registrar/bootstrap hints.
 */
export const allowBootstrapUi =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_INITIALIZE === 'true';

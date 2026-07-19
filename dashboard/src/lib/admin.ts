import { supabase } from './supabase';

export const EMAIL_AMMINISTRATORE = 'panto75@gmail.com';

export function eAmministratore(email: string | undefined): boolean {
  return email === EMAIL_AMMINISTRATORE;
}

export async function chiamaAdminActions<T = unknown>(
  azione: string,
  corpo: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-actions', {
    body: { azione, ...corpo },
  });

  if (error) {
    const contesto = (error as { context?: Response }).context;
    if (contesto && typeof contesto.json === 'function') {
      const corpoErrore = await contesto.json();
      throw new Error(corpoErrore.errore ?? error.message);
    }
    throw new Error(error.message);
  }

  return data as T;
}

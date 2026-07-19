import { describe, expect, it, vi } from 'vitest';
import { EMAIL_AMMINISTRATORE, eAmministratore } from './admin';

const invokeFinto = vi.fn();

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeFinto(...args) } },
}));

describe('eAmministratore', () => {
  it('restituisce true per l\'email amministratore', () => {
    expect(eAmministratore(EMAIL_AMMINISTRATORE)).toBe(true);
  });

  it('restituisce false per un\'altra email', () => {
    expect(eAmministratore('altro@esempio.it')).toBe(false);
  });

  it('restituisce false per undefined', () => {
    expect(eAmministratore(undefined)).toBe(false);
  });
});

describe('chiamaAdminActions', () => {
  it('restituisce i dati quando la chiamata riesce', async () => {
    const { chiamaAdminActions } = await import('./admin');
    invokeFinto.mockResolvedValueOnce({ data: { utenti: [] }, error: null });

    const risultato = await chiamaAdminActions('elenco_utenti');

    expect(risultato).toEqual({ utenti: [] });
    expect(invokeFinto).toHaveBeenCalledWith('admin-actions', { body: { azione: 'elenco_utenti' } });
  });

  it('include parametri aggiuntivi nel corpo della richiesta', async () => {
    const { chiamaAdminActions } = await import('./admin');
    invokeFinto.mockResolvedValueOnce({ data: { ok: true }, error: null });

    await chiamaAdminActions('revoca_utente', { id: 'abc' });

    expect(invokeFinto).toHaveBeenCalledWith('admin-actions', { body: { azione: 'revoca_utente', id: 'abc' } });
  });

  it('lancia un errore con il messaggio del corpo quando la Edge Function risponde con un errore HTTP', async () => {
    const { chiamaAdminActions } = await import('./admin');
    const erroreFinto = {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => ({ errore: 'Non autorizzato' }) },
    };
    invokeFinto.mockResolvedValueOnce({ data: null, error: erroreFinto });

    await expect(chiamaAdminActions('elenco_utenti')).rejects.toThrow('Non autorizzato');
  });

  it('lancia un errore generico quando manca il contesto HTTP (es. errore di rete)', async () => {
    const { chiamaAdminActions } = await import('./admin');
    invokeFinto.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });

    await expect(chiamaAdminActions('elenco_utenti')).rejects.toThrow('Failed to fetch');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('supabase client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('lancia un errore se VITE_SUPABASE_URL manca', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chiave-finta');
    await expect(import('./supabase')).rejects.toThrow(/VITE_SUPABASE_URL/);
  });

  it('lancia un errore se VITE_SUPABASE_ANON_KEY manca', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://esempio.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    await expect(import('./supabase')).rejects.toThrow(/VITE_SUPABASE_ANON_KEY/);
  });

  it('crea il client quando entrambe le variabili sono presenti', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://esempio.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chiave-finta');
    const modulo = await import('./supabase');
    expect(modulo.supabase).toBeTruthy();
    expect(modulo.supabase.auth).toBeDefined();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('inizia con caricamento true e passa a false con sessione null se non c\'è nessuno collegato', async () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.caricamento).toBe(true);
    await waitFor(() => expect(result.current.caricamento).toBe(false));
    expect(result.current.sessione).toBeNull();
  });
});

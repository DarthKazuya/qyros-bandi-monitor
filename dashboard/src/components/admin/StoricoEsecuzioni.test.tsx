import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { EsecuzioneJob } from '../../lib/types';

let datiFinti: EsecuzioneJob[] = [];

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: datiFinti, error: null }),
        }),
      }),
    }),
  },
}));

import { StoricoEsecuzioni } from './StoricoEsecuzioni';

describe('StoricoEsecuzioni', () => {
  beforeEach(() => {
    datiFinti = [];
  });

  it('mostra le esecuzioni con fonti riuscite e nuovi bandi', async () => {
    datiFinti = [
      {
        id: '1',
        eseguito_il: '2026-07-19T08:00:00Z',
        fonti_ok: ['eit', 'invitalia'],
        fonti_fallite: [],
        nuovi_bandi: 5,
      },
    ];
    render(<StoricoEsecuzioni />);
    await waitFor(() => expect(screen.getByText(/5 nuovi bandi/)).toBeInTheDocument());
    expect(screen.getByText(/eit, invitalia/)).toBeInTheDocument();
  });

  it('mostra le fonti fallite quando presenti', async () => {
    datiFinti = [
      {
        id: '1',
        eseguito_il: '2026-07-19T08:00:00Z',
        fonti_ok: ['eit'],
        fonti_fallite: [{ fonte: 'invitalia', errore: 'timeout' }],
        nuovi_bandi: 2,
      },
    ];
    render(<StoricoEsecuzioni />);
    await waitFor(() => expect(screen.getByText('invitalia: timeout')).toBeInTheDocument());
  });

  it('mostra un messaggio quando non ci sono esecuzioni', async () => {
    render(<StoricoEsecuzioni />);
    await waitFor(() => expect(screen.getByText('Nessuna esecuzione registrata.')).toBeInTheDocument());
  });
});

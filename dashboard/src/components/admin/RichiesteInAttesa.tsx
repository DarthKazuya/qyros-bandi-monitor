import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { supabase } from '../../lib/supabase';
import { chiamaAdminActions } from '../../lib/admin';
import type { RichiestaAccesso } from '../../lib/types';

function formattaData(data: string): string {
  return new Date(data).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function RichiesteInAttesa() {
  const [richieste, setRichieste] = useState<RichiestaAccesso[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [azioneInCorso, setAzioneInCorso] = useState<string | null>(null);

  useEffect(() => {
    caricaRichieste();
  }, []);

  async function caricaRichieste() {
    setCaricamento(true);
    const { data, error } = await supabase
      .from('richieste_accesso')
      .select('id, email, nome, cognome, richiesto_il, stato')
      .eq('stato', 'in_attesa')
      .order('richiesto_il', { ascending: false });

    if (error) {
      setErrore(error.message);
    } else {
      setRichieste((data ?? []) as RichiestaAccesso[]);
    }
    setCaricamento(false);
  }

  async function approva(richiesta: RichiestaAccesso) {
    setErrore(null);
    setAzioneInCorso(richiesta.id);
    try {
      await chiamaAdminActions('approva_richiesta', { id: richiesta.id, email: richiesta.email });
      setRichieste((precedenti) => precedenti.filter((r) => r.id !== richiesta.id));
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
    setAzioneInCorso(null);
  }

  async function rifiuta(richiesta: RichiestaAccesso) {
    setErrore(null);
    setAzioneInCorso(richiesta.id);
    const { error } = await supabase
      .from('richieste_accesso')
      .update({ stato: 'rifiutata' })
      .eq('id', richiesta.id);
    if (error) {
      setErrore(error.message);
    } else {
      setRichieste((precedenti) => precedenti.filter((r) => r.id !== richiesta.id));
    }
    setAzioneInCorso(null);
  }

  if (caricamento) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {errore && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errore}
        </Alert>
      )}
      {richieste.length === 0 ? (
        <Typography color="text.secondary">Nessuna richiesta in attesa.</Typography>
      ) : (
        <Stack spacing={2}>
          {richieste.map((richiesta) => (
            <Box key={richiesta.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="subtitle1">
                {richiesta.nome} {richiesta.cognome}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {richiesta.email} · richiesta il {formattaData(richiesta.richiesto_il)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  disabled={azioneInCorso === richiesta.id}
                  onClick={() => approva(richiesta)}
                  sx={{ minHeight: 44 }}
                >
                  Approva
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  disabled={azioneInCorso === richiesta.id}
                  onClick={() => rifiuta(richiesta)}
                  sx={{ minHeight: 44 }}
                >
                  Rifiuta
                </Button>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

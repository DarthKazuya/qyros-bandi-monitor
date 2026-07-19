import { useEffect, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { supabase } from '../../lib/supabase';
import type { EsecuzioneJob } from '../../lib/types';

function formattaDataOra(data: string): string {
  return new Date(data).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StoricoEsecuzioni() {
  const [esecuzioni, setEsecuzioni] = useState<EsecuzioneJob[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    async function carica() {
      setCaricamento(true);
      try {
        const { data, error } = await supabase
          .from('job_run_log')
          .select('id, eseguito_il, fonti_ok, fonti_fallite, nuovi_bandi')
          .order('eseguito_il', { ascending: false })
          .limit(30);

        if (error) {
          setErrore(error.message);
        } else {
          setEsecuzioni((data ?? []) as EsecuzioneJob[]);
        }
      } catch (err) {
        setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
      } finally {
        setCaricamento(false);
      }
    }
    carica();
  }, []);

  if (caricamento) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (errore) {
    return <Alert severity="error">{errore}</Alert>;
  }

  if (esecuzioni.length === 0) {
    return <Typography color="text.secondary">Nessuna esecuzione registrata.</Typography>;
  }

  return (
    <Stack spacing={2}>
      {esecuzioni.map((esecuzione) => (
        <Box key={esecuzione.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle2">{formattaDataOra(esecuzione.eseguito_il)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {esecuzione.nuovi_bandi} nuovi bandi · fonti riuscite: {esecuzione.fonti_ok.join(', ') || 'nessuna'}
          </Typography>
          {esecuzione.fonti_fallite.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {esecuzione.fonti_fallite.map((f) => (
                <Chip key={f.fonte} label={`${f.fonte}: ${f.errore}`} size="small" color="error" />
              ))}
            </Box>
          )}
        </Box>
      ))}
    </Stack>
  );
}

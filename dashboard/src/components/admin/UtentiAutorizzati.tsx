import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { chiamaAdminActions, EMAIL_AMMINISTRATORE } from '../../lib/admin';
import type { UtenteAutorizzato } from '../../lib/types';

function ordinaAmministratorePerPrimo(utenti: UtenteAutorizzato[]): UtenteAutorizzato[] {
  return [...utenti].sort((a, b) => {
    if (a.email === EMAIL_AMMINISTRATORE) return -1;
    if (b.email === EMAIL_AMMINISTRATORE) return 1;
    return 0;
  });
}

export function UtentiAutorizzati() {
  const [utenti, setUtenti] = useState<UtenteAutorizzato[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [azioneInCorso, setAzioneInCorso] = useState<string | null>(null);

  useEffect(() => {
    caricaUtenti();
  }, []);

  async function caricaUtenti() {
    setCaricamento(true);
    setErrore(null);
    try {
      const risultato = await chiamaAdminActions<{ utenti: UtenteAutorizzato[] }>('elenco_utenti');
      setUtenti(risultato.utenti);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
    setCaricamento(false);
  }

  async function revoca(utente: UtenteAutorizzato) {
    setErrore(null);
    setAzioneInCorso(utente.id);
    try {
      await chiamaAdminActions('revoca_utente', { id: utente.id });
      setUtenti((precedenti) => precedenti.filter((u) => u.id !== utente.id));
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
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
      {utenti.length === 0 ? (
        <Typography color="text.secondary">Nessun utente autorizzato.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {ordinaAmministratorePerPrimo(utenti).map((utente) => {
            const nomeCompleto = utente.nome && utente.cognome ? `${utente.nome} ${utente.cognome}` : null;
            const eAmministratore = utente.email === EMAIL_AMMINISTRATORE;
            const testoPrincipale = (nomeCompleto ?? utente.email) + (eAmministratore ? ' (ADMIN)' : '');

            return (
              <Box
                key={utente.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Box>
                  <Typography>{testoPrincipale}</Typography>
                  {nomeCompleto && (
                    <Typography variant="body2" color="text.secondary">
                      {utente.email}
                    </Typography>
                  )}
                </Box>
                {!eAmministratore && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="small"
                    disabled={azioneInCorso === utente.id}
                    onClick={() => revoca(utente)}
                    sx={{ minHeight: 44 }}
                  >
                    Revoca
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

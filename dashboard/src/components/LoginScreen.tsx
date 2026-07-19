import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { supabase } from '../lib/supabase';

type Fase = 'modulo' | 'attesa-codice' | 'richiesta-inviata';

export function LoginScreen() {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [mostraCampiNuovoUtente, setMostraCampiNuovoUtente] = useState(false);
  const [fase, setFase] = useState<Fase>('modulo');
  const [errore, setErrore] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);

  async function gestisciInvioModulo(evento: FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setInvioInCorso(true);

    try {
      if (mostraCampiNuovoUtente) {
        const { error: erroreRichiesta } = await supabase.from('richieste_accesso').insert({ email, nome, cognome });
        if (erroreRichiesta) {
          setErrore(erroreRichiesta.message);
          return;
        }
        setFase('richiesta-inviata');
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });

      if (!error) {
        setFase('attesa-codice');
        return;
      }

      if (error.code === 'signup_disabled') {
        setMostraCampiNuovoUtente(true);
        return;
      }

      setErrore(error.message);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setInvioInCorso(false);
    }
  }

  if (fase === 'richiesta-inviata') {
    return (
      <SchermataCentrata>
        <Alert severity="success" sx={{ mt: 2 }}>
          La tua richiesta di accesso è stata inviata. Riceverai un'email quando sarà approvata.
        </Alert>
      </SchermataCentrata>
    );
  }

  if (fase === 'attesa-codice') {
    return (
      <SchermataCentrata>
        <Alert severity="success" sx={{ mt: 2 }}>
          Ti abbiamo inviato un link di accesso a {email}. Apri l'email e clicca il link per
          entrare.
        </Alert>
      </SchermataCentrata>
    );
  }

  return (
    <SchermataCentrata>
      <Box component="form" onSubmit={gestisciInvioModulo} sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Inserisci la tua email per ricevere un link di accesso, o per richiederlo se non lo hai
          ancora.
        </Typography>
        <TextField
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          autoFocus
          required
          disabled={mostraCampiNuovoUtente}
          InputLabelProps={{ required: false }}
          sx={{ mb: 2 }}
        />
        {mostraCampiNuovoUtente && (
          <>
            <TextField
              label="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              fullWidth
              autoFocus
              required
              InputLabelProps={{ required: false }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Cognome"
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
              fullWidth
              required
              InputLabelProps={{ required: false }}
              sx={{ mb: 2 }}
            />
          </>
        )}
        {errore && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errore}
          </Alert>
        )}
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          disabled={invioInCorso}
          sx={{ minHeight: 44 }}
        >
          {invioInCorso ? 'Invio in corso...' : mostraCampiNuovoUtente ? 'Richiedi accesso' : 'Accedi'}
        </Button>
      </Box>
    </SchermataCentrata>
  );
}

function SchermataCentrata({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Fund Radar
          </Typography>
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}

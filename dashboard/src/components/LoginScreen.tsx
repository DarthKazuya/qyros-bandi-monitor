import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { supabase } from '../lib/supabase';

export function LoginScreen() {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [inviato, setInviato] = useState(false);
  const [richiestaInviata, setRichiestaInviata] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);

  async function gestisciInvio(evento: FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setInvioInCorso(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });

      if (!error) {
        setInviato(true);
        return;
      }

      if (error.code === 'signup_disabled') {
        const { error: erroreRichiesta } = await supabase.from('richieste_accesso').insert({ email, nome, cognome });
        if (erroreRichiesta) {
          setErrore(erroreRichiesta.message);
          return;
        }
        setRichiestaInviata(true);
        return;
      }

      setErrore(error.message);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setInvioInCorso(false);
    }
  }

  const messaggioConfermato = inviato
    ? `Ti abbiamo inviato un link di accesso a ${email}. Apri l'email e clicca il link per entrare.`
    : richiestaInviata
      ? "La tua richiesta di accesso è stata inviata. Riceverai un'email quando sarà approvata."
      : null;

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
          {messaggioConfermato ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              {messaggioConfermato}
            </Alert>
          ) : (
            <Box component="form" onSubmit={gestisciInvio} sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Inserisci i tuoi dati per ricevere un link di accesso, o per richiederlo se non lo
                hai ancora.
              </Typography>
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
              <TextField
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                InputLabelProps={{ required: false }}
                sx={{ mb: 2 }}
              />
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
                {invioInCorso ? 'Invio in corso...' : 'Invia link di accesso'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

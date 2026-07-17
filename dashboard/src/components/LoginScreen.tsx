import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { supabase } from '../lib/supabase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);

  async function gestisciInvio(evento: FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setInvioInCorso(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setInvioInCorso(false);
    if (error) {
      setErrore(error.message);
      return;
    }
    setInviato(true);
  }

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
            QYROS Bandi Monitor
          </Typography>
          {inviato ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              Ti abbiamo inviato un link di accesso a {email}. Apri l'email e clicca il
              link per entrare.
            </Alert>
          ) : (
            <Box component="form" onSubmit={gestisciInvio} sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Inserisci la tua email per ricevere un link di accesso.
              </Typography>
              <TextField
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                autoFocus
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

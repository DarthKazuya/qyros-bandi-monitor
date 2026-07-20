import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, TextField } from '@mui/material';
import { supabase } from '../lib/supabase';

export function SuggerisciParolaChiave() {
  const [parola, setParola] = useState('');
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);

  async function gestisciInvio(evento: FormEvent) {
    evento.preventDefault();
    if (parola.trim() === '') return;

    setErrore(null);
    setInvioInCorso(true);
    const { error } = await supabase.from('suggerimenti_parole_chiave').insert({ parola: parola.trim() });
    setInvioInCorso(false);

    if (error) {
      setErrore(error.message);
      return;
    }
    setParola('');
    setInviato(true);
  }

  return (
    <Box
      component="form"
      onSubmit={gestisciInvio}
      sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap', mt: 1.5 }}
    >
      <TextField
        label="Suggerisci una parola chiave"
        size="small"
        value={parola}
        onChange={(e) => {
          setParola(e.target.value);
          setInviato(false);
        }}
        sx={{ minWidth: 220 }}
      />
      <Button type="submit" variant="outlined" disabled={invioInCorso} sx={{ minHeight: 44 }}>
        Invia
      </Button>
      {inviato && (
        <Alert severity="success" sx={{ width: '100%' }}>
          Suggerimento inviato, grazie!
        </Alert>
      )}
      {errore && (
        <Alert severity="error" sx={{ width: '100%' }}>
          {errore}
        </Alert>
      )}
    </Box>
  );
}

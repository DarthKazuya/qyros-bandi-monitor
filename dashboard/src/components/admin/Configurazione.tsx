import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Select, TextField, Typography } from '@mui/material';
import { supabase } from '../../lib/supabase';
import type { ImpostazioniJob, ParolaChiave, SuggerimentoParolaChiave } from '../../lib/types';

export function Configurazione() {
  const [paroleChiave, setParoleChiave] = useState<ParolaChiave[]>([]);
  const [impostazioni, setImpostazioni] = useState<ImpostazioniJob | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [nuovaParola, setNuovaParola] = useState('');
  const [nuovoLivello, setNuovoLivello] = useState<'livello1' | 'livello2'>('livello2');
  const [oraModificata, setOraModificata] = useState<number>(8);
  const [salvataggioOraInCorso, setSalvataggioOraInCorso] = useState(false);
  const [suggerimenti, setSuggerimenti] = useState<SuggerimentoParolaChiave[]>([]);
  const [azioneSuggerimentoInCorso, setAzioneSuggerimentoInCorso] = useState<string | null>(null);

  useEffect(() => {
    carica();
  }, []);

  async function carica() {
    setCaricamento(true);
    try {
      const [risultatoParole, risultatoImpostazioni, risultatoSuggerimenti] = await Promise.all([
        supabase.from('parole_chiave').select('id, parola, livello').order('parola'),
        supabase.from('impostazioni_job').select('id, ora, fuso_orario').eq('id', 1).single(),
        supabase
          .from('suggerimenti_parole_chiave')
          .select('id, parola, proposto_da, proposto_il, stato')
          .eq('stato', 'in_attesa')
          .order('proposto_il'),
      ]);

      if (risultatoParole.error) {
        setErrore(risultatoParole.error.message);
      } else {
        setParoleChiave((risultatoParole.data ?? []) as ParolaChiave[]);
      }

      if (risultatoImpostazioni.error) {
        setErrore(risultatoImpostazioni.error.message);
      } else if (risultatoImpostazioni.data) {
        const impostazioniLette = risultatoImpostazioni.data as ImpostazioniJob;
        setImpostazioni(impostazioniLette);
        setOraModificata(impostazioniLette.ora);
      }

      if (risultatoSuggerimenti.error) {
        setErrore(risultatoSuggerimenti.error.message);
      } else {
        setSuggerimenti((risultatoSuggerimenti.data ?? []) as SuggerimentoParolaChiave[]);
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setCaricamento(false);
    }
  }

  async function aggiungiParola() {
    if (nuovaParola.trim() === '') return;
    setErrore(null);
    const { data, error } = await supabase
      .from('parole_chiave')
      .insert({ parola: nuovaParola.trim(), livello: nuovoLivello })
      .select('id, parola, livello')
      .single();
    if (error) {
      setErrore(error.message);
      return;
    }
    setParoleChiave((precedenti) => [...precedenti, data as ParolaChiave]);
    setNuovaParola('');
  }

  async function rimuoviParola(parola: ParolaChiave) {
    setErrore(null);
    const { error } = await supabase.from('parole_chiave').delete().eq('id', parola.id);
    if (error) {
      setErrore(error.message);
      return;
    }
    setParoleChiave((precedenti) => precedenti.filter((p) => p.id !== parola.id));
  }

  async function accettaSuggerimento(suggerimento: SuggerimentoParolaChiave) {
    setErrore(null);
    setAzioneSuggerimentoInCorso(suggerimento.id);
    const { data: nuovaParola, error: erroreInserimento } = await supabase
      .from('parole_chiave')
      .insert({ parola: suggerimento.parola, livello: 'livello2' })
      .select('id, parola, livello')
      .single();
    if (erroreInserimento) {
      setErrore(erroreInserimento.message);
      setAzioneSuggerimentoInCorso(null);
      return;
    }
    const { error: erroreStato } = await supabase
      .from('suggerimenti_parole_chiave')
      .update({ stato: 'accettato' })
      .eq('id', suggerimento.id);
    if (erroreStato) {
      setErrore(erroreStato.message);
      setAzioneSuggerimentoInCorso(null);
      return;
    }
    setParoleChiave((precedenti) => [...precedenti, nuovaParola as ParolaChiave]);
    setSuggerimenti((precedenti) => precedenti.filter((s) => s.id !== suggerimento.id));
    setAzioneSuggerimentoInCorso(null);
  }

  async function rifiutaSuggerimento(suggerimento: SuggerimentoParolaChiave) {
    setErrore(null);
    setAzioneSuggerimentoInCorso(suggerimento.id);
    const { error } = await supabase
      .from('suggerimenti_parole_chiave')
      .update({ stato: 'rifiutato' })
      .eq('id', suggerimento.id);
    if (error) {
      setErrore(error.message);
      setAzioneSuggerimentoInCorso(null);
      return;
    }
    setSuggerimenti((precedenti) => precedenti.filter((s) => s.id !== suggerimento.id));
    setAzioneSuggerimentoInCorso(null);
  }

  async function salvaOra() {
    setErrore(null);
    setSalvataggioOraInCorso(true);
    const { error } = await supabase.from('impostazioni_job').update({ ora: oraModificata }).eq('id', 1);
    setSalvataggioOraInCorso(false);
    if (error) {
      setErrore(error.message);
      return;
    }
    setImpostazioni((precedenti) => (precedenti ? { ...precedenti, ora: oraModificata } : precedenti));
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

      <Typography variant="h6" sx={{ mb: 1 }}>
        Suggerimenti in attesa
      </Typography>
      {suggerimenti.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Nessun suggerimento in attesa.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
          {suggerimenti.map((suggerimento) => (
            <Box
              key={suggerimento.id}
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
              <Box>
                <Typography>{suggerimento.parola}</Typography>
                <Typography variant="body2" color="text.secondary">
                  proposto da {suggerimento.proposto_da}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={azioneSuggerimentoInCorso === suggerimento.id}
                  onClick={() => accettaSuggerimento(suggerimento)}
                  sx={{ minHeight: 44 }}
                >
                  Accetta
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  disabled={azioneSuggerimentoInCorso === suggerimento.id}
                  onClick={() => rifiutaSuggerimento(suggerimento)}
                  sx={{ minHeight: 44 }}
                >
                  Rifiuta
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Parole chiave
      </Typography>
      {(['livello1', 'livello2'] as const).map((livello) => (
        <Box key={livello} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {livello === 'livello1' ? 'Livello 1 — Alta priorità' : 'Livello 2 — Da verificare'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {paroleChiave
              .filter((p) => p.livello === livello)
              .map((parola) => (
                <Chip
                  key={parola.id}
                  label={parola.parola}
                  onDelete={() => rimuoviParola(parola)}
                  sx={{
                    minHeight: 44,
                    '& .MuiChip-deleteIcon': {
                      fontSize: '1.3rem',
                      margin: '0 6px 0 -6px',
                    },
                  }}
                />
              ))}
          </Box>
        </Box>
      ))}

      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Nuova parola chiave"
          size="small"
          value={nuovaParola}
          onChange={(e) => setNuovaParola(e.target.value)}
          sx={{ flex: 1, minWidth: 200, minHeight: 44 }}
        />
        <Select
          size="small"
          value={nuovoLivello}
          onChange={(e) => setNuovoLivello(e.target.value as 'livello1' | 'livello2')}
          sx={{ minHeight: 44 }}
        >
          <MenuItem value="livello1">Livello 1</MenuItem>
          <MenuItem value="livello2">Livello 2</MenuItem>
        </Select>
        <Button variant="contained" onClick={aggiungiParola} sx={{ minHeight: 44 }}>
          Aggiungi
        </Button>
      </Box>

      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
        Orario di esecuzione
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          type="number"
          label="Ora (0-23)"
          size="small"
          value={oraModificata}
          onChange={(e) => setOraModificata(Number(e.target.value))}
          inputProps={{ min: 0, max: 23 }}
          sx={{ width: 140, minHeight: 44 }}
        />
        <Button variant="contained" disabled={salvataggioOraInCorso} onClick={salvaOra} sx={{ minHeight: 44 }}>
          Salva
        </Button>
      </Box>
      {impostazioni && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Fuso orario: {impostazioni.fuso_orario} (non modificabile da qui)
        </Typography>
      )}
    </Box>
  );
}

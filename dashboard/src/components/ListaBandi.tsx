import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { supabase } from '../lib/supabase';
import type { Bando, ParolaChiave } from '../lib/types';
import { BandoCard } from './BandoCard';
import { FiltriBar, type FiltriBarProps } from './FiltriBar';
import { SuggerisciParolaChiave } from './SuggerisciParolaChiave';
import { applicaFiltri, type FiltriStato } from '../lib/filtriBandi';
import { FONTI_ATTIVE } from '../lib/sources';
import { caricaFiltriSalvati, salvaFiltri } from '../lib/persistenzaFiltri';

const FILTRI_DEFAULT: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  paroleChiave: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
  direzioneOrdinamento: 'decrescente',
};

export function ListaBandi() {
  const [bandi, setBandi] = useState<Bando[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<FiltriStato>(() => caricaFiltriSalvati() ?? FILTRI_DEFAULT);
  const [paroleChiaveDisponibili, setParoleChiaveDisponibili] = useState<ParolaChiave[]>([]);

  useEffect(() => {
    caricaBandi();
    caricaParoleChiave();
  }, []);

  async function caricaParoleChiave() {
    const { data, error } = await supabase
      .from('parole_chiave')
      .select('id, parola, livello, contatore_click')
      .order('parola');
    if (!error) {
      setParoleChiaveDisponibili((data ?? []) as ParolaChiave[]);
    }
  }

  async function incrementaContatoreParola(id: string) {
    await supabase.rpc('increment_click_parola', { id_parola: id });
  }

  async function caricaBandi() {
    setCaricamento(true);
    const { data, error } = await supabase
      .from('bandi')
      .select('id, fonte, titolo, descrizione, url, scadenza, data_pubblicazione, priorita, stato, parole_corrispondenti')
      .eq('scartato', false)
      .order('data_pubblicazione', { ascending: false });

    if (error) {
      setErrore(error.message);
    } else {
      setBandi((data ?? []) as Bando[]);
    }
    setCaricamento(false);
  }

  async function cambiaStato(id: string, nuovoStato: 'visto' | 'nuovo') {
    setBandi((precedenti) => precedenti.map((b) => (b.id === id ? { ...b, stato: nuovoStato } : b)));
    const { error } = await supabase.from('bandi').update({ stato: nuovoStato }).eq('id', id);
    if (error) {
      setErrore(error.message);
      caricaBandi();
    }
  }

  const bandiFiltrati = useMemo(() => applicaFiltri(bandi, filtri), [bandi, filtri]);

  const conteggiPriorita = useMemo(() => {
    const senzaPriorita = applicaFiltri(bandi, { ...filtri, priorita: 'tutti' });
    return {
      tutti: senzaPriorita.length,
      alta: senzaPriorita.filter((b) => b.priorita === 'alta').length,
      da_verificare: senzaPriorita.filter((b) => b.priorita === 'da_verificare').length,
    };
  }, [bandi, filtri]);

  const onCambiaFiltri: FiltriBarProps['onCambiaFiltri'] = (nuoviFiltri) => {
    setFiltri(nuoviFiltri);
    salvaFiltri(nuoviFiltri);
  };

  if (caricamento) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pb: 4 }}>
      <FiltriBar
        filtri={filtri}
        fontiDisponibili={FONTI_ATTIVE}
        conteggiPriorita={conteggiPriorita}
        paroleChiaveDisponibili={paroleChiaveDisponibili}
        onCambiaFiltri={onCambiaFiltri}
        onParolaChiaveCliccata={incrementaContatoreParola}
      />
      <SuggerisciParolaChiave />

      {errore && (
        <Typography color="error" sx={{ mt: 2 }}>
          {errore}
        </Typography>
      )}

      {bandiFiltrati.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          Nessun bando trovato con questi filtri.
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
            mt: 2,
          }}
        >
          {bandiFiltrati.map((bando) => (
            <BandoCard key={bando.id} bando={bando} onCambiaStato={cambiaStato} />
          ))}
        </Box>
      )}
    </Box>
  );
}

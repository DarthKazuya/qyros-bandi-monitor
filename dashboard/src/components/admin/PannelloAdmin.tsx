import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { RichiesteInAttesa } from './RichiesteInAttesa';
import { UtentiAutorizzati } from './UtentiAutorizzati';
import { StoricoEsecuzioni } from './StoricoEsecuzioni';
import { Configurazione } from './Configurazione';

const SEZIONI = ['richieste', 'utenti', 'storico', 'configurazione'] as const;
type Sezione = (typeof SEZIONI)[number];

export function PannelloAdmin() {
  const [sezione, setSezione] = useState<Sezione>('richieste');

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', px: 2, pb: 4 }}>
      <Tabs
        value={sezione}
        onChange={(_e, valore) => setSezione(valore)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2 }}
      >
        <Tab label="Richieste" value="richieste" sx={{ minHeight: 44 }} />
        <Tab label="Utenti" value="utenti" sx={{ minHeight: 44 }} />
        <Tab label="Storico" value="storico" sx={{ minHeight: 44 }} />
        <Tab label="Configurazione" value="configurazione" sx={{ minHeight: 44 }} />
      </Tabs>

      {sezione === 'richieste' && <RichiesteInAttesa />}
      {sezione === 'utenti' && <UtentiAutorizzati />}
      {sezione === 'storico' && <StoricoEsecuzioni />}
      {sezione === 'configurazione' && <Configurazione />}
    </Box>
  );
}

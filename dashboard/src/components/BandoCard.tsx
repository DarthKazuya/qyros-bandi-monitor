import { Box, Button, Card, CardContent, Chip, Link, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type { Bando } from '../lib/types';

export interface BandoCardProps {
  bando: Bando;
  onCambiaStato: (id: string, nuovoStato: 'visto' | 'nuovo') => void;
}

const MILLISECONDI_AL_GIORNO = 1000 * 60 * 60 * 24;
const SOGLIA_GIORNI_ALLARME = 30;

function formattaData(data: string): string {
  const [anno, mese, giorno] = data.split('-');
  return `${giorno}/${mese}/${anno}`;
}

function calcolaGiorniAllaScadenza(scadenza: string, oggi: Date): number {
  const [anno, mese, giorno] = scadenza.split('-').map(Number);
  const dataScadenza = new Date(anno, mese - 1, giorno);
  const inizioOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  return Math.round((dataScadenza.getTime() - inizioOggi.getTime()) / MILLISECONDI_AL_GIORNO);
}

export function BandoCard({ bando, onCambiaStato }: BandoCardProps) {
  const eVisto = bando.stato === 'visto';
  const eAlta = bando.priorita === 'alta';
  const giorniAllaScadenza = bando.scadenza ? calcolaGiorniAllaScadenza(bando.scadenza, new Date()) : null;
  const eInAllarme = giorniAllaScadenza !== null && giorniAllaScadenza < SOGLIA_GIORNI_ALLARME;

  return (
    <Card sx={{ opacity: eVisto ? 0.6 : 1, transition: 'opacity 0.2s ease', height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          {bando.parole_corrispondenti.length > 0 && (
            <Chip
              label={`Corrisponde a: ${bando.parole_corrispondenti.join(', ')}`}
              size="small"
              sx={{
                bgcolor: eAlta ? 'secondary.container' : 'info.container',
                color: eAlta ? 'secondary.onContainer' : 'info.onContainer',
                fontWeight: 600,
              }}
            />
          )}
          <Button
            size="small"
            startIcon={eVisto ? <VisibilityOffIcon /> : <VisibilityIcon />}
            onClick={() => onCambiaStato(bando.id, eVisto ? 'nuovo' : 'visto')}
            sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
          >
            {eVisto ? 'Segna come nuovo' : 'Segna come visto'}
          </Button>
        </Box>

        <Typography variant="h6" component="h3" sx={{ mt: 1.5 }}>
          {bando.titolo}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {bando.fonte}
          {bando.scadenza && ` · scadenza ${formattaData(bando.scadenza)}`}
        </Typography>

        {giorniAllaScadenza !== null && (
          <Chip
            label={giorniAllaScadenza < 0 ? 'Scaduto' : `${giorniAllaScadenza} giorni alla scadenza`}
            size="small"
            sx={{
              mt: 1,
              bgcolor: eInAllarme ? 'warning.main' : 'action.selected',
              color: eInAllarme ? '#ffffff' : 'text.primary',
            }}
          />
        )}

        <Box>
          <Link
            href={bando.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.5, minHeight: 44 }}
          >
            Vai al bando <OpenInNewIcon fontSize="small" />
          </Link>
        </Box>
      </CardContent>
    </Card>
  );
}

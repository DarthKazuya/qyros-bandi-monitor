import { Box, Button, Card, CardContent, Chip, Link, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type { Bando } from '../lib/types';

export interface BandoCardProps {
  bando: Bando;
  onCambiaStato: (id: string, nuovoStato: 'visto' | 'nuovo') => void;
}

function formattaData(data: string): string {
  const [anno, mese, giorno] = data.split('-');
  return `${giorno}/${mese}/${anno}`;
}

export function BandoCard({ bando, onCambiaStato }: BandoCardProps) {
  const eVisto = bando.stato === 'visto';
  const eAlta = bando.priorita === 'alta';

  return (
    <Card sx={{ opacity: eVisto ? 0.6 : 1, transition: 'opacity 0.2s ease', height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Chip
            label={eAlta ? 'Match diretto' : 'Da verificare'}
            size="small"
            sx={{
              bgcolor: eAlta ? 'primary.main' : 'secondary.main',
              color: '#ffffff',
              fontWeight: 600,
            }}
          />
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

        <Link
          href={bando.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.5, minHeight: 44 }}
        >
          Vai al bando <OpenInNewIcon fontSize="small" />
        </Link>
      </CardContent>
    </Card>
  );
}

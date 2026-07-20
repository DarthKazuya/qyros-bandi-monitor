import { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Checkbox,
  type SelectChangeEvent,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { FiltriStato } from '../lib/filtriBandi';
import type { ParolaChiave } from '../lib/types';

export interface FiltriBarProps {
  filtri: FiltriStato;
  fontiDisponibili: string[];
  conteggiPriorita: { tutti: number; alta: number; da_verificare: number };
  paroleChiaveDisponibili: ParolaChiave[];
  onCambiaFiltri: (filtri: FiltriStato) => void;
  onParolaChiaveCliccata: (id: string) => void;
}

export function FiltriBar({
  filtri,
  fontiDisponibili,
  conteggiPriorita,
  paroleChiaveDisponibili,
  onCambiaFiltri,
  onParolaChiaveCliccata,
}: FiltriBarProps) {
  const [paroleChiaveAperte, setParoleChiaveAperte] = useState(false);

  function gestisciCambioFonti(evento: SelectChangeEvent<string[]>) {
    const valore = evento.target.value;
    onCambiaFiltri({ ...filtri, fonti: typeof valore === 'string' ? valore.split(',') : valore });
  }

  function gestisciToggleParolaChiave(parola: string) {
    const attiva = filtri.paroleChiave.includes(parola);
    const nuoveParole = attiva
      ? filtri.paroleChiave.filter((p) => p !== parola)
      : [...filtri.paroleChiave, parola];
    onCambiaFiltri({ ...filtri, paroleChiave: nuoveParole });
  }

  function gestisciInversioneDirezione() {
    onCambiaFiltri({
      ...filtri,
      direzioneOrdinamento: filtri.direzioneOrdinamento === 'crescente' ? 'decrescente' : 'crescente',
    });
  }

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'background.default',
        py: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <TextField
        placeholder="Cerca per titolo o descrizione..."
        value={filtri.ricerca}
        onChange={(e) => onCambiaFiltri({ ...filtri, ricerca: e.target.value })}
        fullWidth
        size="small"
      />

      <ToggleButtonGroup
        value={filtri.priorita}
        exclusive
        onChange={(_e, valore) => valore && onCambiaFiltri({ ...filtri, priorita: valore })}
        size="small"
        sx={{ flexWrap: 'wrap' }}
      >
        <ToggleButton value="tutti" sx={{ minHeight: 44 }}>
          Tutti ({conteggiPriorita.tutti})
        </ToggleButton>
        <ToggleButton value="alta" sx={{ minHeight: 44 }}>
          Match diretto ({conteggiPriorita.alta})
        </ToggleButton>
        <ToggleButton value="da_verificare" sx={{ minHeight: 44 }}>
          Da verificare ({conteggiPriorita.da_verificare})
        </ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
          <InputLabel id="filtro-fonte-label">Fonte</InputLabel>
          <Select
            labelId="filtro-fonte-label"
            label="Fonte"
            multiple
            value={filtri.fonti}
            onChange={gestisciCambioFonti}
            renderValue={(selezionate) => (selezionate.length === 0 ? 'Tutte le fonti' : selezionate.join(', '))}
          >
            {fontiDisponibili.map((fonte) => (
              <MenuItem key={fonte} value={fonte}>
                <Checkbox checked={filtri.fonti.includes(fonte)} />
                <ListItemText primary={fonte} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180, flex: 1 }}>
          <InputLabel id="ordinamento-label">Ordina per</InputLabel>
          <Select
            labelId="ordinamento-label"
            label="Ordina per"
            value={filtri.ordinamento}
            onChange={(e) =>
              onCambiaFiltri({ ...filtri, ordinamento: e.target.value as FiltriStato['ordinamento'] })
            }
          >
            <MenuItem value="data_pubblicazione">Data pubblicazione</MenuItem>
            <MenuItem value="scadenza">Scadenza</MenuItem>
          </Select>
        </FormControl>

        <IconButton
          onClick={gestisciInversioneDirezione}
          aria-label="Inverti direzione ordinamento"
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          {filtri.direzioneOrdinamento === 'crescente' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
        </IconButton>
      </Box>

      <Box>
        <Box
          component="button"
          type="button"
          onClick={() => setParoleChiaveAperte((aperto) => !aperto)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'transparent',
            border: 'none',
            color: 'text.secondary',
            cursor: 'pointer',
            p: 1,
            minHeight: 44,
          }}
        >
          <Typography variant="body2">
            Parole chiave{filtri.paroleChiave.length > 0 ? ` (${filtri.paroleChiave.length})` : ''}
          </Typography>
          <ExpandMoreIcon
            fontSize="small"
            sx={{ transform: paroleChiaveAperte ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
          />
        </Box>
        <Collapse in={paroleChiaveAperte}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pt: 1 }}>
            {paroleChiaveDisponibili.map((parola) => (
              <Chip
                key={parola.id}
                label={parola.parola}
                clickable
                onClick={() => {
                  gestisciToggleParolaChiave(parola.parola);
                  onParolaChiaveCliccata(parola.id);
                }}
                color={filtri.paroleChiave.includes(parola.parola) ? 'primary' : 'default'}
                sx={{ minHeight: 44 }}
              />
            ))}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
}

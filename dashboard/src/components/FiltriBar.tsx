import {
  Box,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  type SelectChangeEvent,
} from '@mui/material';
import type { FiltriStato } from '../lib/filtriBandi';

export interface FiltriBarProps {
  filtri: FiltriStato;
  fontiDisponibili: string[];
  onCambiaFiltri: (filtri: FiltriStato) => void;
}

export function FiltriBar({ filtri, fontiDisponibili, onCambiaFiltri }: FiltriBarProps) {
  function gestisciCambioFonti(evento: SelectChangeEvent<string[]>) {
    const valore = evento.target.value;
    onCambiaFiltri({ ...filtri, fonti: typeof valore === 'string' ? valore.split(',') : valore });
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
          Tutti
        </ToggleButton>
        <ToggleButton value="alta" sx={{ minHeight: 44 }}>
          Match diretto
        </ToggleButton>
        <ToggleButton value="da_verificare" sx={{ minHeight: 44 }}>
          Da verificare
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
      </Box>
    </Box>
  );
}

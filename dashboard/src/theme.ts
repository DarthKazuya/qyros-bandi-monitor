import { createTheme, type Theme } from '@mui/material/styles';

const PALETTE_QYROS = {
  arancio: '#ff6500',
  bluPetrolio: '#3c6a8b',
  bluScuro: '#040a1b',
} as const;

export function creaTemaQyros(modalita: 'light' | 'dark'): Theme {
  const scuro = modalita === 'dark';

  return createTheme({
    palette: {
      mode: modalita,
      primary: { main: PALETTE_QYROS.arancio, contrastText: '#ffffff' },
      secondary: { main: PALETTE_QYROS.bluPetrolio, contrastText: '#ffffff' },
      background: {
        default: scuro ? PALETTE_QYROS.bluScuro : '#f5f6f8',
        paper: scuro ? '#0d1a38' : '#ffffff',
      },
      text: {
        primary: scuro ? '#f5f5f0' : PALETTE_QYROS.bluScuro,
        secondary: scuro ? '#93a4bd' : '#52627a',
      },
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: '"Roboto", "Segoe UI", -apple-system, sans-serif',
      h5: { fontWeight: 800 },
      h6: { fontWeight: 700 },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 16 },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', borderRadius: 12 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
    },
  });
}

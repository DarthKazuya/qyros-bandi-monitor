import { createTheme, type Theme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface PaletteColor {
    container?: string;
    onContainer?: string;
  }
  interface SimplePaletteColorOptions {
    container?: string;
    onContainer?: string;
  }
}

export function creaTemaQyros(modalita: 'light' | 'dark'): Theme {
  const scuro = modalita === 'dark';

  return createTheme({
    palette: {
      mode: modalita,
      primary: {
        main: scuro ? '#7A8AF0' : '#5B6EE8',
        contrastText: '#ffffff',
      },
      secondary: {
        main: scuro ? '#9FE1CB' : '#0F6E56',
        contrastText: scuro ? '#085041' : '#ffffff',
        container: scuro ? '#085041' : '#D2EFF0',
        onContainer: scuro ? '#9FE1CB' : '#0F6E56',
      },
      info: {
        main: '#78909C',
        contrastText: scuro ? '#0b0f12' : '#ffffff',
        container: scuro ? '#37474F' : '#ECEFF1',
        onContainer: scuro ? '#CFD8DC' : '#37474F',
      },
      error: {
        main: '#D32F2F',
        contrastText: '#ffffff',
      },
      background: {
        default: scuro ? '#111318' : '#f5f6f8',
        paper: scuro ? '#1a1d24' : '#ffffff',
      },
      text: {
        primary: scuro ? '#f5f5f0' : '#040a1b',
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
      MuiAlert: {
        styleOverrides: {
          standardError: {
            backgroundColor: scuro ? '#791F1F' : '#FCEBEB',
            color: scuro ? '#F7C1C1' : '#501313',
          },
        },
      },
    },
  });
}

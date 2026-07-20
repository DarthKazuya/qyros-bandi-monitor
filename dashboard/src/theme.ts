import { createTheme, type Theme, type Shadows } from '@mui/material/styles';

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

function creaOmbreM3(): Shadows {
  const ombre: string[] = ['none'];
  for (let livello = 1; livello <= 24; livello++) {
    const offsetY = Math.min(1 + livello, 16);
    const blur = Math.min(4 + livello * 2, 48);
    const opacita = Math.max(0.16 - livello * 0.004, 0.08).toFixed(2);
    ombre.push(`0px ${offsetY}px ${blur}px rgba(15,20,30,${opacita})`);
  }
  // MUI richiede una tupla di esattamente 25 stringhe (Shadows); costruirla
  // via loop è più leggibile di 25 righe letterali, ma non è verificabile
  // otticamente da TypeScript come tupla a lunghezza fissa.
  return ombre as unknown as Shadows;
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
    shape: { borderRadius: 12 },
    shadows: creaOmbreM3(),
    typography: {
      fontFamily: '"Roboto", "Segoe UI", -apple-system, sans-serif',
      h5: { fontWeight: 800 },
      h6: { fontWeight: 700 },
    },
    components: {
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

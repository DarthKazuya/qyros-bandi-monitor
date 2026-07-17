import { useMemo, useState } from 'react';
import { AppBar, Box, CircularProgress, CssBaseline, IconButton, ThemeProvider, Toolbar, Typography } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { creaTemaQyros } from './theme';
import { useAuth } from './hooks/useAuth';
import { LoginScreen } from './components/LoginScreen';
import { ListaBandi } from './components/ListaBandi';

function rilevaPreferenzaSistema(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  const [modalita, setModalita] = useState<'light' | 'dark'>(rilevaPreferenzaSistema);
  const tema = useMemo(() => creaTemaQyros(modalita), [modalita]);
  const { sessione, caricamento } = useAuth();

  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <AppBar position="sticky" color="secondary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            QYROS Bandi Monitor
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => setModalita((m) => (m === 'dark' ? 'light' : 'dark'))}
            aria-label="Cambia tema chiaro/scuro"
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            {modalita === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ pt: 2 }}>
        {caricamento ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : sessione ? (
          <ListaBandi />
        ) : (
          <LoginScreen />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;

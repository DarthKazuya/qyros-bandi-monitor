import { useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  IconButton,
  ThemeProvider,
  Toolbar,
  Typography,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import { creaTemaQyros } from './theme';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
import { eAmministratore } from './lib/admin';
import { LoginScreen } from './components/LoginScreen';
import { ListaBandi } from './components/ListaBandi';
import { PannelloAdmin } from './components/admin/PannelloAdmin';

function App() {
  const [modalita, setModalita] = useState<'light' | 'dark'>('dark');
  const [vistaAdmin, setVistaAdmin] = useState(false);
  const tema = useMemo(() => creaTemaQyros(modalita), [modalita]);
  const { sessione, caricamento } = useAuth();

  const utenteEAmministratore = eAmministratore(sessione?.user.email);

  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <AppBar position="sticky" color="secondary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Fund Radar
          </Typography>
          {utenteEAmministratore && (
            <Button color="inherit" onClick={() => setVistaAdmin((v) => !v)} sx={{ minHeight: 44, mr: 1 }}>
              {vistaAdmin ? 'Bandi' : 'Pannello'}
            </Button>
          )}
          <IconButton
            color="inherit"
            onClick={() => setModalita((m) => (m === 'dark' ? 'light' : 'dark'))}
            aria-label="Cambia tema chiaro/scuro"
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            {modalita === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
          {sessione && (
            <IconButton
              color="inherit"
              onClick={() => supabase.auth.signOut()}
              aria-label="Esci"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <LogoutIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ pt: 2 }}>
        {caricamento ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : sessione ? (
          vistaAdmin && utenteEAmministratore ? (
            <PannelloAdmin />
          ) : (
            <ListaBandi />
          )
        ) : (
          <LoginScreen />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;

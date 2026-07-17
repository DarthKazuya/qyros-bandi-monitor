import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface StatoAutenticazione {
  sessione: Session | null;
  caricamento: boolean;
}

export function useAuth(): StatoAutenticazione {
  const [sessione, setSessione] = useState<Session | null>(null);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessione(data.session);
      setCaricamento(false);
    });

    const { data: sottoscrizione } = supabase.auth.onAuthStateChange((_evento, nuovaSessione) => {
      setSessione(nuovaSessione);
    });

    return () => sottoscrizione.subscription.unsubscribe();
  }, []);

  return { sessione, caricamento };
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const elemento = document.getElementById('root');
if (!elemento) {
  throw new Error('Elemento #root non trovato in index.html');
}

createRoot(elemento).render(
  <StrictMode>
    <App />
  </StrictMode>
);

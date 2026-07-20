import type { Keywords, MatchResult } from './types.js';

export function normalizzaTesto(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-\s]+/g, '');
}

function keywordCorrispondenti(testoNormalizzato: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => testoNormalizzato.includes(normalizzaTesto(keyword)));
}

export function classifica(titolo: string, descrizione: string, keywords: Keywords): MatchResult {
  const testoNormalizzato = normalizzaTesto(`${titolo} ${descrizione}`);

  const trovateLivello1 = keywordCorrispondenti(testoNormalizzato, keywords.livello1);
  if (trovateLivello1.length > 0) {
    return { priorita: 'alta', scartato: false, paroleTrovate: trovateLivello1 };
  }

  const trovateLivello2 = keywordCorrispondenti(testoNormalizzato, keywords.livello2);
  if (trovateLivello2.length > 0) {
    return { priorita: 'da_verificare', scartato: false, paroleTrovate: trovateLivello2 };
  }

  return { priorita: null, scartato: true, paroleTrovate: [] };
}

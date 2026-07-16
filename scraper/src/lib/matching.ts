import type { Keywords, MatchResult } from './types.js';

export function normalizzaTesto(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-\s]+/g, '');
}

function contieneKeyword(testoNormalizzato: string, keywords: string[]): boolean {
  return keywords.some((keyword) => testoNormalizzato.includes(normalizzaTesto(keyword)));
}

export function classifica(titolo: string, descrizione: string, keywords: Keywords): MatchResult {
  const testoNormalizzato = normalizzaTesto(`${titolo} ${descrizione}`);

  if (contieneKeyword(testoNormalizzato, keywords.livello1)) {
    return { priorita: 'alta', scartato: false };
  }

  if (contieneKeyword(testoNormalizzato, keywords.livello2)) {
    return { priorita: 'da_verificare', scartato: false };
  }

  return { priorita: null, scartato: true };
}

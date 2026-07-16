import { createHash } from 'node:crypto';

export function calcolaHash(titolo: string, descrizione: string): string {
  const contenuto = `${titolo.trim()}\n${descrizione.trim()}`;
  return createHash('sha256').update(contenuto, 'utf8').digest('hex');
}

import axios from 'axios';
import type { BandoRaw, Priorita } from './types.js';
import type { FonteFallita } from './db-port.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface NuovoBandoTrovato {
  bando: BandoRaw;
  priorita: Priorita;
}

export type FunzioneInvioEmail = (opzioni: { a: string; oggetto: string; html: string }) => Promise<void>;

export async function inviaEmailReale(opzioni: { a: string; oggetto: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Variabile d'ambiente RESEND_API_KEY mancante");
  }
  await axios.post(
    RESEND_API_URL,
    {
      from: 'QYROS Bandi Monitor <onboarding@resend.dev>',
      to: [opzioni.a],
      subject: opzioni.oggetto,
      html: opzioni.html,
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
}

function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formattaBadgePriorita(priorita: Priorita): string {
  if (priorita === 'alta') {
    return '<span style="background:#ff6500;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">Match diretto</span>';
  }
  return '<span style="background:#3c6a8b;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">Da verificare</span>';
}

export function formattaEmailDigest(nuoviBandi: NuovoBandoTrovato[], fontiFallite: FonteFallita[]): string {
  const righeBandi = nuoviBandi
    .map(
      ({ bando, priorita }) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee;">
          <div>${formattaBadgePriorita(priorita)}</div>
          <div style="font-weight:600;margin-top:6px;"><a href="${escapeHtml(bando.url)}" style="color:#040a1b;text-decoration:none;">${escapeHtml(bando.titolo)}</a></div>
          <div style="color:#666;font-size:13px;margin-top:4px;">${escapeHtml(bando.fonte)}${bando.scadenza ? ` &middot; scadenza ${escapeHtml(bando.scadenza)}` : ''}</div>
        </td>
      </tr>`
    )
    .join('');

  const sezioneErrori =
    fontiFallite.length > 0
      ? `<p style="margin-top:24px;color:#b00020;">Attenzione, fonti non raggiungibili oggi: ${fontiFallite
          .map((f) => escapeHtml(f.fonte))
          .join(', ')}</p>`
      : '';

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#040a1b;">QYROS Bandi Monitor &mdash; ${nuoviBandi.length} nuovi bandi</h2>
      <table style="width:100%;border-collapse:collapse;">${righeBandi}</table>
      ${sezioneErrori}
    </div>
  `;
}

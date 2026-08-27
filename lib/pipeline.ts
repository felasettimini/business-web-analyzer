import { PipelineStatus, DiscardReason, Business } from './types';

export const PIPELINE_STATUSES: { value: PipelineStatus; label: string; color: string; dot: string }[] = [
  { value: 'nuevo', label: 'Nuevo', color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  { value: 'contactado', label: 'Contactado', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  { value: 'interesado', label: 'Interesado', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  { value: 'cliente', label: 'Cliente', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  { value: 'descartado', label: 'Descartado', color: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
];

export function getStatusMeta(status?: PipelineStatus) {
  return PIPELINE_STATUSES.find((s) => s.value === status) || PIPELINE_STATUSES[0];
}

export const DISCARD_REASONS: { value: DiscardReason; label: string }[] = [
  { value: 'no-contesto', label: 'No contestó' },
  { value: 'no-interesa', label: 'No le interesa' },
  { value: 'ya-tiene', label: 'Ya tiene web/diseñador' },
  { value: 'web-buena', label: 'Tiene muy buena web, no vale la pena' },
  { value: 'precio', label: 'Por precio' },
  { value: 'otro', label: 'Otro' },
];

export function getDiscardReasonLabel(reason?: DiscardReason): string | undefined {
  return DISCARD_REASONS.find((r) => r.value === reason)?.label;
}

/**
 * Pide el motivo de descarte con un prompt simple (mismo patron que las notas).
 * Se usa cada vez que un negocio pasa a estado "descartado", para despues poder
 * ver que esta fallando (mensaje, rubro, precio, etc.) en vez de perder esa info.
 */
export function promptDiscardReason(): DiscardReason | undefined {
  const options = DISCARD_REASONS.map((r, i) => `${i + 1} = ${r.label}`).join('\n');
  const input = window.prompt(`Motivo del descarte:\n${options}\n\nEscribi el numero:`);
  if (!input) return undefined;
  const index = parseInt(input.trim(), 10) - 1;
  return DISCARD_REASONS[index]?.value;
}

/** +3 dias desde ahora, como fecha ISO — usado para sugerir el 2do toque de seguimiento */
export function suggestNextFollowUp(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString();
}

export function isFollowUpDue(nextFollowUpAt?: string): boolean {
  if (!nextFollowUpAt) return false;
  return new Date(nextFollowUpAt).getTime() <= Date.now();
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Un negocio se descarta solo despues de una semana sin respuesta genuina: si nunca
 * contesto nada, o si solo contesto con mensajes automaticos (marcados como tal en el
 * chat). Si en algun momento respondio de verdad, no se descarta solo por el tiempo —
 * queda la chance de insistir mas adelante.
 */
export function shouldAutoDiscard(business: Business): boolean {
  const log = business.conversationLog;
  if (!log || log.length === 0) return false;

  const hasGenuineReply = log.some((e) => e.sender === 'contact' && !e.isAutoReply);
  if (hasGenuineReply) return false;

  const outbound = log.filter((e) => e.sender === 'me');
  if (outbound.length === 0) return false;

  const lastOutboundDate = Math.max(...outbound.map((e) => new Date(e.date).getTime()));
  return Date.now() - lastOutboundDate >= ONE_WEEK_MS;
}

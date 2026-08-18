import { PipelineStatus } from './types';

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

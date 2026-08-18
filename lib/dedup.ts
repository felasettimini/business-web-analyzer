import { Business } from './types';

/**
 * Compara dos negocios para saber si son el mismo.
 * Prioriza placeId (identificador unico de Google) cuando esta disponible
 * en ambos, ya que nombre+direccion puede variar levemente entre busquedas
 * (ej: "Dr. Juan Perez" vs "Juan Perez - Consultorio").
 */
export function isSameBusiness(a: Business, b: Business): boolean {
  if (a.placeId && b.placeId) return a.placeId === b.placeId;
  return a.name === b.name && a.address === b.address;
}

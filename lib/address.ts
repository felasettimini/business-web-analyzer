import { Business } from './types';

/**
 * Codigos de area (caracteristica) de las ciudades argentinas mas grandes, sin el 0
 * inicial. No es una lista exhaustiva (hay cientos de codigos para pueblos chicos),
 * pero cubre las capitales de provincia y las ciudades mas comunes al scoutear.
 * Ordenados de mas a menos digitos para buscar siempre el prefijo mas largo primero
 * (evita que "11" matchee antes que un codigo de 3-4 digitos que tambien empieza en 1).
 */
const AR_AREA_CODES: { code: string; city: string }[] = [
  { code: '2901', city: 'Ushuaia' },
  { code: '2920', city: 'Viedma' },
  { code: '2966', city: 'Río Gallegos' },
  { code: '221', city: 'La Plata' },
  { code: '223', city: 'Mar del Plata' },
  { code: '261', city: 'Mendoza' },
  { code: '264', city: 'San Juan' },
  { code: '266', city: 'San Luis' },
  { code: '280', city: 'Puerto Madryn' },
  { code: '291', city: 'Bahía Blanca' },
  { code: '294', city: 'San Carlos de Bariloche' },
  { code: '297', city: 'Comodoro Rivadavia' },
  { code: '299', city: 'Neuquén' },
  { code: '341', city: 'Rosario' },
  { code: '342', city: 'Santa Fe' },
  { code: '343', city: 'Paraná' },
  { code: '345', city: 'Concordia' },
  { code: '351', city: 'Córdoba' },
  { code: '358', city: 'Río Cuarto' },
  { code: '362', city: 'Resistencia' },
  { code: '370', city: 'Formosa' },
  { code: '376', city: 'Posadas' },
  { code: '379', city: 'Corrientes' },
  { code: '380', city: 'La Rioja' },
  { code: '381', city: 'San Miguel de Tucumán' },
  { code: '383', city: 'Catamarca' },
  { code: '385', city: 'Santiago del Estero' },
  { code: '387', city: 'Salta' },
  { code: '388', city: 'San Salvador de Jujuy' },
  { code: '11', city: 'Buenos Aires' },
].sort((a, b) => b.code.length - a.code.length);

/**
 * Detecta la ciudad a partir del codigo de area del telefono. En Argentina esto es
 * mucho mas confiable que tratar de parsear la direccion (Google la formatea distinto
 * segun el negocio, con o sin barrio/provincia en el medio), porque el codigo de area
 * es fijo por ciudad. Funciona con numeros en formato internacional (+54 9 341 ...)
 * o local (0341 ...).
 */
function cityFromPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('54')) digits = digits.slice(2); // codigo de pais
  if (digits.startsWith('9')) digits = digits.slice(1);  // marcador de celular
  digits = digits.replace(/^0/, '');                     // numeros locales tipo "0341..."

  return AR_AREA_CODES.find((a) => digits.startsWith(a.code))?.city;
}

/** Google siempre pone el pais al final de la direccion formateada, separado por coma. */
function countryFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || undefined;
}

/**
 * Ciudad/pais de un negocio: prioriza los campos estructurados (`city`/`country`,
 * que vienen de Google Places en busquedas nuevas). Si faltan (leads viejos o
 * importados a mano), infiere la ciudad del codigo de area del telefono y el pais
 * del final de la direccion. Si no hay match, queda sin definir — mejor mostrar
 * "sin ciudad" en el filtro que adivinar mal.
 */
export function getBusinessLocation(business: Business): { city?: string; country?: string } {
  return {
    city: business.city || cityFromPhone(business.phone),
    country: business.country || countryFromAddress(business.address),
  };
}

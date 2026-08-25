import { Business } from './types';

/**
 * Extrae ciudad y pais de una direccion formateada (estilo Google Maps), a modo de
 * "mejor esfuerzo" para negocios viejos/importados que no tienen `city`/`country`
 * estructurados (esos campos solo se completan en busquedas nuevas via Google Places).
 *
 * Formatos tipicos que intenta cubrir:
 *  - "Calle 123, S2000 Rosario, Santa Fe, Argentina"      (4 partes: calle, ciudad+CP, provincia, pais)
 *  - "Calle Mayor 1, 28013 Madrid, España"                 (3 partes: calle, ciudad+CP, pais)
 *  - "Rosario, Santa Fe, Argentina"                        (3 partes sin calle)
 *  - "Rosario, Argentina"                                  (2 partes)
 *
 * No es infalible (direcciones con formato raro pueden dar una ciudad incorrecta),
 * pero alcanza para filtrar/agrupar leads existentes.
 */
export function parseAddressParts(address?: string): { city?: string; country?: string } {
  if (!address) return {};

  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};

  const country = parts[parts.length - 1];

  let cityRaw: string | undefined;
  if (parts.length >= 4) {
    cityRaw = parts[parts.length - 3]; // salteamos provincia/estado y pais
  } else if (parts.length === 3) {
    cityRaw = parts[parts.length - 2]; // salteamos solo el pais
  } else if (parts.length === 2) {
    cityRaw = parts[0];
  }

  // Le sacamos codigos postales pegados adelante (ej: "S2000 Rosario" -> "Rosario", "28013 Madrid" -> "Madrid")
  const city = cityRaw?.replace(/^[A-Z]{0,2}\d{3,6}\s+/i, '').trim() || undefined;

  return { city: city || undefined, country: country || undefined };
}

/**
 * Ciudad/pais de un negocio: prioriza los campos estructurados (`city`/`country`,
 * que vienen de Google Places en busquedas nuevas) y si no estan, los infiere
 * de `address` como fallback.
 */
export function getBusinessLocation(business: Business): { city?: string; country?: string } {
  if (business.city || business.country) {
    return { city: business.city, country: business.country };
  }
  return parseAddressParts(business.address);
}

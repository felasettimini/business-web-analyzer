/**
 * Deteccion centralizada de links de redes sociales.
 * Un link a Facebook/Instagram/etc NO es un sitio web propio, aunque
 * Google Maps (o un scraper manual) lo haya puesto en el campo "website".
 */
const SOCIAL_DOMAINS = [
  'facebook.com', 'fb.com', 'fb.me', 'm.me',
  'instagram.com', 'instagr.am',
  'twitter.com', 'x.com',
  'tiktok.com',
  'linkedin.com',
  'youtube.com', 'youtu.be',
  'threads.net',
  'whatsapp.com', 'wa.me',
  'linktr.ee', 'bit.ly', 'linkin.bio',
];

export function isSocialMediaUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Muchos scrapers manuales (Instant Data Scraper, etc.) devuelven
  // dominios sin protocolo, ej: "instagram.com/mi_negocio"
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const hostname = new URL(candidate).hostname.replace(/^www\./, '').replace(/^m\./, '');
    return SOCIAL_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

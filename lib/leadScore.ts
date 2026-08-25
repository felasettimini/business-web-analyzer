import { Business, WebsiteAnalysis } from './types';

/**
 * Calcula un score compuesto de 0-100 que combina:
 * - Que tan "real"/establecido es el negocio (rating + cantidad de reviews)
 *   -> mas probabilidad de que tenga presupuesto y le importe su imagen online
 * - Que tanto necesita una web nueva/mejor (sin web > solo redes > web mala > web buena)
 *
 * Un negocio con 4.8 estrellas y 300 reviews sin web pesa mucho mas que uno
 * con 2 estrellas y 3 reviews sin web, aunque el analisis de "oportunidad"
 * del sitio (o la ausencia de sitio) sea el mismo.
 */
export function calculateLeadScore(business: Business, analysis?: WebsiteAnalysis): number {
  const ratingScore = business.rating ? (business.rating / 5) * 100 : 50; // sin rating = neutro
  const reviewsScore = business.reviews
    ? Math.min(100, (Math.log10(business.reviews + 1) / Math.log10(501)) * 100)
    : 0;
  const businessQuality = ratingScore * 0.6 + reviewsScore * 0.4;

  let opportunityScore: number;
  if (!business.hasWebsite && !business.onlySocial) {
    opportunityScore = 100; // sin web ni redes = maxima necesidad
  } else if (business.onlySocial) {
    opportunityScore = 90; // tiene presencia online pero no web propia
  } else if (analysis) {
    opportunityScore = 100 - analysis.overall; // web mala = mas oportunidad
  } else {
    opportunityScore = 50; // tiene web pero todavia no se analizo
  }

  const leadScore = businessQuality * 0.4 + opportunityScore * 0.6;
  return Math.round(Math.max(0, Math.min(100, leadScore)));
}

export function leadScoreLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Lead premium', color: 'bg-red-100 text-red-700' };
  if (score >= 55) return { label: 'Buen lead', color: 'bg-orange-100 text-orange-700' };
  if (score >= 35) return { label: 'Lead medio', color: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Lead bajo', color: 'bg-slate-100 text-slate-600' };
}

/**
 * Prioridad segun presencia web: 0 = sin web ni redes (mayor oportunidad),
 * 1 = solo redes sociales, 2 = tiene web propia (menor oportunidad).
 * Se usa como criterio de orden principal en las listas, antes del lead score.
 */
export function webPresencePriority(business: Business): number {
  if (!business.hasWebsite && !business.onlySocial) return 0;
  if (business.onlySocial) return 1;
  return 2;
}

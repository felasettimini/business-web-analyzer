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
  } else if (analysis?.indexingBlocked) {
    opportunityScore = 95; // invisible en Google = misma oportunidad que no tener web, aunque el sitio este bien armado
  } else if (analysis) {
    opportunityScore = 100 - analysis.overall; // web mala = mas oportunidad
  } else {
    opportunityScore = 50; // tiene web pero todavia no se analizo
  }

  let leadScore = businessQuality * 0.4 + opportunityScore * 0.6;

  // Si el sitio ya esta bien armado (opportunity 'low', y no bloquea la indexacion),
  // no tiene sentido venderle nada — no importa que tan grande/establecido sea el
  // negocio, tope el score para que caiga siempre en "Lead bajo".
  if (analysis && analysis.opportunity === 'low' && !analysis.indexingBlocked) {
    leadScore = Math.min(leadScore, 34);
  }

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

// ===================== POTENCIAL SISTEMA =====================
// Busca negocios "tipo Cristal Smile": asentados, con varios profesionales y
// procesos que hoy corren a mano (WhatsApp, Excel, telefono). No mide la web,
// mide cuanto les serviria un sistema a medida (turnos, pacientes, cobros, portal).

// Nombre que sugiere varios profesionales (y por lo tanto recepcion, agenda compartida, etc.)
// ("centro" solo con complemento: "Peluqueria Rosario Centro" es un barrio, no un centro medico)
const MULTI_PRO_NAME = /\b(cl[ií]nica|centro\s+(de|del|m[eé]dico|dental|odontol[oó]gico|integral|est[eé]tic)|instituto|consultorios|policonsultorio|grupo|red|integral|especialidades|asociados|equipo)\b/i;
// Demasiado grandes: ya tienen sistema y un area de sistemas
const TOO_BIG_NAME = /\b(hospital|sanatorio|swiss medical|osde|galeno|medife|iapos|pami|universidad|municipal|provincial|p[uú]blico)\b/i;

// messagePhrase: como se nombra el problema en el primer mensaje ("cuesta ...")
const PAIN_TOPICS: { label: string; messagePhrase: string; pattern: RegExp }[] = [
  { label: 'turnos', messagePhrase: 'conseguir turno', pattern: /turno|agenda|reprogram|cancelaron|me cambiaron/i },
  { label: 'comunicación', messagePhrase: 'comunicarse', pattern: /no (atienden|contestan|responden)|imposible comunicar|tel[eé]fono|whats ?app|nunca (atienden|contestan|responden)|no hay forma de comunicar/i },
  { label: 'esperas', messagePhrase: 'evitar las demoras', pattern: /demora|esper[eéa]|puntual|hora de retraso|horas? de espera/i },
  { label: 'administración y cobros', messagePhrase: 'resolver la parte administrativa', pattern: /factur|cobr|presupuesto|desorganiz|administra|obra social|papeles|recepci[oó]n/i },
];

function joinSpanish(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} o ${items[items.length - 1]}`;
}

export interface SystemsLeadResult {
  score: number;
  signals: string[]; // señales en lenguaje humano, para usar en el primer mensaje
  // Frase lista para la plantilla de WhatsApp ("Estuve viendo X y {messageHook}."), armada
  // con la señal mas fuerte. Tono de observacion, no de critica: es el primer contacto.
  messageHook: string;
}

export function calculateSystemsLeadScore(business: Business, analysis?: WebsiteAnalysis): SystemsLeadResult {
  const signals: string[] = [];

  if (TOO_BIG_NAME.test(business.name)) {
    return { score: 0, signals: ['Institución grande — ya tiene sistemas propios'], messageHook: '' };
  }

  // 1. Asentado (0-35): mismas bases que el lead score de web
  const reviews = business.reviews || 0;
  const reviewsScore = Math.min(1, Math.log10(reviews + 1) / Math.log10(301));
  const ratingFactor = business.rating ? Math.min(1, business.rating / 4.5) : 0.7;
  const established = 35 * reviewsScore * ratingFactor;
  if (reviews >= 100) signals.push(`Negocio asentado (${reviews} reseñas)`);

  // 2. Tamaño (0-25): varios profesionales = agenda compartida, recepcion, pacientes que se pierden
  let size = 0;
  if (MULTI_PRO_NAME.test(business.name)) {
    size = 25;
    signals.push('Por el nombre, trabaja con varios profesionales');
  } else if (reviews >= 150) {
    size = 15; // mucho volumen de pacientes aunque el nombre sea de una persona
  }

  // 3. Quejas operativas en reseñas (0-30)
  const complaints = new Set<(typeof PAIN_TOPICS)[number]>();
  for (const review of business.reviewSamples || []) {
    const isNegative = review.rating === undefined || review.rating <= 3;
    for (const topic of PAIN_TOPICS) {
      if (topic.pattern.test(review.text) && isNegative) complaints.add(topic);
    }
  }
  const complaintList = Array.from(complaints);
  const pain = Math.min(30, complaints.size * 15);
  if (complaints.size > 0) signals.push(`Reseñas con quejas de ${complaintList.map((t) => t.label).join(', ')}`);

  // 4. Web / herramientas (0-20)
  let tools = 0;
  if (analysis) {
    if (analysis.hasLoginArea) {
      tools += 12;
      signals.push('Tiene un área de usuarios en la web — posible sistema viejo a reemplazar');
    }
    if (analysis.hasOnlineBooking === false) {
      tools += 8;
      signals.push('Sin turnos online: todo pasa por teléfono/WhatsApp');
    }
  } else if (!business.hasWebsite) {
    tools += 8;
    signals.push('Sin web propia: turnos y consultas seguro van por teléfono/WhatsApp');
  }

  const score = Math.round(Math.max(0, Math.min(100, established + size + pain + tools)));

  let messageHook: string;
  if (complaintList.length > 0) {
    messageHook = `en algunas reseñas comentan que cuesta ${joinSpanish(complaintList.map((t) => t.messagePhrase))}, algo que suele pasar cuando todo entra por teléfono y WhatsApp`;
  } else if (analysis?.hasLoginArea) {
    messageHook = 'noté que en la web tienen un área de acceso para usuarios; muchas veces esos sistemas quedan viejos o casi no se usan';
  } else if (analysis?.hasOnlineBooking === false || !business.hasWebsite) {
    messageHook = 'noté que los turnos y las consultas se manejan por teléfono y WhatsApp';
  } else {
    messageHook = 'noté que trabajan con varios profesionales, y ahí la agenda y el seguimiento de cada caso suelen complicarse';
  }

  return { score, signals, messageHook };
}

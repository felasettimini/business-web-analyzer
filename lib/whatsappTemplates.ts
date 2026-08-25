import { WhatsAppTemplate } from './types';

export const defaultTemplates: WhatsAppTemplate[] = [
  {
    id: 'intro-casual',
    name: 'Presentacion casual',
    message: `Hola! Soy Felipe, desarrollador web de Rosario.

Vi que {nombre_negocio} tiene mucha actividad y queria comentarte algo: hoy en dia el 70% de la gente busca negocios en Google antes de ir. Una pagina web profesional puede ayudarte a captar esos clientes.

Te dejo mi portfolio: https://felipesettimini.com

Si te interesa, te hago una consulta sin costo para ver como mejorar tu presencia online. Sin compromiso!

Saludos!`,
  },
  {
    id: 'intro-directo',
    name: 'Directo al grano',
    message: `Hola! Soy Felipe, web developer en Rosario.

Vi {nombre_negocio} y note que {problema_principal}. Trabajo con negocios de la zona creando sitios web profesionales que captan clientes desde Google.

Portfolio: https://felipesettimini.com

Te interesaria una consulta gratis para ver opciones?`,
  },
  {
    id: 'inmobiliaria-sin-web',
    name: '🏠 INMOBILIARIA - Sin web',
    message: `Hola! Soy Felipe, desarrollador web en Rosario.

Vi que {nombre_negocio} no tiene pagina web propia. Hoy en dia mucha gente busca inmobiliarias en Google antes de contactar, y sin web esos clientes se van a la competencia.

Te armo gratis una vista previa de como quedaria tu pagina, sin compromiso de nada. Te interesa verla?`,
  },
  {
    id: 'inmobiliaria-web-vieja',
    name: '🏠 INMOBILIARIA - Web desactualizda',
    message: `Hola! Soy Felipe, desarrollador web en Rosario.

Vi la pagina de {nombre_negocio} y note que {problema_principal}. Eso hace que muchos clientes se vayan antes de contactarte.

Te armo gratis un ejemplo de como podria verse mejorada, sin compromiso de nada. Te interesa verlo?`,
  },
  {
    id: 'followup',
    name: 'Seguimiento (2do mensaje)',
    message: `Hola de nuevo! Te escribi hace unos dias sobre crear/mejorar la web de {nombre_negocio}.

Queria ver si tuviste chance de pensarlo. Estoy con algunos proyectos en la zona y podria hacerte un precio especial si arrancamos esta semana.

Cualquier duda estoy a disposicion!

Felipe
https://felipesettimini.com`,
  },
  {
    id: 'followup-final',
    name: 'Cierre (3er mensaje)',
    message: `Hola! Se ve que no es el momento, asi que no te molesto mas por este medio.

Si en algun momento te interesa mejorar la presencia online de {nombre_negocio}, quedo a disposicion.

Felipe
https://felipesettimini.com`,
  },
  {
    id: 'inmobiliaria-preview-rapida',
    name: '🏠 INMOBILIARIA - Vista previa (baja friccion)',
    message: `Hola! Vi {nombre_negocio} en Google Maps ({rating}★, {reviews} reseñas) y note que no aparece un sitio propio cuando te buscan.

Te armo gratis una vista previa rapida de tu pagina, sin compromiso. Te la mando?

Felipe - desarrollador web`,
  },
  {
    id: 'inmobiliaria-preview-directa',
    name: '🏠 INMOBILIARIA - Vista previa directa',
    message: `Hola! Soy Felipe, developer web en Rosario.

Vi que {nombre_negocio} no tiene web propia. Hoy la mayoria de tus clientes potenciales googlean antes de ir a una inmobiliaria, y sin web esos clientes se van a la competencia.

Te armo gratis una vista previa de como quedaria tu pagina, sin compromiso de nada. Te interesa verla?`,
  },
  {
    id: 'inmobiliaria-preview-envio',
    name: '🏠 INMOBILIARIA - Envio del link (2do paso, cuando dicen que si)',
    message: `Genial! Te dejo la vista previa: https://web-demos-mauve.vercel.app/demo/inmobiliaria

Es solo un ejemplo de estilo, tu pagina la armaria con tus propiedades, colores y datos. Que te parecio?`,
  },
  {
    id: 'inmobiliaria-followup',
    name: '🏠 INMOBILIARIA - Seguimiento (no respondio)',
    message: `Hola de nuevo! Te escribi hace unos dias por lo de tu pagina web, pero no se si te habra llegado el mensaje.

Sigue en pie lo de armarte gratis una vista previa de como quedaria, sin compromiso. Te la mando?

Felipe`,
  },
];

/**
 * Replace template variables with actual values
 */
export function fillTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let filled = template;
  for (const [key, value] of Object.entries(variables)) {
    filled = filled.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return filled;
}

/**
 * Clean phone number for WhatsApp link
 * Removes spaces, dashes, parens, and ensures country code
 */
export function cleanPhone(phone: string): string {
  // Remove everything except digits and +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If starts with 0, assume Argentina local → prepend +54
  if (cleaned.startsWith('0')) {
    cleaned = '54' + cleaned.substring(1);
  }

  // If doesn't start with + or country code, assume Argentina
  if (!cleaned.startsWith('54') && !cleaned.startsWith('+')) {
    cleaned = '54' + cleaned;
  }

  // Remove leading +
  cleaned = cleaned.replace(/^\+/, '');

  return cleaned;
}

/**
 * Generate WhatsApp link
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanedPhone = cleanPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
}

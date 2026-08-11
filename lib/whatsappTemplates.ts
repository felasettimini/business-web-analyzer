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
    id: 'sin-web',
    name: 'Para negocios SIN web',
    message: `Hola! Soy Felipe, desarrollador web en Rosario.

Vi que {nombre_negocio} no tiene pagina web todavia. Hoy en dia mucha gente busca "{rubro} en Rosario" en Google, y sin web esos clientes se van a la competencia.

Puedo armar un sitio profesional a medida con:
- Diseño moderno y rapido
- Optimizado para Google (SEO)
- Boton de WhatsApp directo
- Fotos y catalogo de productos

Portfolio: https://felipesettimini.com

Te gustaria charlar 15 mins sin compromiso?`,
  },
  {
    id: 'web-vieja',
    name: 'Para webs desactualizadas',
    message: `Hola! Soy Felipe, desarrollador web en Rosario.

Vi la pagina de {nombre_negocio} y note que podria tener un upgrade importante. Las webs modernas cargan mas rapido, se ven mejor en celular y posicionan mejor en Google.

Trabajo con negocios de la zona modernizando su presencia online. Te dejo mi portfolio: https://felipesettimini.com

Te interesaria que te muestre como quedaria tu sitio actualizado? Sin costo la consulta!`,
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

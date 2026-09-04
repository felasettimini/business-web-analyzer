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
    id: 'peluqueria-sin-web',
    name: '💇 PELUQUERIA - Sin web',
    message: `Hola! Soy Felipe, desarrollador web en Rosario.

Vi que {nombre_negocio} no tiene pagina web propia. Hoy en dia mucha gente busca peluquerias en Google antes de ir, mira fotos y quiere reservar turno online, y sin web esos clientes se van a la competencia.

Te armo gratis una vista previa de como quedaria tu pagina, sin compromiso de nada. Te interesa verla?`,
  },
  {
    id: 'peluqueria-web-vieja',
    name: '💇 PELUQUERIA - Web desactualizda',
    message: `Hola! Soy Felipe, desarrollador web en Rosario.

Vi la pagina de {nombre_negocio} y note que {problema_principal}. Eso hace que muchos clientes se vayan antes de reservar un turno.

Te armo gratis un ejemplo de como podria verse mejorada, sin compromiso de nada. Te interesa verlo?`,
  },
  {
    id: 'estudio-juridico-sin-web',
    name: '⚖️ ESTUDIO JURIDICO - Sin web',
    message: `Hola! Soy Felipe, desarrollador web en Rosario.

Vi que {nombre_negocio} no tiene pagina web propia. Hoy en dia mucha gente busca e investiga a un abogado en Google antes de contactarlo, y sin web perdes esa primera impresion de seriedad frente a la competencia.

Te armo gratis una vista previa de como quedaria tu pagina, sin compromiso de nada. Te interesa verla?`,
  },
  {
    id: 'estudio-juridico-web-vieja',
    name: '⚖️ ESTUDIO JURIDICO - Web desactualizda',
    message: `Hola! Soy Felipe, desarrollador web en Rosario.

Vi la pagina de {nombre_negocio} y note que {problema_principal}. Eso le resta seriedad frente a un cliente que te esta comparando con otros estudios.

Te armo gratis un ejemplo de como podria verse mejorada, sin compromiso de nada. Te interesa verlo?`,
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

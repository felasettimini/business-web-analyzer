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
  {
    id: 'dentista-sin-web',
    name: '🦷 DENTISTA - Sin web',
    message: `Hola! Soy Felipe, desarrollador web en Rosario.

Vi que {nombre_negocio} no tiene pagina web propia. Hoy en dia mucha gente busca dentista en Google antes de elegir, quiere ver fotos del consultorio y reservar turno online, y sin web esos pacientes se van a la competencia.

Te armo gratis una vista previa de como quedaria tu pagina, sin compromiso de nada. Te interesa verla?`,
  },
  {
    id: 'dentista-web-vieja',
    name: '🦷 DENTISTA - Web desactualizda',
    message: `Hola! Soy Felipe, desarrollador web en Rosario.

Vi la pagina de {nombre_negocio} y note que {problema_principal}. Eso le resta confianza a un paciente que te esta comparando con otros consultorios.

Te armo gratis un ejemplo de como podria verse mejorada, sin compromiso de nada. Te interesa verlo?`,
  },
  // Clientes de sistemas (tipo Cristal Smile): no se vende una web sino resolver un
  // problema operativo. El primer mensaje pide una charla corta para entender como
  // trabajan hoy — no ofrece una solucion todavia. {senal_sistema} sale de
  // calculateSystemsLeadScore (lib/leadScore.ts).
  {
    id: 'sistemas-intro',
    name: '⚙️ SISTEMAS - Primer contacto',
    message: `Hola! Soy Felipe, desarrollador de Rosario.

Estoy trabajando con una clínica odontológica de acá en un sistema para ordenar casos, pacientes y pagos que hoy llevan por WhatsApp y Excel.

Estuve viendo {nombre_negocio} y {senal_sistema}.

Les puedo hacer 3 o 4 preguntas sobre cómo manejan eso hoy? Son 15 minutos, sin compromiso, y si veo algo que se pueda simplificar se los cuento.`,
  },
  {
    id: 'sistemas-followup',
    name: '⚙️ SISTEMAS - Seguimiento con demo',
    message: `Hola! Retomo lo que les comenté hace unos días sobre cómo organizan turnos y pacientes en {nombre_negocio}.

Si les sirve, paso 15 minutos por ahí y les muestro en la compu cómo quedaría el día a día con un sistema así, con sus propios casos de ejemplo. Sin compromiso.

Qué día les queda cómodo?`,
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

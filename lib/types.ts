export type PipelineStatus = 'nuevo' | 'contactado' | 'interesado' | 'cliente' | 'descartado';

export type DiscardReason = 'no-contesto' | 'no-interesa' | 'ya-tiene' | 'web-buena' | 'precio' | 'otro';

export interface ConversationEntry {
  date: string;              // ISO
  sender: 'me' | 'contact';  // quien mando el mensaje, para armar la vista tipo chat
  text: string;
  reaction?: string;         // emoji de reaccion, como en whatsapp
  seen?: boolean;            // visto por el contacto (solo aplica a mensajes propios)
  isAutoReply?: boolean;     // respuesta automatica del negocio (bot de WhatsApp, etc.), no cuenta como respuesta real en las metricas
}

export interface Business {
  name: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;                 // ciudad, tomada de addressComponents de Google Places cuando esta disponible
  country?: string;               // pais, idem. Si no vino de la API, se puede inferir de `address` (ver lib/address.ts)
  rating?: number;
  reviews?: number;
  mapUrl?: string;
  placeId?: string;
  hasWebsite: boolean;
  socialMedia?: string;   // Facebook/Instagram/etc URL (not a real website)
  onlySocial?: boolean;   // true if the only "web" is a social media profile
  analyzed?: boolean;
  status?: PipelineStatus; // pipeline de venta, default 'nuevo' si no esta seteado
  notes?: string;          // notas libres del vendedor
  screenshotUrl?: string;  // captura de la web actual, generada con Puppeteer (solo local)
  discardReason?: DiscardReason; // por que se descarto el lead, para aprender que ajustar
  nextFollowUpAt?: string;       // ISO date del proximo contacto sugerido (2do/3er toque)
  lastTemplateId?: string;       // plantilla usada en el ultimo envio, para medir que mensaje convierte mejor
  category?: string;             // tipo de negocio (peluquerias, inmobiliarias, etc.), para segmentar contactos
  conversationLog?: ConversationEntry[]; // registro de la conversacion de whatsapp, para analizar que funciona
}

export interface WebsiteAnalysis {
  url: string;
  businessName: string;
  scores: {
    mobile: number;
    speed: number;
    design: number;
    seo: number;
    contactibility: number;
  };
  overall: number;
  issues: string[];
  recommendations: string[];
  hasMobileMenu: boolean;
  hasContactForm: boolean;
  hasWhatsapp: boolean;
  hasMapEmbedded: boolean;
  isResponsive: boolean;
  loadTime: number;
  designAge: 'modern' | 'outdated' | 'very_outdated';
  opportunity: 'high' | 'medium' | 'low';
  indexingBlocked: boolean; // noindex/robots.txt detectado — invisible en Google aunque cargue bien
}

export interface AnalysisResult {
  business: Business;
  analysis?: WebsiteAnalysis;
  error?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  message: string;
}

export interface WhatsAppMessage {
  business: Business;
  phone: string;
  message: string;
  waLink: string;
  sent: boolean;
}

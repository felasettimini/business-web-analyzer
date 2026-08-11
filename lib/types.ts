export interface Business {
  name: string;
  website?: string;
  phone?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  mapUrl?: string;
  placeId?: string;
  hasWebsite: boolean;
  socialMedia?: string;   // Facebook/Instagram/etc URL (not a real website)
  onlySocial?: boolean;   // true if the only "web" is a social media profile
  analyzed?: boolean;
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

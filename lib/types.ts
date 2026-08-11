export interface Business {
  name: string;
  website?: string;
  phone?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  mapUrl?: string;
  hasWebsite: boolean;
  analyzed?: boolean;
}

export interface WebsiteAnalysis {
  url: string;
  businessName: string;
  scores: {
    mobile: number; // 0-100
    speed: number; // 0-100
    design: number; // 0-100
    seo: number; // 0-100
    contactibility: number; // 0-100
  };
  overall: number; // 0-100
  issues: string[];
  recommendations: string[];
  hasMobileMenu: boolean;
  hasContactForm: boolean;
  hasWhatsapp: boolean;
  hasMapEmbedded: boolean;
  isResponsive: boolean;
  loadTime: number; // ms
  designAge: 'modern' | 'outdated' | 'very_outdated';
  opportunity: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  business: Business;
  analysis?: WebsiteAnalysis;
  error?: string;
}

import axios from 'axios';
import * as cheerio from 'cheerio';
import { WebsiteAnalysis } from './types';

export async function analyzeWebsite(url: string, businessName: string): Promise<WebsiteAnalysis> {
  try {
    const startTime = Date.now();

    // Fetch the website
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const loadTime = Date.now() - startTime;
    const html = response.data;
    const $ = cheerio.load(html);

    // Initialize scores
    const scores = {
      mobile: 50,
      speed: 50,
      design: 50,
      seo: 50,
      contactibility: 50,
    };

    const issues: string[] = [];
    const recommendations: string[] = [];

    // ===== MOBILE CHECK =====
    const viewport = $('meta[name="viewport"]').attr('content');
    const hasMobileMenu = $('[role="navigation"]').length > 0 || $('.mobile-menu').length > 0;
    const isResponsive = !!viewport && viewport.includes('width=device-width');

    if (isResponsive) {
      scores.mobile = 85;
    } else {
      scores.mobile = 30;
      issues.push('No responsive design detected');
      recommendations.push('Implement mobile-first responsive design');
    }

    if (!hasMobileMenu && !isResponsive) {
      issues.push('No mobile menu found');
    }

    // ===== SPEED CHECK =====
    if (loadTime < 2000) {
      scores.speed = 95;
    } else if (loadTime < 4000) {
      scores.speed = 70;
    } else {
      scores.speed = 40;
      issues.push('Website loads slowly');
      recommendations.push('Optimize images and reduce server response time');
    }

    // ===== DESIGN AGE CHECK =====
    const hasModernTools =
      html.includes('Next.js') ||
      html.includes('React') ||
      html.includes('Vue') ||
      html.includes('Svelte') ||
      html.includes('Tailwind');

    const hasOldTechs =
      html.includes('Bootstrap 3') ||
      html.includes('jQuery 1.') ||
      html.includes('Flash');

    let designAge: 'modern' | 'outdated' | 'very_outdated' = 'modern';
    let designScore = 80;

    if (hasOldTechs) {
      designAge = 'very_outdated';
      designScore = 30;
      issues.push('Website uses outdated technology stack');
    } else if (!hasModernTools && !isResponsive) {
      designAge = 'outdated';
      designScore = 50;
      issues.push('Website design appears outdated');
    }

    // Check for modern design patterns
    const hasModernDesign =
      $('[class*="hero"]').length > 0 ||
      $('[class*="gradient"]').length > 0 ||
      $('[class*="dark-mode"]').length > 0;

    if (hasModernDesign) designScore += 15;
    scores.design = Math.min(designScore, 100);

    if (designAge !== 'modern') {
      recommendations.push('Redesign with modern UI/UX principles');
    }

    // ===== SEO CHECK =====
    let seoScore = 50;
    const title = $('title').text();
    const metaDescription = $('meta[name="description"]').attr('content');
    const h1Count = $('h1').length;
    const hasStructuredData = html.includes('schema.org');

    if (title && title.length > 20) seoScore += 15;
    else {
      issues.push('Missing or weak page title');
      recommendations.push('Add descriptive title (50-60 chars)');
    }

    if (metaDescription && metaDescription.length > 100) seoScore += 15;
    else {
      issues.push('Missing meta description');
      recommendations.push('Add meta description (150-160 chars)');
    }

    if (h1Count === 1) seoScore += 10;
    else if (h1Count > 1) issues.push('Multiple H1 tags found (should be 1)');

    if (hasStructuredData) seoScore += 10;
    else recommendations.push('Add structured data (schema.org)');

    scores.seo = Math.min(seoScore, 100);

    // ===== CONTACTIBILITY CHECK =====
    let contactScore = 30;
    const hasContactForm = $('form').length > 0 || html.includes('contact');
    const hasPhoneLink = html.includes('tel:');
    const hasEmailLink = html.includes('mailto:');
    const hasWhatsapp = html.includes('whatsapp') || html.includes('wa.me');
    const hasMapEmbedded = html.includes('maps.google') || html.includes('embed') && html.includes('map');

    if (hasContactForm) contactScore += 25;
    if (hasPhoneLink) contactScore += 15;
    if (hasEmailLink) contactScore += 15;
    if (hasWhatsapp) contactScore += 20;
    if (hasMapEmbedded) contactScore += 15;

    if (!hasContactForm && !hasPhoneLink && !hasEmailLink) {
      issues.push('No clear contact methods found');
      recommendations.push('Add contact form, phone, email, and WhatsApp button');
    }

    if (!hasWhatsapp) {
      recommendations.push('Add WhatsApp contact button (critical for Argentina market)');
    }

    scores.contactibility = Math.min(contactScore, 100);

    // ===== OVERALL SCORE =====
    const overall = Math.round(
      (scores.mobile + scores.speed + scores.design + scores.seo + scores.contactibility) / 5
    );

    // ===== OPPORTUNITY LEVEL =====
    let opportunity: 'high' | 'medium' | 'low' = 'low';
    if (overall < 50) opportunity = 'high';
    else if (overall < 70) opportunity = 'medium';
    else opportunity = 'low';

    return {
      url,
      businessName,
      scores,
      overall,
      issues,
      recommendations,
      hasMobileMenu,
      hasContactForm,
      hasWhatsapp,
      hasMapEmbedded,
      isResponsive,
      loadTime,
      designAge,
      opportunity,
    };
  } catch (error) {
    throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function scoreToGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

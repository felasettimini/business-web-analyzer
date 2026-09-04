import axios from 'axios';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser } from 'puppeteer';
import * as cheerio from 'cheerio';
import { WebsiteAnalysis } from './types';

// Sin esto, Chromium se identifica como "HeadlessChrome" y con navigator.webdriver=true,
// asi que cualquier WAF/CDN medianamente decente (Cloudflare, nginx, etc.) lo banea con
// un 403 antes de servir la pagina real — y esa pagina de error vacia es lo que se
// terminaba analizando (y puntuando mal) en vez del sitio de verdad.
puppeteer.use(StealthPlugin());

// Browser compartido entre requests (el flujo de analisis procesa negocios uno por uno
// en secuencia — sin esto cada sitio pagaria el costo de arrancar Chromium desde cero).
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Chequea si el sitio bloquea activamente la indexacion en Google: noindex (meta o
 * header) o robots.txt con Disallow: / para todos los bots. Es una señal gratuita y
 * best-effort — detecta bloqueo explicito, NO detecta un sitio indexable que
 * simplemente nunca rankeo por falta de SEO/backlinks (eso requeriria una API de
 * busqueda paga).
 */
async function checkIndexingBlocked(
  origin: string,
  html: string,
  responseHeaders: Record<string, string>
): Promise<boolean> {
  const xRobotsTag = responseHeaders['x-robots-tag'];
  if (xRobotsTag && xRobotsTag.toLowerCase().includes('noindex')) return true;

  const $ = cheerio.load(html);
  const metaRobots = $('meta[name="robots"]').attr('content');
  if (metaRobots && metaRobots.toLowerCase().includes('noindex')) return true;

  try {
    const robotsRes = await axios.get(`${origin}/robots.txt`, { timeout: 5000 });
    const lines = String(robotsRes.data).split('\n').map((l) => l.trim().toLowerCase());
    let inWildcardGroup = false;
    for (const line of lines) {
      if (line.startsWith('user-agent:')) {
        inWildcardGroup = line.includes('*');
      } else if (inWildcardGroup && line.startsWith('disallow:')) {
        const path = line.split(':')[1]?.trim();
        if (path === '/') return true;
      }
    }
  } catch {
    // sin robots.txt o no accesible: no es señal de bloqueo
  }

  return false;
}

export async function analyzeWebsite(url: string, businessName: string): Promise<WebsiteAnalysis> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    const startTime = Date.now();
    await page.setViewport({ width: 375, height: 812 }); // mobile-first, coherente con el negocio

    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    const loadTime = Date.now() - startTime;

    // Si el sitio devuelve un error (403/404/5xx, tipico de un bloqueo anti-bot que la
    // extension stealth no logro esquivar), NO seguir analizando esa pagina de error
    // como si fuera el sitio real — eso es lo que generaba scores bajos falsos.
    const status = response?.status() ?? 0;
    if (status >= 400) {
      throw new Error(`El sitio devolvio un error (HTTP ${status}) al intentar analizarlo — puede estar bloqueando accesos automatizados`);
    }

    const html = await page.content();
    const responseHeaders = response?.headers() || {};
    const $ = cheerio.load(html);
    const origin = new URL(url).origin;

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

    // ===== SPEED CHECK ===== (tiempo hasta networkidle2: carga + render completo, no solo el fetch)
    if (loadTime < 2500) {
      scores.speed = 95;
    } else if (loadTime < 5000) {
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
    const hasMapEmbedded = html.includes('maps.google') || (html.includes('embed') && html.includes('map'));

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

    // ===== INDEXING CHECK =====
    const indexingBlocked = await checkIndexingBlocked(origin, html, responseHeaders as Record<string, string>);
    if (indexingBlocked) {
      issues.unshift('El sitio bloquea la indexación en Google (noindex/robots.txt) — invisible en búsquedas aunque cargue bien');
    }

    // ===== OVERALL SCORE =====
    const overall = Math.round(
      (scores.mobile + scores.speed + scores.design + scores.seo + scores.contactibility) / 5
    );

    // ===== OPPORTUNITY LEVEL =====
    let opportunity: 'high' | 'medium' | 'low';
    if (indexingBlocked) {
      opportunity = 'high'; // invisible en Google = misma oportunidad que no tener web
    } else if (overall < 50) {
      opportunity = 'high';
    } else if (overall < 70) {
      opportunity = 'medium';
    } else {
      opportunity = 'low';
    }

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
      indexingBlocked,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to launch')) {
      throw new Error('No se pudo iniciar el navegador headless. Correlo en local (no funciona en Vercel sin config extra).');
    }
    throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await page.close();
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

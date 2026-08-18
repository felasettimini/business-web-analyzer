import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL es requerida' }, { status: 400 });
    }

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch (launchError) {
      console.error('No se pudo lanzar Chromium:', launchError);
      return NextResponse.json(
        { error: 'No se pudo iniciar el navegador headless. Correlo en local (no funciona en Vercel sin config extra).' },
        { status: 500 }
      );
    }

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(normalizedUrl, { waitUntil: 'networkidle2', timeout: 20000 });

      const dir = path.join(process.cwd(), 'public', 'screenshots');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const hash = crypto.createHash('md5').update(normalizedUrl).digest('hex').slice(0, 12);
      const filename = `${hash}-${Date.now()}.jpg`;
      const filepath = path.join(dir, filename);

      await page.screenshot({ path: filepath as `${string}.jpg`, type: 'jpeg', quality: 70 });
      await browser.close();

      return NextResponse.json({ screenshotUrl: `/screenshots/${filename}` });
    } catch (pageError) {
      await browser.close();
      console.error('Screenshot page error:', pageError);
      return NextResponse.json(
        { error: 'No se pudo capturar el sitio (timeout o sitio inaccesible)' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Screenshot error:', error);
    return NextResponse.json({ error: 'Error generando el screenshot' }, { status: 500 });
  }
}

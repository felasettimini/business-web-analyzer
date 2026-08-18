import { NextRequest, NextResponse } from 'next/server';
import { analyzeWebsite } from '@/lib/websiteAnalyzer';
import { WebsiteAnalysis } from '@/lib/types';
import { isSocialMediaUrl } from '@/lib/socialMedia';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { url, businessName } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (isSocialMediaUrl(url)) {
      return NextResponse.json(
        { error: 'Es un link de red social, no un sitio web propio — no se analiza como website' },
        { status: 400 }
      );
    }

    // Normalize URL
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const analysis: WebsiteAnalysis = await analyzeWebsite(normalizedUrl, businessName || 'Unknown');

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

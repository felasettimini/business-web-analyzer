import { NextRequest, NextResponse } from 'next/server';
import { Business } from '@/lib/types';

export const maxDuration = 60;

interface MapsBusiness {
  name: string;
  website?: string;
  phone?: string;
  address?: string;
  rating?: number;
  reviews?: number;
}

/**
 * NOTE: This is a placeholder for Google Maps API integration.
 * In production, use official Google Places API:
 * https://developers.google.com/maps/documentation/places/web-service/overview
 *
 * For now, this expects pre-scraped data from Google Maps
 * (user manually exports from Google Maps or uses a scraper extension)
 */
export async function POST(request: NextRequest) {
  try {
    const { businesses } = await request.json();

    if (!businesses || !Array.isArray(businesses)) {
      return NextResponse.json(
        { error: 'businesses array is required' },
        { status: 400 }
      );
    }

    // Process businesses
    const processedBusinesses: Business[] = businesses.map((b: MapsBusiness) => ({
      name: b.name,
      website: b.website,
      phone: b.phone,
      address: b.address,
      rating: b.rating,
      reviews: b.reviews,
      hasWebsite: !!b.website && b.website.trim().length > 0,
    }));

    return NextResponse.json({
      success: true,
      count: processedBusinesses.length,
      withWebsite: processedBusinesses.filter(b => b.hasWebsite).length,
      withoutWebsite: processedBusinesses.filter(b => !b.hasWebsite).length,
      businesses: processedBusinesses,
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scraping failed' },
      { status: 500 }
    );
  }
}

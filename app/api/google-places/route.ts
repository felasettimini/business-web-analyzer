import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: {
    location: { lat: number; lng: number };
  };
}

interface PlaceDetails {
  name: string;
  website?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  url?: string; // Google Maps URL
}

/**
 * Google Places API integration
 *
 * Requires GOOGLE_PLACES_API_KEY environment variable.
 *
 * To get an API key:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a project (or select existing)
 * 3. Enable "Places API" and "Places API (New)"
 * 4. Go to Credentials → Create API Key
 * 5. Add it to .env.local as GOOGLE_PLACES_API_KEY=your_key
 *
 * Pricing (as of 2024):
 * - Text Search: $32 per 1000 requests
 * - Place Details: $17 per 1000 requests
 * - BUT: Google gives $200/month free credit → ~6000 free searches/month
 */
export async function POST(request: NextRequest) {
  try {
    const { query, pageToken } = await request.json();

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Google Places API key not configured',
          setup: 'Add GOOGLE_PLACES_API_KEY to .env.local file. See README for instructions.',
        },
        { status: 400 }
      );
    }

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    // Step 1: Text Search to find businesses
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    searchUrl.searchParams.set('query', query);
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('language', 'es');
    if (pageToken) {
      searchUrl.searchParams.set('pagetoken', pageToken);
    }

    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json();

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      return NextResponse.json(
        { error: `Google Places API error: ${searchData.status}`, details: searchData.error_message },
        { status: 500 }
      );
    }

    if (!searchData.results || searchData.results.length === 0) {
      return NextResponse.json({
        success: true,
        businesses: [],
        count: 0,
        nextPageToken: null,
      });
    }

    // Step 2: Get details for each place (website, phone, etc.)
    const businesses = await Promise.all(
      searchData.results.map(async (place: PlaceResult) => {
        try {
          const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
          detailsUrl.searchParams.set('place_id', place.place_id);
          detailsUrl.searchParams.set('fields', 'name,website,formatted_phone_number,international_phone_number,formatted_address,rating,user_ratings_total,url');
          detailsUrl.searchParams.set('key', apiKey);
          detailsUrl.searchParams.set('language', 'es');

          const detailsResponse = await fetch(detailsUrl.toString());
          const detailsData = await detailsResponse.json();

          if (detailsData.status === 'OK' && detailsData.result) {
            const details: PlaceDetails = detailsData.result;
            return {
              name: details.name || place.name,
              website: details.website || undefined,
              phone: details.international_phone_number || details.formatted_phone_number || undefined,
              address: details.formatted_address || place.formatted_address || undefined,
              rating: details.rating || place.rating || undefined,
              reviews: details.user_ratings_total || place.user_ratings_total || undefined,
              mapUrl: details.url || undefined,
              placeId: place.place_id,
              hasWebsite: !!details.website,
            };
          }

          // Fallback to basic search data
          return {
            name: place.name,
            address: place.formatted_address || undefined,
            rating: place.rating || undefined,
            reviews: place.user_ratings_total || undefined,
            placeId: place.place_id,
            hasWebsite: false,
          };
        } catch {
          return {
            name: place.name,
            address: place.formatted_address || undefined,
            rating: place.rating || undefined,
            reviews: place.user_ratings_total || undefined,
            placeId: place.place_id,
            hasWebsite: false,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      businesses,
      count: businesses.length,
      withWebsite: businesses.filter((b: { hasWebsite: boolean }) => b.hasWebsite).length,
      withoutWebsite: businesses.filter((b: { hasWebsite: boolean }) => !b.hasWebsite).length,
      nextPageToken: searchData.next_page_token || null,
    });
  } catch (error) {
    console.error('Google Places error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Google Places search failed' },
      { status: 500 }
    );
  }
}

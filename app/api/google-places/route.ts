import { NextRequest, NextResponse } from 'next/server';
import { isSocialMediaUrl } from '@/lib/socialMedia';

export const maxDuration = 30;

/**
 * Google Places API (New) integration
 * Uses the modern API endpoints that Google recommends.
 *
 * Requires GOOGLE_PLACES_API_KEY environment variable.
 *
 * To get an API key:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a project (or select existing)
 * 3. Enable "Places API (New)"
 * 4. Go to Credentials → Create API Key
 * 5. Add it to .env.local as GOOGLE_PLACES_API_KEY=your_key
 *
 * Pricing: Google gives $200/month free credit → ~6000 free searches/month
 */

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
  languageCode: string;
}

interface PlaceNew {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
}

// Busca el primer componente de direccion que matchee alguno de los tipos pedidos
// (en orden de preferencia), para sacar ciudad/pais de addressComponents.
function extractAddressComponent(
  components: AddressComponent[] | undefined,
  types: string[]
): string | undefined {
  if (!components) return undefined;
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match) return match.longText;
  }
  return undefined;
}

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

    // Use Places API (New) — Text Search
    const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.addressComponents',
          'places.nationalPhoneNumber',
          'places.internationalPhoneNumber',
          'places.websiteUri',
          'places.googleMapsUri',
          'places.rating',
          'places.userRatingCount',
          'nextPageToken', // sin esto, la API (New) NO devuelve el token de paginacion
        ].join(','),
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'es',
        ...(pageToken ? { pageToken } : {}),
      }),
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      const errorMsg = searchData.error?.message || searchData.error?.status || 'Unknown error';
      return NextResponse.json(
        { error: `Google Places API error: ${errorMsg}`, details: searchData.error },
        { status: 500 }
      );
    }

    const places: PlaceNew[] = searchData.places || [];

    if (places.length === 0) {
      return NextResponse.json({
        success: true,
        businesses: [],
        count: 0,
        nextPageToken: null,
      });
    }

    // Map to our Business format
    const businesses = places.map((place) => {
      const rawUrl = place.websiteUri || undefined;
      const isSocial = isSocialMediaUrl(rawUrl);

      return {
        name: place.displayName?.text || 'Unknown',
        website: isSocial ? undefined : rawUrl,      // Only set if it's a real website
        phone: place.internationalPhoneNumber || place.nationalPhoneNumber || undefined,
        address: place.formattedAddress || undefined,
        city: extractAddressComponent(place.addressComponents, ['locality', 'administrative_area_level_2', 'sublocality']),
        country: extractAddressComponent(place.addressComponents, ['country']),
        rating: place.rating || undefined,
        reviews: place.userRatingCount || undefined,
        mapUrl: place.googleMapsUri || undefined,
        placeId: place.id,
        hasWebsite: !!rawUrl && !isSocial,
        socialMedia: isSocial ? rawUrl : undefined,   // Store social URL separately
        onlySocial: isSocial,
      };
    });

    return NextResponse.json({
      success: true,
      businesses,
      count: businesses.length,
      withWebsite: businesses.filter((b) => b.hasWebsite).length,
      withoutWebsite: businesses.filter((b) => !b.hasWebsite).length,
      nextPageToken: searchData.nextPageToken || null,
    });
  } catch (error) {
    console.error('Google Places error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Google Places search failed' },
      { status: 500 }
    );
  }
}

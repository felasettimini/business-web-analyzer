'use client';

import { useState } from 'react';
import { Search, MapPin, Loader, Plus, AlertTriangle, Globe, Phone } from 'lucide-react';
import { Business } from '@/lib/types';
import { isSameBusiness } from '@/lib/dedup';
import { webPresencePriority } from '@/lib/leadScore';

interface Props {
  onBusinessesLoaded: (businesses: Business[]) => void;
  existingBusinesses: Business[];
}

const SUGGESTED_SEARCHES = [
  { query: 'dentistas Rosario', icon: '🦷', category: 'Dentistas' },
  { query: 'peluquerias Rosario', icon: '💇', category: 'Peluquerias' },
  { query: 'abogados Rosario', icon: '⚖️', category: 'Abogados' },
  { query: 'barberias Rosario', icon: '💈', category: 'Barberias' },
  { query: 'academias de ingles Rosario', icon: '📚', category: 'Academias' },
  { query: 'talleres mecanicos Rosario', icon: '🔧', category: 'Talleres mecanicos' },
  { query: 'estetica Rosario', icon: '💅', category: 'Estetica' },
  { query: 'consultorios medicos Rosario', icon: '🏥', category: 'Consultorios medicos' },
  { query: 'veterinarias Rosario', icon: '🐾', category: 'Veterinarias' },
  { query: 'restaurantes Rosario', icon: '🍽️', category: 'Restaurantes' },
  { query: 'inmobiliarias Rosario', icon: '🏠', category: 'Inmobiliarias' },
];

export default function GoogleMapsSearch({ onBusinessesLoaded, existingBusinesses }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Business[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadAllProgress, setLoadAllProgress] = useState(0);

  const searchGoogleMaps = async (searchQuery?: string, pageToken?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const response = await fetch('/api/google-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, pageToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.setup) {
          setApiKeyMissing(true);
          setError(data.error);
        } else {
          setError(data.error || 'Search failed');
        }
        setSearching(false);
        return;
      }

      if (pageToken) {
        setSearchResults(prev => [...prev, ...data.businesses]);
      } else {
        setSearchResults(data.businesses);
      }
      setNextPageToken(data.nextPageToken);
    } catch {
      setError('Error connecting to Google Places API');
    }

    setSearching(false);
  };

  const loadAllResults = async () => {
    if (!nextPageToken) {
      alert('No hay más resultados que cargar');
      return;
    }

    setLoadingAll(true);
    setLoadAllProgress(0);
    let accumulated: Business[] = [...searchResults];
    let currentToken: string | null = nextPageToken;
    let pageCount = 1;

    try {
      while (currentToken) {
        setLoadAllProgress(pageCount);
        const res = await fetch('/api/google-places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, pageToken: currentToken }),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();

        if (!res.ok) {
          setError(data.error || 'Error loading more results');
          break;
        }

        if (data.businesses) {
          accumulated = [...accumulated, ...data.businesses];
        }
        currentToken = data.nextPageToken || null;
        pageCount += 1;

        // Small delay para no abusar de la API
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setSearchResults(accumulated);
      setNextPageToken(null);
      setError(null);
    } catch {
      setError('Error cargando todos los resultados');
    }

    setLoadingAll(false);
  };

  const tagWithCategory = (business: Business): Business =>
    category.trim() ? { ...business, category: category.trim() } : business;

  const addAllToList = () => {
    const newBusinesses = searchResults
      .filter(sr => !existingBusinesses.some(eb => isSameBusiness(eb, sr)))
      .map(tagWithCategory);
    onBusinessesLoaded([...existingBusinesses, ...newBusinesses]);
  };

  const addSingleToList = (business: Business) => {
    if (!existingBusinesses.some(eb => isSameBusiness(eb, business))) {
      onBusinessesLoaded([...existingBusinesses, tagWithCategory(business)]);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Key Warning */}
      {apiKeyMissing && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">Google Places API Key Required</h3>
              <div className="mt-2 space-y-2 text-sm text-amber-800">
                <p>Para buscar en Google Maps automaticamente necesitas una API key:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>
                    Anda a{' '}
                    <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                      Google Cloud Console
                    </a>
                  </li>
                  <li>Crea un proyecto (o usa uno existente)</li>
                  <li>Activa &quot;Places API&quot; en APIs & Services</li>
                  <li>Ve a Credentials → Create API Key</li>
                  <li>
                    Crea un archivo <code className="rounded bg-amber-200 px-1">.env.local</code> en la raiz del proyecto:
                  </li>
                </ol>
                <pre className="mt-2 rounded bg-amber-100 p-2 text-xs">
                  GOOGLE_PLACES_API_KEY=tu_api_key_aqui
                </pre>
                <p className="mt-2">
                  <strong>Costo:</strong> Google da $200/mes gratis → ~6000 busquedas gratis por mes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <MapPin className="h-5 w-5 text-red-500" />
          Buscar en Google Maps
        </h3>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchGoogleMaps()}
              placeholder='ej: "dentistas Rosario" o "peluquerias zona sur Rosario"'
              className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => searchGoogleMaps()}
            disabled={searching || !query.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {searching ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Buscar
          </button>
        </div>

        {/* Categoria: se guarda en cada negocio que agregues, para poder separarlos despues en WhatsApp */}
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Categoria (para separar despues por tipo de cliente, ej: peluquerias, inmobiliarias...)
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="ej: Peluquerias"
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Suggested Searches */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-slate-500">Busquedas sugeridas:</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_SEARCHES.map((s) => (
              <button
                key={s.query}
                onClick={() => {
                  setQuery(s.query);
                  setCategory(s.category);
                  searchGoogleMaps(s.query);
                }}
                disabled={searching}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
              >
                {s.icon} {s.query}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && !apiKeyMissing && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}

      {/* Results */}
      {searchResults.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Resultados ({searchResults.length})
              </h3>
              <div className="flex gap-4 text-sm text-slate-600">
                <span className="text-green-600 font-medium">
                  {searchResults.filter(b => b.hasWebsite).length} con web
                </span>
                <span className="text-purple-600 font-medium">
                  {searchResults.filter(b => b.onlySocial).length} solo redes
                </span>
                <span className="text-orange-600 font-medium">
                  {searchResults.filter(b => !b.hasWebsite && !b.onlySocial).length} sin nada
                </span>
                <span>
                  {searchResults.filter(b => b.phone).length} con telefono
                </span>
              </div>
            </div>
            <button
              onClick={addAllToList}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Agregar todos ({searchResults.length})
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="border-b px-3 py-2 text-left font-semibold">Negocio</th>
                  <th className="border-b px-3 py-2 text-left font-semibold">Web</th>
                  <th className="border-b px-3 py-2 text-left font-semibold">Telefono</th>
                  <th className="border-b px-3 py-2 text-left font-semibold">Rating</th>
                  <th className="border-b px-3 py-2 text-center font-semibold">Agregar</th>
                </tr>
              </thead>
              <tbody>
                {[...searchResults]
                  .sort((a, b) => webPresencePriority(a) - webPresencePriority(b))
                  .map((business, i) => {
                  const alreadyAdded = existingBusinesses.some(eb => isSameBusiness(eb, business));
                  return (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{business.name}</div>
                        {business.address && (
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">{business.address}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {business.hasWebsite ? (
                          <a
                            href={business.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <Globe className="h-3 w-3" />
                            Ver
                          </a>
                        ) : business.onlySocial ? (
                          <a
                            href={business.socialMedia}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700"
                          >
                            Solo redes
                          </a>
                        ) : (
                          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                            Sin web
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {business.phone ? (
                          <span className="flex items-center gap-1 text-xs text-slate-700">
                            <Phone className="h-3 w-3" />
                            {business.phone}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {business.rating ? `${business.rating} (${business.reviews})` : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {alreadyAdded ? (
                          <span className="text-xs text-green-600">Added</span>
                        ) : (
                          <button
                            onClick={() => addSingleToList(business)}
                            className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200"
                          >
                            <Plus className="inline h-3 w-3" /> Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Load More / Load All */}
          {nextPageToken && (
            <div className="mt-4 space-y-2">
              <button
                onClick={loadAllResults}
                disabled={loadingAll || searching}
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loadingAll ? (
                  <>
                    <Loader className="mr-2 inline h-4 w-4 animate-spin" />
                    Cargando TODO (página {loadAllProgress})...
                  </>
                ) : (
                  'Cargar TODO →'
                )}
              </button>
              <button
                onClick={() => searchGoogleMaps(undefined, nextPageToken)}
                disabled={searching || loadingAll}
                className="w-full rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {searching ? (
                  <>
                    <Loader className="mr-2 inline h-4 w-4 animate-spin" />
                    Cargando mas...
                  </>
                ) : (
                  'Cargar más resultados (1 página) →'
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

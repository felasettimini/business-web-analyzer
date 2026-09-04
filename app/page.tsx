'use client';

import { useState, useEffect, useMemo } from 'react';
import { Upload, Search, BarChart3, Download, Loader, MapPin, MessageCircle, X, StickyNote, Camera, Pencil } from 'lucide-react';
import { AnalysisResult, Business, PipelineStatus, WebsiteAnalysis } from '@/lib/types';
import { PIPELINE_STATUSES, getStatusMeta, promptDiscardReason, shouldAutoDiscard } from '@/lib/pipeline';
import { calculateLeadScore, webPresencePriority } from '@/lib/leadScore';
import { isSocialMediaUrl } from '@/lib/socialMedia';
import { fetchAppState, saveAppState } from '@/lib/appState';
import AnalysisCard from '@/components/AnalysisCard';
import GoogleMapsSearch from '@/components/GoogleMapsSearch';
import WhatsAppPanel from '@/components/WhatsAppPanel';

type Tab = 'search' | 'input' | 'results' | 'whatsapp';

const STORAGE_KEYS = {
  businesses: 'bwa_businesses',
  results: 'bwa_results',
  sentMessages: 'bwa_sent',
};

// Normaliza un negocio cargado manualmente (JSON): si el "website" en
// realidad es un link de Facebook/Instagram/etc, lo tratamos como que
// no tiene sitio web propio (prospect de alta oportunidad).
function normalizeBusiness(b: Business): Business {
  const rawUrl = b.website?.trim() || undefined;
  const isSocial = isSocialMediaUrl(rawUrl) || !!b.onlySocial;

  return {
    ...b,
    website: isSocial ? undefined : rawUrl,
    hasWebsite: !!rawUrl && !isSocial,
    socialMedia: isSocial ? (rawUrl || b.socialMedia) : b.socialMedia,
    onlySocial: isSocial,
  };
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [loaded, setLoaded] = useState(false);
  const [capturingAll, setCapturingAll] = useState(false);
  const [captureProgress, setCaptureProgress] = useState({ current: 0, total: 0 });
  const [businessCategoryFilter, setBusinessCategoryFilter] = useState<string>('all');
  const [businessSearchQuery, setBusinessSearchQuery] = useState('');

  // Carga inicial: Supabase es la fuente de verdad (persiste y es accesible desde
  // cualquier dispositivo). Si Supabase todavia esta vacio pero este navegador tiene
  // datos de la version anterior (solo localStorage), los subimos una vez como semilla.
  useEffect(() => {
    (async () => {
      const remote = await fetchAppState();
      const localBusinesses = loadFromStorage<Business[]>(STORAGE_KEYS.businesses, []);
      const localResults = loadFromStorage<AnalysisResult[]>(STORAGE_KEYS.results, []);

      const remoteBusinesses = (remote?.businesses as Business[] | undefined) || [];
      const remoteResults = (remote?.results as AnalysisResult[] | undefined) || [];

      let finalBusinesses = remoteBusinesses;
      let finalResults = remoteResults;

      if (
        remoteBusinesses.length === 0 &&
        remoteResults.length === 0 &&
        (localBusinesses.length > 0 || localResults.length > 0)
      ) {
        finalBusinesses = localBusinesses;
        finalResults = localResults;
        await saveAppState({ businesses: finalBusinesses, results: finalResults });
      }

      if (finalBusinesses.length > 0) setBusinesses(finalBusinesses);
      if (finalResults.length > 0) setResults(finalResults);
      if (finalBusinesses.length > 0 || finalResults.length > 0) {
        setActiveTab(finalResults.length > 0 ? 'results' : 'input');
      }
      setLoaded(true);
    })();
  }, []);

  // Auto-save: Supabase para persistencia real (debounced), localStorage como cache local.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEYS.businesses, JSON.stringify(businesses));
      localStorage.setItem(STORAGE_KEYS.results, JSON.stringify(results));
    } catch {
      // localStorage full or unavailable
    }
    const timeout = setTimeout(() => {
      saveAppState({ businesses, results });
    }, 800);
    return () => clearTimeout(timeout);
  }, [businesses, results, loaded]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (Array.isArray(data)) {
          const processed = data.map((b: Business) => normalizeBusiness(b));
          setBusinesses(processed);
        }
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handlePasteMapsData = () => {
    const json = prompt('Paste your Google Maps data (JSON format):');
    if (!json) return;

    try {
      const data = JSON.parse(json);
      if (Array.isArray(data)) {
        const processed = data.map((b: Business) => normalizeBusiness(b));
        setBusinesses(processed);
        alert(`Loaded ${data.length} businesses`);
      }
    } catch {
      alert('Invalid JSON');
    }
  };

  const analyzeBusinesses = async () => {
    if (businesses.length === 0) {
      alert('Please load businesses first');
      return;
    }

    setAnalyzing(true);
    setActiveTab('results');
    setProgress({ current: 0, total: businesses.length });
    const newResults: AnalysisResult[] = [];

    for (let i = 0; i < businesses.length; i++) {
      const business = businesses[i];
      setProgress({ current: i + 1, total: businesses.length });

      if (!business.website || business.onlySocial) {
        newResults.push({
          business,
          error: business.onlySocial
            ? `Solo tiene redes sociales — Prospect para web NUEVA`
            : 'No tiene web — Prospect para web NUEVA',
        });
        setResults([...newResults]);
        continue;
      }

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: business.website,
            businessName: business.name,
          }),
        });

        const data = await response.json();
        newResults.push({
          business,
          analysis: data.analysis,
          error: data.error,
        });
      } catch {
        newResults.push({
          business,
          error: 'Analysis failed',
        });
      }

      setResults([...newResults]);
    }

    setAnalyzing(false);
  };

  const downloadConversations = () => {
    const data = businesses
      .filter(b => b.conversationLog && b.conversationLog.length > 0)
      .map(b => ({ name: b.name, status: b.status, conversationLog: b.conversationLog }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversaciones-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const downloadResults = () => {
    const csv = [
      ['Business', 'Phone', 'Website', 'Has Website', 'Overall Score', 'Opportunity', 'Mobile', 'Speed', 'Design', 'SEO', 'Contact', 'Issues'].join(','),
      ...results.map(r => [
        `"${r.business.name}"`,
        `"${r.business.phone || ''}"`,
        r.business.website || 'N/A',
        r.business.hasWebsite ? 'Yes' : 'No',
        r.analysis?.overall || 'N/A',
        r.analysis?.opportunity || (r.business.hasWebsite ? 'N/A' : 'HIGH'),
        r.analysis?.scores.mobile || 'N/A',
        r.analysis?.scores.speed || 'N/A',
        r.analysis?.scores.design || 'N/A',
        r.analysis?.scores.seo || 'N/A',
        r.analysis?.scores.contactibility || 'N/A',
        `"${r.analysis?.issues?.join('; ') || r.error || ''}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `business-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const removeBusiness = (name: string) => {
    setBusinesses(prev => prev.filter(b => b.name !== name));
    setResults(prev => prev.filter(r => r.business.name !== name));
  };

  const businessCategories = useMemo(
    () => Array.from(new Set(businesses.map(b => b.category).filter((c): c is string => !!c))).sort(),
    [businesses]
  );

  const filteredBusinessesForTable = useMemo(() => {
    let list = businesses;
    if (businessCategoryFilter === '__none__') list = list.filter(b => !b.category);
    else if (businessCategoryFilter !== 'all') list = list.filter(b => b.category === businessCategoryFilter);

    const query = businessSearchQuery.trim().toLowerCase();
    if (query) list = list.filter(b => b.name.toLowerCase().includes(query));

    return list;
  }, [businesses, businessCategoryFilter, businessSearchQuery]);

  const updateBusiness = (name: string, updates: Partial<Business>) => {
    setBusinesses(prev => prev.map(b => (b.name === name ? { ...b, ...updates } : b)));
    setResults(prev =>
      prev.map(r => (r.business.name === name ? { ...r, business: { ...r.business, ...updates } } : r))
    );
  };

  // Analiza (o re-analiza) un solo negocio puntual, sin correr toda la tanda.
  // Se usa desde el panel de WhatsApp para chequear/actualizar uno especifico.
  const updateAnalysis = (name: string, analysis?: WebsiteAnalysis, error?: string) => {
    setResults(prev => prev.map(r => (r.business.name === name ? { ...r, analysis, error } : r)));
  };

  // Si paso una semana desde el ultimo mensaje mio y el contacto nunca respondio de
  // verdad (ni una palabra, o solo mensajes automaticos), lo paso solo a "descartado".
  // Si en algun momento respondio personalmente no lo toco, aunque pase el tiempo,
  // porque ahi todavia queda chance de insistir mas adelante.
  useEffect(() => {
    if (!loaded) return;
    businesses.forEach((b) => {
      if (b.status === 'descartado' || b.status === 'interesado' || b.status === 'cliente') return;
      if (shouldAutoDiscard(b)) {
        updateBusiness(b.name, { status: 'descartado', discardReason: 'no-contesto', nextFollowUpAt: undefined });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businesses, loaded]);

  const handleStatusChange = (name: string, newStatus: PipelineStatus) => {
    const updates: Partial<Business> = { status: newStatus };
    if (newStatus === 'descartado') {
      updates.discardReason = promptDiscardReason();
      updates.nextFollowUpAt = undefined;
    } else if (newStatus !== 'contactado') {
      updates.nextFollowUpAt = undefined;
    }
    updateBusiness(name, updates);
  };

  const editNotes = (business: Business) => {
    const note = prompt(`Nota para ${business.name}:`, business.notes || '');
    if (note === null) return;
    updateBusiness(business.name, { notes: note });
  };

  const editCategory = (business: Business) => {
    const category = prompt(`Categoria para ${business.name} (ej: peluquerias, inmobiliarias):`, business.category || '');
    if (category === null) return;
    updateBusiness(business.name, { category: category.trim() || undefined });
  };

  // Google Maps a veces no tiene cargado el sitio web del negocio aunque exista
  // (el dueno nunca lo puso en su ficha). Esto deja cargarlo a mano; despues hay
  // que correr "Analizar sitios web" de nuevo para que se analice.
  const editWebsite = (business: Business) => {
    const url = prompt(`Website para ${business.name} (dejar vacio para sacarlo):`, business.website || '');
    if (url === null) return;
    const trimmed = url.trim();
    if (trimmed) {
      updateBusiness(business.name, { website: trimmed, hasWebsite: true, onlySocial: false });
    } else {
      updateBusiness(business.name, { website: undefined, hasWebsite: false });
    }
  };

  const captureAllScreenshots = async () => {
    const pending = results.filter(
      r => r.business.website && !r.business.onlySocial && !r.business.screenshotUrl
    );
    if (pending.length === 0) {
      alert('No hay sitios pendientes de captura (o ya tienen screenshot)');
      return;
    }

    setCapturingAll(true);
    setCaptureProgress({ current: 0, total: pending.length });

    for (let i = 0; i < pending.length; i++) {
      const business = pending[i].business;
      setCaptureProgress({ current: i + 1, total: pending.length });
      try {
        const res = await fetch('/api/screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: business.website }),
        });
        const data = await res.json();
        if (res.ok) {
          updateBusiness(business.name, { screenshotUrl: data.screenshotUrl });
        }
      } catch {
        // seguimos con el siguiente aunque falle uno
      }
    }

    setCapturingAll(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'search',
      label: '1. Buscar',
      icon: <MapPin className="mr-1.5 inline h-4 w-4" />,
    },
    {
      id: 'input',
      label: '2. Mis Negocios',
      icon: <Upload className="mr-1.5 inline h-4 w-4" />,
      badge: businesses.length || undefined,
    },
    {
      id: 'results',
      label: '3. Analisis',
      icon: <BarChart3 className="mr-1.5 inline h-4 w-4" />,
      badge: results.length || undefined,
    },
    {
      id: 'whatsapp',
      label: '4. WhatsApp',
      icon: <MessageCircle className="mr-1.5 inline h-4 w-4" />,
      badge: results.filter(r => r.business.phone).length || undefined,
    },
  ];

  // El tablero de WhatsApp necesita todo el ancho posible para mostrar las 5 columnas
  // sin scroll horizontal — el resto de las tabs se quedan con el ancho de lectura normal.
  const containerMaxWidth = activeTab === 'whatsapp' ? 'max-w-[1800px]' : 'max-w-6xl';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header — la barra de tabs hace de header, no hace falta nada mas arriba */}
      <header className="border-b border-blue-200 bg-white/80 backdrop-blur">
        <div className={`px-4 ${containerMaxWidth}`}>
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative whitespace-nowrap px-4 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge && (
                  <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={`px-4 py-6 ${containerMaxWidth} ${activeTab === 'whatsapp' ? '' : 'mx-auto'}`}>
        {/* ==================== SEARCH TAB ==================== */}
        {activeTab === 'search' && (
          <GoogleMapsSearch
            onBusinessesLoaded={setBusinesses}
            existingBusinesses={businesses}
          />
        )}

        {/* ==================== INPUT TAB ==================== */}
        {activeTab === 'input' && (
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-6 text-center">
              <Upload className="mx-auto h-10 w-10 text-blue-600 mb-3" />
              <h2 className="mb-2 text-lg font-semibold text-slate-900">Cargar datos manualmente</h2>
              <p className="mb-4 text-sm text-slate-600">
                Subi un JSON con datos scraped o pegalos directamente
              </p>
              <div className="flex flex-col gap-3 sm:flex-row justify-center">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
                  <Upload className="h-4 w-4" />
                  Subir JSON
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
                <button
                  onClick={handlePasteMapsData}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-5 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  <Search className="h-4 w-4" />
                  Pegar JSON
                </button>
              </div>
            </div>

            {/* Business List */}
            {businesses.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold">
                  Negocios cargados ({filteredBusinessesForTable.length}{(businessCategoryFilter !== 'all' || businessSearchQuery.trim()) ? ` de ${businesses.length}` : ''})
                </h3>

                <div className="mb-4 relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={businessSearchQuery}
                    onChange={(e) => setBusinessSearchQuery(e.target.value)}
                    placeholder="Buscar negocio por nombre..."
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-9 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  {businessSearchQuery && (
                    <button
                      onClick={() => setBusinessSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      title="Limpiar busqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mb-4 grid grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {businesses.filter(b => b.hasWebsite).length}
                    </div>
                    <div className="text-xs text-green-700">Con web</div>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {businesses.filter(b => b.onlySocial).length}
                    </div>
                    <div className="text-xs text-purple-700">Solo redes</div>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {businesses.filter(b => !b.hasWebsite && !b.onlySocial).length}
                    </div>
                    <div className="text-xs text-orange-700">Sin nada</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {businesses.filter(b => b.phone).length}
                    </div>
                    <div className="text-xs text-blue-700">Con telefono</div>
                  </div>
                </div>

                {/* Filtro por categoria (tipo de negocio) para separar peluquerias, inmobiliarias, etc. */}
                {businessCategories.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <label className="text-sm font-medium text-slate-700 mr-2 self-center">Categoria:</label>
                    <button
                      onClick={() => setBusinessCategoryFilter('all')}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${
                        businessCategoryFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Todas ({businesses.length})
                    </button>
                    {businessCategories.map((c) => (
                      <button
                        key={c}
                        onClick={() => setBusinessCategoryFilter(c)}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          businessCategoryFilter === c ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        {c} ({businesses.filter(b => b.category === c).length})
                      </button>
                    ))}
                    {businesses.some(b => !b.category) && (
                      <button
                        onClick={() => setBusinessCategoryFilter('__none__')}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          businessCategoryFilter === '__none__' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Sin categoria ({businesses.filter(b => !b.category).length})
                      </button>
                    )}
                  </div>
                )}

                <div className="max-h-96 overflow-y-auto rounded border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="border-b px-3 py-2 text-left font-semibold">Negocio</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">Categoria</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">Website</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">Telefono</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">Rating</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">Estado</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">Notas</th>
                        <th className="border-b px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...filteredBusinessesForTable]
                        .sort((a, b) => webPresencePriority(a) - webPresencePriority(b))
                        .map((b, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50 group">
                          <td className="px-3 py-2 font-medium">{b.name}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => editCategory(b)}
                              className={`rounded px-1.5 py-0.5 text-xs ${b.category ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'text-slate-400 hover:bg-slate-100'}`}
                              title="Editar categoria"
                            >
                              {b.category || '+ Categoria'}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            {b.hasWebsite && b.website ? (
                              <span className="inline-flex items-center gap-1">
                                <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                                  {new URL(b.website.startsWith('http') ? b.website : `https://${b.website}`).hostname}
                                </a>
                                <button
                                  onClick={() => editWebsite(b)}
                                  className="text-slate-300 opacity-0 hover:text-slate-600 group-hover:opacity-100"
                                  title="Editar website"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </span>
                            ) : b.onlySocial ? (
                              <span className="inline-flex items-center gap-1">
                                <a href={b.socialMedia} target="_blank" rel="noopener noreferrer" className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                                  Solo redes
                                </a>
                                <button
                                  onClick={() => editWebsite(b)}
                                  className="text-slate-300 opacity-0 hover:text-slate-600 group-hover:opacity-100"
                                  title="Cargar website real"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => editWebsite(b)}
                                className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700 hover:bg-orange-200"
                                title="Cargar website a mano"
                              >
                                Sin web
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{b.phone || '-'}</td>
                          <td className="px-3 py-2 text-xs">{b.rating ? `${b.rating} (${b.reviews || 0})` : '-'}</td>
                          <td className="px-3 py-2">
                            <select
                              value={b.status || 'nuevo'}
                              onChange={(e) => handleStatusChange(b.name, e.target.value as PipelineStatus)}
                              className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${getStatusMeta(b.status).color}`}
                            >
                              {PIPELINE_STATUSES.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => editNotes(b)}
                              className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs ${b.notes ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-100'}`}
                              title={b.notes || 'Agregar nota'}
                            >
                              <StickyNote className="h-3 w-3 flex-shrink-0" />
                              <span className="max-w-[120px] truncate">{b.notes || 'Agregar nota'}</span>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeBusiness(b.name)}
                              className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                              title="Eliminar"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={analyzeBusinesses}
                    disabled={analyzing}
                    className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
                  >
                    {analyzing ? (
                      <>
                        <Loader className="mr-2 inline h-4 w-4 animate-spin" />
                        Analizando {progress.current}/{progress.total}...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="mr-2 inline h-4 w-4" />
                        Analizar {businesses.filter(b => b.hasWebsite).length} sitios web
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Borrar todos los negocios y resultados?')) {
                        setBusinesses([]);
                        setResults([]);
                        localStorage.removeItem(STORAGE_KEYS.businesses);
                        localStorage.removeItem(STORAGE_KEYS.results);
                        localStorage.removeItem(STORAGE_KEYS.sentMessages);
                        saveAppState({ businesses: [], results: [] });
                      }
                    }}
                    className="rounded-lg border border-red-300 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== RESULTS TAB ==================== */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {/* Progress Bar (while analyzing) */}
            {analyzing && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-blue-900">Analizando sitios web...</span>
                  <span className="text-blue-700">{progress.current}/{progress.total}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Progress Bar (while capturing screenshots) */}
            {capturingAll && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-purple-900">Capturando screenshots...</span>
                  <span className="text-purple-700">{captureProgress.current}/{captureProgress.total}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-purple-200">
                  <div
                    className="h-full rounded-full bg-purple-600 transition-all duration-300"
                    style={{ width: `${(captureProgress.current / captureProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="flex flex-wrap justify-between items-center gap-3">
                <h2 className="text-xl font-semibold">
                  Resultados — {results.filter(r => r.analysis?.opportunity === 'high' || !r.business.hasWebsite).length} oportunidades altas
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={captureAllScreenshots}
                    disabled={capturingAll}
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                    title="Genera screenshots de todos los sitios que todavia no tienen (solo funciona corriendo la app en local)"
                  >
                    {capturingAll ? <Loader className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    Capturar screenshots
                  </button>
                  <button
                    onClick={downloadResults}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </button>
                  <button
                    onClick={downloadConversations}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                    title="Exporta todas las conversaciones registradas a un archivo JSON"
                  >
                    <Download className="h-4 w-4" />
                    Exportar conversaciones
                  </button>
                  <button
                    onClick={() => setActiveTab('whatsapp')}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Ir a WhatsApp
                  </button>
                </div>
              </div>
            )}

            {results.length === 0 && !analyzing ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                <BarChart3 className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <p className="text-slate-600">No hay resultados todavia</p>
                <p className="mt-1 text-sm text-slate-500">Ve a &quot;Mis Negocios&quot; y hace click en &quot;Analizar&quot;</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="text-xl font-bold text-red-600">
                      {results.filter(r => !r.business.hasWebsite && !r.business.onlySocial).length}
                    </div>
                    <div className="text-xs text-red-700">Sin web</div>
                  </div>
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                    <div className="text-xl font-bold text-purple-600">
                      {results.filter(r => r.business.onlySocial).length}
                    </div>
                    <div className="text-xs text-purple-700">Solo redes</div>
                  </div>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <div className="text-xl font-bold text-orange-600">
                      {results.filter(r => r.analysis?.opportunity === 'high').length}
                    </div>
                    <div className="text-xs text-orange-700">Web mala</div>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                    <div className="text-xl font-bold text-yellow-600">
                      {results.filter(r => r.analysis?.opportunity === 'medium').length}
                    </div>
                    <div className="text-xs text-yellow-700">Web media</div>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="text-xl font-bold text-green-600">
                      {results.filter(r => r.analysis?.opportunity === 'low').length}
                    </div>
                    <div className="text-xs text-green-700">Web buena</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xl font-bold text-slate-600">
                      {results.filter(r => r.error && r.business.hasWebsite).length}
                    </div>
                    <div className="text-xs text-slate-700">Errores</div>
                  </div>
                </div>

                {/* Pipeline / Funnel summary */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Pipeline de venta</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {PIPELINE_STATUSES.map((s) => (
                      <div key={s.value} className={`rounded-lg border border-slate-200 p-3 ${s.color}`}>
                        <div className="text-xl font-bold">
                          {results.filter(r => (r.business.status || 'nuevo') === s.value).length}
                        </div>
                        <div className="text-xs">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Results — primero sin web, despues solo redes, despues con web; dentro de cada grupo por lead score */}
                {[...results]
                  .sort((a, b) => {
                    const prioA = webPresencePriority(a.business);
                    const prioB = webPresencePriority(b.business);
                    if (prioA !== prioB) return prioA - prioB;
                    const scoreA = calculateLeadScore(a.business, a.analysis);
                    const scoreB = calculateLeadScore(b.business, b.analysis);
                    return scoreB - scoreA;
                  })
                  .map((result, index) => (
                    <AnalysisCard key={index} result={result} onRemove={removeBusiness} onUpdateBusiness={updateBusiness} />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== WHATSAPP TAB ==================== */}
        {/* Se mantiene montado (oculto con CSS) para no resetear el template */}
        {/* seleccionado ni el resto del estado del panel al cambiar de tab. */}
        <div className={activeTab === 'whatsapp' ? '' : 'hidden'}>
          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
              <MessageCircle className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <p className="text-slate-600">Primero analiza negocios para enviar mensajes</p>
              <button
                onClick={() => setActiveTab('input')}
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Ir a Mis Negocios
              </button>
            </div>
          ) : (
            <WhatsAppPanel results={results} onRemove={removeBusiness} onUpdateBusiness={updateBusiness} onAnalysisUpdate={updateAnalysis} />
          )}
        </div>
      </main>
    </div>
  );
}

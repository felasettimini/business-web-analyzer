'use client';

import { useState } from 'react';
import { Upload, Search, BarChart3, Download, Loader, MapPin, MessageCircle } from 'lucide-react';
import { AnalysisResult, Business } from '@/lib/types';
import AnalysisCard from '@/components/AnalysisCard';
import GoogleMapsSearch from '@/components/GoogleMapsSearch';
import WhatsAppPanel from '@/components/WhatsAppPanel';

type Tab = 'search' | 'input' | 'results' | 'whatsapp';

export default function Home() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (Array.isArray(data)) {
          const processed = data.map((b: Business) => ({
            ...b,
            hasWebsite: b.hasWebsite ?? !!b.website,
          }));
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
        const processed = data.map((b: Business) => ({
          ...b,
          hasWebsite: b.hasWebsite ?? !!b.website,
        }));
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

      if (!business.website) {
        newResults.push({
          business,
          error: 'No website found — Prospect for NEW site',
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

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'search',
      label: 'Google Maps',
      icon: <MapPin className="mr-1.5 inline h-4 w-4" />,
    },
    {
      id: 'input',
      label: 'Mis Negocios',
      icon: <Upload className="mr-1.5 inline h-4 w-4" />,
      badge: businesses.length || undefined,
    },
    {
      id: 'results',
      label: 'Analisis',
      icon: <BarChart3 className="mr-1.5 inline h-4 w-4" />,
      badge: results.length || undefined,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle className="mr-1.5 inline h-4 w-4" />,
      badge: results.filter(r => r.business.phone).length || undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-blue-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-blue-900 sm:text-3xl">Business Web Analyzer</h1>
              <p className="text-sm text-slate-600">
                Busca negocios → Analiza sus webs → Contactalos por WhatsApp
              </p>
            </div>
            <div className="hidden sm:block text-right text-xs text-slate-500">
              <div>{businesses.length} negocios cargados</div>
              <div>{results.length} analizados</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
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
                <h3 className="mb-4 text-lg font-semibold">Negocios cargados ({businesses.length})</h3>

                <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {businesses.filter(b => b.hasWebsite).length}
                    </div>
                    <div className="text-xs text-green-700">Con web</div>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {businesses.filter(b => !b.hasWebsite).length}
                    </div>
                    <div className="text-xs text-orange-700">Sin web</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {businesses.filter(b => b.phone).length}
                    </div>
                    <div className="text-xs text-blue-700">Con telefono</div>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto rounded border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="border-b px-3 py-2 text-left font-semibold">Negocio</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">Website</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">Telefono</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businesses.map((b, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">{b.name}</td>
                          <td className="px-3 py-2">
                            {b.website ? (
                              <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                                {new URL(b.website.startsWith('http') ? b.website : `https://${b.website}`).hostname}
                              </a>
                            ) : (
                              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">Sin web</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{b.phone || '-'}</td>
                          <td className="px-3 py-2 text-xs">{b.rating ? `${b.rating} (${b.reviews || 0})` : '-'}</td>
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
                    onClick={() => setBusinesses([])}
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

            {results.length > 0 && (
              <div className="flex flex-wrap justify-between items-center gap-3">
                <h2 className="text-xl font-semibold">
                  Resultados — {results.filter(r => r.analysis?.opportunity === 'high' || !r.business.hasWebsite).length} oportunidades altas
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={downloadResults}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
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
                <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="text-xl font-bold text-red-600">
                      {results.filter(r => !r.business.hasWebsite).length}
                    </div>
                    <div className="text-xs text-red-700">Sin web (contactar!)</div>
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

                {/* Results — No website first, then by opportunity */}
                {results
                  .sort((a, b) => {
                    // No website first
                    if (!a.business.hasWebsite && b.business.hasWebsite) return -1;
                    if (a.business.hasWebsite && !b.business.hasWebsite) return 1;
                    // Then by score (low = better opportunity)
                    const scoreA = a.analysis?.overall ?? 999;
                    const scoreB = b.analysis?.overall ?? 999;
                    return scoreA - scoreB;
                  })
                  .map((result, index) => (
                    <AnalysisCard key={index} result={result} />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== WHATSAPP TAB ==================== */}
        {activeTab === 'whatsapp' && (
          <div>
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
              <WhatsAppPanel results={results} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

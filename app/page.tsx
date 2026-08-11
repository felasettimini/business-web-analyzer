'use client';

import { useState } from 'react';
import { Upload, Search, BarChart3, Download, Loader } from 'lucide-react';
import { AnalysisResult, Business } from '@/lib/types';
import ResultsTable from '@/components/ResultsTable';
import AnalysisCard from '@/components/AnalysisCard';

export default function Home() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'input' | 'results'>('input');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (Array.isArray(data)) {
          setBusinesses(data);
          setActiveTab('input');
        }
      } catch (error) {
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
        setBusinesses(data);
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
    const newResults: AnalysisResult[] = [];

    for (const business of businesses) {
      if (!business.website) {
        newResults.push({
          business,
          error: 'No website found',
        });
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
      } catch (error) {
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
      ['Business', 'Website', 'Overall Score', 'Opportunity', 'Mobile', 'Speed', 'Design', 'SEO', 'Contact'].join(','),
      ...results.map(r => [
        `"${r.business.name}"`,
        r.business.website || 'N/A',
        r.analysis?.overall || 'Error',
        r.analysis?.opportunity || 'N/A',
        r.analysis?.scores.mobile || 'N/A',
        r.analysis?.scores.speed || 'N/A',
        r.analysis?.scores.design || 'N/A',
        r.analysis?.scores.seo || 'N/A',
        r.analysis?.scores.contactibility || 'N/A',
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `business-analysis-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-blue-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-blue-900">Business Web Analyzer</h1>
              <p className="text-sm text-slate-600">Find businesses with poor websites → Turn them into clients</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('input')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'input'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="mr-2 inline h-4 w-4" />
            Upload Data
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'results'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="mr-2 inline h-4 w-4" />
            Results ({results.length})
          </button>
        </div>

        {/* Input Tab */}
        {activeTab === 'input' && (
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Load Google Maps Data</h2>
              <p className="mb-6 text-sm text-slate-600">
                Export data from Google Maps using a scraper tool and upload it here as JSON
              </p>
              <div className="flex flex-col gap-3 sm:flex-row justify-center">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">
                  <Upload className="h-4 w-4" />
                  Upload JSON File
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={handlePasteMapsData}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-6 py-3 font-medium text-blue-600 hover:bg-blue-50"
                >
                  <Search className="h-4 w-4" />
                  Paste JSON
                </button>
              </div>
            </div>

            {/* Business List Preview */}
            {businesses.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold">Loaded Businesses ({businesses.length})</h3>
                <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
                  <div className="rounded-lg bg-green-50 p-3">
                    <div className="text-2xl font-bold text-green-600">
                      {businesses.filter(b => b.hasWebsite).length}
                    </div>
                    <div className="text-xs text-green-700">With Website</div>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3">
                    <div className="text-2xl font-bold text-orange-600">
                      {businesses.filter(b => !b.hasWebsite).length}
                    </div>
                    <div className="text-xs text-orange-700">Without Website</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <div className="text-2xl font-bold text-blue-600">
                      {businesses.length}
                    </div>
                    <div className="text-xs text-blue-700">Total</div>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto rounded border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="border-b px-4 py-2 text-left font-semibold">Business</th>
                        <th className="border-b px-4 py-2 text-left font-semibold">Website</th>
                        <th className="border-b px-4 py-2 text-left font-semibold">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businesses.slice(0, 10).map((b, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-2">{b.name}</td>
                          <td className="px-4 py-2">
                            {b.website ? (
                              <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {b.website}
                              </a>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>
                          <td className="px-4 py-2">{b.rating ? `${b.rating}⭐` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={analyzeBusinesses}
                  disabled={analyzing}
                  className="mt-4 w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader className="mr-2 inline h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="mr-2 inline h-4 w-4" />
                      Start Analysis
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {results.length > 0 && (
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  Analysis Results ({results.filter(r => r.analysis?.opportunity === 'high').length} High Opportunity)
                </h2>
                <button
                  onClick={downloadResults}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            )}

            {results.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                <BarChart3 className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <p className="text-slate-600">No analysis results yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Results Summary */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="text-2xl font-bold text-red-600">
                      {results.filter(r => r.analysis?.opportunity === 'high').length}
                    </div>
                    <div className="text-xs text-red-700">High Opportunity</div>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                    <div className="text-2xl font-bold text-yellow-600">
                      {results.filter(r => r.analysis?.opportunity === 'medium').length}
                    </div>
                    <div className="text-xs text-yellow-700">Medium Opportunity</div>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {results.filter(r => r.analysis?.opportunity === 'low').length}
                    </div>
                    <div className="text-xs text-green-700">Low Opportunity</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-2xl font-bold text-slate-600">
                      {results.filter(r => r.error).length}
                    </div>
                    <div className="text-xs text-slate-700">Errors</div>
                  </div>
                </div>

                {/* Individual Results */}
                {results.map((result, index) => (
                  <AnalysisCard key={index} result={result} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

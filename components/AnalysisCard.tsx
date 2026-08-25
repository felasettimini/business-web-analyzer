'use client';

import { useState } from 'react';
import { AnalysisResult, Business, PipelineStatus } from '@/lib/types';
import { PIPELINE_STATUSES, getStatusMeta, getDiscardReasonLabel, promptDiscardReason } from '@/lib/pipeline';
import { calculateLeadScore, leadScoreLabel } from '@/lib/leadScore';
import { AlertCircle, CheckCircle, TrendingUp, X, StickyNote, Flame, Camera, Loader } from 'lucide-react';

interface Props {
  result: AnalysisResult;
  onRemove?: (name: string) => void;
  onUpdateBusiness?: (name: string, updates: Partial<Business>) => void;
}

const scoreToColor = (score: number): string => {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 60) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
};

const opportunityColor = (opp: 'high' | 'medium' | 'low'): string => {
  if (opp === 'high') return 'border-red-300 bg-red-50';
  if (opp === 'medium') return 'border-yellow-300 bg-yellow-50';
  return 'border-green-300 bg-green-50';
};

export default function AnalysisCard({ result, onRemove, onUpdateBusiness }: Props) {
  const { business, analysis, error } = result;
  const leadScore = calculateLeadScore(business, analysis);
  const leadMeta = leadScoreLabel(leadScore);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const captureScreenshot = async () => {
    if (!business.website || !onUpdateBusiness) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const res = await fetch('/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: business.website }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCaptureError(data.error || 'No se pudo capturar');
      } else {
        onUpdateBusiness(business.name, { screenshotUrl: data.screenshotUrl });
      }
    } catch {
      setCaptureError('Error de conexion capturando la pantalla');
    }
    setCapturing(false);
  };

  const screenshotBlock = onUpdateBusiness && business.website && !business.onlySocial && (
    <div className="mt-3">
      {business.screenshotUrl ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={business.screenshotUrl}
            alt={`Captura de ${business.name}`}
            className="h-24 w-40 rounded border border-slate-200 object-cover object-top"
          />
          <button
            onClick={captureScreenshot}
            disabled={capturing}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {capturing ? <Loader className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            Recapturar
          </button>
        </div>
      ) : (
        <button
          onClick={captureScreenshot}
          disabled={capturing}
          className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {capturing ? <Loader className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          {capturing ? 'Capturando...' : 'Capturar screenshot de la web'}
        </button>
      )}
      {captureError && <p className="mt-1 text-xs text-red-600">{captureError}</p>}
    </div>
  );

  const leadScoreBadge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${leadMeta.color}`}
      title="Score compuesto: calidad del negocio (rating + reviews) + necesidad de web nueva"
    >
      <Flame className="h-3 w-3" />
      {leadScore} · {leadMeta.label}
    </span>
  );

  const editNotes = () => {
    if (!onUpdateBusiness) return;
    const note = prompt(`Nota para ${business.name}:`, business.notes || '');
    if (note === null) return;
    onUpdateBusiness(business.name, { notes: note });
  };

  const handleStatusChange = (newStatus: PipelineStatus) => {
    if (!onUpdateBusiness) return;
    const updates: Partial<Business> = { status: newStatus };
    if (newStatus === 'descartado') {
      updates.discardReason = promptDiscardReason();
      updates.nextFollowUpAt = undefined;
    } else if (newStatus !== 'contactado') {
      updates.nextFollowUpAt = undefined;
    }
    onUpdateBusiness(business.name, updates);
  };

  const statusControls = onUpdateBusiness && (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={business.status || 'nuevo'}
        onChange={(e) => handleStatusChange(e.target.value as PipelineStatus)}
        className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${getStatusMeta(business.status).color}`}
      >
        {PIPELINE_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      {business.status === 'descartado' && business.discardReason && (
        <span className="text-xs text-slate-500">({getDiscardReasonLabel(business.discardReason)})</span>
      )}
      <button
        onClick={editNotes}
        className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${business.notes ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-100'}`}
        title={business.notes || 'Agregar nota'}
      >
        <StickyNote className="h-3 w-3 flex-shrink-0" />
        <span className="max-w-[200px] truncate">{business.notes || 'Agregar nota'}</span>
      </button>
    </div>
  );

  if (error) {
    const isSocialOnly = business.onlySocial;
    const borderColor = isSocialOnly ? 'border-purple-200 bg-purple-50' : 'border-red-200 bg-red-50';
    const iconColor = isSocialOnly ? 'text-purple-600' : 'text-red-600';
    const textColor = isSocialOnly ? 'text-purple-900' : 'text-red-900';
    const subColor = isSocialOnly ? 'text-purple-700' : 'text-red-700';

    return (
      <div className={`rounded-lg border ${borderColor} p-4 group`}>
        <div className="flex items-start gap-3">
          <AlertCircle className={`h-5 w-5 ${iconColor} flex-shrink-0 mt-0.5`} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`font-semibold ${textColor}`}>{business.name}</h3>
              {isSocialOnly && (
                <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs font-medium text-purple-800">Solo redes</span>
              )}
              {!business.hasWebsite && !isSocialOnly && (
                <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-medium text-red-800">Sin web</span>
              )}
              {leadScoreBadge}
            </div>
            <p className={`text-sm ${subColor}`}>{error}</p>
            {business.socialMedia && (
              <a href={business.socialMedia} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline">
                {business.socialMedia}
              </a>
            )}
            {business.phone && (
              <p className="mt-1 text-xs text-slate-600">Tel: {business.phone}</p>
            )}
            {statusControls}
            {screenshotBlock}
          </div>
          {onRemove && (
            <button
              onClick={() => onRemove(business.name)}
              className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-100 hover:text-red-500 group-hover:opacity-100 flex-shrink-0"
              title="Eliminar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className={`rounded-lg border-2 ${opportunityColor(analysis.opportunity)} p-6 group`}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">{business.name}</h3>
            {leadScoreBadge}
          </div>
          {business.website && (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              {business.website}
            </a>
          )}
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <div className={`text-3xl font-bold ${scoreToColor(analysis.overall)}`}>
              {analysis.overall}
            </div>
          <div className="text-xs font-semibold text-slate-600">Overall Score</div>
          <div className="mt-1 inline-block rounded px-2 py-1 text-xs font-bold uppercase">
            <span
              className={
                analysis.opportunity === 'high'
                  ? 'text-red-600'
                  : analysis.opportunity === 'medium'
                    ? 'text-yellow-600'
                    : 'text-green-600'
              }
            >
              {analysis.opportunity} opportunity
            </span>
          </div>
          </div>
          {onRemove && (
            <button
              onClick={() => onRemove(business.name)}
              className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-100 hover:text-red-500 group-hover:opacity-100 flex-shrink-0"
              title="Eliminar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {statusControls}
      {screenshotBlock}

      {/* Scores Grid */}
      <div className="mb-4 grid grid-cols-5 gap-2 md:gap-3">
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-lg font-bold text-slate-900">{analysis.scores.mobile}</div>
          <div className="text-xs text-slate-600">Mobile</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-lg font-bold text-slate-900">{analysis.scores.speed}</div>
          <div className="text-xs text-slate-600">Speed</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-lg font-bold text-slate-900">{analysis.scores.design}</div>
          <div className="text-xs text-slate-600">Design</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-lg font-bold text-slate-900">{analysis.scores.seo}</div>
          <div className="text-xs text-slate-600">SEO</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-lg font-bold text-slate-900">{analysis.scores.contactibility}</div>
          <div className="text-xs text-slate-600">Contact</div>
        </div>
      </div>

      {/* Details */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left Column */}
        <div>
          <h4 className="mb-2 font-semibold text-slate-900">Site Info</h4>
          <div className="space-y-1 text-sm text-slate-700">
            <div>
              <span className="text-slate-600">Design Age:</span>{' '}
              <span className="font-medium capitalize">{analysis.designAge.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="text-slate-600">Load Time:</span>{' '}
              <span className="font-medium">{analysis.loadTime}ms</span>
            </div>
            <div>
              <span className="text-slate-600">Responsive:</span>{' '}
              {analysis.isResponsive ? (
                <CheckCircle className="ml-1 inline h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="ml-1 inline h-4 w-4 text-red-600" />
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {analysis.hasContactForm && (
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                  ✓ Contact Form
                </span>
              )}
              {analysis.hasWhatsapp && (
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                  ✓ WhatsApp
                </span>
              )}
              {analysis.hasMobileMenu && (
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                  ✓ Mobile Menu
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          <h4 className="mb-2 font-semibold text-slate-900">Issues Found</h4>
          <div className="space-y-1 text-sm">
            {analysis.issues.length > 0 ? (
              analysis.issues.map((issue, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-red-600">•</span>
                  <span className="text-slate-700">{issue}</span>
                </div>
              ))
            ) : (
              <div className="text-green-700">✓ No major issues found</div>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="mt-4 rounded-lg bg-white/60 p-3">
          <h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Top Recommendations
          </h4>
          <ul className="space-y-1 text-sm text-slate-700">
            {analysis.recommendations.slice(0, 3).map((rec, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-600 font-bold">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

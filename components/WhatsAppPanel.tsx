'use client';

import { useState, useMemo, useEffect } from 'react';
import { MessageCircle, Send, Copy, ExternalLink, ChevronDown, ChevronUp, Edit3, Check, Phone, X, PhoneOff } from 'lucide-react';
import { AnalysisResult, WhatsAppTemplate } from '@/lib/types';
import { defaultTemplates, fillTemplate, generateWhatsAppLink } from '@/lib/whatsappTemplates';

const SENT_STORAGE_KEY = 'bwa_sent';
const NO_WA_STORAGE_KEY = 'bwa_no_whatsapp';

interface Props {
  results: AnalysisResult[];
  onRemove?: (name: string) => void;
}

export default function WhatsAppPanel({ results, onRemove }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate>(defaultTemplates[0]);
  const [customMessage, setCustomMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);
  const [sentMessages, setSentMessages] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem(SENT_STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [noWhatsApp, setNoWhatsApp] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem(NO_WA_STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [filter, setFilter] = useState<'all' | 'with-phone' | 'high-opportunity'>('with-phone');
  const [rubro, setRubro] = useState('');

  // Persist sent messages and no-whatsapp
  useEffect(() => {
    try {
      localStorage.setItem(SENT_STORAGE_KEY, JSON.stringify([...sentMessages]));
      localStorage.setItem(NO_WA_STORAGE_KEY, JSON.stringify([...noWhatsApp]));
    } catch { /* ignore */ }
  }, [sentMessages, noWhatsApp]);

  // Filter businesses that have phone numbers
  const filteredBusinesses = useMemo(() => {
    let filtered = results;

    if (filter === 'with-phone') {
      filtered = filtered.filter(r => r.business.phone);
    } else if (filter === 'high-opportunity') {
      filtered = filtered.filter(r => r.business.phone && (r.analysis?.opportunity === 'high' || !r.business.hasWebsite || r.business.onlySocial));
    }

    return filtered;
  }, [results, filter]);

  const getMessageForBusiness = (result: AnalysisResult): string => {
    const template = isEditing ? customMessage : selectedTemplate.message;

    const problemaPrincipal = result.business.onlySocial
      ? 'solo tiene redes sociales pero no una pagina web propia'
      : !result.business.hasWebsite
      ? 'no tiene pagina web'
      : result.analysis?.opportunity === 'high'
        ? 'la pagina web podria mejorar mucho'
        : result.analysis?.issues?.[0] || 'la pagina web podria mejorar';

    return fillTemplate(template, {
      nombre_negocio: result.business.name,
      problema_principal: problemaPrincipal,
      rubro: rubro || 'tu rubro',
      score: String(result.analysis?.overall || 'N/A'),
    });
  };

  const getWhatsAppLink = (result: AnalysisResult): string | null => {
    if (!result.business.phone) return null;
    const message = getMessageForBusiness(result);
    return generateWhatsAppLink(result.business.phone, message);
  };

  const toggleSent = (name: string) => {
    setSentMessages(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleNoWhatsApp = (name: string) => {
    setNoWhatsApp(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        // Si lo marco como "no tiene WA", saco el estado de enviado
        setSentMessages(p => { const n = new Set(p); n.delete(name); return n; });
      }
      return next;
    });
  };

  const copyMessage = (result: AnalysisResult) => {
    const message = getMessageForBusiness(result);
    navigator.clipboard.writeText(message);
  };

  const openAllWhatsApp = async () => {
    const businessesWithPhone = filteredBusinesses.filter(r => r.business.phone);
    const batchSize = 5;

    for (let i = 0; i < businessesWithPhone.length; i += batchSize) {
      const batch = businessesWithPhone.slice(i, i + batchSize);

      for (const result of batch) {
        const link = getWhatsAppLink(result);
        if (link) {
          window.open(link, '_blank');
        }
      }

      // Wait between batches to avoid browser blocking
      if (i + batchSize < businessesWithPhone.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  };

  const businessesWithPhone = filteredBusinesses.filter(r => r.business.phone).length;
  const alreadySent = filteredBusinesses.filter(r => sentMessages.has(r.business.name)).length;
  const noWaCount = filteredBusinesses.filter(r => noWhatsApp.has(r.business.name)).length;
  const pendingCount = businessesWithPhone - alreadySent - noWaCount;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{businessesWithPhone}</div>
              <div className="text-xs text-green-700">Con telefono</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-600">{alreadySent}</div>
              <div className="text-xs text-blue-700">Enviados</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <PhoneOff className="h-5 w-5 text-red-500" />
            <div>
              <div className="text-2xl font-bold text-red-500">{noWaCount}</div>
              <div className="text-xs text-red-600">Sin WhatsApp</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-slate-600" />
            <div>
              <div className="text-2xl font-bold text-slate-600">{pendingCount}</div>
              <div className="text-xs text-slate-700">Pendientes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Template Selector + Rubro Input */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Configurar mensaje</h3>

        {/* Rubro input */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Rubro (para personalizar el mensaje)
          </label>
          <input
            type="text"
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
            placeholder="ej: dentistas, peluquerias, abogados..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Template selector */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Plantilla de mensaje</label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {defaultTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template);
                  setIsEditing(false);
                }}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  selectedTemplate.id === template.id && !isEditing
                    ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="font-medium text-slate-900">{template.name}</div>
                <div className="mt-1 text-xs text-slate-500 line-clamp-2">{template.message.slice(0, 80)}...</div>
              </button>
            ))}
            <button
              onClick={() => {
                setIsEditing(true);
                setCustomMessage(selectedTemplate.message);
              }}
              className={`rounded-lg border p-3 text-left text-sm transition-all ${
                isEditing
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1 font-medium text-slate-900">
                <Edit3 className="h-3 w-3" />
                Mensaje personalizado
              </div>
              <div className="mt-1 text-xs text-slate-500">Edita el template a tu gusto</div>
            </button>
          </div>
        </div>

        {/* Message preview / editor */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {isEditing ? 'Editar mensaje' : 'Vista previa del mensaje'}
          </label>
          {isEditing ? (
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Usa {nombre_negocio}, {problema_principal}, {rubro} como variables..."
            />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-700">
              {selectedTemplate.message}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Variables: {'{nombre_negocio}'}, {'{problema_principal}'}, {'{rubro}'}, {'{score}'}
          </p>
        </div>

        {/* Filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="text-sm font-medium text-slate-700 mr-2 self-center">Filtrar:</label>
          {[
            { value: 'with-phone' as const, label: 'Con telefono' },
            { value: 'high-opportunity' as const, label: 'Alta oportunidad' },
            { value: 'all' as const, label: 'Todos' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                filter === f.value
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Bulk send button */}
        <button
          onClick={openAllWhatsApp}
          disabled={businessesWithPhone === 0}
          className="w-full rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 font-semibold text-white hover:from-green-600 hover:to-green-700 disabled:opacity-50"
        >
          <MessageCircle className="mr-2 inline h-5 w-5" />
          Abrir WhatsApp para {businessesWithPhone} negocios
          <span className="ml-1 text-sm opacity-80">(abre de a 5)</span>
        </button>
      </div>

      {/* Business List */}
      <div className="space-y-3">
        {filteredBusinesses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <MessageCircle className="mx-auto mb-3 h-10 w-10 text-slate-400" />
            <p className="text-slate-600">No hay negocios que coincidan con el filtro</p>
            <p className="mt-1 text-sm text-slate-500">Cambia el filtro o analiza mas negocios</p>
          </div>
        ) : (
          filteredBusinesses.map((result, index) => {
            const link = getWhatsAppLink(result);
            const isSent = sentMessages.has(result.business.name);
            const isNoWa = noWhatsApp.has(result.business.name);
            const isExpanded = expandedBusiness === result.business.name;

            return (
              <div
                key={index}
                className={`rounded-lg border p-4 transition-all ${
                  isNoWa
                    ? 'border-red-200 bg-red-50/30 opacity-60'
                    : isSent
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {/* Business Info Row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900 truncate">{result.business.name}</h4>
                      {isNoWa && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
                          <PhoneOff className="h-3 w-3" /> No tiene WA
                        </span>
                      )}
                      {isSent && !isNoWa && (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          <Check className="h-3 w-3" /> Enviado
                        </span>
                      )}
                      {(result.analysis?.opportunity === 'high' || !result.business.hasWebsite || result.business.onlySocial) && !isSent && !isNoWa && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                          HIGH
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      {result.business.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {result.business.phone}
                        </span>
                      )}
                      {result.analysis && (
                        <span>Score: {result.analysis.overall}/100</span>
                      )}
                      {result.business.onlySocial && (
                        <span className="text-purple-600 font-medium">Solo redes</span>
                      )}
                      {!result.business.hasWebsite && !result.business.onlySocial && (
                        <span className="text-orange-600 font-medium">Sin web</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Expand/Collapse */}
                    <button
                      onClick={() => setExpandedBusiness(isExpanded ? null : result.business.name)}
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                      title="Ver mensaje"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {/* Copy */}
                    <button
                      onClick={() => copyMessage(result)}
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                      title="Copiar mensaje"
                    >
                      <Copy className="h-4 w-4" />
                    </button>

                    {/* Mark sent / unsent */}
                    <button
                      onClick={() => toggleSent(result.business.name)}
                      className={`rounded-lg border p-2 text-sm transition-colors ${
                        isSent
                          ? 'border-green-300 bg-green-100 text-green-700 hover:bg-green-200'
                          : 'border-slate-200 text-slate-400 hover:bg-green-50 hover:text-green-600'
                      }`}
                      title={isSent ? 'Desmarcar como enviado' : 'Marcar como enviado'}
                    >
                      <Check className="h-4 w-4" />
                    </button>

                    {/* Mark no WhatsApp */}
                    <button
                      onClick={() => toggleNoWhatsApp(result.business.name)}
                      className={`rounded-lg border p-2 text-sm transition-colors ${
                        isNoWa
                          ? 'border-red-300 bg-red-100 text-red-600 hover:bg-red-200'
                          : 'border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500'
                      }`}
                      title={isNoWa ? 'Desmarcar "no tiene WA"' : 'Marcar como "no tiene WA"'}
                    >
                      <PhoneOff className="h-4 w-4" />
                    </button>

                    {/* Send WhatsApp */}
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600"
                      >
                        <ExternalLink className="h-4 w-4" />
                        WhatsApp
                      </a>
                    ) : (
                      <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-400">
                        Sin telefono
                      </span>
                    )}

                    {/* Remove */}
                    {onRemove && (
                      <button
                        onClick={() => onRemove(result.business.name)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Eliminar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Message Preview */}
                {isExpanded && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-medium text-slate-500">Mensaje que se enviara:</div>
                    <div className="whitespace-pre-wrap text-sm text-slate-700">
                      {getMessageForBusiness(result)}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

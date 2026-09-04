'use client';

import { useState, useMemo, useEffect } from 'react';
import { MessageCircle, Send, Copy, ExternalLink, ChevronDown, ChevronUp, Edit3, Check, CheckCheck, Phone, X, PhoneOff, MessageSquareText, Trash2, Bot, RefreshCw, Loader } from 'lucide-react';
import { AnalysisResult, WhatsAppTemplate, Business, PipelineStatus, ConversationEntry, WebsiteAnalysis } from '@/lib/types';
import { defaultTemplates, fillTemplate, generateWhatsAppLink } from '@/lib/whatsappTemplates';
import {
  PIPELINE_STATUSES,
  getStatusMeta,
  getDiscardReasonLabel,
  promptDiscardReason,
  suggestNextFollowUp,
  isFollowUpDue,
} from '@/lib/pipeline';
import { calculateLeadScore, leadScoreLabel } from '@/lib/leadScore';
import { getBusinessLocation } from '@/lib/address';
import { fetchAppState, saveAppState } from '@/lib/appState';

const SENT_STORAGE_KEY = 'bwa_sent';
const NO_WA_STORAGE_KEY = 'bwa_no_whatsapp';

interface Props {
  results: AnalysisResult[];
  onRemove?: (name: string) => void;
  onUpdateBusiness?: (name: string, updates: Partial<Business>) => void;
  onAnalysisUpdate?: (name: string, analysis?: WebsiteAnalysis, error?: string) => void;
}

export default function WhatsAppPanel({ results, onRemove, onUpdateBusiness, onAnalysisUpdate }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate>(defaultTemplates[0]);
  const [customMessage, setCustomMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);
  const [conversationOpenFor, setConversationOpenFor] = useState<string | null>(null);
  const [conversationDraft, setConversationDraft] = useState('');
  const [conversationSender, setConversationSender] = useState<'me' | 'contact'>('contact');
  const [reactionPickerFor, setReactionPickerFor] = useState<number | null>(null);
  const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
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
  const [waLoaded, setWaLoaded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'with-phone' | 'high-opportunity' | 'follow-up-due' | 'no-website' | 'only-social' | 'with-website'>('with-phone');
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rubro, setRubro] = useState('');

  // Categorias presentes entre los negocios cargados (peluquerias, inmobiliarias, etc.)
  const categories = useMemo(
    () => Array.from(new Set(results.map(r => r.business.category).filter((c): c is string => !!c))).sort(),
    [results]
  );

  // Ubicacion (ciudad/pais) de cada negocio: usa los campos estructurados si vinieron
  // de Google Places, y si no, los infiere de `address` como fallback (ver lib/address.ts).
  const locationsByBusiness = useMemo(
    () => new Map(results.map(r => [r.business.name, getBusinessLocation(r.business)])),
    [results]
  );

  // Paises presentes entre los negocios cargados
  const countries = useMemo(
    () => Array.from(new Set(results.map(r => locationsByBusiness.get(r.business.name)?.country).filter((c): c is string => !!c))).sort(),
    [results, locationsByBusiness]
  );

  // Ciudades presentes, acotadas al pais seleccionado (si hay uno elegido) para que la lista no sea eterna
  const cities = useMemo(
    () => Array.from(new Set(
      results
        .filter(r => countryFilter === 'all' || locationsByBusiness.get(r.business.name)?.country === countryFilter)
        .map(r => locationsByBusiness.get(r.business.name)?.city)
        .filter((c): c is string => !!c)
    )).sort(),
    [results, locationsByBusiness, countryFilter]
  );

  // Si cambia el pais y la ciudad elegida ya no pertenece a ese pais, reseteamos el filtro de ciudad
  useEffect(() => {
    if (cityFilter !== 'all' && !cities.includes(cityFilter)) {
      setCityFilter('all');
    }
  }, [cities, cityFilter]);

  // Carga inicial desde Supabase; si esta vacio pero este navegador tiene datos
  // viejos en localStorage, los sube una vez como semilla (misma logica que page.tsx).
  useEffect(() => {
    (async () => {
      const remote = await fetchAppState();
      const remoteSent = remote?.sent_messages || [];
      const remoteNoWa = remote?.no_whatsapp || [];
      if (remoteSent.length > 0 || remoteNoWa.length > 0) {
        setSentMessages(new Set(remoteSent));
        setNoWhatsApp(new Set(remoteNoWa));
      } else if (sentMessages.size > 0 || noWhatsApp.size > 0) {
        await saveAppState({ sent_messages: [...sentMessages], no_whatsapp: [...noWhatsApp] });
      }
      setWaLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist sent messages and no-whatsapp: Supabase (debounced) + localStorage como cache
  useEffect(() => {
    try {
      localStorage.setItem(SENT_STORAGE_KEY, JSON.stringify([...sentMessages]));
      localStorage.setItem(NO_WA_STORAGE_KEY, JSON.stringify([...noWhatsApp]));
    } catch { /* ignore */ }
    if (!waLoaded) return;
    const timeout = setTimeout(() => {
      saveAppState({ sent_messages: [...sentMessages], no_whatsapp: [...noWhatsApp] });
    }, 800);
    return () => clearTimeout(timeout);
  }, [sentMessages, noWhatsApp, waLoaded]);

  // Cualquier negocio marcado como enviado que todavia figure como "nuevo" pasa a "contactado".
  // Cubre tanto los que se marcan de ahora en mas como los que ya estaban marcados de antes.
  useEffect(() => {
    if (!onUpdateBusiness) return;
    results.forEach((r) => {
      if (sentMessages.has(r.business.name) && (!r.business.status || r.business.status === 'nuevo')) {
        onUpdateBusiness(r.business.name, { status: 'contactado' });
      }
    });
  }, [results, sentMessages, onUpdateBusiness]);

  // Filter businesses that have phone numbers
  const filteredBusinesses = useMemo(() => {
    let filtered = results;

    if (filter === 'with-phone') {
      filtered = filtered.filter(r => r.business.phone);
    } else if (filter === 'high-opportunity') {
      filtered = filtered.filter(r => r.business.phone && calculateLeadScore(r.business, r.analysis) >= 55);
    } else if (filter === 'follow-up-due') {
      filtered = filtered.filter(r => r.business.phone && isFollowUpDue(r.business.nextFollowUpAt));
    } else if (filter === 'no-website') {
      // Directamente sin web propia — ni siquiera redes sociales como presencia online.
      filtered = filtered.filter(r => r.business.phone && !r.business.hasWebsite && !r.business.onlySocial);
    } else if (filter === 'only-social') {
      filtered = filtered.filter(r => r.business.phone && r.business.onlySocial);
    } else if (filter === 'with-website') {
      filtered = filtered.filter(r => r.business.phone && r.business.hasWebsite && !r.business.onlySocial);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => (r.business.status || 'nuevo') === statusFilter);
    } else {
      // Por default no mostramos los descartados como candidatos para escribir:
      // siguen guardados (no se borran) para no volver a agregarlos sin querer
      // si se vuelve a scrapear la zona, pero no aparecen para contactar salvo
      // que se elija explicitamente el filtro "Descartado".
      filtered = filtered.filter(r => (r.business.status || 'nuevo') !== 'descartado');
    }

    if (categoryFilter === '__none__') {
      filtered = filtered.filter(r => !r.business.category);
    } else if (categoryFilter !== 'all') {
      filtered = filtered.filter(r => r.business.category === categoryFilter);
    }

    if (countryFilter === '__none__') {
      filtered = filtered.filter(r => !locationsByBusiness.get(r.business.name)?.country);
    } else if (countryFilter !== 'all') {
      filtered = filtered.filter(r => locationsByBusiness.get(r.business.name)?.country === countryFilter);
    }

    if (cityFilter === '__none__') {
      filtered = filtered.filter(r => !locationsByBusiness.get(r.business.name)?.city);
    } else if (cityFilter !== 'all') {
      filtered = filtered.filter(r => locationsByBusiness.get(r.business.name)?.city === cityFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const qDigits = q.replace(/\D/g, '');
      filtered = filtered.filter(r =>
        r.business.name.toLowerCase().includes(q) ||
        (qDigits && r.business.phone?.replace(/\D/g, '').includes(qDigits))
      );
    }

    // Orden: primero pendientes, despues ya enviados, y al final del todo los que no tienen WhatsApp.
    // Dentro de cada grupo, orden alfabetico para poder ubicar un contacto facil.
    return [...filtered].sort((a, b) => {
      const groupA = noWhatsApp.has(a.business.name) ? 2 : sentMessages.has(a.business.name) ? 1 : 0;
      const groupB = noWhatsApp.has(b.business.name) ? 2 : sentMessages.has(b.business.name) ? 1 : 0;
      if (groupA !== groupB) return groupA - groupB;
      return a.business.name.localeCompare(b.business.name, 'es', { sensitivity: 'base' });
    });
  }, [results, filter, statusFilter, categoryFilter, countryFilter, cityFilter, locationsByBusiness, searchQuery, sentMessages, noWhatsApp]);

  // Asigna una categoria a todos los negocios que esten pasando el filtro actual y no tengan una todavia.
  // Pensado para etiquetar de una sola vez un lote entero (ej: las 53 peluquerias ya cargadas).
  const bulkAssignCategory = () => {
    if (!onUpdateBusiness) return;
    const uncategorized = filteredBusinesses.filter(r => !r.business.category);
    if (uncategorized.length === 0) {
      alert('No hay negocios sin categoria en el filtro actual');
      return;
    }
    const category = window.prompt(
      `Asignar categoria a ${uncategorized.length} negocio(s) sin categoria (ej: Peluquerias, Inmobiliarias):`
    );
    if (!category || !category.trim()) return;
    uncategorized.forEach(r => onUpdateBusiness(r.business.name, { category: category.trim() }));
  };

  // Analiza (o re-analiza) un negocio puntual desde este panel, sin tener que ir a la
  // tab de resultados y correr toda la tanda de nuevo — util para chequear uno solo
  // que cambio, o que nunca se llego a analizar.
  const [analyzingNames, setAnalyzingNames] = useState<Set<string>>(new Set());

  const analyzeBusiness = async (business: Business) => {
    if (!business.website || business.onlySocial || !onAnalysisUpdate) return;
    setAnalyzingNames(prev => new Set(prev).add(business.name));
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: business.website, businessName: business.name }),
      });
      const data = await res.json();
      onAnalysisUpdate(business.name, data.analysis, data.error);
    } catch {
      onAnalysisUpdate(business.name, undefined, 'Error de conexion analizando el sitio');
    } finally {
      setAnalyzingNames(prev => {
        const next = new Set(prev);
        next.delete(business.name);
        return next;
      });
    }
  };

  const buildMessage = (result: AnalysisResult, templateMessage: string): string => {
    const problemaPrincipal = result.business.onlySocial
      ? 'solo tiene redes sociales pero no una pagina web propia'
      : !result.business.hasWebsite
      ? 'no tiene pagina web'
      : result.analysis?.opportunity === 'high'
        ? 'la pagina web podria mejorar mucho'
        : result.analysis?.issues?.[0] || 'la pagina web podria mejorar';

    return fillTemplate(templateMessage, {
      nombre_negocio: result.business.name,
      problema_principal: problemaPrincipal,
      rubro: rubro || 'tu rubro',
      score: String(result.analysis?.overall || 'N/A'),
      rating: result.business.rating ? String(result.business.rating) : 'muy buen',
      reviews: result.business.reviews ? String(result.business.reviews) : 'varias',
    });
  };

  const getMessageForBusiness = (result: AnalysisResult): string =>
    buildMessage(result, isEditing ? customMessage : selectedTemplate.message);

  // Reconstruye el mensaje inicial ya enviado (segun la plantilla guardada), para
  // usarlo como primer mensaje del chat cuando no quedo registrado en su momento.
  const initialMessageFor = (result: AnalysisResult): string | null => {
    const id = result.business.lastTemplateId;
    if (!id || id === 'custom') return null;
    const template = defaultTemplates.find(t => t.id === id);
    return template ? buildMessage(result, template.message) : null;
  };

  const getWhatsAppLink = (result: AnalysisResult): string | null => {
    if (!result.business.phone) return null;
    const message = getMessageForBusiness(result);
    return generateWhatsAppLink(result.business.phone, message);
  };

  const toggleSent = (result: AnalysisResult) => {
    const name = result.business.name;
    setSentMessages(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        if (onUpdateBusiness) {
          // Guardo que plantilla se uso (para despues comparar cual convierte mejor)
          // y sugiero el 2do toque en 3 dias, para no dejar la conversacion morir sola.
          const updates: Partial<Business> = {
            lastTemplateId: isEditing ? 'custom' : selectedTemplate.id,
            nextFollowUpAt: suggestNextFollowUp(),
          };
          if (!result.business.status || result.business.status === 'nuevo') {
            updates.status = 'contactado';
          }
          // Arranco el chat con el mensaje que se manda ahora, si todavia no hay nada registrado
          if (!result.business.conversationLog || result.business.conversationLog.length === 0) {
            updates.conversationLog = [{ date: new Date().toISOString(), sender: 'me', text: getMessageForBusiness(result) }];
          }
          onUpdateBusiness(name, updates);
        }
      }
      return next;
    });
  };

  const handleStatusChange = (name: string, newStatus: PipelineStatus) => {
    if (!onUpdateBusiness) return;
    const updates: Partial<Business> = { status: newStatus };
    if (newStatus === 'descartado') {
      updates.discardReason = promptDiscardReason();
      updates.nextFollowUpAt = undefined;
    } else if (newStatus !== 'contactado') {
      // interesado / cliente / nuevo: ya no hace falta recordatorio de seguimiento
      updates.nextFollowUpAt = undefined;
    }
    onUpdateBusiness(name, updates);
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

  const addConversationEntry = (business: Business) => {
    if (!onUpdateBusiness || !conversationDraft.trim()) return;
    const entry: ConversationEntry = { date: new Date().toISOString(), sender: conversationSender, text: conversationDraft.trim() };
    onUpdateBusiness(business.name, { conversationLog: [...(business.conversationLog || []), entry] });
    setConversationDraft('');
  };

  const deleteConversationEntry = (business: Business, index: number) => {
    if (!onUpdateBusiness) return;
    const next = (business.conversationLog || []).filter((_, i) => i !== index);
    onUpdateBusiness(business.name, { conversationLog: next });
  };

  const setReaction = (business: Business, index: number, emoji: string) => {
    if (!onUpdateBusiness) return;
    const log = business.conversationLog || [];
    const next = log.map((entry, i) =>
      i === index ? { ...entry, reaction: entry.reaction === emoji ? undefined : emoji } : entry
    );
    onUpdateBusiness(business.name, { conversationLog: next });
    setReactionPickerFor(null);
  };

  const toggleSeen = (business: Business, index: number) => {
    if (!onUpdateBusiness) return;
    const log = business.conversationLog || [];
    const next = log.map((entry, i) => (i === index ? { ...entry, seen: !entry.seen } : entry));
    onUpdateBusiness(business.name, { conversationLog: next });
  };

  // Muchos negocios contestan con un mensaje automatico (bot de WhatsApp Business, etc.).
  // Marcandolo, se excluye de "respondieron" / tiempo de respuesta para no ensuciar las metricas.
  const toggleAutoReply = (business: Business, index: number) => {
    if (!onUpdateBusiness) return;
    const log = business.conversationLog || [];
    const next = log.map((entry, i) => (i === index ? { ...entry, isAutoReply: !entry.isAutoReply } : entry));
    onUpdateBusiness(business.name, { conversationLog: next });
  };

  // Abre el chat de un negocio. Si todavia no hay nada registrado pero ya se le mando
  // el mensaje inicial (esta marcado como enviado), lo reconstruye como primer mensaje.
  const openConversation = (result: AnalysisResult) => {
    const name = result.business.name;
    if (conversationOpenFor === name) {
      setConversationOpenFor(null);
      return;
    }
    setConversationOpenFor(name);
    setConversationDraft('');
    setReactionPickerFor(null);
    const hasLog = (result.business.conversationLog?.length ?? 0) > 0;
    if (!hasLog && sentMessages.has(name) && onUpdateBusiness) {
      const initial = initialMessageFor(result);
      if (initial) {
        onUpdateBusiness(name, {
          conversationLog: [{ date: new Date().toISOString(), sender: 'me', text: initial }],
        });
      }
    }
  };

  const businessesWithPhone = filteredBusinesses.filter(r => r.business.phone).length;
  const alreadySent = filteredBusinesses.filter(r => sentMessages.has(r.business.name)).length;
  const noWaCount = filteredBusinesses.filter(r => noWhatsApp.has(r.business.name)).length;
  const pendingCount = businessesWithPhone - alreadySent - noWaCount;
  const followUpDueCount = results.filter(r => r.business.phone && isFollowUpDue(r.business.nextFollowUpAt)).length;
  const noWebsiteCount = results.filter(r => r.business.phone && !r.business.hasWebsite && !r.business.onlySocial).length;
  const onlySocialCount = results.filter(r => r.business.phone && r.business.onlySocial).length;
  const withWebsiteCount = results.filter(r => r.business.phone && r.business.hasWebsite && !r.business.onlySocial).length;

  // Conversaciones pegadas a mano (de antes de que existiera este registro) no tienen
  // lastTemplateId guardado. Para no perderlas del analisis, se detecta la plantilla
  // buscando una frase fija (sin variables) de cada una dentro del primer mensaje "mio".
  const normalizeText = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

  const TEMPLATE_SIGNATURES: [string, string][] = [
    ['intro-casual', 'busca negocios en google antes de ir'],
    ['intro-directo', 'creando sitios web profesionales que captan clientes desde google'],
    ['sin-web', 'no tiene pagina web todavia'],
    ['web-vieja', 'podria tener un upgrade importante'],
    ['followup', 'te escribi hace unos dias sobre'],
    ['followup-final', 'no te molesto mas por este medio'],
    ['preview-A', 'arme una vista previa rapida de como podria quedar tu web'],
    ['preview-B', 'no tiene web propia. hoy la mayoria de tus clientes potenciales googlean'],
  ];

  const detectTemplateId = (text: string): string | null => {
    const norm = normalizeText(text);
    const match = TEMPLATE_SIGNATURES.find(([, signature]) => norm.includes(normalizeText(signature)));
    return match ? match[0] : null;
  };

  // Conversion por plantilla: de los que se les mando un mensaje con X plantilla,
  // cuantos terminaron interesados/clientes vs descartados. Ademas, saca metricas de
  // la conversacion registrada (respondio o no, cuanto tardo en responder) para que el
  // tablero se vaya alimentando solo a medida que se registran las conversaciones.
  const templateStats = useMemo(() => {
    const stats: Record<string, {
      sent: number;
      interested: number;
      discarded: number;
      responded: number;
      responseHours: number[];
      positiveReactions: number;
      negativeReactions: number;
    }> = {};
    const NEGATIVE_EMOJIS = new Set(['😢', '👎']);
    results.forEach((r) => {
      const log = r.business.conversationLog || [];
      const firstMe = log.find(e => e.sender === 'me');
      // Ignoro las respuestas automaticas (bot de WhatsApp Business, etc.) para que no
      // cuenten como si el contacto hubiese respondido de verdad.
      const firstContact = log.find(e => e.sender === 'contact' && !e.isAutoReply);

      // Si no hay plantilla guardada (o es "custom"), trato de detectarla en el primer
      // mensaje registrado. Si no matchea ninguna, cae en "custom" igual (mensaje a medida).
      const savedId = r.business.lastTemplateId;
      const detectedId = firstMe ? detectTemplateId(firstMe.text) : null;
      const id = savedId && savedId !== 'custom' ? savedId : detectedId || savedId || (firstMe ? 'custom' : null);

      // Cuenta como "enviado" si esta marcado como tal en el panel, o si ya tiene un
      // primer mensaje mio registrado en la conversacion (conversaciones pegadas a mano).
      const hasSentEvidence = sentMessages.has(r.business.name) || !!firstMe;
      if (!id || !hasSentEvidence) return;

      if (!stats[id]) {
        stats[id] = { sent: 0, interested: 0, discarded: 0, responded: 0, responseHours: [], positiveReactions: 0, negativeReactions: 0 };
      }
      stats[id].sent += 1;
      if (r.business.status === 'interesado' || r.business.status === 'cliente') stats[id].interested += 1;
      if (r.business.status === 'descartado') stats[id].discarded += 1;

      if (firstContact) {
        stats[id].responded += 1;
        if (firstMe) {
          const hours = (new Date(firstContact.date).getTime() - new Date(firstMe.date).getTime()) / 36e5;
          if (hours >= 0) stats[id].responseHours.push(hours);
        }
      }
      log.forEach((entry) => {
        if (!entry.reaction) return;
        if (NEGATIVE_EMOJIS.has(entry.reaction)) stats[id].negativeReactions += 1;
        else stats[id].positiveReactions += 1;
      });
    });
    return stats;
  }, [results, sentMessages]);

  const templateName = (id: string) =>
    id === 'custom' ? 'Mensaje personalizado' : defaultTemplates.find(t => t.id === id)?.name || id;

  const formatResponseTime = (hours: number[]): string => {
    if (hours.length === 0) return '—';
    const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
    return avg < 24 ? `${avg.toFixed(1)} h` : `${(avg / 24).toFixed(1)} d`;
  };

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

      {/* Conversion por plantilla — que mensaje esta funcionando mejor. Las columnas de */}
      {/* respuesta/reacciones se calculan solas a partir de las conversaciones registradas. */}
      {Object.keys(templateStats).length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Conversion por plantilla</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">Plantilla</th>
                  <th className="pb-2 pr-4">Enviados</th>
                  <th className="pb-2 pr-4">Respondieron</th>
                  <th className="pb-2 pr-4">Tiempo 1ra respuesta</th>
                  <th className="pb-2 pr-4">Reacciones</th>
                  <th className="pb-2 pr-4">Interesados/Clientes</th>
                  <th className="pb-2">Descartados</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(templateStats).map(([id, s]) => {
                  const responseRate = s.sent > 0 ? Math.round((s.responded / s.sent) * 100) : 0;
                  return (
                    <tr key={id} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{templateName(id)}</td>
                      <td className="py-2 pr-4">{s.sent}</td>
                      <td className="py-2 pr-4">
                        {s.responded} <span className="text-xs text-slate-400">({responseRate}%)</span>
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{formatResponseTime(s.responseHours)}</td>
                      <td className="py-2 pr-4 text-xs">
                        {s.positiveReactions > 0 && <span className="text-green-700">👍 {s.positiveReactions}</span>}
                        {s.positiveReactions > 0 && s.negativeReactions > 0 && ' · '}
                        {s.negativeReactions > 0 && <span className="text-red-600">👎 {s.negativeReactions}</span>}
                        {s.positiveReactions === 0 && s.negativeReactions === 0 && <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 pr-4 text-green-700">{s.interested}</td>
                      <td className="py-2 text-red-600">{s.discarded}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            Variables: {'{nombre_negocio}'}, {'{problema_principal}'}, {'{rubro}'}, {'{score}'}, {'{rating}'}, {'{reviews}'}
          </p>
        </div>

        {/* Filter */}
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="text-sm font-medium text-slate-700 mr-2 self-center">Filtrar:</label>
          {[
            { value: 'with-phone' as const, label: 'Con telefono' },
            { value: 'no-website' as const, label: `Sin web (${noWebsiteCount})` },
            { value: 'only-social' as const, label: `Solo redes (${onlySocialCount})` },
            { value: 'with-website' as const, label: `Con web (${withWebsiteCount})` },
            { value: 'high-opportunity' as const, label: 'Alta oportunidad' },
            { value: 'follow-up-due' as const, label: `Seguimiento vencido (${followUpDueCount})` },
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

        {/* Status Filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="text-sm font-medium text-slate-700 mr-2 self-center">Estado:</label>
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              statusFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          {PIPELINE_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                statusFilter === s.value ? 'ring-1 ring-slate-400 ' + s.color : s.color + ' opacity-60 hover:opacity-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Category Filter — separa los contactos por tipo de negocio (peluquerias, inmobiliarias, etc.) */}
        {(categories.length > 0 || results.some(r => !r.business.category)) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-700 mr-2 self-center">Categoria:</label>
            <button
              onClick={() => setCategoryFilter('all')}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                categoryFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  categoryFilter === c ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {c} ({results.filter(r => r.business.category === c).length})
              </button>
            ))}
            {results.some(r => !r.business.category) && (
              <button
                onClick={() => setCategoryFilter('__none__')}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  categoryFilter === '__none__' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Sin categoria ({results.filter(r => !r.business.category).length})
              </button>
            )}
            {onUpdateBusiness && (
              <button
                onClick={bulkAssignCategory}
                className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-700"
                title="Asigna una categoria a todos los negocios del filtro actual que no tengan una"
              >
                + Asignar categoria a los filtrados
              </button>
            )}
          </div>
        )}

        {/* Country Filter — util para separar leads de distintos paises (ej: Argentina vs España) */}
        {(countries.length > 0 || results.some(r => !locationsByBusiness.get(r.business.name)?.country)) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-700 mr-2 self-center">Pais:</label>
            <button
              onClick={() => setCountryFilter('all')}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                countryFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todos
            </button>
            {countries.map((c) => (
              <button
                key={c}
                onClick={() => setCountryFilter(c)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  countryFilter === c ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                {c} ({results.filter(r => locationsByBusiness.get(r.business.name)?.country === c).length})
              </button>
            ))}
            {results.some(r => !locationsByBusiness.get(r.business.name)?.country) && (
              <button
                onClick={() => setCountryFilter('__none__')}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  countryFilter === '__none__' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Sin pais ({results.filter(r => !locationsByBusiness.get(r.business.name)?.country).length})
              </button>
            )}
          </div>
        )}

        {/* City Filter — se acota automaticamente a las ciudades del pais elegido arriba */}
        {(cities.length > 0 || results.some(r => !locationsByBusiness.get(r.business.name)?.city)) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-700 mr-2 self-center">Ciudad:</label>
            <button
              onClick={() => setCityFilter('all')}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                cityFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            {cities.map((c) => (
              <button
                key={c}
                onClick={() => setCityFilter(c)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  cityFilter === c ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                }`}
              >
                {c} ({results.filter(r => locationsByBusiness.get(r.business.name)?.city === c).length})
              </button>
            ))}
            {results.some(r => !locationsByBusiness.get(r.business.name)?.city) && (
              <button
                onClick={() => setCityFilter('__none__')}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  cityFilter === '__none__' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Sin ciudad ({results.filter(r => !locationsByBusiness.get(r.business.name)?.city).length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Business List */}
      <div className="mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre o telefono..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
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
            const followUpDue = isFollowUpDue(result.business.nextFollowUpAt);

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
                      {result.business.category && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {result.business.category}
                        </span>
                      )}
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
                      {followUpDue && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Seguimiento vencido
                        </span>
                      )}
                      {!isSent && !isNoWa && (() => {
                        const score = calculateLeadScore(result.business, result.analysis);
                        const meta = leadScoreLabel(score);
                        return (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.color}`} title="Lead score">
                            {score} · {meta.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="mt-1">
                      {onUpdateBusiness ? (
                        <select
                          value={result.business.status || 'nuevo'}
                          onChange={(e) => handleStatusChange(result.business.name, e.target.value as PipelineStatus)}
                          className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${getStatusMeta(result.business.status).color}`}
                        >
                          {PIPELINE_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusMeta(result.business.status).color}`}>
                          {getStatusMeta(result.business.status).label}
                        </span>
                      )}
                      {result.business.status === 'descartado' && result.business.discardReason && (
                        <span className="ml-2 text-xs text-slate-500">
                          ({getDiscardReasonLabel(result.business.discardReason)})
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
                        <span>Web: {result.analysis.overall}/100</span>
                      )}
                      {(result.business.website || result.business.socialMedia) && (
                        <a
                          href={result.business.website || result.business.socialMedia}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                          title={result.business.website || result.business.socialMedia}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {result.business.website ? 'Ver web' : 'Ver redes'}
                        </a>
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

                    {/* Analizar / re-analizar este negocio puntual */}
                    {onAnalysisUpdate && result.business.website && !result.business.onlySocial && (
                      <button
                        onClick={() => analyzeBusiness(result.business)}
                        disabled={analyzingNames.has(result.business.name)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        title={result.analysis ? 'Re-analizar sitio' : 'Analizar sitio'}
                      >
                        {analyzingNames.has(result.business.name) ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                    )}

                    {/* Mark sent / unsent */}
                    <button
                      onClick={() => toggleSent(result)}
                      className={`rounded-lg border p-2 text-sm transition-colors ${
                        isSent
                          ? 'border-green-300 bg-green-100 text-green-700 hover:bg-green-200'
                          : 'border-slate-200 text-slate-400 hover:bg-green-50 hover:text-green-600'
                      }`}
                      title={isSent ? 'Desmarcar como enviado' : 'Marcar como enviado'}
                    >
                      <Check className="h-4 w-4" />
                    </button>

                    {/* Conversacion registrada */}
                    {onUpdateBusiness && (
                      <button
                        onClick={() => openConversation(result)}
                        className={`relative rounded-lg border p-2 text-sm transition-colors ${
                          conversationOpenFor === result.business.name
                            ? 'border-blue-300 bg-blue-100 text-blue-700'
                            : 'border-slate-200 text-slate-400 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                        title="Ver / registrar conversacion"
                      >
                        <MessageSquareText className="h-4 w-4" />
                        {(result.business.conversationLog?.length ?? 0) > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                            {result.business.conversationLog!.length}
                          </span>
                        )}
                      </button>
                    )}

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

                {/* Conversacion registrada — vista tipo chat de WhatsApp, para despues analizar que funciona */}
                {conversationOpenFor === result.business.name && onUpdateBusiness && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-[#e5ddd5]/40 p-3">
                    <div className="mb-2 text-xs font-medium text-slate-500">Conversacion de WhatsApp:</div>
                    {result.business.conversationLog && result.business.conversationLog.length > 0 ? (
                      <ul className="mb-3 space-y-2">
                        {result.business.conversationLog.map((entry, i) => {
                          const isMe = entry.sender === 'me';
                          return (
                            <li key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`group relative max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                                isMe ? 'bg-green-100 text-slate-800' : entry.isAutoReply ? 'border border-dashed border-slate-300 bg-slate-100 text-slate-600' : 'border border-slate-200 bg-white text-slate-800'
                              }`}>
                                {!isMe && entry.isAutoReply && (
                                  <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                    <Bot className="h-3 w-3" /> Mensaje automatico
                                  </div>
                                )}
                                <div className="whitespace-pre-wrap">{entry.text}</div>
                                <div className="mt-1 flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                    {new Date(entry.date).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    {isMe && (
                                      <button
                                        onClick={() => toggleSeen(result.business, i)}
                                        title={entry.seen ? 'Marcar como no visto' : 'Marcar como visto'}
                                        className={entry.seen ? 'text-sky-500' : 'text-slate-400 hover:text-slate-600'}
                                      >
                                        {entry.seen ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                                      </button>
                                    )}
                                  </span>
                                  <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    {!isMe && (
                                      <button
                                        onClick={() => toggleAutoReply(result.business, i)}
                                        title={entry.isAutoReply ? 'Desmarcar como automatico' : 'Marcar como mensaje automatico'}
                                        className={entry.isAutoReply ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'}
                                      >
                                        <Bot className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setReactionPickerFor(reactionPickerFor === i ? null : i)}
                                      className="text-slate-400 hover:text-slate-600"
                                      title="Reaccionar"
                                    >
                                      🙂
                                    </button>
                                    <button
                                      onClick={() => deleteConversationEntry(result.business, i)}
                                      className="text-slate-400 hover:text-red-500"
                                      title="Eliminar mensaje"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </span>
                                </div>

                                {entry.reaction && (
                                  <span className={`absolute -bottom-2 rounded-full border border-slate-200 bg-white px-1 text-xs shadow ${isMe ? 'left-1' : 'right-1'}`}>
                                    {entry.reaction}
                                  </span>
                                )}

                                {reactionPickerFor === i && (
                                  <div className={`absolute top-full z-10 mt-1 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg ${isMe ? 'right-0' : 'left-0'}`}>
                                    {REACTION_EMOJIS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={() => setReaction(result.business, i, emoji)}
                                        className="text-sm hover:scale-125 transition-transform"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mb-3 text-sm text-slate-500">Todavia no hay nada registrado.</p>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex overflow-hidden rounded-lg border border-slate-300">
                        <button
                          onClick={() => setConversationSender('contact')}
                          className={`px-2 py-1.5 text-xs font-medium ${
                            conversationSender === 'contact' ? 'bg-slate-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          Cliente
                        </button>
                        <button
                          onClick={() => setConversationSender('me')}
                          className={`px-2 py-1.5 text-xs font-medium ${
                            conversationSender === 'me' ? 'bg-green-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          Yo
                        </button>
                      </div>
                      <input
                        type="text"
                        value={conversationDraft}
                        onChange={(e) => setConversationDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addConversationEntry(result.business);
                        }}
                        placeholder="Escribi el mensaje..."
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => addConversationEntry(result.business)}
                        disabled={!conversationDraft.trim()}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Agregar
                      </button>
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

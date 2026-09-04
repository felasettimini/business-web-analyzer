'use client';

import { useState, useMemo, useEffect } from 'react';
import { MessageCircle, Copy, ExternalLink, ChevronDown, ChevronUp, Edit3, Check, CheckCheck, Phone, X, PhoneOff, MessageSquareText, Trash2, Bot, RefreshCw, Loader, MoreHorizontal } from 'lucide-react';
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<PipelineStatus | null>(null);

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

  // Filtros que aplican tanto en la vista de lista como en el tablero: presencia web,
  // categoria, ubicacion y busqueda. El estado (pipeline) se aplica aparte — en la lista
  // como un filtro mas, en el tablero como las columnas mismas (no tiene sentido filtrarlo ahi).
  const baseFilteredBusinesses = useMemo(() => {
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

    return filtered;
  }, [results, filter, categoryFilter, countryFilter, cityFilter, locationsByBusiness, searchQuery]);

  const filteredBusinesses = useMemo(() => {
    let filtered = baseFilteredBusinesses;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => (r.business.status || 'nuevo') === statusFilter);
    } else {
      // Por default no mostramos los descartados como candidatos para escribir:
      // siguen guardados (no se borran) para no volver a agregarlos sin querer
      // si se vuelve a scrapear la zona, pero no aparecen para contactar salvo
      // que se elija explicitamente el filtro "Descartado".
      filtered = filtered.filter(r => (r.business.status || 'nuevo') !== 'descartado');
    }

    // Orden: primero pendientes, despues ya enviados, y al final del todo los que no tienen WhatsApp.
    // Dentro de cada grupo: con el filtro "Alta oportunidad" activo, de mayor a menor lead score
    // (para atacar primero los mejores); en el resto de los filtros, alfabetico para ubicar facil.
    return [...filtered].sort((a, b) => {
      const groupA = noWhatsApp.has(a.business.name) ? 2 : sentMessages.has(a.business.name) ? 1 : 0;
      const groupB = noWhatsApp.has(b.business.name) ? 2 : sentMessages.has(b.business.name) ? 1 : 0;
      if (groupA !== groupB) return groupA - groupB;
      if (filter === 'high-opportunity') {
        const scoreA = calculateLeadScore(a.business, a.analysis);
        const scoreB = calculateLeadScore(b.business, b.analysis);
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      return a.business.name.localeCompare(b.business.name, 'es', { sensitivity: 'base' });
    });
  }, [baseFilteredBusinesses, statusFilter, filter, sentMessages, noWhatsApp]);

  // Tablero tipo Trello: mismos filtros de arriba, pero agrupado por estado en vez de
  // filtrado por estado — ahi es donde tiene sentido ver los descartados tambien (es
  // una columna mas, no algo que se esconde).
  const boardColumns = useMemo(() => {
    const columns = new Map<PipelineStatus, AnalysisResult[]>(PIPELINE_STATUSES.map(s => [s.value, []]));
    for (const r of baseFilteredBusinesses) {
      const status = r.business.status || 'nuevo';
      columns.get(status)?.push(r);
    }
    for (const list of columns.values()) {
      list.sort((a, b) => calculateLeadScore(b.business, b.analysis) - calculateLeadScore(a.business, a.analysis));
    }
    return columns;
  }, [baseFilteredBusinesses]);

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

  const presenceFilters: { value: typeof filter; label: string }[] = [
    { value: 'with-phone', label: 'Con telefono' },
    { value: 'no-website', label: `Sin web (${noWebsiteCount})` },
    { value: 'only-social', label: `Solo redes (${onlySocialCount})` },
    { value: 'with-website', label: `Con web (${withWebsiteCount})` },
    { value: 'high-opportunity', label: 'Alta oportunidad' },
    { value: 'follow-up-due', label: `Seguimiento vencido (${followUpDueCount})` },
    { value: 'all', label: 'Todos' },
  ];

  const selectClass = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ==================== SIDEBAR: filtros + configurar mensaje ==================== */}
      <aside className="w-full flex-shrink-0 space-y-4 lg:w-72">
        {/* Presencia web + quick filters */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Presencia web</h3>
          <div className="flex flex-wrap gap-2">
            {presenceFilters.map((f) => (
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
        </div>

        {/* Configurar mensaje — colapsado por default, no compite con la lista */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <button
            onClick={() => setComposerOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mensaje</div>
              <div className="text-sm font-medium text-slate-900">
                {isEditing ? 'Mensaje personalizado' : selectedTemplate.name}
              </div>
            </div>
            {composerOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>

          {composerOpen && (
            <div className="mt-4 space-y-4">
              {/* Rubro input */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Rubro (para personalizar el mensaje)
                </label>
                <input
                  type="text"
                  value={rubro}
                  onChange={(e) => setRubro(e.target.value)}
                  placeholder="ej: dentistas, peluquerias, abogados..."
                  className={selectClass}
                />
              </div>

              {/* Template selector */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Plantilla de mensaje</label>
                <div className="grid gap-2">
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
              <div>
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
            </div>
          )}
        </div>

        {/* Estado / Categoria / Pais / Ciudad — dropdowns compactos en vez de filas de pills */}
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PipelineStatus | 'all')}
              className={selectClass}
            >
              <option value="all">Todos</option>
              {PIPELINE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {(categories.length > 0 || results.some(r => !r.business.category)) && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">Todas</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c} ({results.filter(r => r.business.category === c).length})</option>
                ))}
                {results.some(r => !r.business.category) && (
                  <option value="__none__">Sin categoria ({results.filter(r => !r.business.category).length})</option>
                )}
              </select>
              {onUpdateBusiness && (
                <button
                  onClick={bulkAssignCategory}
                  className="mt-1 text-xs text-slate-500 underline decoration-dotted hover:text-blue-700"
                  title="Asigna una categoria a todos los negocios del filtro actual que no tengan una"
                >
                  + Asignar categoria a los filtrados
                </button>
              )}
            </div>
          )}

          {(countries.length > 0 || results.some(r => !locationsByBusiness.get(r.business.name)?.country)) && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Pais</label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">Todos</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c} ({results.filter(r => locationsByBusiness.get(r.business.name)?.country === c).length})</option>
                ))}
                {results.some(r => !locationsByBusiness.get(r.business.name)?.country) && (
                  <option value="__none__">Sin pais ({results.filter(r => !locationsByBusiness.get(r.business.name)?.country).length})</option>
                )}
              </select>
            </div>
          )}

          {(cities.length > 0 || results.some(r => !locationsByBusiness.get(r.business.name)?.city)) && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ciudad</label>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">Todas</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c} ({results.filter(r => locationsByBusiness.get(r.business.name)?.city === c).length})</option>
                ))}
                {results.some(r => !locationsByBusiness.get(r.business.name)?.city) && (
                  <option value="__none__">Sin ciudad ({results.filter(r => !locationsByBusiness.get(r.business.name)?.city).length})</option>
                )}
              </select>
            </div>
          )}
        </div>

        {/* Metricas — stats + conversion por plantilla, colapsado por default */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <button
            onClick={() => setMetricsOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Metricas
            {metricsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>

          {metricsOpen && (
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-green-200 bg-green-50 p-2">
                  <div className="text-lg font-bold text-green-600">{businessesWithPhone}</div>
                  <div className="text-xs text-green-700">Con telefono</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                  <div className="text-lg font-bold text-blue-600">{alreadySent}</div>
                  <div className="text-xs text-blue-700">Enviados</div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                  <div className="text-lg font-bold text-red-500">{noWaCount}</div>
                  <div className="text-xs text-red-600">Sin WhatsApp</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-lg font-bold text-slate-600">{pendingCount}</div>
                  <div className="text-xs text-slate-700">Pendientes</div>
                </div>
              </div>

              {Object.keys(templateStats).length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-slate-600">Conversion por plantilla</h4>
                  <div className="space-y-2">
                    {Object.entries(templateStats).map(([id, s]) => {
                      const responseRate = s.sent > 0 ? Math.round((s.responded / s.sent) * 100) : 0;
                      return (
                        <div key={id} className="rounded-lg border border-slate-100 p-2 text-xs">
                          <div className="font-medium text-slate-800">{templateName(id)}</div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500">
                            <span>Enviados: {s.sent}</span>
                            <span>Respondieron: {s.responded} ({responseRate}%)</span>
                            <span>1ra respuesta: {formatResponseTime(s.responseHours)}</span>
                            <span className="text-green-700">Interesados: {s.interested}</span>
                            <span className="text-red-600">Descartados: {s.discarded}</span>
                            {(s.positiveReactions > 0 || s.negativeReactions > 0) && (
                              <span>
                                {s.positiveReactions > 0 && <span className="text-green-700">👍 {s.positiveReactions}</span>}
                                {s.positiveReactions > 0 && s.negativeReactions > 0 && ' · '}
                                {s.negativeReactions > 0 && <span className="text-red-600">👎 {s.negativeReactions}</span>}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ==================== COLUMNA PRINCIPAL: lista de contactos ==================== */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o telefono..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex flex-shrink-0 overflow-hidden rounded-lg border border-slate-300">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                view === 'list' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="Vista de lista"
            >
              Lista
            </button>
            <button
              onClick={() => setView('board')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                view === 'board' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="Vista de tablero, arrastra las tarjetas para cambiar el estado"
            >
              Tablero
            </button>
          </div>
        </div>

        {view === 'board' ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {PIPELINE_STATUSES.map((col) => {
              const items = boardColumns.get(col.value) || [];
              return (
                <div
                  key={col.value}
                  onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.value); }}
                  onDragLeave={() => setDragOverColumn((prev) => (prev === col.value ? null : prev))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const name = e.dataTransfer.getData('text/plain');
                    setDragOverColumn(null);
                    setDraggingName(null);
                    if (name) handleStatusChange(name, col.value);
                  }}
                  className={`w-64 flex-shrink-0 rounded-lg border bg-slate-50/50 p-2 transition-colors ${
                    dragOverColumn === col.value ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                    <h4 className="text-sm font-semibold text-slate-700">{col.label}</h4>
                    <span className="ml-auto text-xs text-slate-400">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((result) => {
                      const score = calculateLeadScore(result.business, result.analysis);
                      const meta = leadScoreLabel(score);
                      const link = getWhatsAppLink(result);
                      return (
                        <div
                          key={result.business.name}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', result.business.name);
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggingName(result.business.name);
                          }}
                          onDragEnd={() => { setDraggingName(null); setDragOverColumn(null); }}
                          className={`cursor-grab rounded-lg border border-slate-200 bg-white p-2.5 text-sm shadow-sm active:cursor-grabbing ${
                            draggingName === result.business.name ? 'opacity-40' : ''
                          }`}
                        >
                          <div className="font-medium text-slate-900 line-clamp-2">{result.business.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                              {score} · {meta.label}
                            </span>
                            {result.business.category && (
                              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                                {result.business.category}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            {result.business.phone ? (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Phone className="h-3 w-3" />
                                {result.business.phone}
                              </span>
                            ) : <span />}
                            {link && (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="rounded p-1 text-green-600 hover:bg-green-50"
                                title="Enviar WhatsApp"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                        Sin negocios
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : filteredBusinesses.length === 0 ? (
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
                    {/* Conversacion registrada — se usa seguido para registrar respuestas, queda visible */}
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

                    {/* Mas acciones: ver/copiar mensaje, analizar sitio, marcar sin WA, eliminar */}
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpenFor(menuOpenFor === result.business.name ? null : result.business.name)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                        title="Mas acciones"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {menuOpenFor === result.business.name && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpenFor(null)} />
                          <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            <button
                              onClick={() => { setExpandedBusiness(isExpanded ? null : result.business.name); setMenuOpenFor(null); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              {isExpanded ? 'Ocultar mensaje' : 'Ver mensaje'}
                            </button>
                            <button
                              onClick={() => { copyMessage(result); setMenuOpenFor(null); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Copy className="h-4 w-4" />
                              Copiar mensaje
                            </button>
                            {onAnalysisUpdate && result.business.website && !result.business.onlySocial && (
                              <button
                                onClick={() => { analyzeBusiness(result.business); setMenuOpenFor(null); }}
                                disabled={analyzingNames.has(result.business.name)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {analyzingNames.has(result.business.name) ? (
                                  <Loader className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                                {result.analysis ? 'Re-analizar sitio' : 'Analizar sitio'}
                              </button>
                            )}
                            <button
                              onClick={() => { toggleNoWhatsApp(result.business.name); setMenuOpenFor(null); }}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${isNoWa ? 'text-red-600' : 'text-slate-700'}`}
                            >
                              <PhoneOff className="h-4 w-4" />
                              {isNoWa ? 'Desmarcar "no tiene WA"' : 'Marcar "no tiene WA"'}
                            </button>
                            {onRemove && (
                              <button
                                onClick={() => { onRemove(result.business.name); setMenuOpenFor(null); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                                Eliminar
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
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

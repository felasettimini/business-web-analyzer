# Setup Guide - Business Web Analyzer

Guía paso a paso para instalar y ejecutar la herramienta.

## Requisitos previos

- Node.js 18+ instalado
- npm o yarn
- Un navegador moderno

## Instalación

### 1. Clonar / Ir al directorio

```bash
cd /Users/felipesettimini/Repos/business-web-analyzer
```

### 2. Instalar dependencias

```bash
npm install
```

Espera a que termine (puede tomar 2-3 minutos la primera vez).

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

Abre http://localhost:3000 en tu navegador.

## Obtener datos de Google Maps

### Opción 1: Google Maps Scraper (Pagada ~$10/mes pero fácil)

1. Instala: https://chrome.google.com/webstore (busca "Google Maps Scraper")
2. Ve a Google Maps
3. Busca: "dentistas Rosario" (o tu búsqueda)
4. Abre la extension y dale click a "Scrape All"
5. Descarga los datos en formato JSON
6. En la app, haz click en "Upload JSON File"

### Opción 2: Instant Data Scraper (GRATIS ⭐)

**Es la más fácil para empezar:**

1. Instala: https://chrome.google.com/webstore/detail/instant-data-scraper/ofaokhiedipichpaobibbnahnkdoialc
2. Ve a Google Maps
3. Busca: "dentistas Rosario"
4. Abre la extension y selecciona datos
5. Click en "Scrape visible data"
6. Descarga como JSON

### Opción 3: Usar datos de ejemplo

Ya tenemos un archivo `example-data.json` en el proyecto. Para testear:

```bash
# En la app, ve a la pestaña "Upload Data"
# Haz click en "Paste JSON"
# Copia todo el contenido de example-data.json
# Pégalo en el prompt
```

## Flujo de uso

1. **Carga datos** → Upload JSON o Paste JSON
2. **Revisa preview** → Verifica que cargó bien (muestra count)
3. **Start Analysis** → La app analiza cada sitio (toma ~1-5 min)
4. **Ve resultados** → Automáticamente te muestra en la pestaña "Results"
5. **Exporta CSV** → Download para seguimiento

## Búsquedas recomendadas para testear

Estos rubros tienen buena densidad de locales sin web en Argentina:

```
Rosario:
- "dentistas Rosario"
- "peluquerías Rosario"
- "barbería Rosario"
- "estética Rosario"
- "abogados Rosario"

Mendoza:
- "dentistas Mendoza"
- "peluquerías Mendoza"

Córdoba:
- "académias Córdoba"
- "talleres mecánicos Córdoba"
```

## Qué esperar

- ✅ Algunos sitios analizan en 1-2 segundos
- ⏳ Otros pueden tardar más si son lentos
- ❌ Algunos pueden dar error si están protegidos anti-bot
- 🚀 El score es orientativo - revisa manualmente después

## Interpretar resultados

### Score 0-100

| Score | Significado | Acción |
|-------|------------|--------|
| < 30 | Crítico | 🔴 ALTAMENTE RECOMENDADO para prospectar |
| 30-50 | Bajo | 🔴 RECOMENDADO - Buena oportunidad |
| 50-70 | Medio | 🟡 POSIBLE - Tiene algunos problemas |
| 70-90 | Bueno | 🟢 MALA OPORTUNIDAD - No prospeca |
| > 90 | Excelente | 🟢 NO PROSPECA - Tienen todo bien |

### Oportunidad

- 🔴 **HIGH** → El negocio necesita web. Score bajo.
- 🟡 **MEDIUM** → Algunos problemas pero no crítico.
- 🟢 **LOW** → No vale la pena prospectarlos.

### Issues (Problemas encontrados)

- "No responsive design" → No se ve bien en móvil
- "Missing meta description" → Malo para SEO
- "No contact methods" → No pueden recibir clientes
- "Website loads slowly" → Pierden visitantes

### Recomendaciones

Estas son acciones específicas que puedes mencionar al prospectarlos:
- "Implementar diseño responsive"
- "Agregar botón WhatsApp" (CRÍTICO en Argentina)
- "Optimizar imágenes"
- "Agregar formulario de contacto"

## Troubleshooting

### "Analysis failed" o "Cannot GET URL"

**Causas:**
- El sitio web está down
- Tiene protección anti-bot
- URL mal escrita

**Solución:**
- Revisa el sitio manualmente en el navegador
- Salta ese y continúa con otros

### Análisis muy lento

**Causas:**
- Tu conexión es lenta
- El servidor está congestionado
- El sitio web es muy grande

**Solución:**
- Espera o vuelve a intentar
- Puedes cerrar la ventana y recargar

### JSON invalid

**Causas:**
- Formato mal (falta comas, comillas, etc.)
- Copy-paste incompleto

**Solución:**
- Copia el JSON completo
- Verifica con https://jsonlint.com/

## Próximos pasos

Después de obtener resultados:

1. **Ordena por OPPORTUNITY** → Filtra HIGH
2. **Ordena por SCORE** → Los más bajos primero
3. **Visita manualmente** → Chequea que el análisis sea correcto
4. **Prepara tu pitch** → Menciona problemas específicos
5. **Contacta vía WhatsApp** → Canal más efectivo en Argentina

## Automatización futura

Planeamos agregar:
- [ ] Búsqueda automática en Google Maps API
- [ ] Envío automático de WhatsApp
- [ ] Base de datos para seguimiento
- [ ] Análisis visual con screenshots
- [ ] Integración con CRM

## Preguntas frecuentes

**¿Puedo usar esto sin pagar nada?**
Sí, todo es gratis excepto:
- Google Maps API (oficial, ~$7 per 1000 búsquedas)
- Extensiones de scraping (algunas son pagas)

**¿Cuántos negocios puedo analizar?**
Unlimited en local. En producción dependerá de servidor.

**¿Cómo vendo esto?**
Esta es TU herramienta. Úsala para prospectar tus propios clientes.

**¿Puedo compartirla con otros?**
Sí, puedes hacer un deploy en Vercel gratis.

## Deploy en Vercel (Opcional)

```bash
# Instala Vercel CLI
npm i -g vercel

# Deploy
vercel

# Te dará una URL pública
```

---

¡Listo! Ahora estás preparado para empezar a analizar y prospectarnegocios.

Cualquier duda, revisa el README.md o contacta a felipe@settimini.net

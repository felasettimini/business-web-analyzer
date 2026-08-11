# Business Web Analyzer

Herramienta automatizada para encontrar negocios con sitios web de baja calidad y convertirlos en clientes.

## Características

✅ **Análisis de Sitios Web** - Evalúa automáticamente:
- Responsividad mobile
- Velocidad de carga
- Calidad del diseño
- SEO básico
- Métodos de contacto

✅ **Scoring Inteligente** - Genera un score 0-100 por sitio basado en:
- Mobile-friendly
- Performance
- Design moderno
- SEO (title, meta, h1, structured data)
- Contactibilidad (form, email, WhatsApp, teléfono)

✅ **Oportunidades Rankeadas** - Clasificación automática:
- 🔴 HIGH (score < 50) - Excelentes prospectos
- 🟡 MEDIUM (50-70) - Buenos prospectos
- 🟢 LOW (> 70) - Mejor dejarlos

✅ **Exporta a CSV** - Genera reportes descargables

## Instalación

```bash
cd business-web-analyzer
npm install
```

## Uso

### 1. Preparar datos de Google Maps

Tienes varias opciones para obtener datos de Google Maps:

**Opción A: Usar Google Maps Scraper (extension Chrome)**
- Instala: [Google Maps Scraper](https://chrome.google.com/webstore)
- Busca en Maps: "dentistas Rosario" (o tu rubro + ciudad)
- Abre la extension y dale "Scrape"
- Descarga el JSON

**Opción B: Usar Instant Data Scraper (GRATIS)**
- Instala: [Instant Data Scraper](https://chrome.google.com/webstore)
- Busca en Maps: "dentistas Rosario"
- Selecciona resultados
- Abre extension → "Scrape this table"
- Descarga como JSON

**Opción C: Formato manual JSON**

```json
[
  {
    "name": "Centro Dental García",
    "website": "www.dentalgarcia.com.ar",
    "phone": "+54 341 123-4567",
    "address": "Calle Principal 100, Rosario",
    "rating": 4.5,
    "reviews": 28
  },
  {
    "name": "Dentista Pérez",
    "website": null,
    "phone": "+54 341 456-7890",
    "address": "Av. Rivadavia 200, Rosario",
    "rating": 4.2,
    "reviews": 15
  }
]
```

### 2. Importar datos a la app

```bash
npm run dev
```

1. Abre http://localhost:3000
2. Sube el archivo JSON O pega el JSON manualmente
3. Verifica los datos cargados
4. Haz click en "Start Analysis"

### 3. Revisar resultados

La app analiza cada sitio web y genera:

- **Overall Score** (0-100)
- **Scores por categoría**:
  - Mobile (¿es responsive?)
  - Speed (¿carga rápido?)
  - Design (¿se ve moderno?)
  - SEO (¿se posiciona en Google?)
  - Contact (¿tiene formas de contacto?)

- **Oportunidad** (HIGH/MEDIUM/LOW)
- **Issues** encontrados
- **Recomendaciones** específicas

### 4. Exportar resultados

Haz click en "Export CSV" para descargar un archivo con todos los datos que puedes usar en Excel, Google Sheets, o para seguimiento.

## Análisis que hace la app

### Mobile Score (0-100)
- ✅ +85: Tiene viewport meta tag + es responsive
- ✅ +15: Tiene mobile menu
- ❌ -50: No es responsive

### Speed Score (0-100)
- ✅ +95: Carga en < 2s
- ✅ +70: Carga en 2-4s
- ❌ +40: Carga en > 4s

### Design Score (0-100)
- ✅ +80-100: Usa tecnología moderna (React, Next.js, Vue, Tailwind)
- ✅ +15: Tiene elementos de diseño moderno (hero, gradients, dark mode)
- ❌ +30: Usa Bootstrap 3, jQuery viejo, Flash
- ❌ +50: No es responsive y no tiene diseño moderno

### SEO Score (0-100)
- ✅ +15: Tiene title > 20 chars
- ✅ +15: Tiene meta description > 100 chars
- ✅ +10: Tiene exactamente 1 H1
- ✅ +10: Tiene structured data (schema.org)

### Contact Score (0-100)
- ✅ +25: Tiene formulario de contacto
- ✅ +15: Tiene enlace tel:
- ✅ +15: Tiene enlace mailto:
- ✅ +20: Tiene WhatsApp (IMPORTANTE para AR!)
- ✅ +15: Tiene mapa embebido

## Prospectos de Alto Potencial

Busca empresas con:

1. **Score < 50** - Máximas oportunidades
2. **Sin WhatsApp** - Problema crítico en Argentina
3. **Sin contacto claro** - No pueden recibir leads
4. **Diseño outdated** - Pierden credibilidad
5. **Sin mobile** - 70% del tráfico es mobile

## Flujo de prospección recomendado

```
1. Carga 30-50 negocios
2. Analiza (toma 5-10 mins)
3. Filtra HIGH OPPORTUNITY
4. Ordena por score bajo
5. Visita sus websites
6. Prepara pitch personalizado
7. Contacta vía WhatsApp/Email/Teléfono
```

## Ejemplos de buscar

**Rubros altos potencial en Argentina:**
- Dentistas
- Peluquerías/Barbería
- Abogados
- Académias/Cursos
- Talleres mecánicos
- Kioscos/Almacenes
- Consultorios médicos
- Estéticas

**Ciudades recomendadas para empezar:**
- Rosario (tu ciudad - ventaja local)
- Mendoza
- Córdoba
- La Plata

## Tips para la prospección

✅ **DO:**
- Personaliza cada mensaje (menciona algo del negocio)
- Usa WhatsApp (es el canal más efectivo en AR)
- Muestra ejemplos de trabajos anteriores
- Ofrece consulta GRATIS sin compromiso
- Enfoca en resultados (más clientes, visibilidad en Google)

❌ **DON'T:**
- Envíes spam masivo (baja tasa de respuesta)
- Exageres promesas
- Ignores respuestas negativas
- Seas pushy en mensajes de seguimiento

## Stack técnico

- **Framework**: Next.js 15 + TypeScript
- **Análisis web**: Axios + Cheerio
- **Scoring**: Lógica custom
- **UI**: React + Tailwind CSS
- **Almacenamiento**: JSON in-memory (mejorable a DB)

## Limitaciones actuales

⚠️ Análisis desde el cliente (sin Puppeteer)
⚠️ No ejecuta JavaScript (algunos sitios dinámicos)
⚠️ No verifica Google Search Console
⚠️ No valida HTTPS/certificados

## Mejoras futuras

📋 Integración oficial Google Places API
📋 Análisis de screenshot visual
📋 Verificación de posicionamiento Google
📋 Análisis de competencia
📋 Automatización de outreach vía Email/WhatsApp
📋 Base de datos para seguimiento
📋 Reportes por rubros/ciudades

## Troubleshooting

**Error: "Analysis failed"**
- El sitio web puede estar down
- Puede tener protección anti-bot
- Timeout por sitio muy lento

**Score muy bajo en sitios buenos**
- Posible que sea sitio dinámico (React, etc.)
- La app solo lee HTML estático
- Revisa manualmente

**No carga JSON**
- Asegúrate que sea JSON válido (usa jsonlinter.com)
- Verifica que tenga estructura correcta

## Contacto

📧 felipe@settimini.net
💼 Portfolio: https://mi-portfolio-web.vercel.app

---

Hecho con ❤️ para encontrar oportunidades de negocio en Argentina 🇦🇷

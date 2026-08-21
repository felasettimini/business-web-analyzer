# Guía de conversación — mejorar conversión

Basada en el análisis de las 52 conversaciones registradas al 2026-08-20. Se actualiza a medida que se junten más datos (repetir el análisis cada tanto exportando conversaciones desde el botón "Exportar conversaciones").

## Principios que salen de los datos

1. **Pregunta cerrada y concreta > oferta abstracta.** "¿Te interesa verla?" sobre una vista previa gratis convirtió 3/3 en charla real. "Te hago una consulta sin costo para mejorar tu presencia online" convirtió ~0/45 en charla real (solo bots).
2. **Personalizar > plantilla genérica.** Mencionar algo específico del negocio (no tiene web / la web es lenta / no se ve bien en el celular) engancha más que "vi que tenés mucha actividad".
3. **El segundo toque automático no funciona tal cual está.** 7 envíos de "¿Tenés 5 min esta semana...?" inmediatamente después del bot → 0 respuestas. Hay que espaciarlo y personalizarlo.
4. **El cuello de botella hoy es la respuesta, no el precio.** Nadie rechazó por plata todavía — el "no" más común es "por ahora no lo necesito", dicho con buena onda. Palanca de mejora: subir tasa de respuesta, no bajar precio.
5. **El tono en los "no" ya funciona bien** — cordial, sin insistir, dejando la puerta abierta. Mantenerlo.

---

## Paso 1 — Primer mensaje

### A) Negocio SIN web propia (usar siempre esta, es la que mejor funciona)

> Hola! Soy Felipe, developer web en Rosario.
>
> Vi que **{negocio}** no tiene web propia. Hoy la mayoría de tus clientes potenciales googlean antes de ir a un lugar nuevo, y sin web esos clientes se van a la competencia.
>
> Te armé una vista previa de cómo quedaría tu página — mirá: https://web-demos-mauve.vercel.app/demo/inmobiliaria
>
> Sin compromiso, avisame qué te parece.

Estructura: gancho específico (no tiene web) → consecuencia concreta (se van a la competencia) → link directo a demo (tangible, sin que tengas que esperar respuesta) → cierre cordial.

### B) Negocio CON web (hoy usás la genérica — cambiarla por esta)

En vez de "vi que tenés mucha actividad", usar un dato real de tu propio análisis (`issues` / `recommendations` de `WebsiteAnalysis`):

> Hola! Soy Felipe, developer web en Rosario.
>
> Vi la web de **{negocio}** y noté que {problema puntual: no carga bien en el celular / tarda mucho en abrir / no tiene botón de WhatsApp / diseño de hace varios años}. Eso hace que muchos clientes se vayan antes de contactarte.
>
> Te armé un ejemplo de cómo podría verse mejorada: https://web-demos-mauve.vercel.app/demo/inmobiliaria
>
> Sin compromiso, avisame qué te parece.

Estructura: gancho específico (problema detectado) → consecuencia (clientes se van) → link directo a demo (muestra la solución) → cierre cordial.

### Evitar

- Frases largas tipo "consulta sin costo para ver cómo mejorar tu presencia online" (vago, no genera respuesta).
- Copiar/pegar con emojis rotos — revisá que el mensaje se vea bien antes de enviar (hubo casos con un `�` en vez de emoji).

---

## Paso 2 — Segundo toque (semana 2-3, si no respondieron)

**Recién aquí mandas la demo si es que dijeron "por ahora no" en el primer mensaje.** Es tu carta fuerte cuando cambio de opinión o tuvieron tiempo para pensarlo.

Reglas:
- Espaciá al menos 2-3 días (mejor una semana) desde el primer contacto.
- El segundo mensaje debe sonar personalizado, referenciando lo que dijeron antes — no un script fijo.
- Ahora sí, mandá la demo sin esperar respuesta previa:

> Buenas! Vi que mencionaste que por ahora no lo necesitaban — te armé igual una vista previa de cómo podría verse la web de {negocio}: https://web-demos-mauve.vercel.app/demo/inmobiliaria
>
> Sin compromiso, cualquier cosa acá estoy.

**Si respondieron con un bot de horarios**, diferenciá en el primer toque:

> Buenas! Vi que atienden {horario mencionado}. No busco turno — te escribía por lo de la web que te comenté. Cuando tengas un momento, mirá esto: https://web-demos-mauve.vercel.app/demo/inmobiliaria
>
> Sin compromiso, cualquier cosa acá estoy.

---

## Paso 3 — Objeciones más comunes (con respuesta sugerida)

**"Por ahora no lo necesito / no necesitamos"** (el más frecuente)
> Dale, ningún problema! Te dejo mi contacto por si más adelante te sirve. Cualquier cosa, acá estoy.

Ya lo hacés bien (Sol Mai, Ariel Wilchen) — mantenelo así, sin insistir en el momento. La chance real está en el follow-up de la semana 2-3, no en el momento del rechazo.

**"Ya tengo alguien / ya tengo web"**
> Buenísimo que ya la tengas! Si en algún momento querés una segunda opinión o necesitás algo puntual (una sección nueva, que cargue más rápido, etc.) contame, sin compromiso.

Deja la puerta abierta para trabajo puntual, no solo "sitio nuevo completo".

**Silencio total tras el primer mensaje (sin bot ni persona)**
No insistir a las pocas horas. Usar el follow-up automático a la semana (ya implementado con `shouldAutoDiscard`) como corte, y antes de descartar probar **un solo** mensaje con ángulo distinto al original — no repetir el mismo texto.

---

## Paso 4 — Avanzar la charla cuando hay interés real

Cuando alguien responde con curiosidad genuina (pregunta precio, pide ver ejemplos, dice "mandame más info"):

1. Responder rápido — la ventana de interés es corta.
2. Mandar el portfolio (`felipesettimini.com`) + 1-2 ejemplos concretos del mismo rubro si los tenés.
3. Proponer un paso chico y de bajo compromiso: "¿Te parece si te armo la vista previa esta semana y la vemos juntos 10 min?" — no saltar directo a hablar de precio.
4. Recién ahí, si preguntan precio, dar un rango en vez de evadir.

Marcar el negocio como `interesado` en el pipeline apenas haya intención real, para poder medir después qué mensajes de esta etapa convierten a `cliente`.

---

## Checklist rápido antes de mandar un mensaje

- [ ] ¿Termina en una pregunta cerrada y concreta (no "avisame cualquier cosa")?
- [ ] ¿Menciona algo específico del negocio (no genérico tipo "mucha actividad")?
- [ ] ¿Revisaste que no haya emojis rotos o texto cortado?
- [ ] Si es un segundo toque: ¿pasó tiempo suficiente y hace referencia a lo último que dijeron?

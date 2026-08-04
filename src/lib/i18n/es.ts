import type { Dict } from "./en";

/**
 * Spanish (es-US) dictionary — draft translation for owner review (spec §9.6).
 * Written as clear US Spanish, not literal machine translation (spec §9.1).
 * The `Dict` type guarantees key parity with English at compile time.
 */

export const es: Dict = {
  meta: {
    siteName: "HandyAlliance",
    home: {
      title: "HandyAlliance — Herramientas sencillas para profesionales de servicios del hogar",
      description:
        "Responde llamadas, crea presupuestos, da seguimiento a tus clientes, protege tu presupuesto de leads, crea tu sitio web y organiza cada trabajo.",
    },
    tools: {
      title: "Herramientas — HandyAlliance",
      description:
        "Cinco herramientas de pago sencillas más un Seguimiento de trabajos gratis. Úsalas por separado o juntas.",
    },
    jobTracker: {
      title: "Seguimiento de trabajos — Gratis — HandyAlliance",
      description:
        "Organiza clientes, presupuestos, trabajos, pagos y seguimientos en una sola tabla sencilla. Gratis para siempre, con sincronización automática a Google Sheets.",
    },
    pricing: {
      title: "Precios — HandyAlliance",
      description:
        "Precios mensuales simples. Elige una herramienta, varias, o todas y ahorra alrededor del 30%.",
    },
    signIn: {
      title: "Iniciar sesión — HandyAlliance",
      description: "Inicia sesión en tu cuenta de HandyAlliance.",
    },
    signUp: {
      title: "Crear cuenta — HandyAlliance",
      description:
        "Crea tu cuenta gratuita de HandyAlliance y empieza con el Seguimiento de trabajos gratis.",
    },
  },

  nav: {
    tools: "Herramientas",
    pricing: "Precios",
    trades: "Para tu profesión",
    jobTracker: "Seguimiento de trabajos",
    signIn: "Iniciar sesión",
    chooseTools: "Elegir mis herramientas",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    switchLocale: "English",
    switchLocaleLabel: "Switch to English",
  },

  common: {
    free: "Gratis",
    from: "Desde",
    perMonth: "/mes",
    perYear: "/año",
    or: "o",
    oneTime: "pago único",
    learnMore: "Ver más",
    getStarted: "Comenzar",
    seePricing: "Ver precios",
    includedInBundle: "Incluida en Todas las herramientas",
    allToolsName: "Todas las herramientas",
    saveAbout: "Ahorra alrededor del 30%",
    comingSoon: "Muy pronto",
    skipToContent: "Ir al contenido",
  },

  hero: {
    title: "Herramientas sencillas para profesionales de servicios del hogar",
    subtitle:
      "Responde llamadas, crea presupuestos, da seguimiento a tus clientes, protege tu presupuesto de leads, crea tu sitio web y organiza cada trabajo.",
    ctaPrimary: "Elegir mis herramientas",
    ctaSecondary: "Obtener todas — Ahorrar 30%",
    note: "Seguimiento de trabajos gratis incluido. Sin CRM complicado. Cancela cuando quieras.",
    badges: ["Funciona en inglés y español", "Hecho para tu teléfono", "Se sincroniza con Google Sheets"],
  },

  toolsSection: {
    heading: "Elige solo las herramientas que necesitas",
    subheading:
      "Cada herramienta funciona por sí sola. Juntas, comparten un mismo perfil de empresa y una misma lista de trabajos.",
  },

  tools: {
    call_answering: {
      name: "Respuesta de llamadas 24/7",
      tagline:
        "Responde las llamadas de los clientes, pregunta qué necesitan y envía los detalles del trabajo a tu teléfono.",
      cta: "Escuchar una demo",
      priceLine: "Desde ${price}/mes",
      detail: {
        promise:
          "No pierdas un trabajo por estar subido a una escalera. El asistente responde, hace las preguntas correctas y te envía los detalles por texto.",
        howTitle: "Cómo funciona",
        steps: [
          "Un cliente llama a tu número de negocio — de día o de noche.",
          "El asistente responde en inglés o español y pregunta qué necesita, dónde y qué tan urgente es.",
          "Recibes un mensaje de texto y un correo con los detalles del trabajo al instante.",
          "El nuevo trabajo aparece automáticamente en tu Seguimiento de trabajos y en tu Hoja de Google.",
        ],
        featuresTitle: "Qué hace",
        features: [
          "Responde en inglés y en español",
          "Guiones listos para tu profesión — sin configurar desde cero",
          "Conoce tus servicios, horarios y zona de trabajo",
          "Te transfiere las llamadas urgentes cuando tú quieras",
          "Detecta emergencias y te avisa de inmediato",
          "Cada llamada se convierte en un trabajo en tu Seguimiento de trabajos",
        ],
        limitsTitle: "Incluido en el precio",
        limits: [
          "{minutes} minutos al mes incluidos",
          "${overage}/minuto adicional después",
          "Los minutos no usados no se acumulan",
        ],
        honestyTitle: "Hablando claro",
        honesty: [
          "Siempre le dice a quien llama que es un asistente automático.",
          "Nunca promete precios ni horas exactas de llegada — eso lo decides tú.",
          "No es un servicio de emergencias y lo dice cuando alguien está en peligro.",
        ],
        faq: [
          {
            q: "¿Qué pasa si el cliente habla español?",
            a: "El asistente detecta el idioma u ofrece una elección rápida, y continúa toda la llamada en español. Tu resumen llega en el idioma que elegiste para tu cuenta.",
          },
          {
            q: "¿Puede transferirme las llamadas?",
            a: "Sí. Tú eliges cuándo: siempre, solo llamadas urgentes, o solo en ciertos horarios.",
          },
          {
            q: "¿Necesito números de teléfono nuevos?",
            a: "Configuramos un número de negocio para el asistente. Puedes desviar tu línea actual cuando estés ocupado.",
          },
        ],
      },
    },
    estimate_quote_maker: {
      name: "Creador de presupuestos y cotizaciones",
      tagline:
        "Convierte una nota de voz, una descripción del trabajo o fotos en un presupuesto profesional en minutos.",
      cta: "Ver cómo funciona",
      priceLine: "${price}/mes",
      detail: {
        promise:
          "Describe el trabajo como se lo contarías a un amigo. Recibe un presupuesto limpio y profesional que tu cliente puede aceptar en línea.",
        howTitle: "Cómo funciona",
        steps: [
          "Describe el trabajo — escríbelo, graba una nota de voz o agrega fotos.",
          "Preparamos el alcance del trabajo y las partidas usando plantillas de tu profesión.",
          "Revisas todo y defines el precio final. Nada se envía sin tu aprobación.",
          "Envíalo como PDF o enlace seguro. Tu cliente puede aceptarlo desde su teléfono.",
        ],
        featuresTitle: "Qué hace",
        features: [
          "Plantillas listas para tu profesión — cambio de llaves, montaje de TV, limpiezas profundas y más",
          "Presupuestos en inglés, en español o en ambos",
          "Mano de obra, materiales e impuestos presentados con claridad",
          "Los clientes aceptan o rechazan en línea — recibes aviso al instante",
          "Cada presupuesto queda vinculado al trabajo en tu Seguimiento de trabajos",
          "Los estados se actualizan solos: enviado, visto, aceptado",
        ],
        limitsTitle: "Incluido en el precio",
        limits: ["Presupuestos ilimitados", "PDF y enlace web seguro incluidos"],
        honestyTitle: "Hablando claro",
        honesty: [
          "El borrador es un punto de partida — tú siempre confirmas el precio final antes de enviar nada.",
        ],
        faq: [
          {
            q: "¿Puedo editar el presupuesto antes de enviarlo?",
            a: "Siempre. Puedes cambiar cada partida, el precio, los términos — todo. El presupuesto solo se envía cuando tú lo apruebas.",
          },
          {
            q: "¿Mi cliente puede aceptarlo en línea?",
            a: "Sí. Abre un enlace seguro, ve el presupuesto en su idioma y toca Aceptar — tú recibes el aviso y el estado del trabajo se actualiza.",
          },
        ],
      },
    },
    reviews_followups: {
      name: "Solicitudes de reseñas y seguimiento",
      tagline:
        "Envía mensajes de agradecimiento, solicitudes de reseñas, recordatorios de presupuestos y seguimientos profesionales.",
      cta: "Ver mensajes de ejemplo",
      priceLine: "${price}/mes",
      detail: {
        promise:
          "El dinero está en el seguimiento — pero es fácil olvidarlo. Preparamos el mensaje correcto en el momento correcto; tú solo lo apruebas.",
        howTitle: "Cómo funciona",
        steps: [
          "Un trabajo cambia de estado — presupuesto enviado, visita agendada, trabajo terminado, pago recibido.",
          "Te sugerimos el mensaje adecuado: un recordatorio, un agradecimiento o una solicitud de reseña.",
          "Revisas el borrador y tocas enviar. Eso es todo.",
        ],
        featuresTitle: "Tipos de mensajes",
        features: [
          "Mensajes de agradecimiento al terminar un trabajo",
          "Recordatorios de presupuestos para que no se enfríen",
          "Recordatorios de citas que reducen las ausencias",
          "Solicitudes de reseñas con tu enlace real de reseñas de Google",
          "Recordatorios de pago — amables pero efectivos",
          "Recordatorios de temporada para servicios recurrentes",
        ],
        limitsTitle: "Incluido en el precio",
        limits: ["{sms} mensajes de texto al mes incluidos", "Mensajes por correo — sin límite"],
        honestyTitle: "Hablando claro",
        honesty: [
          "Los mensajes van solo a tus clientes reales — esto no es una herramienta de mensajes masivos.",
          "Los clientes pueden responder STOP en cualquier momento, y lo respetamos automáticamente.",
          "Nunca escribimos reseñas falsas ni premiamos a los clientes por reseñas positivas.",
        ],
        faq: [
          {
            q: "¿Los mensajes se envían automáticamente?",
            a: "Por defecto, no — preparamos un borrador y tú lo apruebas. Cuando te sientas cómodo, puedes activar el envío automático para ciertos tipos de mensajes.",
          },
          {
            q: "¿Funciona en español?",
            a: "Sí. Cada cliente tiene un idioma preferido, y los mensajes se redactan en ese idioma automáticamente.",
          },
        ],
      },
    },
    bad_lead_refund_helper: {
      name: "Ayuda para reembolsos de leads no válidos",
      tagline:
        "Revisa un lead pagado, identifica la evidencia faltante y crea un borrador claro para solicitar un reembolso.",
      cta: "Revisar un lead",
      priceLine: "${price}/mes",
      priceLineExtra: "o ${oneTime} por una sola revisión",
      detail: {
        promise:
          "¿Pagaste por un lead con número equivocado, ciudad equivocada o un trabajo que nadie pidió? Prepara una solicitud de reembolso clara y bien documentada en minutos.",
        howTitle: "Cómo funciona",
        steps: [
          "Sube capturas de pantalla del lead y de tu conversación con el cliente.",
          "Las comparamos con los motivos de reembolso de la plataforma y te mostramos qué evidencia tienes — y cuál falta.",
          "Recibes un borrador de solicitud de reembolso claro y editable.",
          "Lo copias y lo envías tú mismo desde tu cuenta de Thumbtack.",
        ],
        featuresTitle: "Qué hace",
        features: [
          "Funciona con leads de Thumbtack (más plataformas después)",
          "Encuentra el motivo de reembolso más fuerte: servicio equivocado, ubicación equivocada, duplicado, contacto inválido y más",
          "Muestra exactamente qué evidencia falta antes de enviar",
          "Mantiene cada caso organizado y vinculado al trabajo",
          "Tus capturas quedan privadas — nunca se comparten ni se publican",
        ],
        limitsTitle: "Incluido en el precio",
        limits: [
          "{analyses} revisiones de leads al mes con la suscripción",
          "O paga ${oneTime} por una sola revisión — sin suscripción",
        ],
        honestyTitle: "Hablando claro",
        honesty: [
          "Te ayudamos a organizar la evidencia y preparar una solicitud de reembolso más clara. La plataforma toma la decisión final.",
          "Nunca entramos a tu cuenta de Thumbtack ni enviamos nada por ti.",
          "Ningún reembolso está garantizado — quien te prometa eso no está siendo honesto.",
        ],
        faq: [
          {
            q: "¿Garantizan el reembolso?",
            a: "No — y ningún servicio honesto puede hacerlo. La plataforma toma la decisión final. Nosotros nos aseguramos de que tu solicitud sea clara, completa y con la evidencia correcta.",
          },
          {
            q: "¿Necesitan mi contraseña de Thumbtack?",
            a: "Nunca. Tú subes capturas, nosotros preparamos el borrador y tú lo envías desde tu propia cuenta.",
          },
        ],
      },
    },
    business_website: {
      name: "Sitio web para tu negocio",
      tagline:
        "Obtén un sitio web profesional y adaptable a móviles creado con una plantilla lista para tu profesión.",
      cta: "Ver plantillas",
      priceLine: "${yearly}/año",
      priceLineExtra: "o ${monthly}/mes",
      detail: {
        promise:
          "Un sitio web limpio y profesional con tus servicios, fotos y un formulario de contacto — en línea en minutos, no en meses.",
        howTitle: "Cómo funciona",
        steps: [
          "Elige la plantilla de tu profesión.",
          "Tu perfil de empresa completa el sitio automáticamente — nombre, servicios, horarios, zona de trabajo.",
          "Agrega tus fotos, revisa la vista previa y publica.",
          "Cada formulario enviado se convierte en un nuevo trabajo en tu Seguimiento de trabajos.",
        ],
        featuresTitle: "Qué incluye",
        features: [
          "Plantilla profesional diseñada para tu profesión",
          "Funciona de maravilla en teléfonos — donde están tus clientes",
          "En inglés, en español o bilingüe con cambio de idioma",
          "Formulario de contacto que crea trabajos y te avisa al instante",
          "Botón de llamada en cada página",
          "Tu dirección en handyalliance.com/pro/tu-negocio",
        ],
        limitsTitle: "Incluido en el precio",
        limits: ["{sites} sitio web por negocio", "Alojamiento y actualizaciones incluidos"],
        honestyTitle: "Hablando claro",
        honesty: [
          "Las plantillas lo mantienen simple y económico — esto no es diseño web a la medida.",
          "Nunca inventamos licencias, reseñas ni zonas de servicio para tu sitio. Lo que se publica es lo que es verdad.",
        ],
        faq: [
          {
            q: "¿Mi sitio puede estar en los dos idiomas?",
            a: "Sí. Elige inglés, español o ambos — los sitios bilingües tienen páginas separadas por idioma y un cambio de idioma.",
          },
          {
            q: "¿Qué pasa cuando alguien llena el formulario?",
            a: "Recibes un texto y un correo de inmediato, y la solicitud aparece como un nuevo trabajo en tu Seguimiento de trabajos y en tu Hoja de Google.",
          },
        ],
      },
    },
  },

  jobTracker: {
    name: "Seguimiento de trabajos",
    badge: "Gratis",
    tagline: "Organiza clientes, presupuestos, trabajos, pagos y seguimientos en una sola tabla sencilla.",
    cta: "Comenzar gratis",
    homeHeading: "Tus trabajos, organizados — gratis",
    homeSub:
      "Cada cuenta de HandyAlliance incluye el Seguimiento de trabajos. Sin prueba, sin tarjeta, sin trampa. Es la base donde se conectan todas las demás herramientas.",
    page: {
      heroTitle: "Una lista sencilla para cada trabajo",
      heroSub:
        "Desde la primera llamada hasta el pago final — clientes, presupuestos, citas y pagos en un solo lugar. Gratis para siempre.",
      flowTitle: "Sigue tu flujo de trabajo real",
      flow: ["Llamada", "Lead", "Trabajo", "Presupuesto", "Seguimiento", "Reseña", "Pago"],
      featuresTitle: "Qué puedes hacer",
      features: [
        "Agrega un trabajo en menos de un minuto — o díctalo por voz",
        "Ve de un vistazo qué es nuevo, agendado, en curso y sin pagar",
        "Controla montos de presupuestos, totales y costos de materiales",
        "Busca, filtra y ordena todo",
        "Funciona muy bien en tu teléfono con tarjetas sencillas",
        "Exporta a CSV cuando quieras — tus datos son tuyos",
      ],
      voiceTitle: "Agrega un trabajo por voz",
      voiceExample:
        "“John Smith necesita cambiar una llave el viernes por la tarde. La cotización es de 280 dólares y los materiales cuestan unos 45.”",
      voiceNote: "Nosotros llenamos los campos; tú confirmas antes de guardar.",
      sampleTitle: "Tarjetas sencillas en tu teléfono",
      notCrmTitle: "No es un CRM — a propósito",
      notCrm:
        "Sin embudos que configurar, sin etapas de venta que estudiar. Solo tus clientes y trabajos en una lista sencilla que se mantiene organizada sola.",
      syncTitle: "Sincronizado con tu Hoja de Google",
      syncText:
        "Cada cambio llega automáticamente a tu propia Hoja de Google — perfecto para respaldos, contadores o conectar otros servicios.",
    },
  },

  sheets: {
    heading: "Tus datos también viven en tu Hoja de Google",
    promise:
      "Tus trabajos se organizan en HandyAlliance y se sincronizan automáticamente con tu Hoja de cálculo de Google.",
    points: [
      "Un clic conecta tu cuenta de Google — nosotros creamos la hoja por ti",
      "Cada trabajo, cliente y presupuesto se mantiene al día automáticamente",
      "Es tu hoja, en tu Google Drive — la conservas aunque te vayas",
      "Conecta Zapier, Make o cualquier servicio que lea Google Sheets",
    ],
    sheetNote: "Edita los trabajos en HandyAlliance. Esta hoja se actualiza automáticamente.",
    lastSynced: "Última sincronización: ahora mismo",
  },

  setupOnce: {
    heading: "Configura tu empresa una sola vez",
    sub: "El nombre de tu negocio, servicios, horarios y zona de trabajo alimentan todas las herramientas. Llénalos una vez — cada herramienta que agregues después estará lista en minutos.",
    points: [
      "Un perfil compartido por todas tus herramientas",
      "Agrega o quita herramientas cuando quieras",
      "Todo habla inglés y español",
    ],
  },

  pricingPreview: {
    heading: "Precios simples, sin sorpresas",
    sub: "Elige una herramienta, varias o todas. El Seguimiento de trabajos gratis siempre está incluido.",
    cta: "Ver todos los precios",
  },

  pricingPage: {
    title: "Precios",
    sub: "Cada cuenta empieza con el Seguimiento de trabajos gratis y la sincronización con Google Sheets. Agrega solo las herramientas que necesitas — o llévate todas y ahorra alrededor del 30%.",
    perToolHeading: "Herramientas individuales",
    bundleHeading: "La mejor opción",
    bundle: {
      name: "Todas las herramientas — Ahorra 30%",
      priceLine: "Alrededor de ${price}/mes",
      blurb:
        "Las cinco herramientas de pago, una sola suscripción sencilla, alrededor de un 30% más barato que comprarlas por separado.",
      includes: [
        "Respuesta de llamadas 24/7 — {minutes} minutos/mes incluidos",
        "Creador de presupuestos — presupuestos ilimitados",
        "Reseñas y seguimiento — {sms} textos/mes incluidos",
        "Ayuda para reembolsos de leads — {analyses} revisiones/mes",
        "Sitio web para tu negocio — activo mientras dure la suscripción",
      ],
      cta: "Obtener todas",
    },
    freeCard: {
      name: "Seguimiento de trabajos + Sincronización con Google Sheets",
      priceLine: "Gratis para siempre",
      blurb: "Incluido con cada cuenta. No es una prueba.",
      cta: "Comenzar gratis",
    },
    limitsNote:
      "Los límites incluidos y las tarifas por uso adicional siempre se muestran antes de comprar. Los precios pueden cambiar mientras aprendemos — los suscriptores actuales serán avisados primero.",
    faq: [
      {
        q: "¿Puedo comprar una sola herramienta?",
        a: "Sí. Cada herramienta funciona por sí sola. Empieza con una y agrega más cuando quieras.",
      },
      {
        q: "¿Qué pasa si me paso de los minutos o textos incluidos?",
        a: "Nada deja de funcionar. El uso adicional se cobra a la tarifa publicada, y te avisamos antes de que te acerques al límite.",
      },
      {
        q: "¿Puedo cancelar cuando quiera?",
        a: "Sí. Cancela desde tu cuenta en dos clics. Tu Seguimiento de trabajos y tu Hoja de Google siguen siendo tuyos, gratis.",
      },
      {
        q: "¿Hay contrato?",
        a: "Sin contratos. Los planes mensuales se renuevan mes a mes; el sitio web tiene una opción anual más económica.",
      },
    ],
  },

  trades: {
    heading: "Hecho para tu profesión",
    sub: "Guiones, plantillas de presupuestos y diseños de sitios web hechos para el trabajo que realmente haces.",
    seeAll: "Mira cómo funciona para tu profesión",
    page: {
      heroTitleTpl: "HandyAlliance para {trade}",
      heroSubTpl: "Herramientas que ya conocen el trabajo de {trade} — sin configurar desde cero.",
      templatesTitle: "Plantillas de presupuestos listas",
      templatesSub: "Empieza desde una plantilla, ajusta los números, envía. Trabajos típicos que cubrimos:",
      toolsTitle: "Las herramientas, ajustadas a tu profesión",
      toolsSub:
        "Guiones de llamadas, partidas de presupuestos, mensajes de seguimiento y plantillas de sitio web — todo preparado para tu tipo de trabajo.",
      ctaTitle: "Pruébalo con tu próximo trabajo",
      ctaSub: "Empieza con el Seguimiento de trabajos gratis. Agrega herramientas de pago cuando estés listo.",
    },
    items: {
      handyman: {
        name: "Handyman",
        blurb: "Desde montar una TV hasta reparar puertas — mantén cada trabajo pequeño rentable y organizado.",
        examples: ["Montaje de TV", "Armado de muebles", "Parche de drywall", "Reparación de puertas", "Instalación de repisas"],
      },
      plumbing: {
        name: "Plomería",
        blurb: "Llamadas de emergencia respondidas, presupuestos rápidos y seguimientos que ganan el trabajo.",
        examples: ["Cambio de llave", "Instalación de inodoro", "Diagnóstico de fugas", "Cambio de triturador"],
      },
      hvac: {
        name: "HVAC",
        blurb: "Temporadas altas bajo control: llamadas respondidas 24/7 y recordatorios de mantenimiento que hacen volver a los clientes.",
        examples: ["Visita de diagnóstico", "Cambio de termostato", "Mantenimiento", "Presupuesto de instalación"],
      },
      electrical: {
        name: "Electricistas",
        blurb: "Presupuestos profesionales para cada panel, lámpara y contacto — con manejo de llamadas que pone la seguridad primero.",
        examples: ["Instalación de lámparas", "Cambio de contactos", "Visita de diagnóstico"],
      },
      cleaning: {
        name: "Limpieza",
        blurb: "Horarios recurrentes, cotizaciones rápidas y solicitudes de reseñas que llenan tu calendario.",
        examples: ["Limpieza estándar", "Limpieza profunda", "Limpieza de mudanza"],
      },
      appliance_repair: {
        name: "Reparación de electrodomésticos",
        blurb: "Visitas de diagnóstico agendadas mientras trabajas, refacciones y mano de obra cotizadas con claridad.",
        examples: ["Visita de diagnóstico", "Cambio de refacción", "Instalación"],
      },
    },
  },

  demo: {
    heading: "Míralo en acción",
    sub: "Aquí irán pantallas reales del producto conforme salga cada herramienta. Sin testimonios de archivo ni reseñas inventadas — solo el producto.",
  },

  faq: {
    heading: "Preguntas frecuentes",
    items: [
      {
        q: "¿El Seguimiento de trabajos es gratis de verdad?",
        a: "Sí — gratis para siempre, incluida la sincronización con Google Sheets. Es el centro de HandyAlliance, y las herramientas de pago se conectan a él.",
      },
      {
        q: "¿Tengo que comprar todas las herramientas?",
        a: "No. Cada herramienta funciona por sí sola. Compra una, varias, o llévate todas y ahorra alrededor del 30%.",
      },
      {
        q: "¿Esto es un CRM?",
        a: "No. Es un conjunto de herramientas sencillas y listas para usar. Sin embudos, sin cursos, sin consultores — lo entiendes en minutos.",
      },
      {
        q: "¿Todo funciona en español?",
        a: "Sí. Toda la plataforma — llamadas, presupuestos, mensajes, tu sitio web — funciona en inglés, en español o en ambos.",
      },
      {
        q: "¿Qué pasa con mis datos si cancelo?",
        a: "Tu Hoja de Google está en tu propio Google Drive y se queda contigo. También puedes exportar todo a CSV cuando quieras.",
      },
      {
        q: "¿Reemplazan mi teléfono o mis herramientas?",
        a: "No. HandyAlliance funciona junto a tu forma actual de trabajar — tu teléfono, tus clientes, tu cuenta de Google.",
      },
    ],
  },

  ctaBanner: {
    title: "¿Listo para organizarte?",
    sub: "Empieza gratis con el Seguimiento de trabajos. Agrega herramientas cuando las necesites.",
    ctaPrimary: "Elegir mis herramientas",
    ctaSecondary: "Obtener todas — Ahorrar 30%",
  },

  footer: {
    tagline: "Herramientas sencillas para profesionales de servicios del hogar.",
    toolsHeading: "Herramientas",
    productHeading: "Producto",
    languageHeading: "Idioma",
    legalNote: "Los Términos de servicio y la Política de privacidad se están finalizando y se publicarán aquí.",
    rights: "Todos los derechos reservados.",
  },

  auth: {
    signIn: {
      title: "Bienvenido de nuevo",
      sub: "Inicia sesión en tu cuenta de HandyAlliance.",
      email: "Correo electrónico",
      password: "Contraseña",
      submit: "Iniciar sesión",
      magic: "Envíenme un enlace de acceso",
      google: "Iniciar sesión con Google",
      divider: "o",
      noAccount: "¿Nuevo en HandyAlliance?",
      switchLink: "Crea una cuenta gratis",
      note: "El inicio de sesión se abre con el lanzamiento de la plataforma. Esta página es una vista previa.",
    },
    signUp: {
      title: "Crea tu cuenta gratis",
      sub: "Empieza con el Seguimiento de trabajos gratis. Agrega herramientas de pago cuando estés listo.",
      email: "Correo electrónico",
      password: "Contraseña",
      submit: "Crear cuenta",
      google: "Registrarse con Google",
      divider: "o",
      hasAccount: "¿Ya tienes una cuenta?",
      switchLink: "Inicia sesión",
      note: "El registro se abre con el lanzamiento de la plataforma. Esta página es una vista previa.",
      perks: ["Seguimiento de trabajos gratis incluido", "No se requiere tarjeta de crédito", "Inglés y español"],
    },
  },

  trackerSample: {
    columns: { customer: "Cliente", service: "Servicio", status: "Estado", amount: "Monto", date: "Fecha" },
    rows: [
      { customer: "John Smith", service: "Cambio de llave", status: "Presupuesto enviado", amount: "$280", date: "Vie, 2:00 PM" },
      { customer: "María López", service: "Limpieza profunda", status: "Agendado", amount: "$180", date: "Lun, 9:00 AM" },
      { customer: "Dave Wilson", service: "Montaje de TV", status: "Terminado", amount: "$150", date: "Ayer" },
    ],
    statuses: {
      newLead: "Lead nuevo",
      estimateSent: "Presupuesto enviado",
      scheduled: "Agendado",
      completed: "Terminado",
      paid: "Pagado",
    },
  },
};

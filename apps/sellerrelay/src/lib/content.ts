export const locales = ["en", "ru"] as const;
export type Locale = (typeof locales)[number];

export const pageSlugs = [
  "",
  "services",
  "how-it-works",
  "pricing",
  "international-sellers",
  "agencies",
  "faq",
  "get-a-quote",
  "contact",
  "privacy",
  "terms",
  "restricted-products",
  "thank-you",
] as const;
export type PageSlug = (typeof pageSlugs)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function isPageSlug(value: string): value is PageSlug {
  return pageSlugs.includes(value as PageSlug);
}

export const serviceIds = [
  "receiving",
  "inspection",
  "labeling",
  "packaging",
  "kitting",
  "storage",
  "forwarding",
  "returns",
] as const;

export type ServiceId = (typeof serviceIds)[number];

export type Service = {
  id: ServiceId;
  title: string;
  short: string;
  includes: string[];
  clientProvides: string[];
  result: string[];
  extras: string[];
  approval: string[];
};

type Faq = { question: string; answer: string };

type Copy = {
  localeName: string;
  nav: Array<{ slug: PageSlug; label: string }>;
  common: {
    getQuote: string;
    startPilot: string;
    learnMore: string;
    viewAll: string;
    requestQuote: string;
    backHome: string;
    california: string;
    amazonDisclaimer: string;
    availability: string;
    noShipWarning: string;
    initialResponse: string;
  };
  meta: Record<PageSlug, { title: string; description: string }>;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    trust: string[];
  };
  flow: string[];
  intro: {
    title: string;
    text: string;
    columns: Array<{ title: string; bullets: string[] }>;
  };
  servicesTitle: string;
  services: Service[];
  sixStepsTitle: string;
  sixSteps: Array<{ title: string; text: string }>;
  language: {
    title: string;
    text: string;
    bullets: string[];
    cta: string;
  };
  geography: { title: string; text: string };
  standards: { title: string; cards: Array<{ title: string; text: string }> };
  pilot: { title: string; subtitle: string; bullets: string[]; cta: string; note: string };
  agenciesTeaser: {
    title: string;
    subtitle: string;
    models: Array<{ title: string; text: string }>;
    cta: string;
  };
  finalCta: { title: string; text: string; note: string };
  howItWorks: {
    title: string;
    intro: string;
    steps: Array<{ title: string; text: string }>;
    notesTitle: string;
    notes: string[];
  };
  pricing: {
    title: string;
    intro: string;
    plans: Array<{ name: string; audience: string; items: string[]; cta: string; intent: string }>;
    factorsTitle: string;
    factors: string[];
    disclaimer: string;
  };
  international: {
    title: string;
    lead: string;
    points: Array<{ title: string; text: string }>;
    regionsTitle: string;
    regions: string[];
  };
  agencies: {
    title: string;
    lead: string;
    models: Array<{ title: string; text: string; items: string[] }>;
    formTitle: string;
  };
  faqTitle: string;
  faqs: Faq[];
  restricted: {
    title: string;
    intro: string;
    categories: string[];
    reviewTitle: string;
    reviewText: string;
    notAcceptedTitle: string;
    notAccepted: string[];
  };
  contact: {
    title: string;
    intro: string;
    formTitle: string;
    privacy: string;
  };
  privacy: {
    title: string;
    updated: string;
    sections: Array<{ title: string; paragraphs: string[]; bullets?: string[] }>;
  };
  terms: {
    title: string;
    updated: string;
    sections: Array<{ title: string; paragraphs: string[]; bullets?: string[] }>;
  };
};

const enServices: Service[] = [
  {
    id: "receiving",
    title: "Inventory Receiving",
    short: "We receive cartons and pallets, confirm arrival, verify quantities, and report visible shipping damage.",
    includes: ["Arrival confirmation", "Carton or pallet count", "Visible damage review", "Receiving record"],
    clientProvides: ["Approved shipment plan", "Carrier and tracking details", "Packing list", "SKU identification"],
    result: ["Receiving confirmation", "Count summary", "Exception notice when needed"],
    extras: ["Detailed unit count", "Photo documentation", "Oversize or pallet handling"],
    approval: ["Unscheduled deliveries", "Containers", "Temperature-sensitive or regulated products"],
  },
  {
    id: "inspection",
    title: "Product Inspection",
    short: "Visual inspection, count verification, sample checks, issue reporting, and product photos.",
    includes: ["Visual condition check", "Approved sample checks", "Count verification", "Issue documentation"],
    clientProvides: ["Inspection criteria", "Reference photos or specifications", "Accept/reject instructions"],
    result: ["Inspection summary", "Photos of agreed checks or identified issues", "Exception list"],
    extras: ["Expanded sampling", "Functional checks where suitable", "Sorting and rework"],
    approval: ["Destructive testing", "Special tools", "Certified or laboratory testing"],
  },
  {
    id: "labeling",
    title: "FNSKU Labeling",
    short: "We print and apply FNSKU labels, cover conflicting barcodes, and prepare units for FBA requirements.",
    includes: ["Label printing", "Accurate placement", "Conflicting barcode coverage", "Final spot check"],
    clientProvides: ["Correct FNSKU files", "SKU-to-label mapping", "Marketplace instructions"],
    result: ["Labeled units", "Quantity completion record", "Exception report"],
    extras: ["Removal of old labels", "Custom warning labels", "Label redesign support"],
    approval: ["Relabeling high-value goods", "Labels requiring regulatory review", "Unclear SKU mapping"],
  },
  {
    id: "packaging",
    title: "Packaging & Repackaging",
    short: "Polybagging, bubble wrap, protective materials, box replacement, and product repackaging.",
    includes: ["Approved protective packaging", "Polybagging", "Bubble wrap", "Box replacement where agreed"],
    clientProvides: ["Marketplace packaging rules", "Product fragility details", "Brand presentation requirements"],
    result: ["Prepared sellable units", "Material usage summary", "Issue report"],
    extras: ["Custom inserts", "Sealing", "Warning labels", "Retail-ready presentation"],
    approval: ["Food-contact packaging", "Hazmat materials", "Major product modification"],
  },
  {
    id: "kitting",
    title: "Bundling & Kitting",
    short: "We assemble multipacks, product sets, promotional bundles, and custom kits.",
    includes: ["Component matching", "Approved assembly", "Bundle labeling", "Final count check"],
    clientProvides: ["Bill of materials", "Assembly instructions", "SKU mapping", "Packaging design"],
    result: ["Completed kits", "Component variance report", "Finished quantity"],
    extras: ["Custom inserts", "Shrink wrap", "Complex assembly", "Rework"],
    approval: ["Electrical assembly", "Medical claims", "Child-product configurations", "Complex quality testing"],
  },
  {
    id: "storage",
    title: "Storage & Replenishment",
    short: "Store reserve inventory in the U.S. and replenish Amazon as needed.",
    includes: ["Reserve inventory storage", "Inventory tracking", "Approved replenishment releases", "Outbound coordination"],
    clientProvides: ["SKU list", "Replenishment instructions", "Forecast or release requests"],
    result: ["Storage status", "Release confirmation", "Outbound tracking"],
    extras: ["Long-term storage", "Pallet handling", "Cycle counts"],
    approval: ["Temperature control", "High-value goods", "Oversize inventory", "Special insurance requirements"],
  },
  {
    id: "forwarding",
    title: "FBA Forwarding",
    short: "We prepare outbound cartons or pallets and forward inventory to assigned fulfillment centers.",
    includes: ["Outbound carton preparation", "Box labels", "Carrier handoff", "Tracking confirmation"],
    clientProvides: ["Approved shipping plan", "Marketplace box labels", "Carrier instructions or shipping labels"],
    result: ["Shipment handoff", "Tracking", "Final status"],
    extras: ["Palletization", "Freight coordination", "Split shipment handling"],
    approval: ["International export", "Unusual carrier requirements", "Hazmat transportation"],
  },
  {
    id: "returns",
    title: "Removals & Returns",
    short: "We receive removals and returns, inspect products, photograph issues, repackage sellable units, forward inventory, or follow approved disposal instructions.",
    includes: ["Receiving", "Condition review", "Issue photos", "Disposition according to approved instructions"],
    clientProvides: ["Return or removal details", "Disposition rules", "Forwarding address when applicable"],
    result: ["Condition summary", "Recoverable quantity", "Forwarding or disposition record"],
    extras: ["Repackaging", "Testing", "Parts sorting", "Consolidation"],
    approval: ["Disposal", "Data-bearing electronics", "Hazardous or contaminated goods"],
  },
];

const ruServices: Service[] = [
  {
    id: "receiving",
    title: "Приёмка товара",
    short: "Принимаем коробки и паллеты, подтверждаем поступление, проверяем количество и фиксируем видимые повреждения при перевозке.",
    includes: ["Подтверждение поступления", "Подсчёт коробок или паллет", "Проверка видимых повреждений", "Запись о приёмке"],
    clientProvides: ["Согласованный план поставки", "Данные перевозчика и tracking", "Packing list", "Идентификацию SKU"],
    result: ["Подтверждение приёмки", "Сводка количества", "Уведомление о несоответствиях"],
    extras: ["Подробный пересчёт единиц", "Фотодокументация", "Работа с негабаритными грузами или паллетами"],
    approval: ["Несогласованные доставки", "Контейнеры", "Температурные и регулируемые товары"],
  },
  {
    id: "inspection",
    title: "Проверка продукции",
    short: "Визуальная проверка, пересчёт, выборочная инспекция, фиксация проблем и фотографии товара.",
    includes: ["Визуальная проверка состояния", "Согласованная выборочная проверка", "Пересчёт", "Документирование проблем"],
    clientProvides: ["Критерии инспекции", "Эталонные фото или спецификации", "Инструкции принять/отклонить"],
    result: ["Сводка проверки", "Фото согласованных проверок или найденных проблем", "Список исключений"],
    extras: ["Расширенная выборка", "Функциональные проверки, где применимо", "Сортировка и доработка"],
    approval: ["Разрушающие тесты", "Специальные инструменты", "Сертифицированные или лабораторные испытания"],
  },
  {
    id: "labeling",
    title: "Маркировка FNSKU",
    short: "Печатаем и наносим FNSKU, закрываем конфликтующие штрихкоды и подготавливаем товар к требованиям FBA.",
    includes: ["Печать этикеток", "Точное размещение", "Закрытие конфликтующих штрихкодов", "Финальная выборочная проверка"],
    clientProvides: ["Корректные файлы FNSKU", "Соответствие SKU и этикеток", "Инструкции маркетплейса"],
    result: ["Промаркированные единицы", "Отчёт о выполненном количестве", "Отчёт о несоответствиях"],
    extras: ["Удаление старых этикеток", "Предупреждающие наклейки", "Помощь с макетом этикетки"],
    approval: ["Перемаркировка дорогих товаров", "Регулируемые этикетки", "Неясное соответствие SKU"],
  },
  {
    id: "packaging",
    title: "Упаковка и переупаковка",
    short: "Пакеты, защитная плёнка, дополнительные материалы, замена коробок и переупаковка товара.",
    includes: ["Согласованная защитная упаковка", "Polybagging", "Bubble wrap", "Замена коробок по согласованию"],
    clientProvides: ["Требования маркетплейса", "Данные о хрупкости", "Требования к внешнему виду бренда"],
    result: ["Подготовленные товарные единицы", "Сводка материалов", "Отчёт о проблемах"],
    extras: ["Индивидуальные вкладыши", "Пломбирование", "Предупреждающие этикетки", "Retail-ready оформление"],
    approval: ["Упаковка для контакта с пищей", "Опасные материалы", "Существенная модификация товара"],
  },
  {
    id: "kitting",
    title: "Наборы и комплектация",
    short: "Собираем мультипаки, товарные комплекты, промо-наборы и индивидуальные киты.",
    includes: ["Сопоставление компонентов", "Согласованная сборка", "Маркировка наборов", "Финальный пересчёт"],
    clientProvides: ["Состав набора", "Инструкцию по сборке", "Соответствие SKU", "Макет упаковки"],
    result: ["Готовые наборы", "Отчёт о расхождениях компонентов", "Итоговое количество"],
    extras: ["Индивидуальные вкладыши", "Термоусадка", "Сложная сборка", "Доработка"],
    approval: ["Электрическая сборка", "Медицинские заявления", "Детские товары", "Сложный контроль качества"],
  },
  {
    id: "storage",
    title: "Хранение и пополнение",
    short: "Храним резервный запас в США и пополняем склады Amazon по мере необходимости.",
    includes: ["Хранение резерва", "Учёт запасов", "Согласованные пополнения", "Координация исходящих партий"],
    clientProvides: ["Список SKU", "Инструкции по пополнению", "Прогноз или запросы на отгрузку"],
    result: ["Статус хранения", "Подтверждение выпуска", "Tracking исходящей партии"],
    extras: ["Долгосрочное хранение", "Работа с паллетами", "Инвентаризация"],
    approval: ["Температурный режим", "Дорогие товары", "Негабарит", "Особые страховые требования"],
  },
  {
    id: "forwarding",
    title: "Отправка на FBA",
    short: "Подготавливаем исходящие коробки или паллеты и отправляем товар в назначенные fulfillment-центры.",
    includes: ["Подготовка исходящих коробок", "Box labels", "Передача перевозчику", "Подтверждение tracking"],
    clientProvides: ["Согласованный shipping plan", "Box labels маркетплейса", "Инструкции перевозчика или shipping labels"],
    result: ["Подтверждение передачи", "Tracking", "Финальный статус"],
    extras: ["Паллетирование", "Координация freight", "Разделение поставки"],
    approval: ["Международный экспорт", "Необычные требования перевозчика", "Перевозка hazmat"],
  },
  {
    id: "returns",
    title: "Removal orders и возвраты",
    short: "Принимаем removal orders и возвраты, проверяем товар, фотографируем проблемы, переупаковываем пригодные единицы, пересылаем продукцию или выполняем согласованные инструкции по утилизации.",
    includes: ["Приёмка", "Оценка состояния", "Фото проблем", "Обработка по согласованным инструкциям"],
    clientProvides: ["Данные возврата или removal order", "Правила дальнейших действий", "Адрес пересылки, если применимо"],
    result: ["Сводка состояния", "Количество восстановимых единиц", "Запись о пересылке или обработке"],
    extras: ["Переупаковка", "Тестирование", "Сортировка деталей", "Консолидация"],
    approval: ["Утилизация", "Электроника с данными", "Опасный или загрязнённый товар"],
  },
];

const enFaqs: Faq[] = [
  { question: "Do you work only with Russian-speaking sellers?", answer: "No. SellerRelay supports clients in English and Russian. The service is designed for international marketplace sellers who need a clear U.S. operating process." },
  { question: "Do I need to live in the United States?", answer: "No. You can remain outside the United States while SellerRelay manages the approved physical workflow for inventory inside the U.S." },
  { question: "Can I send a small pilot shipment?", answer: "Yes. Small pilot shipments are welcome when the product, documentation, and shipment plan are reviewed and approved in advance." },
  { question: "Do you provide a U.S. receiving address?", answer: "An assigned U.S. receiving address is provided after the product and shipment are reviewed and approved. Do not send inventory before receiving written instructions." },
  { question: "Can inventory ship directly from my manufacturer?", answer: "Often yes, provided the supplier follows the approved packing, labeling, documentation, carrier, and delivery instructions." },
  { question: "Do you inspect products?", answer: "Yes. Available inspection ranges from visible condition and count verification to agreed sample checks. Scope is documented before work begins." },
  { question: "Can you apply FNSKU labels?", answer: "Yes. You provide the correct FNSKU files and SKU mapping; SellerRelay prints, applies, and spot-checks the labels." },
  { question: "Do you provide polybagging and protective packaging?", answer: "Yes. Polybags, bubble wrap, protective materials, replacement boxes, and other approved packaging operations are available." },
  { question: "Can you create bundles and kits?", answer: "Yes. Multipacks, sets, promotional bundles, and custom kits can be assembled from written instructions and an approved bill of materials." },
  { question: "Do you store reserve inventory?", answer: "Yes, for approved products and capacity. Storage and replenishment pricing depends on product dimensions, handling, duration, and release frequency." },
  { question: "Do you handle Amazon removals?", answer: "Yes. SellerRelay can receive approved removal orders, document condition, repackage eligible units, consolidate, forward, or follow agreed disposition instructions." },
  { question: "Do you inspect returned products?", answer: "Yes, under an agreed inspection scope. SellerRelay can photograph issues and separate sellable, repairable, and non-sellable units." },
  { question: "Do you open Amazon seller accounts?", answer: "SellerRelay focuses on physical inventory preparation and logistics. Marketplace account registration and approval remain between the seller and the marketplace." },
  { question: "Do you need my Seller Central password?", answer: "Never send us your primary marketplace password. When limited access is required, use approved user permissions or partner access." },
  { question: "Can SellerRelay act as Importer of Record?", answer: "Importer of Record services are not included by default. International shipments may require a qualified customs broker and a separately approved import arrangement." },
  { question: "Do you accept every product category?", answer: "No. Acceptance depends on the product, documentation, seller, destination, compliance requirements, and current operational capacity." },
  { question: "How is pricing calculated?", answer: "Pricing reflects receiving, inspection, labels, packaging, materials, storage, transportation, special handling, product dimensions, and volume. Online estimates are not final quotations." },
  { question: "How quickly will I receive a quote?", answer: "The target for an initial response is within one business day. Final availability and pricing follow a review of the product and shipment details." },
  { question: "Where are you located?", answer: "SellerRelay operates in California, United States. The assigned receiving address is provided only after written shipment approval." },
  { question: "Are you affiliated with Amazon?", answer: "No. SellerRelay is an independent preparation and logistics service and is not affiliated with or endorsed by Amazon." },
];

const ruFaqs: Faq[] = [
  { question: "Вы работаете только с русскоязычными продавцами?", answer: "Нет. SellerRelay поддерживает клиентов на английском и русском языках. Сервис создан для международных продавцов, которым нужен понятный операционный процесс в США." },
  { question: "Мне обязательно жить в США?", answer: "Нет. Вы можете находиться за пределами США, а SellerRelay будет выполнять согласованную физическую работу с товаром внутри страны." },
  { question: "Можно отправить небольшую тестовую партию?", answer: "Да. Небольшие пилотные партии принимаются после предварительной проверки и согласования товара, документов и плана поставки." },
  { question: "Вы предоставляете адрес для приёмки в США?", answer: "Адрес для приёмки в США предоставляется после проверки и согласования товара и партии. Не отправляйте продукцию до получения письменных инструкций." },
  { question: "Можно отправить товар прямо от производителя?", answer: "Часто да, если поставщик соблюдает согласованные требования к упаковке, маркировке, документам, перевозчику и доставке." },
  { question: "Вы проверяете товары?", answer: "Да. Доступны визуальная проверка, пересчёт и согласованные выборочные проверки. Объём инспекции фиксируется до начала работ." },
  { question: "Вы наносите FNSKU?", answer: "Да. Клиент предоставляет корректные файлы FNSKU и соответствие SKU; SellerRelay печатает, наносит и выборочно проверяет этикетки." },
  { question: "Вы делаете polybagging и защитную упаковку?", answer: "Да. Доступны пакеты, bubble wrap, защитные материалы, замена коробок и другие согласованные операции." },
  { question: "Вы собираете наборы и комплекты?", answer: "Да. Мультипаки, комплекты, промо-наборы и индивидуальные киты собираются по письменной инструкции и согласованному составу." },
  { question: "Вы храните резервный запас?", answer: "Да, для согласованных товаров и при наличии мощности. Стоимость зависит от размеров, обработки, срока и частоты пополнений." },
  { question: "Вы обрабатываете removal orders Amazon?", answer: "Да. SellerRelay может принять согласованный removal order, зафиксировать состояние, переупаковать пригодные единицы, консолидировать, переслать или выполнить согласованные инструкции." },
  { question: "Вы проверяете возвращённые товары?", answer: "Да, по согласованным критериям. Можно сфотографировать проблемы и разделить товар на пригодный к продаже, восстановимый и непригодный." },
  { question: "Вы открываете аккаунты продавца Amazon?", answer: "SellerRelay занимается физической подготовкой товара и логистикой. Регистрация и одобрение аккаунта остаются между продавцом и маркетплейсом." },
  { question: "Вам нужен мой пароль Seller Central?", answer: "Никогда не передавайте нам основной пароль от аккаунта маркетплейса. Когда нужен ограниченный доступ, используйте разрешения для отдельного пользователя или партнёрский доступ." },
  { question: "SellerRelay может выступить Importer of Record?", answer: "Услуги Importer of Record не входят в стандартный пакет. Для международной поставки может потребоваться лицензированный таможенный брокер и отдельно согласованная схема импорта." },
  { question: "Вы принимаете любую категорию товаров?", answer: "Нет. Возможность приёма зависит от товара, документов, продавца, направления, требований и доступной операционной мощности." },
  { question: "Как рассчитывается стоимость?", answer: "Учитываются приёмка, инспекция, маркировка, упаковка, материалы, хранение, перевозка, особая обработка, размеры и объём. Онлайн-оценка не является финальным предложением." },
  { question: "Как быстро я получу расчёт?", answer: "Целевой срок первичного ответа — один рабочий день. Финальная доступность и стоимость подтверждаются после проверки товара и партии." },
  { question: "Где вы находитесь?", answer: "SellerRelay работает в Калифорнии, США. Адрес для приёмки предоставляется только после письменного подтверждения партии." },
  { question: "Вы связаны с Amazon?", answer: "Нет. SellerRelay является независимым сервисом подготовки и логистики и не аффилирован с Amazon." },
];

const sharedEnMeta: Record<PageSlug, { title: string; description: string }> = {
  "": { title: "SellerRelay | U.S. FBA Prep, Inspection & Logistics for International Sellers", description: "California-based receiving, inspection, FNSKU labeling, packaging, storage, FBA forwarding, removals, and returns support for international marketplace sellers." },
  services: { title: "FBA Prep & Inventory Services | SellerRelay", description: "Receiving, inspection, FNSKU labeling, packaging, kitting, storage, FBA forwarding, removals, and returns in the United States." },
  "how-it-works": { title: "How SellerRelay Works | U.S. Inventory Prep", description: "A clear workflow from shipment review and receiving instructions to inspection, prep, forwarding, and tracking." },
  pricing: { title: "FBA Prep Pricing & Custom Quotes | SellerRelay", description: "Pilot, recurring-volume, and agency pricing for U.S. receiving, prep, storage, forwarding, removals, and returns." },
  "international-sellers": { title: "U.S. Prep for International Marketplace Sellers | SellerRelay", description: "Keep control of your marketplace account while SellerRelay manages the approved physical inventory workflow in the United States." },
  agencies: { title: "White-Label U.S. Prep & Logistics for Agencies | SellerRelay", description: "Referral, managed, and white-label prep and logistics support for ecommerce agencies and consultants." },
  faq: { title: "SellerRelay FAQ | FBA Prep for International Sellers", description: "Answers about U.S. receiving addresses, pilot shipments, inspections, FNSKU labels, storage, removals, returns, and pricing." },
  "get-a-quote": { title: "Get a Custom FBA Prep Quote | SellerRelay", description: "Tell us about your product, volume, services, and timeline to receive a custom U.S. prep and logistics plan." },
  contact: { title: "Contact SellerRelay Logistics", description: "Contact SellerRelay about shipment quotes, active shipments, agency partnerships, warehouse partnerships, or general questions." },
  privacy: { title: "Privacy Policy | SellerRelay", description: "How SellerRelay collects, uses, stores, and protects information submitted through its website and service request forms." },
  terms: { title: "Terms of Service | SellerRelay", description: "Terms governing shipment approval, receiving instructions, subcontractors, pricing, compliance, returns, and logistics services." },
  "restricted-products": { title: "Restricted Products & Review Requirements | SellerRelay", description: "Product categories that require additional review, documentation, or written approval before shipping to SellerRelay." },
  "thank-you": { title: "Request Received | SellerRelay", description: "SellerRelay has received your request and will review your shipment information." },
};

const sharedRuMeta: Record<PageSlug, { title: string; description: string }> = {
  "": { title: "SellerRelay — подготовка товаров и логистика Amazon FBA в США", description: "Приёмка, проверка, маркировка FNSKU, упаковка, хранение, отправка на Amazon FBA и обработка возвратов для международных продавцов." },
  services: { title: "Услуги prep-центра и логистики в США | SellerRelay", description: "Приёмка, инспекция, FNSKU, упаковка, комплектация, хранение, отправка на FBA, removal orders и возвраты." },
  "how-it-works": { title: "Как работает SellerRelay | Подготовка товаров в США", description: "Понятный путь от проверки партии и выдачи адреса до приёмки, подготовки, отправки и tracking." },
  pricing: { title: "Стоимость подготовки товаров Amazon FBA | SellerRelay", description: "Персональный расчёт для тестовых, регулярных и агентских поставок в США." },
  "international-sellers": { title: "Prep-центр в США для международных продавцов | SellerRelay", description: "Вы управляете аккаунтом и выплатами, а SellerRelay выполняет согласованную физическую работу с товаром в США." },
  agencies: { title: "White-label prep и логистика для агентств | SellerRelay", description: "Referral, managed и white-label форматы для ecommerce-агентств и консультантов." },
  faq: { title: "Вопросы и ответы SellerRelay", description: "Ответы об адресе приёмки, тестовых партиях, инспекции, FNSKU, хранении, removal orders, возвратах и стоимости." },
  "get-a-quote": { title: "Получить расчёт подготовки и логистики | SellerRelay", description: "Укажите товар, объём, услуги и сроки, чтобы получить персональный план работы в США." },
  contact: { title: "Связаться с SellerRelay Logistics", description: "Вопросы по расчёту поставки, текущей партии, агентскому или складскому партнёрству." },
  privacy: { title: "Политика конфиденциальности | SellerRelay", description: "Как SellerRelay собирает, использует, хранит и защищает данные, отправленные через сайт." },
  terms: { title: "Условия обслуживания | SellerRelay", description: "Условия согласования партий, выдачи адреса, работы подрядчиков, стоимости, compliance, возвратов и логистики." },
  "restricted-products": { title: "Ограниченные категории товаров | SellerRelay", description: "Категории, для которых требуется дополнительная проверка, документы или письменное одобрение." },
  "thank-you": { title: "Заявка получена | SellerRelay", description: "SellerRelay получил информацию и проверит параметры вашей поставки." },
};

export const copy: Record<Locale, Copy> = {
  en: {
    localeName: "English",
    nav: [
      { slug: "services", label: "Services" },
      { slug: "how-it-works", label: "How It Works" },
      { slug: "pricing", label: "Pricing" },
      { slug: "international-sellers", label: "International Sellers" },
      { slug: "agencies", label: "For Agencies" },
      { slug: "faq", label: "FAQ" },
    ],
    common: {
      getQuote: "Get a Quote",
      startPilot: "Start a Pilot Shipment",
      learnMore: "Learn More",
      viewAll: "View All Questions",
      requestQuote: "Request a Quote",
      backHome: "Return to Home",
      california: "California, United States",
      amazonDisclaimer: "SellerRelay Logistics is an independent service provider and is not affiliated with, endorsed by, or sponsored by Amazon.com, Inc. or its affiliates.",
      availability: "Services are subject to product, shipment, documentation, compliance, and capacity review.",
      noShipWarning: "Do not ship inventory until you receive written shipment approval and receiving instructions from SellerRelay.",
      initialResponse: "Initial response within one business day. Final availability and pricing are confirmed after shipment review.",
    },
    meta: sharedEnMeta,
    hero: {
      eyebrow: "CALIFORNIA-BASED FBA PREP & LOGISTICS",
      title: "Your U.S. prep and logistics team for Amazon FBA",
      subtitle: "We receive, inspect, label, package, store, and forward your inventory in the United States — with dedicated support in Russian and English.",
      trust: ["California-based operations", "Russian-speaking support", "Small pilot shipments accepted", "Receiving, prep, storage, and returns"],
    },
    flow: ["Supplier", "SellerRelay in California", "Inspection & Prep", "Marketplace Fulfillment"],
    intro: {
      title: "You sell. We handle the physical work in the United States.",
      text: "Managing inventory from another country can be difficult. SellerRelay gives international sellers a reliable U.S. operations team that receives products, verifies quantities, identifies problems, prepares inventory, and forwards it to Amazon and other fulfillment channels.",
      columns: [
        { title: "Before Arrival", bullets: ["Product and shipment review", "Service selection", "Shipping instructions", "Receiving assignment"] },
        { title: "At SellerRelay", bullets: ["Receiving", "Count verification", "Inspection", "Photos", "Labeling", "Packaging", "Kitting and rework"] },
        { title: "After Preparation", bullets: ["Final quality check", "Outbound preparation", "FBA forwarding", "Tracking", "Reserve storage", "Removals and returns"] },
      ],
    },
    servicesTitle: "Everything your inventory needs before it reaches Amazon",
    services: enServices,
    sixStepsTitle: "From your supplier to Amazon in six clear steps",
    sixSteps: [
      { title: "Tell us about your shipment", text: "Share the product, quantity, dimensions, timeline, and required services." },
      { title: "Receive your quote", text: "SellerRelay reviews the shipment and prepares a custom service plan." },
      { title: "Get shipping instructions", text: "The receiving address is assigned only after the shipment is approved." },
      { title: "We receive and inspect", text: "Arrival is confirmed, quantities are checked, and problems are reported." },
      { title: "We prepare the inventory", text: "Labeling, packaging, bundling, kitting, rework, and other approved services are completed." },
      { title: "We forward it", text: "You receive final status and tracking information." },
    ],
    language: {
      title: "Amazon logistics without the language barrier",
      text: "SellerRelay was created for international entrepreneurs who need reliable physical support in the United States but want to discuss product instructions, shipment issues, labeling, returns, and costs in a language they understand.",
      bullets: ["Support in Russian and English", "Clear explanations without unnecessary warehouse jargon", "Help organizing SKU and shipment instructions", "Photos of identified issues", "One point of contact for the shipment", "Communication during U.S. business hours", "Ability to start with a small approved shipment"],
      cta: "Discuss Your First Shipment",
    },
    geography: {
      title: "Based in California. Supporting international sellers worldwide.",
      text: "We support eligible sellers from Eastern Europe, the Caucasus, Central Asia, Europe, and other international markets. Service availability depends on the seller, product category, documentation, destination, and applicable requirements.",
    },
    standards: {
      title: "What you receive with every approved shipment",
      cards: [
        { title: "Written Service Plan", text: "The approved scope, responsibilities, and exceptions are documented before work begins." },
        { title: "Receiving Confirmation", text: "You receive confirmation when the approved inbound shipment is checked in." },
        { title: "Count Verification", text: "Quantities are checked according to the approved receiving and inspection scope." },
        { title: "Exception Reporting", text: "Visible damage, shortages, or instruction conflicts are escalated for a decision." },
        { title: "Photo Support", text: "Photos are provided for agreed checks and identified issues; not every unit by default." },
        { title: "Final Tracking", text: "Outbound handoff and tracking are provided when the prepared inventory leaves the operation." },
      ],
    },
    pilot: {
      title: "Start with a small pilot shipment",
      subtitle: "Test our receiving, communication, inspection, and prep process before moving regular inventory.",
      bullets: ["Initial product review", "Custom quote", "Receiving instructions", "Arrival confirmation", "Approved prep services", "Final status", "Tracking"],
      cta: "Request Pilot Pricing",
      note: "Pilot shipments are subject to product and shipment approval.",
    },
    agenciesTeaser: {
      title: "Add U.S. prep and logistics to your client services",
      subtitle: "Support your marketplace clients without building your own warehouse operation.",
      models: [
        { title: "Referral partnership", text: "Introduce qualified clients and agree the commercial model separately." },
        { title: "Managed logistics partnership", text: "Remain the lead consultant while SellerRelay runs the physical workflow." },
        { title: "White-label operations", text: "Use an agreed white-label or co-branded process for your client portfolio." },
      ],
      cta: "Discuss an Agency Partnership",
    },
    finalCta: {
      title: "Tell us what you are shipping. We will map the U.S. workflow.",
      text: "Share your product, volume, and timeline to receive a custom preparation and logistics quote.",
      note: "Initial response within one business day. Final availability and pricing are confirmed after shipment review.",
    },
    howItWorks: {
      title: "A controlled path from your supplier to marketplace fulfillment",
      intro: "Each shipment starts with a review, written approval, and assigned receiving instructions. The workflow below keeps responsibilities, exceptions, and costs visible.",
      steps: [
        { title: "Preliminary request", text: "You submit product, volume, shipment, service, and timing information." },
        { title: "Product and shipment review", text: "We assess category, documentation, dimensions, risks, operational fit, and destination requirements." },
        { title: "Custom quote", text: "You receive a proposed service plan with pricing assumptions and separately billed items." },
        { title: "Written approval", text: "The shipment is accepted only after both sides confirm the scope and instructions." },
        { title: "Assigned receiving address", text: "A receiving address and delivery requirements are issued for the approved shipment." },
        { title: "Inbound shipment", text: "Your supplier or carrier sends the inventory according to the written instructions." },
        { title: "Receiving confirmation", text: "Arrival is recorded and communicated." },
        { title: "Count and inspection", text: "We complete the approved count, visible review, sample checks, and photo documentation." },
        { title: "Exception decision", text: "When a shortage, damage, mismatch, or unclear instruction appears, you receive options and approve the next step." },
        { title: "Prep operations", text: "Labeling, packaging, kitting, rework, or other authorized work is completed." },
        { title: "Final quality check", text: "The prepared units and outbound cartons are checked against the approved plan." },
        { title: "Outbound handoff", text: "Inventory is transferred to the approved parcel, freight, or marketplace shipping channel." },
        { title: "Tracking and completion", text: "You receive final status, tracking, and any remaining exception notes." },
      ],
      notesTitle: "Important operating rules",
      notes: ["The receiving address is provided only after written approval.", "You provide SKU, FNSKU, marketplace box labels, and shipping data when required.", "Additional work is approved before performance, except reasonable emergency actions needed to protect inventory.", "Transportation, materials, special handling, duties, brokerage, and third-party charges may be billed separately.", "Never provide your primary Seller Central password; use approved limited permissions when access is necessary."],
    },
    pricing: {
      title: "Custom pricing built around your product and workflow",
      intro: "Prep work is not one-size-fits-all. SellerRelay reviews the product, quantity, dimensions, services, materials, transportation, and capacity before confirming a final quote.",
      plans: [
        { name: "Pilot Shipment", audience: "For a first approved shipment.", items: ["Shipment review", "Custom service plan", "Receiving coordination", "Selected prep operations", "Final status and tracking"], cta: "Get Pilot Pricing", intent: "pilot_shipment" },
        { name: "Growth", audience: "For recurring inventory.", items: ["Volume-based pricing", "Saved SKU instructions", "Reserve storage", "Replenishment", "Recurring operational support"], cta: "Request Volume Pricing", intent: "custom_quote" },
        { name: "Agency", audience: "For agencies and multi-client workflows.", items: ["Dedicated workflows", "Managed communication", "White-label or co-branded reporting where agreed", "Custom rate card", "Client-protection terms subject to agreement"], cta: "Discuss Agency Pricing", intent: "agency" },
      ],
      factorsTitle: "What affects your quote",
      factors: ["Receiving", "Count verification", "Inspection", "FNSKU labels", "Polybags", "Protective packaging", "Bundling", "Kitting", "Rework", "Carton or pallet handling", "Storage", "Removals", "Returns", "Transportation", "Materials", "Special handling"],
      disclaimer: "Pricing depends on product type, quantity, dimensions, required services, storage, materials, transportation, and operational capacity. Online estimates are not final quotations.",
    },
    international: {
      title: "A U.S. operations team for international marketplace sellers",
      lead: "You keep control of your seller account and marketplace payouts. SellerRelay manages the physical U.S. workflow for approved inventory.",
      points: [
        { title: "Operate from abroad", text: "You do not need to live in the United States to use an approved receiving, prep, storage, and forwarding workflow." },
        { title: "Keep account control", text: "Your seller account, marketplace decisions, and payouts remain under your control." },
        { title: "No borrowed identities", text: "SellerRelay does not provide third-party documents, seller accounts, or guaranteed marketplace approval." },
        { title: "Start with a pilot", text: "Validate communication and operations with a small approved shipment before increasing volume." },
        { title: "Use your language", text: "Discuss product instructions, exceptions, returns, and costs in Russian or English." },
        { title: "Plan imports correctly", text: "International shipments may require a customs broker, Importer of Record arrangement, duties, and product documentation outside the standard prep service." },
      ],
      regionsTitle: "Regions we commonly support",
      regions: ["Ukraine", "Kazakhstan", "Armenia", "Georgia", "Uzbekistan", "Moldova", "Kyrgyzstan", "Azerbaijan", "Eastern Europe", "The Caucasus", "Central Asia", "European countries", "Other eligible international markets"],
    },
    agencies: {
      title: "U.S. prep and logistics for your marketplace clients",
      lead: "Add a physical U.S. operating layer to your client services without building your own warehouse team.",
      models: [
        { title: "Referral", text: "Your agency introduces a qualified seller. SellerRelay handles the approved logistics relationship, while referral and commercial terms are agreed separately.", items: ["Simple handoff", "Transparent client qualification", "Separate commercial agreement"] },
        { title: "Managed Partnership", text: "Your agency remains the main advisor while SellerRelay manages receiving, prep, storage, forwarding, and exception communication.", items: ["Shared operating plan", "Defined responsibilities", "Recurring client workflows"] },
        { title: "White Label", text: "SellerRelay performs approved operations within a white-label or co-branded process tailored to your client portfolio.", items: ["Custom reporting", "Agreed communication rules", "Client-protection terms subject to contract"] },
      ],
      formTitle: "Tell us about your agency and client volume",
    },
    faqTitle: "Questions international sellers ask before shipping",
    faqs: enFaqs,
    restricted: {
      title: "Products requiring additional review",
      intro: "Do not ship a regulated, fragile, high-value, oversized, branded resale, or unusual product until SellerRelay has reviewed it and issued written approval.",
      categories: ["Batteries", "Liquids", "Aerosols", "Hazardous materials", "Chemicals", "Food and beverages", "Supplements", "Cosmetics", "Medical products or medical claims", "Children’s products", "High-value goods", "Branded resale inventory", "Temperature-sensitive products", "Fragile or oversized inventory", "Products subject to special certification"],
      reviewTitle: "Documents we may request",
      reviewText: "Product acceptance is determined after review. SellerRelay may request invoices, safety documentation, brand authorization, certificates, testing records, customs information, or additional product details.",
      notAcceptedTitle: "Categories generally not accepted without an exceptional written agreement",
      notAccepted: ["Illegal or counterfeit goods", "Weapons, explosives, or controlled substances", "Products that cannot be lawfully transported or stored", "Unidentified chemicals", "Inventory with unresolved ownership or authorization concerns", "Products requiring capabilities not available for the proposed shipment"],
    },
    contact: {
      title: "Contact SellerRelay Logistics",
      intro: "Tell us whether you need a shipment quote, help with an existing approved shipment, an agency partnership, a warehouse partnership, or a general answer.",
      formTitle: "Send a secure message",
      privacy: "Do not send passwords, passports, bank details, or other unnecessary sensitive documents through this form.",
    },
    privacy: {
      title: "Privacy Policy",
      updated: "Working draft — August 5, 2026",
      sections: [
        { title: "1. Scope", paragraphs: ["This Privacy Policy explains how SellerRelay Logistics, operated by Amazing Seller LLC, collects and uses information submitted through the website, quote forms, contact forms, and service communications."] },
        { title: "2. Information we collect", paragraphs: ["We collect information you provide and limited technical information needed to operate and protect the website."], bullets: ["Identity and contact information", "Company, marketplace, product, SKU, volume, shipment, and service details", "Files you intentionally upload", "Communication preferences and consent records", "UTM parameters, referrer, language, device category, and basic security logs", "Correspondence and operational records related to an approved shipment"] },
        { title: "3. How we use information", paragraphs: ["We use information to review service eligibility, prepare quotes, communicate, perform approved operations, prevent fraud and spam, maintain records, improve the website, and comply with law."] },
        { title: "4. Service providers", paragraphs: ["Information may be shared with qualified warehouse, transportation, inspection, preparation, fulfillment, hosting, analytics, email, security, and professional service providers only as needed for the requested service or legal obligations."] },
        { title: "5. Storage and security", paragraphs: ["We use reasonable administrative, technical, and organizational safeguards. Uploaded documents are intended to be stored in private, access-controlled systems. No online system is completely risk-free."] },
        { title: "6. Retention", paragraphs: ["We retain lead and operational information for as long as reasonably necessary for quotes, services, disputes, legal requirements, accounting, security, and legitimate business records. Retention periods may vary by record type and jurisdiction."] },
        { title: "7. Cookies and analytics", paragraphs: ["The website may use essential storage for language and form progress. Optional analytics or marketing cookies should be activated only after the applicable consent and configuration requirements are met."] },
        { title: "8. Your choices and rights", paragraphs: ["Depending on your location, you may have rights to request access, correction, deletion, restriction, or information about disclosures. Some records may be retained where legally permitted or required."] },
        { title: "9. International processing", paragraphs: ["Information submitted from outside the United States may be processed in the United States and other locations where approved service providers operate."] },
        { title: "10. Contact", paragraphs: ["Use the SellerRelay contact form and select a privacy-related topic. A dedicated privacy email may be published once the mailbox is confirmed operational."] },
      ],
    },
    terms: {
      title: "Terms of Service",
      updated: "Working draft — August 5, 2026",
      sections: [
        { title: "1. Operator and service", paragraphs: ["SellerRelay Logistics is operated by Amazing Seller LLC. SellerRelay provides approved receiving, inspection, labeling, preparation, packaging, storage, forwarding, returns, removals, and related coordination services."] },
        { title: "2. Shipment approval", paragraphs: ["No product or shipment is accepted until SellerRelay completes a review and provides written approval. A receiving address is assigned only for an approved shipment. Sending inventory without approval may result in refusal, delay, return, storage, or other charges."] },
        { title: "3. Client information and compliance", paragraphs: ["The client is responsible for accurate product, ownership, quantity, value, category, customs, safety, marketplace, and documentation information. Regulated products may require invoices, certificates, safety data, brand authorization, tests, or other records."] },
        { title: "4. Independent marketplace status", paragraphs: ["SellerRelay is independent from Amazon and other marketplaces. SellerRelay does not guarantee account approval, listing approval, shipment acceptance, marketplace performance, or the absence of marketplace restrictions."] },
        { title: "5. Subcontractors and service providers", paragraphs: ["Certain warehouse, transportation, inspection, preparation, and fulfillment operations may be performed by qualified subcontractors and service providers selected and managed by SellerRelay."] },
        { title: "6. Quotes, fees, and changes", paragraphs: ["Pricing and timelines are confirmed separately after review. Materials, transportation, duties, brokerage, carrier fees, storage, special handling, rework, and third-party charges may be billed separately. Additional work is normally approved before performance, except reasonable emergency actions needed to protect inventory or people."] },
        { title: "7. Imports and taxes", paragraphs: ["Importer of Record, customs brokerage, duties, taxes, product registration, and regulatory representation are not included unless expressly agreed in writing."] },
        { title: "8. Inventory condition and exceptions", paragraphs: ["Receiving and inspection are limited to the agreed scope. Concealed defects, manufacturing defects, carrier damage, shortages, and instruction conflicts may require a client decision and additional work."] },
        { title: "9. Returns, removals, damage, and unclaimed goods", paragraphs: ["The process for damage, returns, removals, disposal, abandoned or unclaimed inventory, and claim deadlines is governed by the applicable quote, service plan, operating instructions, and any signed agreement."] },
        { title: "10. Account access and security", paragraphs: ["Clients must not provide a primary marketplace password. When limited access is necessary, clients should use approved user permissions or partner access and revoke access when no longer needed."] },
        { title: "11. Limitation and final agreement", paragraphs: ["The final commercial agreement, approved service plan, and applicable law may add or replace terms in this website draft. These Terms should be reviewed by licensed counsel before large-scale paid acquisition or complex regulated shipments."] },
      ],
    },
  },
  ru: {
    localeName: "Русский",
    nav: [
      { slug: "services", label: "Услуги" },
      { slug: "how-it-works", label: "Как это работает" },
      { slug: "pricing", label: "Стоимость" },
      { slug: "international-sellers", label: "Международным продавцам" },
      { slug: "agencies", label: "Агентствам" },
      { slug: "faq", label: "Вопросы и ответы" },
    ],
    common: {
      getQuote: "Получить расчёт",
      startPilot: "Отправить тестовую партию",
      learnMore: "Подробнее",
      viewAll: "Все вопросы",
      requestQuote: "Получить расчёт",
      backHome: "Вернуться на главную",
      california: "Калифорния, США",
      amazonDisclaimer: "SellerRelay Logistics является независимым поставщиком услуг и не аффилирован, не одобрен и не спонсируется Amazon.com, Inc. или её аффилированными лицами.",
      availability: "Услуги предоставляются после проверки товара, партии, документов, compliance и доступной операционной мощности.",
      noShipWarning: "Не отправляйте товар до получения письменного подтверждения партии и инструкций по приёмке от SellerRelay.",
      initialResponse: "Первичный ответ — в течение одного рабочего дня. Возможность обслуживания и итоговая стоимость подтверждаются после проверки партии.",
    },
    meta: sharedRuMeta,
    hero: {
      eyebrow: "ПОДГОТОВКА ТОВАРОВ И ЛОГИСТИКА В КАЛИФОРНИИ",
      title: "Ваша команда по подготовке товаров для Amazon в США",
      subtitle: "Мы принимаем, проверяем, маркируем, упаковываем, храним и отправляем ваши товары на Amazon — с полноценной поддержкой на русском и английском языках.",
      trust: ["Работаем в Калифорнии", "Поддержка на русском языке", "Принимаем небольшие тестовые партии", "Приёмка, подготовка, хранение и возвраты"],
    },
    flow: ["Поставщик", "SellerRelay в Калифорнии", "Проверка и подготовка", "Отправка в fulfillment-центр"],
    intro: {
      title: "Вы продаёте. Мы выполняем физическую работу с товаром в США.",
      text: "Управлять товаром из другой страны сложно. SellerRelay предоставляет международным продавцам команду в США, которая принимает продукцию, проверяет количество, выявляет проблемы, подготавливает товар и отправляет его на Amazon и в другие каналы выполнения заказов.",
      columns: [
        { title: "До поступления", bullets: ["Проверка товара и поставки", "Выбор услуг", "Инструкции по отправке", "Назначение приёмки"] },
        { title: "На этапе SellerRelay", bullets: ["Приёмка", "Проверка количества", "Инспекция", "Фотографии", "Маркировка", "Упаковка", "Комплектация и доработка"] },
        { title: "После подготовки", bullets: ["Финальная проверка качества", "Подготовка исходящей партии", "Отправка на FBA", "Tracking", "Хранение резерва", "Removal orders и возвраты"] },
      ],
    },
    servicesTitle: "Всё, что требуется вашему товару перед отправкой на Amazon",
    services: ruServices,
    sixStepsTitle: "От поставщика до Amazon за шесть понятных шагов",
    sixSteps: [
      { title: "Расскажите о поставке", text: "Укажите товар, количество, размеры, сроки и необходимые услуги." },
      { title: "Получите расчёт", text: "SellerRelay проверяет партию и готовит персональный план работ." },
      { title: "Получите инструкции", text: "Адрес для приёмки назначается только после согласования поставки." },
      { title: "Мы принимаем и проверяем", text: "Подтверждаем поступление, проверяем количество и сообщаем о проблемах." },
      { title: "Мы подготавливаем товар", text: "Выполняем маркировку, упаковку, комплектацию, доработку и другие согласованные операции." },
      { title: "Мы отправляем партию", text: "Вы получаете финальный статус и tracking." },
    ],
    language: {
      title: "Логистика Amazon без языкового барьера",
      text: "SellerRelay создан для международных предпринимателей, которым нужна надёжная физическая поддержка в США и возможность обсуждать инструкции, маркировку, проблемы с поставками, возвраты и стоимость на понятном языке.",
      bullets: ["Поддержка на русском и английском", "Понятные объяснения без лишнего складского жаргона", "Помощь в организации SKU и инструкций", "Фото обнаруженных проблем", "Одна точка коммуникации по поставке", "Связь в рабочее время США", "Возможность начать с небольшой согласованной партии"],
      cta: "Обсудить первую поставку",
    },
    geography: {
      title: "Работаем в Калифорнии. Поддерживаем международных продавцов по всему миру.",
      text: "Мы поддерживаем подходящих продавцов из Восточной Европы, Кавказа, Центральной Азии, европейских стран и других международных рынков. Возможность обслуживания зависит от продавца, категории товара, документов, направления и применимых требований.",
    },
    standards: {
      title: "Что вы получаете с каждой согласованной поставкой",
      cards: [
        { title: "Письменный план работ", text: "Объём услуг, ответственность и исключения фиксируются до начала работ." },
        { title: "Подтверждение поступления", text: "Вы получаете уведомление, когда согласованная входящая партия принята." },
        { title: "Проверка количества", text: "Количество проверяется в рамках согласованной приёмки и инспекции." },
        { title: "Отчёт о несоответствиях", text: "Повреждения, недостача или конфликт инструкций передаются вам для решения." },
        { title: "Фотоподтверждение", text: "Фото предоставляются для согласованных проверок и обнаруженных проблем, но не каждой единицы по умолчанию." },
        { title: "Итоговый tracking", text: "После передачи исходящей партии вы получаете финальный статус и tracking." },
      ],
    },
    pilot: {
      title: "Начните с небольшой тестовой партии",
      subtitle: "Проверьте приёмку, коммуникацию, инспекцию и подготовку товара перед отправкой регулярных объёмов.",
      bullets: ["Первичная проверка товара", "Персональный расчёт", "Инструкции по приёмке", "Подтверждение поступления", "Согласованные prep-операции", "Финальный статус", "Tracking"],
      cta: "Получить расчёт тестовой партии",
      note: "Тестовые партии принимаются после проверки и согласования товара и поставки.",
    },
    agenciesTeaser: {
      title: "Добавьте подготовку и логистику в США к услугам вашего агентства",
      subtitle: "Обслуживайте клиентов маркетплейсов без создания собственного складского отдела.",
      models: [
        { title: "Referral partnership", text: "Передавайте подходящих клиентов и отдельно согласуйте коммерческую модель." },
        { title: "Managed logistics partnership", text: "Оставайтесь главным консультантом, а SellerRelay выполнит физическую работу." },
        { title: "White-label operations", text: "Используйте согласованный white-label или co-branded процесс для портфеля клиентов." },
      ],
      cta: "Обсудить партнёрство",
    },
    finalCta: {
      title: "Расскажите, какой товар вы отправляете. Мы подготовим план работы в США.",
      text: "Укажите товар, объём и сроки, чтобы получить персональный расчёт подготовки и логистики.",
      note: "Первичный ответ — в течение одного рабочего дня. Возможность обслуживания и итоговая стоимость подтверждаются после проверки партии.",
    },
    howItWorks: {
      title: "Контролируемый путь от поставщика до fulfillment-центра",
      intro: "Каждая поставка начинается с проверки, письменного согласования и выдачи инструкций по приёмке. Процесс ниже делает ответственность, исключения и стоимость прозрачными.",
      steps: [
        { title: "Предварительная заявка", text: "Вы отправляете данные о товаре, объёме, партии, услугах и сроках." },
        { title: "Проверка товара и партии", text: "Мы оцениваем категорию, документы, размеры, риски, операционную совместимость и требования направления." },
        { title: "Персональный расчёт", text: "Вы получаете предложенный план услуг, предпосылки цены и отдельно оплачиваемые позиции." },
        { title: "Письменное подтверждение", text: "Партия принимается только после подтверждения объёма работ и инструкций обеими сторонами." },
        { title: "Назначение адреса", text: "Для согласованной поставки выдаются адрес приёмки и требования к доставке." },
        { title: "Входящая отправка", text: "Поставщик или перевозчик отправляет товар по письменным инструкциям." },
        { title: "Подтверждение приёмки", text: "Поступление фиксируется и подтверждается клиенту." },
        { title: "Пересчёт и инспекция", text: "Выполняются согласованный пересчёт, визуальная проверка, выборка и фотодокументация." },
        { title: "Решение по исключениям", text: "При недостаче, повреждении, несоответствии или неясной инструкции вы получаете варианты и согласуете следующий шаг." },
        { title: "Prep-операции", text: "Выполняются маркировка, упаковка, комплектация, доработка и другие разрешённые работы." },
        { title: "Финальная проверка", text: "Подготовленные единицы и исходящие коробки сверяются с согласованным планом." },
        { title: "Передача исходящей партии", text: "Товар передаётся в согласованный parcel, freight или marketplace-канал." },
        { title: "Tracking и завершение", text: "Вы получаете финальный статус, tracking и оставшиеся замечания." },
      ],
      notesTitle: "Важные правила работы",
      notes: ["Адрес приёмки выдаётся только после письменного подтверждения.", "Клиент предоставляет SKU, FNSKU, box labels маркетплейса и shipping-данные, когда это требуется.", "Дополнительные работы согласовываются до выполнения, кроме разумных аварийных действий для защиты товара или людей.", "Перевозка, материалы, особая обработка, пошлины, брокерские и сторонние сборы могут оплачиваться отдельно.", "Не передавайте основной пароль Seller Central; используйте ограниченные разрешения, когда доступ действительно нужен."],
    },
    pricing: {
      title: "Персональная стоимость под ваш товар и процесс",
      intro: "Подготовка товара не бывает одинаковой для всех. SellerRelay проверяет категорию, количество, размеры, услуги, материалы, транспорт и доступную мощность до подтверждения финальной цены.",
      plans: [
        { name: "Pilot Shipment", audience: "Для первой согласованной партии.", items: ["Проверка партии", "Персональный план услуг", "Координация приёмки", "Выбранные prep-операции", "Финальный статус и tracking"], cta: "Получить расчёт пилотной партии", intent: "pilot_shipment" },
        { name: "Growth", audience: "Для регулярных поставок.", items: ["Цена с учётом объёма", "Сохранённые инструкции SKU", "Хранение резерва", "Пополнение", "Регулярная операционная поддержка"], cta: "Запросить цену по объёму", intent: "custom_quote" },
        { name: "Agency", audience: "Для агентств и нескольких клиентских процессов.", items: ["Выделенные процессы", "Управляемая коммуникация", "White-label или co-branded отчётность по согласованию", "Индивидуальная rate card", "Условия защиты клиентов по договору"], cta: "Обсудить цены для агентства", intent: "agency" },
      ],
      factorsTitle: "Из чего складывается стоимость",
      factors: ["Приёмка", "Проверка количества", "Инспекция", "FNSKU", "Пакеты", "Защитная упаковка", "Наборы", "Комплектация", "Доработка", "Работа с коробками или паллетами", "Хранение", "Removal orders", "Возвраты", "Перевозка", "Материалы", "Особая обработка"],
      disclaimer: "Стоимость зависит от категории товара, количества, размеров, необходимых операций, хранения, материалов, доставки и доступной операционной мощности. Онлайн-оценка не является окончательным предложением.",
    },
    international: {
      title: "Операционная команда в США для международных продавцов маркетплейсов",
      lead: "Вы сохраняете контроль над аккаунтом продавца и выплатами маркетплейса. SellerRelay управляет физическим процессом работы с согласованным товаром в США.",
      points: [
        { title: "Работайте из другой страны", text: "Для использования согласованной приёмки, подготовки, хранения и отправки не обязательно жить в США." },
        { title: "Сохраняйте контроль аккаунта", text: "Аккаунт продавца, решения на маркетплейсе и выплаты остаются под вашим контролем." },
        { title: "Без чужих документов", text: "SellerRelay не предоставляет документы третьих лиц, аккаунты продавца или гарантии одобрения маркетплейсом." },
        { title: "Начните с пилота", text: "Проверьте коммуникацию и операции на небольшой согласованной партии перед ростом объёма." },
        { title: "Общайтесь на понятном языке", text: "Обсуждайте инструкции, проблемы, возвраты и стоимость на русском или английском." },
        { title: "Правильно организуйте импорт", text: "Для международной поставки могут потребоваться таможенный брокер, Importer of Record, пошлины и документы, не входящие в стандартный prep-сервис." },
      ],
      regionsTitle: "Основные регионы аудитории",
      regions: ["Украина", "Казахстан", "Армения", "Грузия", "Узбекистан", "Молдова", "Кыргызстан", "Азербайджан", "Восточная Европа", "Кавказ", "Центральная Азия", "Европейские страны", "Другие подходящие международные рынки"],
    },
    agencies: {
      title: "Подготовка и логистика в США для клиентов вашего агентства",
      lead: "Добавьте физическую операционную работу в США к своим услугам без создания собственной складской команды.",
      models: [
        { title: "Referral", text: "Агентство передаёт квалифицированного продавца. SellerRelay ведёт согласованный логистический процесс, а referral и коммерческие условия фиксируются отдельно.", items: ["Простая передача", "Понятная квалификация", "Отдельное коммерческое соглашение"] },
        { title: "Managed Partnership", text: "Агентство остаётся главным консультантом, а SellerRelay управляет приёмкой, prep, хранением, отправкой и коммуникацией по исключениям.", items: ["Общий операционный план", "Разделённая ответственность", "Регулярные клиентские процессы"] },
        { title: "White Label", text: "SellerRelay выполняет согласованные операции в рамках white-label или co-branded процесса для портфеля агентства.", items: ["Индивидуальная отчётность", "Согласованные правила коммуникации", "Условия защиты клиента по договору"] },
      ],
      formTitle: "Расскажите об агентстве и объёме клиентов",
    },
    faqTitle: "Вопросы, которые международные продавцы задают до отправки",
    faqs: ruFaqs,
    restricted: {
      title: "Товары, требующие дополнительной проверки",
      intro: "Не отправляйте регулируемый, хрупкий, дорогой, негабаритный, branded resale или необычный товар, пока SellerRelay не проверит его и не выдаст письменное согласование.",
      categories: ["Батареи", "Жидкости", "Аэрозоли", "Опасные материалы", "Химикаты", "Еда и напитки", "БАДы", "Косметика", "Медицинские товары или заявления", "Детские товары", "Дорогие товары", "Branded resale inventory", "Товары с температурным режимом", "Хрупкий или негабаритный товар", "Товары со специальной сертификацией"],
      reviewTitle: "Какие документы могут потребоваться",
      reviewText: "Возможность приёма товара определяется после проверки. SellerRelay может запросить invoices, документы по безопасности, разрешение бренда, сертификаты, результаты тестов, таможенные данные или дополнительную информацию о продукции.",
      notAcceptedTitle: "Категории, которые обычно не принимаются без исключительного письменного соглашения",
      notAccepted: ["Незаконные или контрафактные товары", "Оружие, взрывчатые вещества или контролируемые вещества", "Товары, которые нельзя законно перевозить или хранить", "Неидентифицированные химикаты", "Товар с нерешёнными вопросами собственности или авторизации", "Товары, для которых нет необходимых операционных возможностей"],
    },
    contact: {
      title: "Связаться с SellerRelay Logistics",
      intro: "Укажите, нужен ли вам расчёт, помощь с действующей согласованной поставкой, агентское или складское партнёрство либо общий ответ.",
      formTitle: "Отправить защищённое сообщение",
      privacy: "Не отправляйте через форму пароли, паспорта, банковские данные или другие лишние чувствительные документы.",
    },
    privacy: {
      title: "Политика конфиденциальности",
      updated: "Рабочий черновик — 5 августа 2026 года",
      sections: [
        { title: "1. Область действия", paragraphs: ["Эта Политика объясняет, как SellerRelay Logistics, управляемый Amazing Seller LLC, собирает и использует информацию из сайта, форм расчёта, контактных форм и коммуникаций по услугам."] },
        { title: "2. Какие данные мы собираем", paragraphs: ["Мы собираем предоставленные вами данные и ограниченную техническую информацию, необходимую для работы и защиты сайта."], bullets: ["Имя и контактные данные", "Компания, маркетплейсы, товар, SKU, объём, поставка и необходимые услуги", "Файлы, которые вы сознательно загружаете", "Предпочтения коммуникации и записи согласий", "UTM, referrer, язык, категория устройства и базовые security-логи", "Переписка и операционные записи по согласованной поставке"] },
        { title: "3. Как используются данные", paragraphs: ["Данные используются для проверки возможности обслуживания, подготовки расчёта, коммуникации, выполнения согласованных операций, защиты от спама и мошенничества, ведения записей, улучшения сайта и выполнения закона."] },
        { title: "4. Поставщики услуг", paragraphs: ["Информация может передаваться квалифицированным складским, транспортным, инспекционным, prep-, fulfillment-, hosting-, analytics-, email-, security- и профессиональным поставщикам только в объёме, необходимом для услуги или закона."] },
        { title: "5. Хранение и безопасность", paragraphs: ["Мы применяем разумные административные, технические и организационные меры. Загруженные документы должны храниться в закрытых системах с контролем доступа. Ни одна онлайн-система не исключает риск полностью."] },
        { title: "6. Сроки хранения", paragraphs: ["Лиды и операционные записи хранятся столько, сколько разумно необходимо для расчётов, услуг, споров, закона, бухгалтерии, безопасности и деловой документации. Сроки зависят от типа записи и юрисдикции."] },
        { title: "7. Cookies и аналитика", paragraphs: ["Сайт может использовать обязательное локальное хранение для языка и прогресса формы. Необязательная аналитика или marketing cookies должны включаться только после выполнения требований по согласию и настройке."] },
        { title: "8. Ваш выбор и права", paragraphs: ["В зависимости от места нахождения вы можете иметь право запросить доступ, исправление, удаление, ограничение или информацию о раскрытии. Некоторые записи могут сохраняться, когда это разрешено или требуется законом."] },
        { title: "9. Международная обработка", paragraphs: ["Данные, отправленные из-за пределов США, могут обрабатываться в США и других местах работы согласованных поставщиков услуг."] },
        { title: "10. Связь по вопросам данных", paragraphs: ["Используйте контактную форму SellerRelay и выберите тему, связанную с конфиденциальностью. Отдельный email будет опубликован после подтверждения работоспособности почтового ящика."] },
      ],
    },
    terms: {
      title: "Условия обслуживания",
      updated: "Рабочий черновик — 5 августа 2026 года",
      sections: [
        { title: "1. Оператор и услуги", paragraphs: ["SellerRelay Logistics управляется Amazing Seller LLC. SellerRelay предоставляет согласованные услуги приёмки, инспекции, маркировки, подготовки, упаковки, хранения, отправки, возвратов, removal orders и связанной координации."] },
        { title: "2. Согласование поставки", paragraphs: ["Ни товар, ни поставка не принимаются до проверки и письменного подтверждения SellerRelay. Адрес назначается только для согласованной партии. Несогласованная отправка может быть отклонена, задержана, возвращена или повлечь расходы на хранение и обработку."] },
        { title: "3. Информация клиента и compliance", paragraphs: ["Клиент отвечает за точные данные о товаре, собственности, количестве, стоимости, категории, таможне, безопасности, маркетплейсе и документах. Для регулируемых товаров могут потребоваться invoices, сертификаты, safety data, разрешение бренда, тесты и другие записи."] },
        { title: "4. Независимость от маркетплейсов", paragraphs: ["SellerRelay независим от Amazon и других маркетплейсов. SellerRelay не гарантирует одобрение аккаунта, листинга, поставки, показатели продаж или отсутствие ограничений маркетплейса."] },
        { title: "5. Подрядчики и поставщики услуг", paragraphs: ["Отдельные складские, транспортные, инспекционные, подготовительные и логистические операции могут выполняться квалифицированными подрядчиками и поставщиками услуг, выбранными и управляемыми SellerRelay."] },
        { title: "6. Расчёты, сборы и изменения", paragraphs: ["Стоимость и сроки подтверждаются отдельно после проверки. Материалы, перевозка, пошлины, брокерские услуги, carrier fees, хранение, special handling, доработка и сторонние сборы могут оплачиваться отдельно. Дополнительные работы обычно согласовываются заранее, кроме разумных аварийных действий для защиты товара или людей."] },
        { title: "7. Импорт и налоги", paragraphs: ["Importer of Record, таможенный брокер, пошлины, налоги, регистрация товара и регуляторное представительство не включены, если иное прямо не согласовано письменно."] },
        { title: "8. Состояние товара и исключения", paragraphs: ["Приёмка и инспекция ограничены согласованным объёмом. Скрытые дефекты, производственные проблемы, повреждения перевозчиком, недостача и конфликт инструкций могут потребовать решения клиента и дополнительных работ."] },
        { title: "9. Возвраты, removal orders, повреждения и невостребованный товар", paragraphs: ["Порядок работы с повреждениями, возвратами, removal orders, утилизацией и невостребованным товаром определяется расчётом, планом услуг, операционными инструкциями и подписанным соглашением."] },
        { title: "10. Доступ к аккаунту и безопасность", paragraphs: ["Клиент не должен передавать основной пароль маркетплейса. Когда нужен ограниченный доступ, следует использовать разрешения отдельного пользователя или партнёрский доступ и отзывать его после завершения необходимости."] },
        { title: "11. Ограничения и финальное соглашение", paragraphs: ["Итоговое коммерческое соглашение, согласованный план услуг и применимое право могут дополнять или заменять положения этого черновика. Условия следует проверить у лицензированного юриста до масштабной рекламы или сложных регулируемых поставок."] },
      ],
    },
  },
};

export const routeLabel: Record<Locale, Record<PageSlug, string>> = {
  en: {
    "": "Home",
    services: "Services",
    "how-it-works": "How It Works",
    pricing: "Pricing",
    "international-sellers": "International Sellers",
    agencies: "For Agencies",
    faq: "FAQ",
    "get-a-quote": "Get a Quote",
    contact: "Contact",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    "restricted-products": "Restricted Products",
    "thank-you": "Thank You",
  },
  ru: {
    "": "Главная",
    services: "Услуги",
    "how-it-works": "Как это работает",
    pricing: "Стоимость",
    "international-sellers": "Международным продавцам",
    agencies: "Агентствам",
    faq: "Вопросы и ответы",
    "get-a-quote": "Получить расчёт",
    contact: "Контакты",
    privacy: "Политика конфиденциальности",
    terms: "Условия обслуживания",
    "restricted-products": "Ограниченные товары",
    "thank-you": "Спасибо",
  },
};

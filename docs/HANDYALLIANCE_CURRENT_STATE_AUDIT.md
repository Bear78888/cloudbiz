# HANDYALLIANCE — CURRENT STATE AUDIT (Этап 0)

**Дата:** 2026-08-04
**Автор:** AI-разработчик (Claude Code, сессия Этапа 0)
**Статус:** черновик для утверждения владельцем
**Основание:** `docs/handyalliance/MASTER_SPEC.md` (v2.1), разделы §00.1b, §35 «Этап 0»

> Расположение: канонические копии этого документа и мастер-ТЗ находятся в репозитории платформы `Bear78888/cloudbiz` (`docs/MASTER_SPEC.md`, `docs/HANDYALLIANCE_CURRENT_STATE_AUDIT.md`) — перенесены 2026-08-04 согласно §00.0.2 мастер-ТЗ. Исходные копии в `Bear78888/bizmetria.ai` (`docs/handyalliance/`) с этого момента неканоничны.

---

## 1. Итог в трёх предложениях

1. Репозиторий платформы уже существует: **`Bear78888/cloudbiz`** («временное имя, позже — `handyalliance-platform`», по README) — в `main` только README, а в draft PR #1 (`claude/public-site-design`) параллельная сессия строит двуязычный публичный сайт по §7.
2. Отдельных репозиториев CallBrixa / RefundMyLead / старого HandyAlliance в аккаунте `Bear78888` **нет** — из кода доступна только BizMetria; наработки CallBrixa живут на платформе **Retell AI** (подтверждено владельцем 2026-08-04), материалы RefundMyLead — вне GitHub (сайт, шаблоны, Boss Sheet).
3. BizMetria даёт готовые, проверенные паттерны почти для всего фундамента Этапа 1: Supabase (клиенты/миграции/RLS), Stripe Checkout + webhook, Resend, i18n en/es с контролем ключей, AI-пайплайн со structured output и Retell-интеграцию (agent provisioning + webhook) — детальная карта в §4.

## 2. Инвентарь репозиториев и активов

| Актив | Состояние на 2026-08-04 | Вывод для проекта |
|---|---|---|
| `Bear78888/cloudbiz` | Репозиторий платформы HandyAlliance. `main` = README + .gitignore (1 коммит). Ветка `claude/public-site-design` + draft PR #1: Next.js App Router, `[locale]`-роутинг, словари `src/lib/i18n/en.ts`/`es.ts`, `pricing.ts`, `routes.ts`, страницы §7 | Строить платформу здесь. Backend не начат («pending owner access») |
| `Bear78888/bizmetria.ai` | Живой продукт (assessment-платформа), активный `main`, CI, тесты, Supabase-миграции | Источник паттернов (§4). В платформу не сливать — только переиспользование кода |
| CallBrixa | Отдельного репозитория НЕТ. Голосовой агент работает на **Retell AI**; демо-номер 213-816-5979; сайт callbrixa.com | Запросить доступ к дашборду Retell (аккаунт, API key, номера, webhook secret). Паттерн интеграции Retell уже есть в BizMetria |
| RefundMyLead | Отдельного репозитория НЕТ. Материалы: refundmylead.com, шаблоны dispute-писем, SEO-семантика, креативы, Meta Pixel | Запросить экспорт материалов у владельца (файлы/доступы) |
| Handyman Boss Sheet | `Handyman_Boss_Sheet_EN-1.xlsx` + `HANDYMAN_BOSS_APP_TZ.md` — в репозиториях не найдены | Запросить файлы у владельца (прототип Job Tracker §13) |
| Старый лендинг HandyAlliance | `handyalliance.html`, Supabase-таблица `area_claims` — в доступных репозиториях не найдены | Только не задеть при деплое домена; бизнес-логика упразднена |

## 3. Текущее состояние платформы (cloudbiz)

- **Есть:** каркас публичного сайта (draft PR #1) — все основные маршруты §7.1 в обеих локалях, header/footer, карточки инструментов, pricing из конфига, sitemap/robots, typecheck-контроль паритета EN/ES-ключей.
- **Нет:** auth, организаций, кабинета, Supabase-проекта, Stripe, entitlements, всех шести инструментов, Google Sheets sync, admin, юридических страниц (черновики §32), аналитики.
- **Вывод:** стратегия §00.4 («платформа сначала») соблюдается; следующий шаг после мерджа PR #1 — Этап 1 (платформенный фундамент) в cloudbiz.

## 4. Карта переиспользования кода BizMetria → HandyAlliance

Общий вердикт: качество кода BizMetria высокое (строгий TypeScript, чистая логика поверх store-интерфейсов, fail-closed безопасность, настоящий RLS). Главный структурный барьер: BizMetria — **жёстко однопользовательская** система (ни `organizations`, ни `tenant_id`, ни membership нигде нет), поэтому переносятся паттерны и отдельные модули, а не схема данных целиком.

### 4.1. Стек BizMetria (для справки)

Next.js 16 App Router + React 19, `@supabase/ssr` + `supabase-js`, Stripe SDK v22, `@anthropic-ai/sdk` (structured output через `messages.parse` + `zodOutputFormat`), Zod 4, `retell-sdk` + `retell-client-js-sdk`, Resend через сырой `fetch` (без SDK), рукописный CSS без Tailwind, vitest (unit/integration/live) + Playwright. Это совместимо с рекомендованным стеком §23.2.

### 4.2. Переносить почти дословно (фундамент Этапа 1)

| Паттерн | Где в BizMetria | Куда в HandyAlliance |
|---|---|---|
| Слоёная валидация env (Zod-схемы browser ⊂ platform ⊂ integrations; проверка префиксов ключей `sk_test_`/`whsec_`/…; ошибки только с именами переменных, без значений; enforcement на этапе build в `next.config.ts`) | `src/lib/env/*`, `next.config.ts:8-15` | Платформа, §33 |
| Четыре Supabase-клиента по уровням доверия (browser / server-с-cookies / admin-от-verified-ref / target-guard против «не той базы») | `src/lib/supabase/*` | Платформа, §23.2, §26 |
| Идемпотентность webhook: таблица `webhook_events` (`unique(provider, external_event_id)`), трёхстатусный `EventAdmission` (`new/retry/duplicate` — где failed переобрабатывается), санитизированный payload, типизация retryable/non-retryable ошибок | `src/features/checkout/store.ts`, `webhook.ts` | Все webhooks: Stripe, Retell, SMS, Resend (§24, §26.4) |
| Конвенции миграций: статусы как CHECK-реестры (не enum), `jsonb_typeof`-guards, generated columns, цикл установки `updated_at`-триггеров, `force row level security` + реестр таблиц, `security definer`-хелперы с пиненым `search_path`, неизменяемый `audit_logs` | `supabase/migrations/20260731000100_platform_foundation.sql` | Схема §25 |
| CI с синтетическими env-литералами (секреты для CI не нужны): audit → format → lint → typecheck → unit → integration → build + Playwright | `.github/workflows/ci.yml` | Платформа |
| Тестируемость `server-only`-модулей (`ssr.resolve.conditions`) и архитектура «чистая логика поверх инжектируемого store-интерфейса» — источник качественных unit-тестов | `vitest.config.ts:17-21`, `checkout/`, `interview/` | Все модули, §37 |

### 4.3. Переносить с адаптацией

| Актив | Где в BizMetria | В какой модуль HandyAlliance |
|---|---|---|
| AI-пайплайн: свободная от лимитов schema + `normalize()` после, инжектируемый `StructuredAnalysisCall`, версии промптов константами, детерминированный reference-провайдер (бесплатный CI и offline-режим), структурное исключение PII из входа модели, prompt-caching системного блока, guard от prompt injection | `src/features/analysis/*` | Estimate Maker (§16.4), Refund Helper (§18.6), провайдер-абстракция §27.5. Добавить retry/backoff — в BizMetria его нет |
| Retell-интеграция: идемпотентный provisioning агентов по `agent_name` с конвергенцией, выбор голоса по locale, session id в call metadata (не от клиента), dedupe по `eventType:callId` (у Retell нет event id), обязательный `await Retell.verify(...)`, consent как обязательный вход | `scripts/provision-retell-agents.mjs`, `src/features/interview/*`, `api/webhooks/retell` | 24/7 Call Answering (§15) — это готовый скелет provider adapter §23.2 |
| Извлечение структуры из телефонного разговора: transcript → `messages.parse` со схемой «все поля обязательны, пустота = ''», маппинг речи на канонические id опций, запрет фабрикации, детерминированный idempotency-UUID из `sha256(callId)` | `src/features/free-assessment/phone-intake.ts` | Call Answering flow §15.7 (звонок → Customer → Job) |
| Stripe: `assertTestModeKey`, поиск цены по `lookup_key` с ре-верификацией `unit_amount`, app-идентификаторы в metadata, amount-mismatch = non-retryable, идемпотентный provisioning-скрипт каталога | `src/features/checkout/*`, `scripts/provision-stripe-catalog.ts` | Биллинг §6. ВАЖНО: в BizMetria только one-time payments (`mode:'payment'`); подписки, portal, entitlements — писать с нуля |
| Quiz-движок 4 слоя: schema (языконезависимые id опций + `superRefine`) / content (EN+ES тексты) / score (чистая версионированная функция) / storage (mock/supabase-переключатель) | `src/features/free-assessment/*` | Onboarding §10, шаблоны Call-вопросов §15.5, формы вообще |
| Resend: тройной gate (`API_KEY && FROM_EMAIL && DELIVERY_MODE==='send'` иначе skip), best-effort у всех вызывающих (письмо не роняет основную операцию), единый registrable domain для sender и ссылок | `src/features/free-assessment/email.ts`, `src/lib/site.ts` | Email-канал §17.6, §23.2. HTML-шаблоны переписать (React Email), добавить unsubscribe |
| Auth: email+password, Google OAuth (за флагом), безопасный `next`-redirect через sentinel-origin, account linking по подтверждённому email с защитой от повторного захвата | `src/app/[locale]/auth/*`, `auth/callback`, `link.ts` | Auth §10.1. Magic link в BizMetria НЕТ — добавить |
| Admin-доступ в 3 слоя: page-check → RLS (`admin_roles_self_select` даёт не-админу ноль строк) → повторная проверка роли в store | `src/app/[locale]/admin/*` | Admin §22, §26.1 |

### 4.4. Не переносить / переписать

1. **i18n** — в BizMetria рукописные словари `as const` без runtime-fallback, без интерполяции, с переводами, размазанными по 18 файлам. Для HandyAlliance (полные требования §9: словари, контроль отсутствующих ключей, cookie-персистентность, hreflang по реальному пути) взять полноценную библиотеку (например next-intl). Ценность BizMetria тут — качественные нативные ES-тексты как образец тона и трюк типовой проверки паритета ключей.
2. **RLS-модель владения** — все политики BizMetria ключуются на `auth.uid()` напрямую (`owns_lead` и т.п.). HandyAlliance с первого дня нужна модель `is_member_of(org_id)` (§26.1); ретрофит дороже, чем написать сразу.
3. **Схема данных** — таблицы BizMetria предметно другие; берём конвенции, не DDL. Учесть: ~треть схемы BizMetria аспирационная (таблицы `automation_jobs`, `email_events`, `audit_logs` есть, но писателей в коде нет) — не копировать этот разрыв.
4. **Email-HTML** — дублированные инline-шаблоны без plaintext и List-Unsubscribe.

### 4.5. Известные дефекты BizMetria (чтобы не унаследовать)

- env-дрифт: `.env.example` называет `RETELL_ENGLISH_AGENT_ID`, код читает `RETELL_AGENT_ID_EN`; 4 мёртвые переменные в example, 3 используемые — отсутствуют.
- Rate limiting только на `/api/chat`, read-modify-write с признанной гонкой; checkout и webhooks не ограничены.
- Нет фоновых worker'ов (очередь §14.9 для HandyAlliance строить с нуля), нет structured logging, нет down-миграций, RLS не тестируется против реального Postgres.
- Секретов в репозитории НЕТ (проверено сканом по префиксам ключей; в CI — синтетические литералы). Несекретные идентификаторы (project ref, Vercel team/project id) захардкожены и при копировании файлов подлежат замене.

## 5. Риски

1. **Параллельные сессии.** В cloudbiz уже работает другая сессия (PR #1). Правило: одна задача — одна ветка — один draft PR; перед началом каждой сессии сверять открытые ветки/PR, чтобы не дублировать работу.
2. **Право записи.** Текущая сессия может пушить только в `bizmetria.ai`. Канонические документы проекта нужно перенести в cloudbiz отдельной задачей.
3. **Нет доступа к внешним сервисам.** Supabase-проект платформы, Stripe, Retell, Resend (домен handyalliance.com), Google Cloud, SMS-провайдер, Vercel, DNS — всё ждёт выдачи доступов (§00.3). Этап 1 можно начинать по коду (schema, RLS, UI, entitlements-логика), но end-to-end проверки заблокированы до выдачи.
4. **BizMetria — однопользовательская модель.** Подтверждено аудитом кода: понятий organization/tenant/membership в коде и схеме нет вообще; вся RLS ключуется на `auth.uid()`. Мультитенантность (§25.1, §26.1) проектируется для HandyAlliance с нуля; переносим паттерны, не файлы.
5. **Материалы вне GitHub.** Boss Sheet, шаблоны RefundMyLead, скрипты CallBrixa — единственные источники доменного контента; без них контент-пакет §00.2 будет написан «с нуля» и потребует больше правок владельца.

## 6. Migration plan (после утверждения аудита)

1. Перенести `docs/MASTER_SPEC.md` и этот аудит в `cloudbiz` (первая сессия с правом записи туда).
2. Завершить и смерджить PR #1 (публичный сайт) — с разрешения владельца.
3. Этап 1 в cloudbiz: Supabase-проект платформы, organizations/memberships/business_profiles (§25.1), Auth (email+password, magic link, Google), i18n-инфраструктура в полном объёме §9, entitlements + Stripe foundation, audit log, admin foundation. Паттерны — из BizMetria (§4).
4. Далее по §35: Этап 2 (Job Tracker) → Этап 3 (Google Sheets Sync) → Этап 4 (Estimate Maker) → Этап 5 (Business Website) — публичный первый запуск §36.1 → Этапы 6–8 за feature-флагами → Этап 9 → Этап 11 (Этап 10 пропущен).
5. Retell: аудит существующих агентов CallBrixa в дашборде Retell (сценарии, номера, конфигурация) — отдельной задачей после выдачи доступа; адаптер строить по образцу BizMetria (§4).

## 7. Чек-лист доступов для владельца (§00.3)

Статус на 2026-08-04:

| Ресурс | Статус | Что нужно от владельца |
|---|---|---|
| GitHub | ✅ Частично | `cloudbiz` найден и принят как репо платформы. Подтвердить это решение; выдать сессиям право push в `cloudbiz` |
| Vercel | ❌ | Инвайт; право создать проект для cloudbiz и привязать handyalliance.com; Preview Deployments |
| Домен | ❌ | Подтверждение владения handyalliance.com; доступ к DNS (записи Vercel + Resend) |
| Supabase | ❌ | Создать/выдать проект-базу платформы (отдельный от BizMetria!); Project URL; service role key — только в env Vercel |
| Stripe | ❌ | Инвайт или restricted key (Products/Prices/Webhooks); test и live раздельно |
| Google Cloud | ❌ | Проект со включёнными Sheets API + Drive API; OAuth Client ID/Secret; scope `drive.file`; Google Picker key. Напоминание: верификацию OAuth consent screen запускает владелец (параллельно с Этапом 3) |
| Resend | ❌ | API key; подтвердить sender-домен handyalliance.com |
| SMS | ❌ | Название провайдера, ключи, номер верифицированного A2P-аккаунта |
| Voice (Retell) | 🔶 Платформа известна | Доступ к аккаунту Retell (дашборд/API key), webhook secret, список номеров и существующих агентов CallBrixa |
| Аналитика | ❌ | GA4 property + Search Console для handyalliance.com |
| Файлы | ❌ | `Handyman_Boss_Sheet_EN-1.xlsx`, `HANDYMAN_BOSS_APP_TZ.md`, шаблоны/тексты RefundMyLead, скрипты CallBrixa (если есть вне Retell) |

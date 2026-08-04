# HandyAlliance — Архитектура платформы

Статус: живой документ; отражает состояние после Этапа 1 (платформенный фундамент)
и данных Этапа 2 (Job Tracker).
Основание: `docs/MASTER_SPEC.md` (§23, §25, §26), `docs/HANDYALLIANCE_CURRENT_STATE_AUDIT.md` (§4 — карта паттернов BizMetria).

## 1. Стек

- Next.js App Router + React + TypeScript (strict), Tailwind CSS 4.
- Supabase: Postgres + Auth + (позже) Storage; RLS включён и forced на всех таблицах.
- Stripe: Checkout + Billing + Customer Portal + Webhooks; локальный entitlement-кэш.
- Модульный монолит (§23.1): фичи в `src/features/*` как «чистая логика поверх инжектируемого store-интерфейса».

## 2. Структура каталогов

```text
src/
  app/
    [locale]/[[...slug]]/     публичный сайт (маршруты §7.1, локализованные слаги)
    [locale]/onboarding/      создание организации (§10.3, минимальный путь)
    [locale]/app/             кабинет: dashboard (§20), billing
    [locale]/admin/           админ-фундамент (§22), трёхслойная проверка доступа
    api/stripe/checkout       POST — создание Checkout-сессии (owner-only)
    api/stripe/customer-portal POST — портал Stripe (owner-only)
    api/webhooks/stripe       POST — подпись + идемпотентность + обработка
    auth/callback             обмен кода на сессию (magic link / confirm / OAuth)
    auth/sign-out             POST — выход
  features/
    auth/                     клиентские формы sign-in/sign-up
    billing/                  каталог, checkout, webhook-ядро, store-интерфейс + Supabase-реализация
    entitlements/             чистая entitlement-резолюция
    jobs/                     Job Tracker: model.ts (реестры §13.6/§13.7), schema.ts (валидация §13.5)
    organizations/            сервис/экшены организации, onboarding-форма
  lib/
    config.ts                 продукты, цены, лимиты, trades, флаги (§5, §6)
    datetime.ts               таймзона организации: wall-clock ↔ instant, форматирование
    env/                      слоёная Zod-валидация env (§33)
    i18n/                     словари en/es + контроль паритета
    routes.ts                 реестр локализованных маршрутов
    supabase/                 клиенты по уровням доверия + target-guard
  middleware.ts               сессия Supabase, защита /app|/admin, cookie локали (§9.4)
supabase/
  migrations/                 SQL-миграции (конвенции аудита §4.2)
  tests/                      shim Supabase-окружения + RLS-тесты изоляции
```

## 3. Границы доверия

1. **Browser** — anon key, RLS применяется всегда.
2. **Server (session)** — `createSupabaseServerClient()`: anon key + cookies пользователя; RLS применяется.
3. **Server (elevated)** — `createSupabaseAdminClient()`: service role, RLS обходится; допускается ТОЛЬКО в webhooks/admin/фоновых задачах, origin выводится из проверенного server-owned `SUPABASE_PROJECT_REF` (`src/lib/supabase/target.ts`), а не из публичного URL. Ref'ы проектов BizMetria запрещены жёстко.
4. **Мультитенантность** — все политики через `app_private.is_member_of(org_id)` / `is_org_owner(org_id)` (security definer, пиненый `search_path`). Создание организации — только атомарный RPC `public.create_organization` (org + owner-membership + business profile + бесплатный Job Tracker + audit-запись).

## 4. Env-валидация

`src/lib/env/schema.ts`: три вложенных scope — browser ⊂ platform ⊂ integrations; префиксы ключей проверяются; сообщения об ошибках содержат только имена переменных. Enforcement при сборке в `next.config.ts`: если задана хотя бы одна platform-переменная — валидируется весь platform-scope; без env публичный сайт собирается как раньше. Stripe-ключи пинятся к test-режиму, пока владелец явно не установит `STRIPE_LIVE_MODE=live`.

## 5. RLS-тесты

`supabase/tests/rls_isolation_test.sql` — самопроверяющийся сценарий §37.4: изоляция всех tenant-таблиц между двумя организациями, скрытие billing от staff, неизменяемость audit_logs, запрет прямого INSERT в organizations, ноль строк для anon. CI гоняет его против чистого Postgres 16 c shim'ом (`supabase_shim.sql`: роли + `auth.users` + `auth.uid()`).

## 5a. Данные Job Tracker (Этап 2)

Миграция `20260804000400_job_tracker.sql` добавляет `customers`, `jobs`, `job_activities` (§25.2).

| Решение | Обоснование |
|---|---|
| `job_activities` без единого FK | История хранит исходные `organization_id`/`job_id` и переживает удаление организации. FK с `ON DELETE CASCADE/SET NULL` на append-only таблицу конфликтует с триггером неизменяемости и блокирует удаление организации целиком — регрессия, исправленная в `20260804000300` |
| Записи activity пишут триггеры, а не приложение | §13.11 «изменения записываются в activity log» должно выполняться для любого пути записи: UI, CSV-импорт, будущие платные модули, service role. Триггеры `SECURITY DEFINER` (владелец `postgres`) пишут в таблицу, у которой нет INSERT-политики, — клиент читает свою историю, но не может её подделать или отредактировать |
| В activity — только имена изменённых полей | §26.6 логирует действия, а не полезную нагрузку: журнал не становится второй копией клиентских данных |
| Пакетный контекст через GUC `handyalliance.activity_context` | Импорт (§14.15) выставляет его транзакционно-локально внутри своего RPC, поэтому сто строк дают события `job.imported`, а не сто `job.created`. Транзакционная локальность безопасна при пулинге |
| Consent-поля (§17.9) сразу в `customers` | Инструменту Reviews & Follow-Ups (Этап 6) не придётся бэкфилить согласия. CHECK гарантирует, что `sms_consent = true` невозможен без источника и отметки времени |
| Нет DELETE-политик у `customers`/`jobs` | Удаление — всегда `deleted_at` (§14.12). Физическое удаление доступно только service role |
| Реестры статусов дублируются в `model.ts` и в CHECK | Тесты `tests/unit/jobs-model.test.ts` пиннят реестр, словари и §13.6 друг к другу; расхождение падает на CI |

## 6. Решения и допущения Этапа 1

| Решение | Обоснование | Обратимость |
|---|---|---|
| i18n остаётся на типизированных словарях проекта (без next-intl) | Существующая система закрывает жёсткие требования §9.4 (одинаковые ключи, контроль отсутствующих, интерполяция); словари содержат массивы, которые next-intl не поддерживает; миграция сейчас означала бы переписывание файлов, которыми владеет параллельная сессия PR #1 | Обратимо: словари конвертируются в ICU-messages механически; вопрос вынесен владельцу |
| Cookie локали `ha_locale` + Accept-Language в middleware | §9.4: язык браузера — только первичная рекомендация | Полностью |
| Stripe: lookup keys в каталоге вместо `STRIPE_PRICE_*` env | §6.2.2 допускает «конфигурацию или базу»; ре-верификация суммы перед Checkout безопаснее слепого Price ID | Полностью |
| Переключение bundle ↔ отдельные инструменты заблокировано (409) до Этапа 9 | §6.2.6/6.2.7: без flow с прорацией и показом итога — не списывать | Этап 9 |
| Google OAuth за флагом `GOOGLE_AUTH_ENABLED=false` | Нет Google Cloud проекта (§00.0.5) | Флаг |
| Магазин-каталог провижионится в Stripe отдельным идемпотентным скриптом (не написан — нет доступа) | §00.0.5 | Этап 9 |

## 7. Что сознательно НЕ сделано в Этапе 1

- Приглашения staff (RPC + UI) — модель и RLS готовы, flow в Этапе 2+.
- Уведомления UI (§28.3) — таблица есть, интерфейс позже.
- Google Sheets sync (§14) — Этап 3; `sync_outbox` появится своей миграцией.
- Admin-операции записи (§22) — только чтение; audit-обвязка готова.
- Партнёрская программа — OUT OF MVP (§21), архитектурных препятствий нет (nullable `partner_id` добавляется позже отдельной миграцией).

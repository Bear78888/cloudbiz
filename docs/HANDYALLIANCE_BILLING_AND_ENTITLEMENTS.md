# HandyAlliance — Billing и Entitlements (Этап 1)

Основание: `docs/MASTER_SPEC.md` §6, §25.9; паттерны BizMetria по аудиту §4.3.

## 1. Модель

```text
Stripe (источник истины по оплате, §6.2.4)
  → POST /api/webhooks/stripe (подпись на raw body, webhook_events-идемпотентность)
  → upsert subscriptions (локальный кэш)
  → resolveEntitlements(все подписки организации)  ← чистая функция
  → replace entitlements (кэш доступа)
  → UI/фичи читают ТОЛЬКО entitlements
```

- Redirect после Checkout никогда не выдаёт доступ — только webhook (§6.2.4).
- `job_tracker` всегда активен и бесплатен (§13.1) — включён в резолюцию безусловно и выдаётся при создании организации RPC-ом.
- Bundle `all_tools_bundle` разворачивается во все пять платных инструментов (§6.1); при пересечении bundle + отдельная подписка функция остаётся активной, пока её покрывает хотя бы одна granting-подписка, срок — максимальный из покрытий.

## 2. Статусы подписки → доступ (§6.2.5)

| Статус Stripe | Entitlement |
|---|---|
| active, trialing | active |
| past_due | active (dunning-окно; Stripe повторяет списание) |
| unpaid, canceled, incomplete, incomplete_expired, paused | suspended |

Refund/chargeback приходит как `customer.subscription.deleted`/статусные события и снимает entitlement той же цепочкой (§6.2.9).

## 3. Каталог и цены

- Цены — в `src/lib/config.ts` (`PRICING`, `LIMITS`), не в компонентах (§6.2.1).
- `src/features/billing/catalog.ts` сопоставляет продукт+интервал → Stripe `lookup_key` + ожидаемую сумму в центах.
- Перед Checkout цена ищется по lookup_key и ре-верифицируется (`unit_amount`, `currency`, `interval`). Несовпадение = `CheckoutConfigurationError` → 503, деньги не списываются.
- Провижионинг каталога в Stripe — идемпотентный скрипт Этапа 9 (доступ к Stripe ожидается от владельца; §00.0.5). Тестовые Price создаются с теми же lookup keys.

## 4. Идемпотентность webhook (§26.4)

Таблица `webhook_events`, `unique(provider, external_event_id)`:

- INSERT прошёл → `new`, обрабатываем;
- конфликт + предыдущий статус `failed` → `retry`, обрабатываем повторно;
- иначе → `duplicate`, отвечаем 200 без побочных эффектов.

Ошибки: `NonRetryableWebhookError` (незнакомый продукт, неатрибутируемая подписка) → статус `failed` + HTTP 200, чтобы Stripe не зациклился; всё остальное → HTTP 500, Stripe ретраит.

## 5. Гарды

- Checkout/portal — только владелец организации (§11.3), staff получает 403.
- Повторная покупка того же продукта → 409 `already_subscribed`.
- Bundle при активных отдельных подписках (и наоборот) → 409 `upgrade_flow_required` до появления flow Этапа 9 с прорацией и показом итоговой суммы (§6.2.6–6.2.7).
- Stripe-ключи пинятся к test-режиму до `STRIPE_LIVE_MODE=live` (env-схема).

## 6. Тесты

`tests/unit/entitlements.test.ts`, `tests/unit/billing-webhook.test.ts` — резолюция, статусы, bundle-пересечения, non-retryable ветки, fake-store сценарий Scenario D (§37.3) на уровне ядра. End-to-end со Stripe CLI — после выдачи доступа к Stripe (открытый вопрос владельцу).

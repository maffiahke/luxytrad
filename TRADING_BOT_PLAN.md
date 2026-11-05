# Luxytrades — Trading Bot: Build Plan

Status: **planned, not yet implemented** · Owner: frontend (trader app) + shared store · Depends on: the shared browser store (`src/state/store.ts`) and sequential-run engine (`src/state/AppStore.tsx`) now in place.

This document is written so it can be handed straight to an implementer. It reuses every mechanic that already works (sequential runs, auto-settle, admin-shaped records, localStorage persistence, `useSyncExternalStore` reactivity) and layers the bot on top, so the bot's trades are ordinary `Position`/`Run` rows the back office already understands — just tagged as automated.

---

## 1. What the bot is (product definition)

A rule-driven auto-trader that the user configures from a **bottom-sheet modal** (opened by the existing `BotBanner` "Activate Now" button, which currently has no handler). Once activated it:

1. Places a fixed **stake** on a chosen market, repeatedly, one trade after another (reusing the existing sequential-run engine — never two at once).
2. Decides each trade's direction **automatically from momentum** of the live price (the user's chosen mode) — no manual Buy/Sell.
3. Runs a configured number of **runs** (`total` trades) and/or loops until the user stops it.
4. Watches cumulative profit/loss and **halts itself** when a **take-profit** or **stop-loss** threshold is hit.
5. **Never trades below the $50 minimum stake** — enforced in the engine, not just the UI.

Every bot trade writes the same admin-shaped records the trader's manual trades do, so deposits, positions, runs, ledger and audit all surface in the console live and survive refresh.

---

## 2. Modal configuration (UI contract)

`BotConfigModal` — a `ModalShell` from `src/components/Sheet.tsx` (same shell the funds flows use), mounted from `App.tsx` next to `BotBanner`. The banner becomes: `<BotBanner onActivate={() => setBotOpen(true)} active={bot?.status === "RUNNING"} />`.

Fields (all persisted):

| Field | Type | Control | Constraint |
|---|---|---|---|
| Market | pair name | searchable list (reuse market universe) | must be an active market |
| Stake per trade `$` | number | `AmountField` + quick chips 50 / 100 / 250 / 500 | **min 50**, max = available balance, ≤ market gateway max |
| Expiry / duration | seconds | `DURATIONS` chips | one of `[5,15,30,60,120,300]` |
| Runs (number of trades) | int | stepper 1–100 | `total` |
| Direction mode | enum | fixed label **"Momentum (auto)"** | only mode in v1 (manual override hidden behind a "Advanced" toggle, off by default) |
| Take profit `$` | number | input | optional; positive; cumulative realized profit that stops the bot |
| Stop loss `$` | number | input | optional; positive; cumulative realized loss that stops the bot |
| Per-trade early close | bool | toggle | **assumed ON-off default OFF** (see §4) — when ON, a single trade that runs into the TP/SL mid-expiry is closed early |
| Repeat after N runs | int/∞ | stepper | when reached, bot re-arms a fresh batch of `total` trades until stopped |

Validation surfaced inline: choosing a stake under $50 disables **Activate** and shows *"Minimum stake is $50."* Insufficient balance shows *"Balance too low — deposit first."*

Actions: **Activate** (starts), and while running the banner/modal shows **Stop** (graceful: finishes the in-flight trade, cancels queued runs) plus a live stat strip (trades done, net P&L, runs left).

---

## 3. Data model (added to the shared store, mirroring Prisma)

New types in `src/admin/types.ts` (and a matching `prisma/schema.prisma` `BotConfig` model + a `botConfigId`/`automated` column on `Position`/`Run`):

```ts
export type BotStatus = "IDLE" | "RUNNING" | "PAUSED" | "DONE" | "STOPPED";

export interface BotConfig {
  id: string;
  userId: string;
  market: string;          // pair display name
  stake: number;           // enforced >= 50
  duration: number;        // seconds
  total: number;           // trades per batch
  repeat: boolean;         // re-arm after batch completes
  direction: "MOMENTUM";   // v1 only
  takeProfit: number;      // $ (cumulative), 0 = off
  stopLoss: number;        // $ (cumulative), 0 = off
  earlyClose: boolean;     // per-trade TP/SL during expiry (assumed, see §4)
  status: BotStatus;
  done: number;            // trades completed this session
  realized: number;        // running P&L across this session's bot trades
  createdAt: string;
  startedAt?: string;
  stoppedAt?: string;
}
```

`Position` and `Run` gain two optional shared-store fields the admin already tolerates as extras (exactly how `account`/`digits` work today): `bot?: boolean` and `botId?: string`. The admin Trading/Runs tables add an **"Auto"** chip and a filter; `computeKpis()` adds `botVolume`.

Persisted automatically — `BotConfig` lives in `db` (add `db.bots = []` to `src/admin/data.ts`, include it in `snapshot()`/`hydrate()` in `store.ts`). Key bump: `lx_store_v1 → lx_store_v2` (or version the payload) so stale caches re-seed.

---

## 4. Engine design (reuses the run mechanics)

### 4.1 Direction (momentum, auto)
On each new trade, read the live price series (already simulated in `AppStore`):
- `momentum = last - previous` over the current candle's recent ticks, or a short EMA spread `(ema_fast - ema_slow)`.
- `side = momentum >= 0 ? "BUY" : "SELL"` (tie → follow the last tick direction).
This is computed at placement time in the bot loop, so the existing `startTrade`/`advanceTrade` engine is unchanged — it already accepts a `side`.

### 4.2 Minimum $50 (hard guard)
Enforced in the store, not the UI:

```ts
export const BOT_MIN_STAKE = 50;
export function botCanTrade(cfg, balance) {
  return cfg.stake >= BOT_MIN_STAKE && cfg.stake <= balance && cfg.status === "RUNNING";
}
```
Any code path that would place a bot trade below $50 is rejected and the bot self-stops with an audit line `bot_rejected_min_stake`. This also protects the repeat/advance paths.

### 4.3 Scheduling
The bot does **not** open its own `setInterval` racing the engine. It piggybacks on the existing sequential-run + auto-settle effects in `AppStore` (keyed on `[now, version]`, ticking every 500 ms):

1. **Start** → call `startTrade(ticket, count=total)` with the momentum side; stamp the returned run/position with `bot:true, botId`. Store `activeBotRunId` on the config.
2. **Advance** → when the engine detects the bot run's `activeId` has settled, the bot hook (a small `useBotEngine` effect that watches `liveRuns()` for the bot's run) evaluates TP/SL against `cfg.realized`:
   - if `takeProfit>0 && realized >= takeProfit` → `finishRun(...,'COMPLETED')` + `status:"DONE"`.
   - if `stopLoss>0 && realized <= -stopLoss` → `finishRun(...,'STOPPED')` + `status:"STOPPED"` (target hit).
   - else if `remaining>0 && botCanTrade` → `advanceTrade(...)` with a freshly computed momentum side.
   - else if batch done and `repeat` → arm a new batch (`startTrade` again, reset `done` per-batch, keep `realized` for session TP/SL); if not repeat → `status:"DONE"`.
3. **Accumulate** — after each `settleTrade`, add its signed `pnl` into `cfg.realized` and increment `cfg.done`; `emit()`.

Because it reacts to the same `version`/`now` signals, the bot stays perfectly in lockstep with manual trades and needs no new clock.

### 4.4 TP/SL enforcement (stated assumption)
- **Default = run-level (cumulative).** TP/SL compare against the batch's running realized P&L **between trades** (at each settle), and halt the remaining queued runs. This is the safe, low-latency option and is the assumed default.
- **Optional per-trade early close (`cfg.earlyClose`).** When the user turns this ON, a separate check runs on every price tick: if the *current open* position's unrealized P&L crosses the TP/SL, close it early via the existing `closePosition(id)` → `settleTrade(...,"CLOSED_EARLY")`. Left OFF by default to avoid over-trading the 5s expiries.

> If the product intent was strictly per-trade TP/SL (a classic bot), flip the default: set `earlyClose:true` and treat TP/SL against the single trade's live P&L rather than the cumulative `realized`. The engine already exposes both hooks, so this is a one-line default change, not a rewrite.

---

## 5. Admin wiring (back office sees the robot)

- **Runs / Trading tables**: "Auto" badge on positions/runs where `bot:true`; a segment control to filter Manual / Auto; a per-bot summary row (config + realized + status) on a new **Bots** card in the Trading page.
- **Users page**: the trader's bot configs listed with a **Kill switch** (super-admin/OPS) that writes `status:"STOPPED"` + `pushAudit("bot_kill", ...)`; propagates to the trader via the shared store / `storage` event already implemented.
- **Ledger**: bot stakes/payouts are ordinary `TRADE_DEBIT`/`TRADE_CREDIT` rows (already written by `startTrade`/`settleTrade`) — the note string is prefixed `Bot:` when automated.
- **Audit**: `bot_start`, `bot_stop`, `bot_target_tp`, `bot_target_sl`, `bot_rejected_min_stake`, `bot_kill`.
- **KPIs**: add `botVolume` (sum of bot stake turnover today) so the dashboard reflects automated activity.

In mock mode this is all automatic (single shared `db`); in LIVE mode the same fields serialize through `serializers.ts` and `server/routes` unchanged — a `BotConfig` table + `POST /admin/api/bots/:id/kill` endpoint mirror the client.

---

## 6. Files to touch

| File | Change |
|---|---|
| `src/admin/types.ts` | add `BotConfig`, `BotStatus`; `Position.bot/botId`, `Run.bot/botId` |
| `src/admin/data.ts` | `db.bots = []`; (LIVE) Prisma model + columns |
| `src/state/store.ts` | `BOT_MIN_STAKE`, `botCanTrade`, `createBot/startBot/stopBot/recordBotPnl`, include `bots` in `snapshot/hydrate`; stamp `bot/botId` in `startTrade`/`advanceTrade`/`settleTrade` |
| `src/state/AppStore.tsx` | `useBotEngine()` effect reacting to `[now, version]`; momentum `sideFor(pair)`; expose `bot`, `activateBot(cfg)`, `stopBot()` on `AppState` |
| `src/components/BotConfigModal.tsx` | **new** — the configuration sheet (§2) |
| `src/components/BotBanner.tsx` | wire `onActivate` → open modal; show live running stats + Stop |
| `src/App.tsx` | mount `BotConfigModal`, lift `botOpen` state |
| `src/admin/pages/Trading.tsx` | Auto badges, Manual/Auto filter, Bots card, kill switch |
| `src/admin/pages/Users.tsx` | list user bots + kill |
| `src/admin/data.ts` `computeKpis` / `server` | `botVolume`, Prisma + serializer parity |

---

## 7. Build phases

1. **Model + guard (no UI):** `BotConfig` type, `db.bots`, store actions, `BOT_MIN_STAKE`, momentum `sideFor`, `useBotEngine` reacting to the existing run loop. Verify headlessly (extend `scripts/verify_store.ts`) that a bot batch places ≥$50 momentum trades, accumulates realized, and halts on TP/SL.
2. **Modal UI:** `BotConfigModal` + banner wiring; validation (min $50, balance, active market); Activate/Stop; live stat strip.
3. **Admin surfacing:** Auto badges, filter, Bots card, kill switch, `botVolume`, audit events.
4. **Persistence + cross-tab:** confirm bot state and in-flight trades survive refresh and mirror to an open admin tab (`storage` event already handles adoption; guard re-hydration against double-starting a bot on load — resume idempotently from `status`).
5. **LIVE parity (optional, when API is on):** Prisma `BotConfig`, `bots` routes, `/bots/:id/kill`, serializers.

---

## 8. Edge cases & safety

- **Double-start on refresh:** on hydrate, never auto-`startTrade` for a `RUNNING` bot — resume the scheduler from its current `activeId`/`done` so a reload mid-run neither re-fires nor skips.
- **Balance drained mid-batch:** existing run engine already stops with a toast; bot sets `status:"STOPPED"` + audit `bot_no_funds`.
- **Suspended/banned user (admin kill):** `useBotEngine` checks the session user's `status` each tick; if not `ACTIVE`, stop and stop placing trades.
- **Market disabled by admin:** skip a market toggled inactive; stop with `bot_market_off`.
- **Tab throttling:** background tabs throttle the 500 ms tick; settlement uses `expiresAt <= now` (catches up on focus), and TP/SL is evaluated on the same settle signal, so no missed exits — worst case a slightly late halt. Acceptable for a demo/sim wallet.
- **Never below $50, never above balance:** both enforced centrally in `botCanTrade`, so no UI bug can breach them.
- **Single in-flight rule:** bot only ever has one active position because it reuses sequential runs.

---

## 9. Acceptance criteria

- A configured bot ($50 stake, momentum, 5 runs, TP $30, SL $20) opens ≤1 trade at a time, auto-picks Buy/Sell from price direction, books P&L, and **stops itself** once realized crosses +$30 or −$20.
- Attempting to start a bot under $50 stake is blocked in the modal **and** in the engine (test asserts the reject + audit row).
- All bot trades appear in the admin console tagged **Auto**, with correct balances, ledger entries and audit trail, and survive a full page refresh; an admin **kill** stops the running bot within one tick.
- `npm run build` + `tsc` clean; the extended `scripts/verify_store.ts` is green.

---

### Assumptions to confirm at build time
1. TP/SL defaults to **run-level cumulative** (halt remaining runs), with per-trade early-close as an opt-in toggle — per the momentum-mode direction you chose. Flip one default if you want strict per-trade TP/SL instead.
2. v1 is **momentum-only** auto-direction; manual/advanced direction stays available but off by default.
3. Bot trades are ordinary positions (same payouts/model as manual), just flagged automated — no separate "bot asset class".

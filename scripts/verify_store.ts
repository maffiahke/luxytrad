/**
 * Headless end-to-end check of the shared store engine.
 * Runs the SAME functions the trader UI calls (store.ts) and asserts that every
 * action produces admin-shaped records + persisted state — no browser required.
 *
 *   npx tsx scripts/verify_store.ts
 */

// --- minimal browser stubs BEFORE the store module loads (it hydrates on import) ---
const backing = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
};

import { db, computeKpis } from "../src/admin/data";
// ES imports are hoisted, so load the store dynamically AFTER the localStorage stub is set.
const {
  balances,
  livePositions,
  liveRuns,
  settledTrades,
  startTrade,
  advanceTrade,
  settleTrade,
  finishRun,
  submitDeposit,
  submitWithdrawal,
  submitKyc,
  createBot,
  armBot,
  stopBot,
  startBotTrade,
  recordBotResult,
  botHaltReason,
  botCanTrade,
  liveBots,
  activeBots,
  BOT_MIN_STAKE,
  SESSION_USER_ID,
} = await import("../src/state/store");

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (extra ? " — " + extra : "")); }
};

console.log("\n== shared store engine verification ==");

// 1. clean slate: seeded u1 positions have no `account` marker → invisible to trader
ok("trader sees no live positions at start", livePositions().length === 0, `saw ${livePositions().length}`);
const start = balances();
console.log(`  · start balances real=${start.real} demo=${start.demo}`);

// 2. place a BUY trade
const { runId, posId } = startTrade(
  { account: "real", pair: "EUR/USD", side: "BUY", amount: 100, duration: 30, entry: 1.08452, digits: 5 },
  3, // a run of 3 sequential trades
);
const afterOpen = balances();
ok("trade debits stake from real balance", Math.abs(afterOpen.real - (start.real - 100)) < 0.001, `${start.real} → ${afterOpen.real}`);
ok("livePositions shows the new OPEN trade", livePositions().some((p) => p.id === posId && p.account === "real"));
ok("run registered as ACTIVE", liveRuns().some((r) => r.id === runId && r.status === "ACTIVE"));
ok("admin sees the position (db.positions OPEN + userId)", db.positions.some((p) => p.id === posId && p.userId === SESSION_USER_ID && p.status === "OPEN"));
ok("audit trail written by trader", db.audit.some((a) => a.entityId === posId && a.admin === "Trader (app)"));

// 3. advance the run (2nd sequential trade)
advanceTrade(runId, { account: "real", pair: "EUR/USD", side: "BUY", amount: 100, duration: 30, entry: 1.085, digits: 5 });
ok("advance launched a 2nd live position", livePositions().length === 2);
ok("advance decremented remaining + repointed activeId", (liveRuns().find((r) => r.id === runId)?.remaining ?? -1) === 1);

// 4. settle both open trades at a favourable price (win)
const open = livePositions().map((p) => p.id);
for (const id of open) {
  const p = db.positions.find((x) => x.id === id)! as any;
  settleTrade({ posId: id, account: "real", pair: p.market, side: p.side, stake: 100, value: 20, closePrice: 1.087 });
}
const afterSettle = balances();
ok("settled trades return stake + profit", Math.abs(afterSettle.real - (start.real - 200 + 2 * 120)) < 0.001, `=${afterSettle.real}, expected ${start.real - 200 + 240}`);
ok("settledTrades history populated", settledTrades().length === 2);
ok("positions flipped to WON (admin-visible)", db.positions.filter((p) => open.includes(p.id) && p.status === "WON").length === 2);

finishRun(runId, "COMPLETED");
ok("run marked COMPLETED (leaves ACTIVE queue)", !liveRuns().some((r) => r.id === runId));

// 5. deposit via M-Pesa → instant + credited
const beforeDep = balances().real;
const dep = submitDeposit({ channel: "MPESA", amount: 500, bonusPct: 100, mpesaCode: "LXTEST1234" });
ok("M-Pesa deposit COMPLETED", dep.status === "COMPLETED");
ok("M-Pesa deposit credited real balance (+bonus)", Math.abs(balances().real - (beforeDep + 1000)) < 0.001, `${beforeDep} → ${balances().real}`);
ok("deposit in admin queue for u1", db.deposits.some((d) => d.id === dep.id && d.userId === SESSION_USER_ID));

// 6. deposit via crypto → pending, NOT credited
const beforeCry = balances().real;
const cry = submitDeposit({ channel: "CRYPTO", amount: 250, bonusPct: 0, reference: "0xabc…def" });
ok("crypto deposit PENDING (finance must approve)", cry.status === "PENDING");
ok("crypto deposit did NOT credit yet", Math.abs(balances().real - beforeCry) < 0.001);

// 7. withdrawal → pending + debited up front
const beforeWd = balances().real;
const wd = submitWithdrawal({ channel: "MPESA", amount: 200, fee: 0, destination: "0712345678" });
ok("withdrawal PENDING in admin queue", wd.status === "PENDING" && db.withdrawals.some((w) => w.id === wd.id));
ok("withdrawal debited real balance", Math.abs(balances().real - (beforeWd - 200)) < 0.001);

// 8. KYC → under review
submitKyc("National ID", "🇰🇪 KE");
ok("user kyc flipped to UNDER_REVIEW", db.users.find((u) => u.id === SESSION_USER_ID)?.kyc === "UNDER_REVIEW");
ok("kyc application queued for admin", db.kyc.some((k) => k.userId === SESSION_USER_ID && k.status === "UNDER_REVIEW"));

/* --------------------------- 8b. trading bot engine --------------------------- */
ok("BOT_MIN_STAKE is $50", BOT_MIN_STAKE === 50, `=${BOT_MIN_STAKE}`);
ok("seeded mock bots are invisible to the trader", liveBots().length === 0, `saw ${liveBots().length}`);

// B1. create with a sub-minimum stake → hard-clamped to $50, status IDLE
const botLow = createBot({ market: "BTC/USD", account: "real", stake: 40, duration: 30, total: 2, repeat: false, takeProfit: 0, stopLoss: 0, earlyClose: false });
ok("createBot clamps stake to the $50 floor", botLow.stake === BOT_MIN_STAKE, `stake=${botLow.stake}`);
ok("new bot starts IDLE", botLow.status === "IDLE");

// B2. create a real bot + arm it, launch its first momentum trade
const beforeBot = balances().real;
const bot = createBot({ market: "BTC/USD", account: "real", stake: 250, duration: 30, total: 2, repeat: false, takeProfit: 0, stopLoss: 0, earlyClose: false });
const bpos1 = startBotTrade({ account: "real", pair: "BTC/USD", side: "BUY", amount: bot.stake, duration: 30, entry: 71240, digits: 1 }, bot.id);
armBot(bot.id);
ok("bot trade debits stake from balance", Math.abs(balances().real - (beforeBot - 250)) < 0.001, `${beforeBot} → ${balances().real}`);
ok("bot trade is a live OPEN position", livePositions().some((p) => p.id === bpos1 && p.status === "OPEN"));
ok("bot position stamped bot:true + botId (admin Auto tag)", db.positions.some((p) => p.id === bpos1 && p.bot === true && p.botId === bot.id));
ok("bot now RUNNING and in activeBots", activeBots().some((b) => b.id === bot.id && b.status === "RUNNING"));
ok("botVolume KPI counts auto-trade stakes", computeKpis().botVolume >= 250, `botVolume=${computeKpis().botVolume}`);

// record result #1 (win) → done + realized update, still under the total
recordBotResult(bot.id, 60);
const botAfter1 = db.bots.find((b) => b.id === bot.id)!;
ok("recordBotResult increments done", botAfter1.done === 1, `done=${botAfter1.done}`);
ok("recordBotResult accumulates realized P&L", Math.abs(botAfter1.realized - 60) < 0.001, `realized=${botAfter1.realized}`);
ok("no halt while trades remain under total", botHaltReason(botAfter1) === null);

// record result #2 (win) → hits the batch limit (repeat:false)
startBotTrade({ account: "real", pair: "BTC/USD", side: "SELL", amount: 250, duration: 30, entry: 71240, digits: 1 }, bot.id);
const botAfter2 = recordBotResult(bot.id, 30)!;
ok("second result reaches total", botAfter2.done === 2 && botAfter2.realized === 90, `done=${botAfter2.done} realized=${botAfter2.realized}`);
ok("batch-limit halt fires when done>=total (no repeat)", botHaltReason(botAfter2) === "LIMIT");

// B3. take-profit halt (cumulative)
const tpBot = createBot({ market: "ETH/USD", account: "real", stake: 100, duration: 30, total: 50, repeat: false, takeProfit: 100, stopLoss: 0, earlyClose: false });
const tpRes = recordBotResult(tpBot.id, 120)!;
ok("take-profit halt when realized>=TP", botHaltReason(tpRes) === "TP", `=${botHaltReason(tpRes)}`);

// B4. stop-loss halt (cumulative)
const slBot = createBot({ market: "XAU/USD", account: "real", stake: 100, duration: 30, total: 50, repeat: false, takeProfit: 0, stopLoss: 100, earlyClose: false });
const slRes = recordBotResult(slBot.id, -150)!;
ok("stop-loss halt when realized<=-SL", botHaltReason(slRes) === "SL", `=${botHaltReason(slRes)}`);

// B5. repeat re-arm is enabled (repeat:true), limit cleared by resetting done
const rpBot = createBot({ market: "USOIL", account: "real", stake: 50, duration: 30, total: 1, repeat: true, takeProfit: 0, stopLoss: 0, earlyClose: false });
const rpRes = recordBotResult(rpBot.id, 5)!;
ok("repeat bot hits LIMIT then re-arms", botHaltReason(rpRes) === "LIMIT" && rpRes.repeat === true);

// B6. budget guard — a bot that can't cover its next stake reports false
const richBot = createBot({ market: "BTC/USD", account: "real", stake: 999999, duration: 30, total: 1, repeat: false, takeProfit: 0, stopLoss: 0, earlyClose: false });
ok("botCanTrade false when stake exceeds balance", botCanTrade(richBot) === false);
ok("botCanTrade true for an affordable bot", botCanTrade(tpBot) === true);

// B7. stop / kill switch
stopBot(tpBot.id, "STOPPED");
const stoppedBot = db.bots.find((b) => b.id === tpBot.id)!;
ok("stopBot marks STOPPED + stoppedAt + clears activeRunId", stoppedBot.status === "STOPPED" && !!stoppedBot.stoppedAt && stoppedBot.activeRunId === undefined);
ok("bot actions audited by trader", db.audit.some((a) => a.entityId === tpBot.id && /bot/i.test(a.action)));

// 9. persistence — everything above should be serialised to the localStorage stub
const persisted = JSON.parse(backing.get("lx_store_v1") || "null");
ok("state persisted to localStorage key", !!persisted);
ok("persisted snapshot contains the crypto deposit", persisted?.deposits?.some((d: any) => d.id === cry.id));
ok("persisted snapshot contains the settled WON positions", persisted?.positions?.filter((p: any) => open.includes(p.id)).length === 2);
ok("persisted ledger has trader entries", persisted?.ledger?.some((l: any) => l.userId === SESSION_USER_ID && /TRADE|DEPOSIT|WITHDRAWAL/.test(l.type)));
ok("persisted snapshot contains the bot configs", persisted?.bots?.some((b: any) => b.id === bot.id));
ok("persisted snapshot contains the bot-stamped positions", persisted?.positions?.some((p: any) => p.bot === true && p.botId === bot.id));

// 10. re-hydrate round-trip: rebuild the in-memory db from the persisted snapshot
const rehydrated = JSON.parse(backing.get("lx_store_v1") || "{}");
Object.assign(db, rehydrated);
ok("re-hydrated data reproduces trader history", (rehydrated.positions ?? []).filter((p: any) => open.includes(p.id) && p.status === "WON").length === 2);
ok("re-hydrated bots survive the round-trip", (rehydrated.bots ?? []).some((b: any) => b.id === bot.id && b.done === 2));

console.log(`\n${fail === 0 ? "ALL GREEN" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);

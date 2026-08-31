// SPDX-License-Identifier: GPL-3.0-only
// Register-bridge re-seat CORPUS SCAN (reviewer-rules R37). Drives core/bridge-reseat.js across every
// reachable bridge routine, at real captured entry states, and reports candidates + honest coverage.
//
// The capture problem (a direct-called-in-idiomatic helper like loc_5733 is not a ROUTINES override, so
// the unit snapshot seam can't intercept it at its own address) DISSOLVES by capturing during a TRANSLATED
// run: the translated layer dispatches everything through m.call, so a snapshot override installed at
// construction intercepts every routine, including those helpers. Each captured entry is re-homed on a
// pristine (pure-translated) registry, then the tooth runs idiomatic-vs-oracle with the bridge register
// POISONED and the value handed in as a param -- a re-seat recovers, a stale register leaks (the b0602b4f
// class, invisible to memory-eq and the base tape's early-1P reach).
//
// A HIT is a CANDIDATE, never a verdict: the poison-at-entry tooth is conservative -- it flags any routine
// whose observable effect would diverge if the register differed from the param at a downstream read, a
// SUPERSET of real defects. Triage each vs the oracle/MAME (a caller that seats the register, or an
// unclobbered pure dispatcher, is a false positive). See scratchpad/POOYAN-OPEN-GAPS.md for the triage record.
//
// Run:  node tools/bridge_reseat_scan.mjs --game pooyan
//       node tools/bridge_reseat_scan.mjs --game pooyan --selfcheck   (proves the driver reports >0)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bridgeReseatEquivalent } from "../core/bridge-reseat.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const REG16 = new Set(["ix", "iy", "hl", "de", "bc"]);
const POISON16 = { ix: 0x8b40, iy: 0x8b52, hl: 0x8b64, de: 0x8b76, bc: 0x8b88 };
const hx = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
function poisonFor(reg, v) {
  if (REG16.has(reg)) { let p = POISON16[reg] ?? 0x8b40; if (p === v) p = (p + 8) & 0xffff; return p; }
  let p = (v ^ 0x80) & 0xff; if (p === v) p = (v ^ 0x40) & 0xff; return p;
}

// Parse a module's exported function signature into its (param -> register) bridge map, or null when the
// export is absent / not a PURE register-bridge (a non-register param means it is not register-dispatched).
function bridgeSignature(src, fnName) {
  const marker = `export function ${fnName}(`;
  let i = src.indexOf(marker);
  if (i < 0) return null;
  i += marker.length - 1;
  let depth = 0, inner = "";
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === "(") { depth++; if (depth === 1) continue; }
    else if (ch === ")") { depth--; if (depth === 0) break; }
    inner += ch;
  }
  const parts = inner.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts[0] !== "m") return null;
  const params = [];
  for (const p of parts.slice(1)) {
    const mm = p.match(/^([A-Za-z_$][\w$]*)\s*=\s*m\.regs\.([a-z]+)$/);
    if (!mm) return { pure: false, params: [] };
    params.push({ name: mm[1], reg: mm[2] });
  }
  return { pure: true, params };
}

async function loadGame(game) {
  const gdir = join(ROOT, "games", game);
  const { Machine } = await import(join(gdir, "machine.js"));
  const { runCycleFree } = await import(join(ROOT, "core/frame-stepped.js"));
  const { ROUTINE_ENTRIES } = await import(join(gdir, "translated/_registry.generated.js"));
  const names = await import(join(gdir, "idiomatic/names.js"));
  const manifest = (await import(join(gdir, "manifest.js"))).default;
  const romPath = join(gdir, "rom/maincpu.bin");
  if (!existsSync(romPath)) throw new Error(`no ROM at ${romPath} — run make -C games/${game} rom`);
  const rom = new Uint8Array(readFileSync(romPath));
  return { gdir, Machine, runCycleFree, ROUTINE_ENTRIES, names, manifest, rom };
}

// Enumerate the bridge routines: idiomatic modules with a pure register-bridge signature, a known address
// (loc_<addr> filename or a ROUTINES name), and a translated oracle at that address.
async function enumerateBridges(g) {
  const idir = join(g.gdir, "idiomatic");
  const translatedByAddr = new Map(g.ROUTINE_ENTRIES);
  const nameToAddr = new Map();
  for (const [addr, meta] of Object.entries(g.names.ROUTINES)) nameToAddr.set(meta.name, Number(addr));
  const files = readdirSync(idir).filter((f) => f.endsWith(".js") && f !== "names.js");
  const bridges = [];
  // Every module lands in exactly one bucket -- a bridge, or a counted skip. No silent drops: an
  // unparsedSig (regex matched the export but bridgeSignature's exact marker did not, e.g. a space before
  // the paren) would otherwise vanish uncounted, hiding a real bridge from the coverage report.
  const skips = { noFnExport: 0, noAddr: 0, noOracle: 0, unparsedSig: 0, notPureBridge: 0, noBridgeParam: 0, noCallable: 0 };
  for (const f of files) {
    const src = readFileSync(join(idir, f), "utf8");
    const exp = src.match(/export function ([A-Za-z_$][\w$]*)\s*\(/);
    if (!exp) { skips.noFnExport++; continue; }
    const fnName = exp[1];
    const locm = f.match(/^loc_([0-9a-f]{4})\.js$/);
    const addr = locm ? parseInt(locm[1], 16) : nameToAddr.get(fnName) ?? null;
    if (addr == null) { skips.noAddr++; continue; }
    if (!translatedByAddr.has(addr)) { skips.noOracle++; continue; }
    const sig = bridgeSignature(src, fnName);
    if (!sig) { skips.unparsedSig++; continue; }
    if (!sig.pure) { skips.notPureBridge++; continue; }
    if (sig.params.length === 0) { skips.noBridgeParam++; continue; }
    const mod = await import(join(idir, f));
    if (typeof mod[fnName] !== "function") { skips.noCallable++; continue; }
    bridges.push({ addr, name: fnName, params: sig.params, fn: mod[fnName], oracle: translatedByAddr.get(addr) });
  }
  return { bridges, skips, translatedByAddr };
}

// One capture pass: run the translated oracle with a snapshot at every bridge addr, grabbing each routine's
// first entry (re-homed on a pristine registry so the tooth's oracle side runs pure-translated).
function capture(g, bridgeAddrs, translatedByAddr, scenario, pristine) {
  const captured = new Map();
  const snapshot = new Map();
  for (const addr of bridgeAddrs) {
    snapshot.set(addr, (mm, ...args) => {
      if (!captured.has(addr)) { const e = mm.clone(); e.routines = pristine; captured.set(addr, e); }
      return translatedByAddr.get(addr)(mm, ...args);
    });
  }
  const m = new g.Machine(g.rom, { overrides: snapshot });
  const { pollPCs } = g.manifest.convergence;
  const r = g.runCycleFree(m, {
    pollPCs, maxFrames: scenario.frames, stepBudget: scenario.frames * 200000,
    onFrame: (mm, f) => {
      if (f === 0) return;
      if (scenario.poke) scenario.poke(mm, f);
      mm.io.inputAssert = scenario.tape ? scenario.tape(mm, f) : {};
    },
  });
  return { captured, stop: r.stop, stopError: r.stopError, frames: r.frames };
}

function toothOne(b, entry, inDeadStack) {
  try { b.oracle(entry.clone()); }
  catch (e) { return { status: "unscannable", why: `oracle throws from this state: ${e.message}` }; }
  const live = {}, poison = {}, args = [];
  for (const p of b.params) {
    const v = entry.regs[p.reg] & (REG16.has(p.reg) ? 0xffff : 0xff);
    args.push(v); live[p.reg] = v; poison[p.reg] = poisonFor(p.reg, v);
  }
  try {
    const r = bridgeReseatEquivalent(entry, b.oracle, b.fn, { live, poison, args, excludeAddr: inDeadStack });
    return r.equal ? { status: "clean" } : { status: "hit", addr: r.ram?.addr, a: r.ram?.a, b: r.ram?.b };
  } catch (e) {
    return { status: "hit-throw", why: e.message };
  }
}

// -- pooyan scenarios: the poke-tape tranche. Inputs are pressed-bit (io folds active-low). ----------
function pooyanScenarios(A, names) {
  const press = (a, act) => { a[act.port] = (a[act.port] || 0) | act.bit; };
  const play = (a, f) => { if (f % 24 < 4) press(a, A.fire); press(a, Math.floor(f / 60) % 2 ? A.down : A.up); };
  const coinStart1 = (a, f) => { if (f >= 300 && f < 306) press(a, A.coin); if (f >= 360 && f < 366) press(a, A.start1); if (f >= 420) play(a, f); };
  return [
    { name: "attract", frames: 900 },
    {
      name: "1P coin/start/play", frames: 1600,
      tape: (m, f) => { const a = {}; if (f >= 300 && f < 306) press(a, A.coin); if (f >= 360 && f < 366) press(a, A.start1); if (f >= 420) play(a, f); return a; },
    },
    {
      name: "2P coin/coin/start2/play", frames: 1600,
      tape: (m, f) => { const a = {}; if (f >= 300 && f < 306) press(a, A.coin); if (f >= 320 && f < 326) press(a, A.coin2 ?? A.coin); if (f >= 380 && f < 386) press(a, A.start2); if (f >= 440) play(a, f); return a; },
    },
    {
      // Round-advance poke: after entering play, bump the round counter so later-wave spawn tables run.
      name: "late-wave (round-advance poke)", frames: 1700,
      tape: (m, f) => { const a = {}; if (f >= 300 && f < 306) press(a, A.coin); if (f >= 360 && f < 366) press(a, A.start1); if (f >= 420) play(a, f); return a; },
      poke: (m, f) => { if (f === 700) m.mem.write8(names.ROUND_COUNTER, 0x06); },
    },
    {
      // Long natural play, sustained fire -> survive and advance through waves organically (pooyan's
      // ROM-integrity checks TRAP a raw state/round poke, so deep states are reached by PLAY, not pokes).
      name: "long survive (sustained fire)", frames: 4200,
      tape: (m, f) => {
        const a = {}; if (f >= 300 && f < 306) press(a, A.coin); if (f >= 360 && f < 366) press(a, A.start1);
        if (f >= 420) { if (f % 10 < 6) press(a, A.fire); press(a, Math.floor(f / 45) % 2 ? A.down : A.up); }
        return a;
      },
    },
    {
      // No-fire play -> let waves through -> lose lives -> the death / life-loss states (lives 3->2->1).
      // NOTE: true game-over is NOT reachable this way yet -- past ~f5510 the deep-death path reaches the
      // untranslated 0x1c03 (a 0x15a8-dispatch handler) and throws, before all lives are spent; capped here
      // to capture the life-loss states cleanly. Translating 0x1c03 unblocks the game-over subtree.
      name: "no-fire deep death (life-loss states)", frames: 4000,
      tape: (m, f) => {
        const a = {}; if (f >= 300 && f < 306) press(a, A.coin); if (f >= 360 && f < 366) press(a, A.start1);
        if (f >= 420) press(a, Math.floor(f / 90) % 2 ? A.down : A.up); // move but never fire
        return a;
      },
    },
  ];
}

export async function scan(game, { selfcheck = false, quiet = false } = {}) {
  const g = await loadGame(game);
  const { bridges, skips, translatedByAddr } = await enumerateBridges(g);
  const { STACK_SCRATCH } = g.names;
  const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
  const pristine = new g.Machine(g.rom).routines;
  const byAddr = new Map(bridges.map((b) => [b.addr, b]));

  if (selfcheck) {
    // Prove the driver's capture->tooth->report path reports >0: swap loc_5733 for a faithful copy MINUS its
    // `m.regs.ix = ix` re-seat (the b0602b4f defect) and require the driver to flag 0x5733.
    const t = byAddr.get(0x5733);
    if (!t) throw new Error("selfcheck: 0x5733 not enumerated");
    t.fn = await mutantMissingReseat(g.gdir, g.names);
  }

  const scenarios = pooyanScenarios(g.manifest.inputs.actions, g.names);
  const reached = new Set();
  const entryOf = new Map();
  const perScenario = [];
  for (const s of scenarios) {
    const c = capture(g, [...byAddr.keys()], translatedByAddr, s, pristine);
    for (const [addr, e] of c.captured) { if (!entryOf.has(addr)) { entryOf.set(addr, e); } reached.add(addr); }
    perScenario.push({ name: s.name, frames: c.frames, stop: c.stop, err: c.stopError, captured: c.captured.size });
  }

  const hits = [], unscannable = [];
  let clean = 0;
  for (const addr of reached) {
    const res = toothOne(byAddr.get(addr), entryOf.get(addr), inDeadStack);
    if (res.status === "clean") clean++;
    else if (res.status === "unscannable") unscannable.push({ addr, res });
    else hits.push({ addr, name: byAddr.get(addr).name, params: byAddr.get(addr).params, res });
  }
  const notReached = bridges.filter((b) => !reached.has(b.addr)).map((b) => b.name);

  const report = { enumerated: bridges.length, skips, reached: reached.size, clean, unscannable: unscannable.length, hits, notReached, perScenario };
  if (!quiet) printReport(report);
  return report;
}

function printReport(r) {
  const skipStr = Object.entries(r.skips).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(" ") || "none";
  console.log(`bridge routines enumerated: ${r.enumerated}  (skipped: ${skipStr})`);
  for (const s of r.perScenario) console.log(`  scenario "${s.name}": ${s.frames} frames (${s.stop}${s.err ? " ERR " + s.err : ""}) -> captured ${s.captured}`);
  console.log(`COVERAGE: reached ${r.reached}/${r.enumerated} under the scenarios; ${r.notReached.length} not reached (need deeper poke-tapes)`);
  console.log(`TOOTH: clean=${r.clean} unscannable=${r.unscannable} HITS=${r.hits.length}`);
  for (const h of r.hits) {
    const loc = h.res.addr != null ? `RAM ${hx(h.res.addr)} oracle=${h.res.a} idiomatic=${h.res.b}` : h.res.why || "";
    console.log(`  HIT ${h.name} @${hx(h.addr)} [${h.params.map((p) => p.reg).join(",")}] ${h.res.status} ${loc}`);
  }
  if (r.notReached.length) console.log(`  not reached (sample): ${r.notReached.slice(0, 24).join(", ")}${r.notReached.length > 24 ? " …" : ""}`);
}

// The b0602b4f mutant for --selfcheck: the real idiomatic loc_5733 verbatim MINUS its `m.regs.ix = ix`
// re-seat, delegating through the real idiomatic sub-chain (decrementPhaseCounterAndDispatchSpawnOrStep -> loc_57c6 reads `= m.regs.ix`).
async function mutantMissingReseat(gdir, N) {
  const idir = join(gdir, "idiomatic");
  const { fetchByteFromTableIndex } = await import(join(idir, "fetchByteFromTableIndex.js"));
  const { adjustSpawnColumn } = await import(join(idir, "adjustSpawnColumn.js"));
  const { setActorAnimation } = await import(join(idir, "setActorAnimation.js"));
  const { decrementPhaseCounterAndDispatchSpawnOrStep } = await import(join(idir, "decrementPhaseCounterAndDispatchSpawnOrStep.js"));
  return function loc_5733_missingReseat(m, c = m.regs.c, ix = m.regs.ix, e = m.regs.e) {
    const { mem8 } = m;
    const stateSeed = c;
    mem8[ix + 0x00] = 0x01; mem8[ix + 0x02] = 0x03; mem8[ix + 0x04] = e; mem8[ix + 0x03] = 0x00;
    mem8[ix + 0x05] = 0x00; mem8[ix + 0x06] = 0x00; mem8[ix + 0x08] = 0x00; mem8[ix + 0x07] = 0x01;
    mem8[ix + 0x0b] = 0x00;
    const odd = mem8[N.ROUND_COUNTER] & 0x01;
    let col = mem8[N.DIFFICULTY_DSW]; if (col >= 0x03) col = 0x03;
    if (mem8[N.GAUGE_PHASE_COUNTER] >= 0x04) col = (col + mem8[N.SPAWN_COLUMN_BIAS]) & 0xff;
    if (odd === 0) col = adjustSpawnColumn(m, col);
    col = (mem8[N.ROUND_COUNTER] + col) & 0xff; if (col >= 0x20) col = 0x1f;
    const [motion] = fetchByteFromTableIndex(m, odd ? N.SPAWN_FIELD_TABLE_ODD : N.SPAWN_FIELD_TABLE, col);
    mem8[ix + 0x09] = motion; mem8[ix + 0x0a] = -motion;
    setActorAnimation(m, ix, N.ANIM_TABLE_3829);
    const [timer] = fetchByteFromTableIndex(m, odd ? N.SPAWN_TIMER_TABLE_ODD : N.SPAWN_TIMER_TABLE_EVEN, col);
    mem8[N.ENEMY_SPAWN_TIMER] = timer;
    mem8[N.ACTIVE_ENEMY_COUNT] = mem8[N.ACTIVE_ENEMY_COUNT] + 1;
    // BUG: no `m.regs.ix = ix` -> the decrementPhaseCounterAndDispatchSpawnOrStep -> loc_57c6 chain reads a stale m.regs.ix.
    decrementPhaseCounterAndDispatchSpawnOrStep(m, stateSeed);
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const game = process.argv[process.argv.indexOf("--game") + 1] || "pooyan";
  const selfcheck = process.argv.includes("--selfcheck");
  const r = await scan(game, { selfcheck });
  if (selfcheck) {
    const caught = r.hits.some((h) => h.addr === 0x5733);
    console.log(`\nSELFCHECK: ${caught ? "PASS — the driver flags the injected missing-re-seat mutant" : "FAIL — the driver did NOT flag the mutant"}`);
    process.exit(caught ? 0 : 1);
  }
}

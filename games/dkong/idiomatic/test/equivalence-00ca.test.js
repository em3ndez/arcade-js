// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_00ca (ROM 0x00CA) — the shared computed-jump dispatcher.
 *
 * WHAT THIS ROUTINE IS, because it shapes every check below: it takes a ROM target address, decides
 * whether that address is one the inline jump tables are allowed to reach, and runs the handler
 * there. It has no body of its own — no cell read, no cell written, no register touched — so
 * "equivalent" here means "makes the same routing decision and forwards the same result", and the
 * entry shape is the target address, not a register.
 *
 * COVERAGE.
 *  - The ROUTING DECISION is covered EXHAUSTIVELY, not sampled: all 65536 possible targets are put
 *    to the oracle and to the rewrite on a machine whose routine table answers every address with a
 *    recording stub. 67 are dispatched and 65469 are refused, and the test asserts the two agree on
 *    which, on where each dispatch landed, and on the refusal text. Nothing is left to a sample and
 *    no arm is unreached — but the stub means those 67 dispatches route without running the real
 *    handler.
 *  - REAL DISPATCHES are covered for attract only: every dispatch in a 2000-frame attract run is
 *    replayed inline, both ways, on fresh override-free machines with the dispatched handler run in
 *    FULL. Attract reaches 10 of the 67 targets. The other 57 — every credited-game, interlude,
 *    death and board-advance arm — are covered by the sweep above and by nothing that runs them for
 *    real, and no entry here is crafted to force them.
 *  - The REWRITTEN-HANDLER PRE-CHECK (dispatch an installed override directly instead of through
 *    the routine table) is covered by one focused check with a non-retting, idiomatic-shaped handler
 *    installed, which is the only configuration in which the two paths differ. A twin that drops the
 *    pre-check is asserted to ESCAPE the sweep, the attract replay AND the live run, and to be
 *    caught only there — that hole is measured, not assumed.
 *
 * TEETH. Six broken twins, and the checks print which arm caught which: a target missing from the
 * accepted set (sweep AND attract replay), no accepted set at all, an extra target the oracle
 * refuses, a dispatch landing one address off (sweep), a register scribbled after a correct dispatch
 * (attract replay, asserted to be the REGISTER comparison that catches it, so that comparison is not
 * inert), and the dropped pre-check (installed-handler check only, with its escape from everything
 * else asserted). The real routine was also broken three ways and watched go red: a reached target
 * removed, an attract-unreached target removed, and the pre-check removed.
 *
 * CONTRACT. The full state dump INCLUDING STACK_SCRATCH, the whole register file, pc, SP, the
 * cycle count, and the return value (a throw counts as a result and is compared by name and text).
 * Nothing is excluded: the rewrite performs the same dispatch through the same routine table as the
 * oracle, so the stack residue is identical rather than merely irrelevant, and a separate check
 * asserts that the STACK_SCRATCH window really is byte-equal on every capture — i.e. that the
 * exclusion a unit gate would normally apply is INERT here rather than load-bearing.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-00ca.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { ORACLE_ROUTINES } from "../../routines.js";
import { NotImplemented } from "../../../../boards/dkong/io.js";
import { firstRegDiff } from "../../../../core/equivalence.js";
import { loc_00ca as oracle } from "../../translated/loc_00ca.js";
import { loc_00ca } from "../loc_00ca.js";
import { STACK_SCRATCH } from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/dkong/rom/maincpu.bin" }, fn);

const ATTRACT_FRAMES = 2000;

// The dispatch-site label. It is read only on the refusal path, where it names which table a
// target fell out of; every dispatched call ignores it. This is the oracle's own default.
const SITE = "0x00CA (NMI game state)";

// A work-RAM cell the sweep's stubs mark so that "the stub ran" is observable in machine state and
// not only in a JS counter. Below STACK_SCRATCH (0x6BE0) and below the guest stack pointer at every
// dispatch this gate replays, so marking it disturbs nothing either side is reading.
const STUB_MARK = 0x6bd0;

const hx = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// -- vehicles -----------------------------------------------------------------

/**
 * A fresh machine carrying another's observable state and NONE of its overrides.
 *
 * clone() would be wrong here: it rebuilds from the source's constructor options, so it carries the
 * capturing hooks with it and a replay re-enters them. Rehosting drops them, which is also what puts
 * the replay on the routine-table path (an override-free machine has nothing for the rewritten-
 * handler pre-check to find) — the path the live run below cannot reach.
 */
function rehost(src, opts) {
  const c = new Machine(ROM, opts);
  c.mem.workRam.set(src.mem.workRam);
  c.mem.spriteRam.set(src.mem.spriteRam);
  c.mem.videoRam.set(src.mem.videoRam);
  c.mem.discardedWrites = src.mem.discardedWrites;
  c.regs.copyFrom(src.regs);
  c.io.loadStateFrom(src.io);
  c.cycles = src.cycles;
  c.pc = src.pc;
  c.pcKnown = src.pcKnown;
  c.frame = src.frame;
  c.nmiCount = src.nmiCount;
  c.booted = src.booted;
  c.nextBoundary = Infinity;
  c.nextNmi = Infinity;
  c.maxFrames = Infinity;
  c.maxCycles = Infinity;
  return c;
}

/** Run a dispatcher and reduce "returned x" / "threw y" to one comparable value. */
function outcome(fn, m, target) {
  try {
    return { returned: fn(m, target, SITE) };
  } catch (e) {
    return { threw: `${e.constructor.name}: ${e.message}` };
  }
}

/** Compare two outcomes; null when they agree. */
function outcomeDiff(a, b) {
  if (a.threw !== b.threw) return { kind: "throw", a: a.threw ?? "(returned)", b: b.threw ?? "(returned)" };
  if (a.returned !== b.returned) return { kind: "return", a: a.returned, b: b.returned };
  return null;
}

// -- 1. THE ROUTING DECISION, over every possible target ----------------------

/**
 * Put all 65536 targets to `fn` on a machine whose routine table answers EVERY address with a stub
 * that records where it was called and marks work RAM. No real handler runs, so this is safe to
 * drive with targets the game never produces, and a mis-route is visible as the wrong recorded
 * address rather than as whatever a wrongly-run handler happened to do.
 */
function sweepRouting(fn) {
  const m = new Machine(ROM);
  let landedAt = null;
  m.routines = {
    get: (addr) => (mm) => {
      landedAt = addr;
      mm.mem.write8(STUB_MARK, addr & 0xff);
      return 0x1000 + (addr & 0x0fff);
    },
  };
  const accepted = new Map();
  const refused = new Map();
  for (let target = 0; target <= 0xffff; target++) {
    landedAt = null;
    m.mem.write8(STUB_MARK, 0);
    const r = outcome(fn, m, target);
    if (r.threw !== undefined) refused.set(target, r.threw);
    else accepted.set(target, { landedAt, returned: r.returned, mark: m.mem.read8(STUB_MARK) });
  }
  return { accepted, refused };
}

const ORACLE_SWEEP = ROM_PRESENT ? sweepRouting(oracle) : { accepted: new Map(), refused: new Map() };

// The list the attract hooks below are installed on comes from the ORACLE's accept set, never from
// the rewrite's — otherwise a rewrite that dropped a target would also drop its own coverage.
const ORACLE_TARGETS = [...ORACLE_SWEEP.accepted.keys()];

/** First disagreement between the oracle's routing and a candidate's, or null. */
function routingBreach(candidate) {
  const s = sweepRouting(candidate);
  for (const [target, o] of ORACLE_SWEEP.accepted) {
    const c = s.accepted.get(target);
    if (c === undefined) return { target, kind: "refused a target the oracle dispatches", a: "dispatch", b: s.refused.get(target) };
    if (c.landedAt !== o.landedAt) return { target, kind: "dispatched to a different address", a: hx(o.landedAt), b: hx(c.landedAt) };
    if (c.returned !== o.returned) return { target, kind: "forwarded a different value", a: o.returned, b: c.returned };
    if (c.mark !== o.mark) return { target, kind: "left a different mark in RAM", a: o.mark, b: c.mark };
  }
  for (const [target, o] of ORACLE_SWEEP.refused) {
    if (s.accepted.has(target))
      return { target, kind: "dispatched a target the oracle refuses", a: "refusal", b: hx(s.accepted.get(target).landedAt) };
    const c = s.refused.get(target);
    if (c !== o) return { target, kind: "different refusal text", a: o, b: c };
  }
  return null;
}

test("EQUAL: the routing decision matches the oracle on all 65536 possible targets", () => {
  assert.equal(
    ORACLE_SWEEP.accepted.size + ORACLE_SWEEP.refused.size,
    65536,
    "the sweep did not reach every target",
  );
  assert.ok(ORACLE_SWEEP.accepted.size > 0, "the oracle dispatched nothing — the sweep proves nothing");
  const breach = routingBreach(loc_00ca);
  assert.equal(
    breach,
    null,
    breach ? `target ${hx(breach.target)}: ${breach.kind} (oracle ${breach.a}, rewrite ${breach.b})` : "",
  );
  console.log(
    `  EQUAL/routing: ${ORACLE_SWEEP.accepted.size} targets dispatched and ` +
      `${ORACLE_SWEEP.refused.size} refused, identically, over all 65536 addresses; ` +
      "every dispatch landed on the address asked for",
  );
});

// -- 2. EVERY REAL DISPATCH IN AN ATTRACT RUN, replayed inline ----------------

/**
 * Boot attract with a hook on every target the oracle dispatches. The hook fires with the machine
 * in EXACTLY the state the dispatcher was entered with — nothing happens before the routing
 * decision — so it is a real entry state, not a crafted one, and the target is known.
 *
 * At each dispatch: rehost twice, run the oracle on one and the candidate on the other WITH THE
 * DISPATCHED HANDLER RUNNING IN FULL, compare, discard. O(1) memory, so every dispatch is replayed
 * rather than a sample of them. Then hand the host's dispatch to the oracle so the run proceeds.
 */
function replayOverAttract(candidate) {
  const breaches = [];
  const byTarget = new Map();
  const stackWindowDiffs = [];
  let dispatches = 0;

  const spec = {};
  for (const target of ORACLE_TARGETS) {
    spec[target.toString(16)] = (mm) => {
      dispatches++;
      byTarget.set(target, (byTarget.get(target) ?? 0) + 1);

      const a = rehost(mm);
      const b = rehost(mm);
      const ro = outcome(oracle, a, target);
      const rc = outcome(candidate, b, target);

      let breach = outcomeDiff(ro, rc);
      if (!breach) {
        const da = a.dumpState();
        const db = b.dumpState();
        for (let i = 0; i < da.length; i++) {
          if (da[i] === db[i]) continue;
          const addr = a.stateOffsetToAddr(i);
          if (addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi) stackWindowDiffs.push(addr);
          breach = { kind: "state", addr, a: da[i], b: db[i] };
          break;
        }
      }
      if (!breach) {
        const reg = firstRegDiff(a.regs, b.regs);
        if (reg) breach = { kind: `register ${reg.reg}`, a: reg.a, b: reg.b };
      }
      if (!breach && a.pc !== b.pc) breach = { kind: "pc", a: hx(a.pc), b: hx(b.pc) };
      if (!breach && a.regs.sp !== b.regs.sp) breach = { kind: "sp", a: hx(a.regs.sp), b: hx(b.regs.sp) };
      if (!breach && a.cycles !== b.cycles) breach = { kind: "cycles", a: a.cycles, b: b.cycles };
      if (breach) breaches.push({ target, ...breach });

      return ORACLE_ROUTINES.get(target)(mm);
    };
  }
  new Machine(ROM, { overrides: spec }).runFrames(ATTRACT_FRAMES);
  return { breaches, byTarget, dispatches, stackWindowDiffs };
}

const ATTRACT = ROM_PRESENT ? replayOverAttract(loc_00ca) : { breaches: [], byTarget: new Map(), dispatches: 0, stackWindowDiffs: [] };

test("EQUAL: every real attract dispatch replays identically, handler and all", () => {
  assert.ok(
    ATTRACT.dispatches > 0,
    "no dispatch was captured in the attract run — this check would be vacuous",
  );
  const [first] = ATTRACT.breaches;
  assert.equal(
    ATTRACT.breaches.length,
    0,
    first
      ? `${ATTRACT.breaches.length} breach(es), first at target ${hx(first.target)}: ${first.kind} ` +
        `${first.addr === undefined ? "" : hx(first.addr)} oracle=${first.a} rewrite=${first.b}`
      : "",
  );
  const spread = [...ATTRACT.byTarget]
    .sort((p, q) => q[1] - p[1])
    .map(([t, n]) => `${hx(t)}x${n}`)
    .join(" ");
  console.log(
    `  EQUAL/attract: ${ATTRACT.dispatches} of ${ATTRACT.dispatches} real dispatches in ` +
      `${ATTRACT_FRAMES} frames replayed both ways; ${ATTRACT.byTarget.size} of ` +
      `${ORACLE_TARGETS.length} targets reached: ${spread}`,
  );
});

test("the STACK_SCRATCH exclusion is INERT here — the stack window is byte-equal too", () => {
  assert.equal(
    ATTRACT.stackWindowDiffs.length,
    0,
    `the stack window differed at ${ATTRACT.stackWindowDiffs.map(hx).join(",")} — the full-dump ` +
      "comparison this gate claims is not safe and the header is wrong",
  );
  console.log(
    `  INERT: 0 differences inside 0x${STACK_SCRATCH.lo.toString(16)}-0x${(STACK_SCRATCH.hi - 1).toString(16)} ` +
      `over ${ATTRACT.dispatches} dispatches, so comparing the FULL dump costs nothing and adds teeth`,
  );
});

// -- 3. THE REWRITTEN-HANDLER PRE-CHECK ---------------------------------------

/** One real entry state, captured early in attract, for the focused checks below. */
function captureOneEntry(target) {
  let snap = null;
  const spec = {};
  for (const t of ORACLE_TARGETS) {
    spec[t.toString(16)] = (mm) => {
      if (t === target && snap === null) snap = mm.clone();
      return ORACLE_ROUTINES.get(t)(mm);
    };
  }
  new Machine(ROM, { overrides: spec }).runFrames(60);
  return snap;
}

const ENTRY_073C = ROM_PRESENT ? captureOneEntry(0x073c) : null;

/**
 * Run one dispatch with an idiomatic-SHAPED handler installed for the target: it returns plainly
 * and never pops the guest stack, which is what a rewritten routine does and what the engine's
 * call-bracket seam exists to compensate for. Report where the dispatch went, what the guest stack
 * did, and whether the routine table was consulted at all.
 */
function dispatchWithInstalledHandler(fn, target) {
  let fired = 0;
  const m = rehost(ENTRY_073C, {
    overrides: {
      [target.toString(16)]: (mm) => {
        fired++;
        mm.mem.write8(STUB_MARK, 0x5a);
        return 7;
      },
    },
  });
  const consulted = [];
  const base = m.call.bind(m);
  m.call = (addr, ...rest) => {
    consulted.push(addr);
    return base(addr, ...rest);
  };
  const spBefore = m.regs.sp;
  const r = outcome(fn, m, target);
  return { fired, consulted, spBefore, spAfter: m.regs.sp, mark: m.mem.read8(STUB_MARK), ...r };
}

test("EQUAL: an installed handler is dispatched directly, leaving the guest stack where the oracle does", () => {
  assert.ok(ENTRY_073C !== null, "no entry state was captured — this check would be vacuous");
  const o = dispatchWithInstalledHandler(oracle, 0x073c);
  const c = dispatchWithInstalledHandler(loc_00ca, 0x073c);

  assert.equal(o.fired, 1, "the installed handler never ran on the oracle side — nothing is being observed");
  assert.equal(o.mark, 0x5a, "the installed handler left no mark — it is indistinguishable from no handler");
  assert.deepEqual(
    { fired: c.fired, consulted: c.consulted, sp: c.spAfter, mark: c.mark, returned: c.returned },
    { fired: o.fired, consulted: o.consulted, sp: o.spAfter, mark: o.mark, returned: o.returned },
  );
  console.log(
    `  EQUAL/pre-check: handler ran ${o.fired}x, routine table consulted ` +
      `${o.consulted.length}x, guest stack ${hx(o.spBefore)} -> ${hx(o.spAfter)}, forwarded ${o.returned}`,
  );
});

// -- 4. TEETH -----------------------------------------------------------------

const REAL_TARGETS = new Set(ORACLE_TARGETS);

/** Twin: one reachable target is missing from the accepted set, so it is refused instead of run. */
function twinMissingTarget(m, target, site = SITE) {
  if (target === 0x073c) throw new NotImplemented(`handler at ROM 0x073c (reached via rst 0x28 table at ${site})`);
  return loc_00ca(m, target, site);
}

/** Twin: no accepted set at all — any address with a routine behind it is dispatched. */
function twinNoBounds(m, target) {
  if (m.overrides && m.overrides.has(target)) return m.overrides.get(target)(m);
  return m.call(target);
}

/** Twin: one address the oracle refuses is accepted. */
function twinExtraTarget(m, target, site = SITE) {
  if (target === 0x02bd) return m.call(target);
  return loc_00ca(m, target, site);
}

/** Twin: the dispatch lands one address off. */
function twinMisroute(m, target, site = SITE) {
  if (REAL_TARGETS.has(target)) return m.call(target ^ 1);
  return loc_00ca(m, target, site);
}

/** Twin: the rewritten-handler pre-check is dropped; everything goes through the routine table. */
function twinNoPreCheck(m, target, site = SITE) {
  if (REAL_TARGETS.has(target)) return m.call(target);
  throw new NotImplemented(
    `handler at ROM 0x${target.toString(16).padStart(4, "0")} (reached via rst 0x28 table at ${site})`,
  );
}

for (const [name, twin] of [
  ["a target missing from the accepted set", twinMissingTarget],
  ["no accepted set at all", twinNoBounds],
  ["an extra target the oracle refuses", twinExtraTarget],
  ["a dispatch that lands one address off", twinMisroute],
]) {
  test(`TEETH: a twin with ${name} is CAUGHT by the 65536-target sweep`, () => {
    const breach = routingBreach(twin);
    assert.ok(breach !== null, `the sweep FAILED to catch the "${name}" twin — it proves nothing`);
    console.log(
      `  TEETH/sweep/${name}: caught at target ${hx(breach.target)} — ${breach.kind} ` +
        `(oracle ${breach.a}, twin ${breach.b})`,
    );
  });
}

test("TEETH: the missing-target twin is ALSO caught by the real attract dispatches", () => {
  const r = replayOverAttract(twinMissingTarget);
  assert.ok(r.breaches.length > 0, "the attract replay FAILED to catch the missing-target twin");
  const [first] = r.breaches;
  console.log(
    `  TEETH/attract/missing target: caught on ${r.breaches.length} of ${r.dispatches} dispatches; ` +
      `first at ${hx(first.target)} — ${first.kind} (oracle ${first.a}, twin ${first.b})`,
  );
});

/** Twin: routes correctly, then leaves a register the handler did not leave. */
function twinRegisterResidue(m, target, site = SITE) {
  const r = loc_00ca(m, target, site);
  m.regs.a = m.regs.a ^ 0xff;
  return r;
}

test("TEETH: a twin that scribbles a register after dispatching is caught, ON THE REGISTER CHECK", () => {
  const r = replayOverAttract(twinRegisterResidue);
  assert.ok(r.breaches.length > 0, "the attract replay FAILED to catch the register-residue twin");
  const [first] = r.breaches;
  assert.ok(
    first.kind.startsWith("register"),
    `the register comparison is not what caught it (${first.kind}) — it may be inert`,
  );
  console.log(
    `  TEETH/attract/register residue: caught on ${r.breaches.length} of ${r.dispatches} dispatches; ` +
      `first at ${hx(first.target)} — ${first.kind} (oracle ${first.a}, twin ${first.b})`,
  );
});

test("TEETH: the dropped-pre-check twin is caught ONLY by the installed-handler check", () => {
  // The half that matters: it IS caught where the semantic lives — the guest stack leaks 2 bytes
  // per dispatch because the seam balances a bracket the computed jump never opened.
  const o = dispatchWithInstalledHandler(oracle, 0x073c);
  const t = dispatchWithInstalledHandler(twinNoPreCheck, 0x073c);
  assert.notDeepEqual(
    { consulted: t.consulted.length, sp: t.spAfter },
    { consulted: o.consulted.length, sp: o.spAfter },
    "the installed-handler check FAILED to catch the dropped-pre-check twin",
  );

  // The other half, stated because it is a real hole in the rest of this gate rather than an
  // assumption: with only oracle handlers behind them, the two dispatch paths are indistinguishable,
  // so nothing else here can see this defect.
  assert.equal(routingBreach(twinNoPreCheck), null, "the sweep unexpectedly sees the pre-check");
  assert.equal(
    replayOverAttract(twinNoPreCheck).breaches.length,
    0,
    "the attract replay unexpectedly sees the pre-check",
  );
  console.log(
    `  TEETH/pre-check: caught — routine table consulted ${t.consulted.length}x vs ${o.consulted.length}x, ` +
      `guest stack ${hx(t.spAfter)} vs ${hx(o.spAfter)} (a ${o.spAfter - t.spAfter}-byte leak per dispatch); ` +
      "ESCAPES the 65536-target sweep and all real attract dispatches",
  );
});

// -- 5. LIVE-OUT, measured over a whole run -----------------------------------

/**
 * Drive a whole attract run with `dispatcher` standing in the dispatch position at every one of the
 * ROM's computed jumps, and return the frame trace.
 *
 * The vehicle: a hook on each target, which is the only seam a routine reached by direct import has.
 * The hook hands the dispatch to `dispatcher`; the dispatcher's own lookup of that same target
 * bounces straight back into the hook, and the bounce flag routes that one re-entry to the frozen
 * handler. Nested dispatches inside the handler clear the flag, so they go through `dispatcher` too
 * and the whole run is covered rather than only the outermost dispatch per frame.
 *
 * Because the hook is what the dispatcher finds, this run exercises the installed-handler path;
 * the routine-table path is what the rehosted attract replay above covers. Between them both arms
 * of the routing decision run against real machine state.
 */
function runWholeAttract(dispatcher) {
  let bounce = false;
  let dispatches = 0;
  const spec = {};
  for (const target of ORACLE_TARGETS) {
    spec[target.toString(16)] = (mm) => {
      if (bounce) {
        bounce = false;
        return ORACLE_ROUTINES.get(target)(mm);
      }
      dispatches++;
      bounce = true;
      try {
        return dispatcher(mm, target, SITE);
      } finally {
        bounce = false;
      }
    };
  }
  const m = new Machine(ROM, { overrides: spec });
  return { trace: m.runFrames(ATTRACT_FRAMES), dispatches: () => dispatches, m };
}

test("LIVE-OUT: wired live for a whole attract run, the rewrite leaves the same trace as the oracle", () => {
  // The vehicle itself must be transparent, or the comparison below is between two artefacts.
  const pure = new Machine(ROM).runFrames(ATTRACT_FRAMES);
  const base = runWholeAttract(oracle);
  const live = runWholeAttract(loc_00ca);

  assert.equal(base.dispatches(), ATTRACT.dispatches, "the live vehicle did not see the same dispatches as the replay");
  assert.ok(base.dispatches() > 0, "the live run dispatched nothing — it would pass against any routine");
  assert.equal(live.dispatches(), base.dispatches(), "the rewrite ran a different number of dispatches");

  for (const [label, trace] of [["the harness vehicle", base.trace], ["the rewrite", live.trace]]) {
    assert.equal(trace.length, pure.length, `${label} did not reach the same frame count`);
    for (let f = 0; f < pure.length; f++) {
      for (let i = 0; i < pure[f].length; i++) {
        if (pure[f][i] === trace[f][i]) continue;
        assert.fail(`${label}: frame ${f} ${hx(base.m.stateOffsetToAddr(i))} pure=${pure[f][i]} run=${trace[f][i]}`);
      }
    }
  }
  console.log(
    `  LIVE-OUT: ${ATTRACT_FRAMES} attract frames byte-identical with the rewrite in the dispatch ` +
      `position for all ${live.dispatches()} dispatches; no cycle charge is restored because this ` +
      "routine charges none — the dispatched handler charges its own",
  );
});

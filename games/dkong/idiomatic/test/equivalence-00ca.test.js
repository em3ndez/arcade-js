// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_00ca (ROM 0x00CA) — the shared computed-jump dispatcher.
 *
 * WHAT THIS ROUTINE IS, because it shapes every check below: it takes a ROM target address, decides
 * whether that address is one the inline jump tables are allowed to reach, and — in every shipped
 * config — hands the dispatch to the idiomatic override installed for that address. It has no body of
 * its own — no cell read, no cell written, no register touched — so "equivalent" here means "makes
 * the same routing decision and forwards the same result", and the entry shape is the target address,
 * not a register.
 *
 * WHY THIS GATE WAS REDESIGNED (and what did NOT change). The idiomatic layer never re-opens a Z80
 * call bracket: it dispatches ONLY through installed overrides (loc_00ca line 49) and holds no
 * `m.call`. The routing decision is therefore split into a pure `resolveDispatchTarget(target)` that
 * returns the ROM address a target vectors to (identity for the whitelist) or throws by name for an
 * out-of-range selector, WITHOUT running a handler or touching a stack. This gate verifies the
 * ROUTING by comparing that resolution to the oracle's executed routing-table decision — it does NOT
 * execute the rewrite's dispatch on an override-free machine, because the rewrite no longer has such
 * a path. The oracle (frozen `translated/loc_00ca.js`) still legitimately uses `m.call`, so its
 * routing table is established by running it against a recording routine table; that table is the
 * source of truth the rewrite's resolution is checked against.
 *
 * COVERAGE.
 *  - The ROUTING DECISION is covered EXHAUSTIVELY, not sampled: all 65536 possible targets are put to
 *    the oracle (executed against a recording routine table) and to the rewrite's `resolveDispatchTarget`
 *    (pure). 67 are dispatched and 65469 are refused, and the test asserts the two agree on which, on
 *    which ROM address each accepted target resolves to, and on the refusal text.
 *  - FORWARDING AND RESIDUE are covered over every real dispatch in a 2000-frame attract run: at each
 *    dispatch the machine is rehosted twice with a recording override installed for the target — the
 *    production path (loc_00ca line 49) — and the oracle and the rewrite are each run through it and
 *    compared byte-for-byte, register file and all. loc_00ca forwards the override and adds nothing;
 *    any residue it leaves shows here. Attract reaches 10 of the 67 targets; the other 57 are covered
 *    by the exhaustive routing sweep and by the whole-run live wiring below.
 *  - THE OVERRIDE PRE-CHECK (dispatch an installed override directly, never through the routine table)
 *    is covered by one focused check with a non-retting, idiomatic-shaped handler installed. It
 *    asserts loc_00ca consults the routine table ZERO times and leaves the guest stack where the
 *    oracle does — the structural guarantee that replaced the old routine-table dispatch.
 *  - LIVE-OUT is covered over a whole attract run with the rewrite wired into the dispatch position
 *    at every computed jump (the production override path), byte-compared frame by frame to a pure
 *    oracle run.
 *
 * TEETH. Broken twins, and the checks print which arm caught which: a target missing from the
 * accepted set, no accepted set at all, an extra target the oracle refuses, a resolution that lands
 * one address off, a single target resolved to a WRONG address (the explicit null-mutant), a register
 * scribbled after a correct forward (residue replay, asserted to be the REGISTER comparison), and the
 * dropped override pre-check (installed-handler check only). The real routine was also broken and
 * watched go red: a reached target removed and the pre-check removed.
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
import { loc_00ca, resolveDispatchTarget } from "../loc_00ca.js";
import { ROUTINES } from "../names.js";
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
const SITE = "the NMI game-state table";

// A work-RAM cell the recording override marks so that "the override ran" is observable in machine
// state and not only in a JS counter. Below STACK_SCRATCH (0x6BE0) and below the guest stack pointer
// at every dispatch this gate replays, so marking it disturbs nothing either side is reading.
const STUB_MARK = 0x6bd0;

const hx = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// -- vehicles -----------------------------------------------------------------

/**
 * A fresh machine carrying another's observable state and NONE of its overrides. Used to give both
 * the oracle and the rewrite an IDENTICAL, freshly-installed override for one target, so the compare
 * below is loc_00ca-vs-loc_00ca on the production dispatch path, not a comparison of two overrides.
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
 * that records where it was called and marks work RAM. This runs the FROZEN ORACLE only: the oracle
 * legitimately dispatches with `m.call`, and the recording table turns that into an observable
 * "landed at ADDR" without running a real handler. This is the source of truth for the routing
 * decision the rewrite's pure resolution is checked against.
 */
function sweepOracleRouting(fn) {
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

const ORACLE_SWEEP = ROM_PRESENT ? sweepOracleRouting(oracle) : { accepted: new Map(), refused: new Map() };
const ORACLE_TARGETS = [...ORACLE_SWEEP.accepted.keys()];

/**
 * The candidate's routing decision by PURE RESOLUTION, over all 65536 targets. No machine, no
 * `m.call`, no handler: `resolve(target)` returns the ROM address the dispatch vectors to, or throws
 * for an out-of-range selector.
 */
function resolveRouting(resolve) {
  const accepted = new Map();
  const refused = new Map();
  for (let target = 0; target <= 0xffff; target++) {
    try {
      accepted.set(target, resolve(target, SITE));
    } catch (e) {
      refused.set(target, `${e.constructor.name}: ${e.message}`);
    }
  }
  return { accepted, refused };
}

/** First disagreement between the oracle's executed routing and a candidate's resolution, or null. */
function routingBreach(resolve) {
  const s = resolveRouting(resolve);
  for (const [target, o] of ORACLE_SWEEP.accepted) {
    if (!s.accepted.has(target))
      return { target, kind: "refused a target the oracle dispatches", a: "dispatch", b: s.refused.get(target) };
    const resolved = s.accepted.get(target);
    if (resolved !== o.landedAt)
      return { target, kind: "resolved a different address", a: hx(o.landedAt), b: hx(resolved) };
  }
  for (const [target, o] of ORACLE_SWEEP.refused) {
    if (s.accepted.has(target))
      return { target, kind: "resolved a target the oracle refuses", a: "refusal", b: hx(s.accepted.get(target)) };
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
  const breach = routingBreach(resolveDispatchTarget);
  assert.equal(
    breach,
    null,
    breach ? `target ${hx(breach.target)}: ${breach.kind} (oracle ${breach.a}, rewrite ${breach.b})` : "",
  );
  console.log(
    `  EQUAL/routing: ${ORACLE_SWEEP.accepted.size} targets resolve to the address the oracle ` +
      `dispatches to and ${ORACLE_SWEEP.refused.size} are refused, identically, over all 65536 ` +
      "addresses — verified by pure resolution, no m.call on the rewrite",
  );
});

// The rewrite dispatches ONLY through overrides (line 49); the throw path exists for an out-of-table
// target and for a config missing an override. That the throw path is unreachable for a valid target
// in production rests on every dispatch target having an installed idiomatic override. Assert it
// against the shipped override set, exhaustively, so "line 51 is dead code" is measured, not assumed.
test("EQUAL: every dispatch target has a shipped idiomatic override, so the throw path is dead for valid targets", () => {
  const shipped = new Set(Object.keys(ROUTINES).map(Number));
  const uncovered = ORACLE_TARGETS.filter((t) => !shipped.has(t));
  assert.deepEqual(
    uncovered.map(hx),
    [],
    `dispatch targets with NO shipped override (the rewrite would throw on them): ${uncovered.map(hx).join(",")}`,
  );
  console.log(
    `  EQUAL/coverage: all ${ORACLE_TARGETS.length} dispatch targets have a shipped idiomatic ` +
      "override, so loc_00ca line 49 handles every valid target and never reaches the throw",
  );
});

// -- 2. FORWARDING AND RESIDUE, over every real attract dispatch --------------

/**
 * A recording override: marks work RAM and returns a distinct value, standing in for the installed
 * idiomatic handler. Both the oracle and the rewrite are handed the SAME override, so they forward
 * the identical function and the comparison is loc_00ca-vs-loc_00ca, not handler-vs-handler.
 */
function recordingOverride(target) {
  return (mm) => {
    mm.mem.write8(STUB_MARK, target & 0xff);
    return 0x1000 + (target & 0x0fff);
  };
}

/**
 * Boot attract with a hook on every target the oracle dispatches. Each hook fires with the machine
 * in EXACTLY the state the dispatcher was entered with. At each dispatch: rehost twice, install the
 * SAME recording override for the target on both (the production dispatch path, loc_00ca line 49),
 * run the oracle on one and the candidate on the other, compare the full state dump, the register
 * file, pc, SP and cycles, then hand the host's dispatch to the oracle so the run proceeds.
 */
function residueOverAttract(candidate) {
  const breaches = [];
  const byTarget = new Map();
  const stackWindowDiffs = [];
  let dispatches = 0;

  const spec = {};
  for (const target of ORACLE_TARGETS) {
    spec[target.toString(16)] = (mm) => {
      dispatches++;
      byTarget.set(target, (byTarget.get(target) ?? 0) + 1);

      const ov = recordingOverride(target);
      const a = rehost(mm);
      const b = rehost(mm);
      a.overrides = new Map([[target, ov]]);
      b.overrides = new Map([[target, ov]]);
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

const ATTRACT = ROM_PRESENT
  ? residueOverAttract(loc_00ca)
  : { breaches: [], byTarget: new Map(), dispatches: 0, stackWindowDiffs: [] };

test("EQUAL: every real attract dispatch forwards identically, adding no residue", () => {
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
    `  EQUAL/forward: ${ATTRACT.dispatches} of ${ATTRACT.dispatches} real dispatches in ` +
      `${ATTRACT_FRAMES} frames forwarded both ways on the override path; ${ATTRACT.byTarget.size} of ` +
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

// -- 3. THE OVERRIDE PRE-CHECK ------------------------------------------------

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
 * Run one dispatch with an idiomatic-SHAPED handler installed for the target: it returns plainly and
 * never pops the guest stack. Report where the dispatch went, what the guest stack did, and whether
 * the routine table (`m.call`) was consulted at all — it must not be: the idiomatic layer dispatches
 * only through the override.
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

test("EQUAL: an installed handler is dispatched directly, never through the routine table", () => {
  assert.ok(ENTRY_073C !== null, "no entry state was captured — this check would be vacuous");
  const o = dispatchWithInstalledHandler(oracle, 0x073c);
  const c = dispatchWithInstalledHandler(loc_00ca, 0x073c);

  assert.equal(o.fired, 1, "the installed handler never ran on the oracle side — nothing is being observed");
  assert.equal(o.mark, 0x5a, "the installed handler left no mark — it is indistinguishable from no handler");
  assert.equal(c.consulted.length, 0, "the rewrite consulted the routine table — it must dispatch only through overrides");
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

/** Twin: one reachable target is missing from the accepted set, so it is refused instead of resolved. */
function twinMissingTarget(target, site = SITE) {
  if (target === 0x073c) throw new NotImplemented(`handler at ROM 0x073c (reached via rst 0x28 table at ${site})`);
  return resolveDispatchTarget(target, site);
}

/** Twin: no accepted set at all — every address resolves (to itself). */
function twinNoBounds(target) {
  return target;
}

/** Twin: one address the oracle refuses is resolved. */
function twinExtraTarget(target, site = SITE) {
  if (target === 0x02bd) return 0x02bd;
  return resolveDispatchTarget(target, site);
}

/** Twin: every accepted target resolves one address off. */
function twinMisroute(target, site = SITE) {
  return resolveDispatchTarget(target, site) ^ 1;
}

/** Null-mutant: exactly one real target resolves to a WRONG address; everything else is correct. */
function twinWrongOneTarget(target, site = SITE) {
  const resolved = resolveDispatchTarget(target, site);
  return target === 0x073c ? 0x0000 : resolved;
}

for (const [name, twin] of [
  ["a target missing from the accepted set", twinMissingTarget],
  ["no accepted set at all", twinNoBounds],
  ["an extra target the oracle refuses", twinExtraTarget],
  ["a resolution that lands one address off", twinMisroute],
  ["one target resolved to a wrong address (null-mutant)", twinWrongOneTarget],
]) {
  test(`TEETH: a twin with ${name} is CAUGHT by the 65536-target routing check`, () => {
    const breach = routingBreach(twin);
    assert.ok(breach !== null, `the routing check FAILED to catch the "${name}" twin — it proves nothing`);
    console.log(
      `  TEETH/routing/${name}: caught at target ${hx(breach.target)} — ${breach.kind} ` +
        `(oracle ${breach.a}, twin ${breach.b})`,
    );
  });
}

test("TEETH: the null-mutant is caught AT the mutated target, 0x073c", () => {
  const breach = routingBreach(twinWrongOneTarget);
  assert.ok(breach !== null, "the null-mutant escaped the routing check");
  assert.equal(breach.target, 0x073c, `the null-mutant was caught at ${hx(breach.target)}, not the mutated 0x073c`);
  assert.equal(breach.kind, "resolved a different address", `caught by the wrong arm: ${breach.kind}`);
  console.log(
    `  TEETH/null-mutant: 0x073c resolved to ${breach.b} but the oracle dispatches to ${breach.a} — RED`,
  );
});

test("TEETH: the missing-target twin also fails on a target attract really reaches", () => {
  assert.ok(ATTRACT.byTarget.has(0x073c), "attract did not reach 0x073c — this tooth would be vacuous");
  assert.throws(
    () => twinMissingTarget(0x073c, SITE),
    /handler at ROM 0x073c/,
    "the missing-target twin resolved 0x073c instead of refusing it",
  );
  assert.equal(resolveDispatchTarget(0x073c, SITE), 0x073c, "the real routine failed to resolve a reached target");
  console.log(
    `  TEETH/attract: 0x073c is dispatched ${ATTRACT.byTarget.get(0x073c)}x in attract; the missing-target ` +
      "twin refuses it while the real routine resolves it — the deletion would break a real dispatch",
  );
});

/** Twin: forwards correctly, then leaves a register the handler did not leave. */
function twinRegisterResidue(m, target, site = SITE) {
  const r = loc_00ca(m, target, site);
  m.regs.a = m.regs.a ^ 0xff;
  return r;
}

test("TEETH: a twin that scribbles a register after forwarding is caught, ON THE REGISTER CHECK", () => {
  const r = residueOverAttract(twinRegisterResidue);
  assert.ok(r.breaches.length > 0, "the residue replay FAILED to catch the register-residue twin");
  const [first] = r.breaches;
  assert.ok(
    first.kind.startsWith("register"),
    `the register comparison is not what caught it (${first.kind}) — it may be inert`,
  );
  console.log(
    `  TEETH/residue/register: caught on ${r.breaches.length} of ${r.dispatches} dispatches; ` +
      `first at ${hx(first.target)} — ${first.kind} (oracle ${first.a}, twin ${first.b})`,
  );
});

/** Twin: the override pre-check (line 49) is dropped, so an installed override is never dispatched. */
function twinNoPreCheck(m, target, site = SITE) {
  const resolved = resolveDispatchTarget(target, site);
  throw new NotImplemented(
    `dispatch target 0x${resolved.toString(16).padStart(4, "0")} has no installed override ` +
      `(reached via rst 0x28 table at ${site}); the idiomatic layer dispatches only through overrides`,
  );
}

test("TEETH: the dropped-override-pre-check twin is caught by the installed-handler check", () => {
  const o = dispatchWithInstalledHandler(oracle, 0x073c);
  const t = dispatchWithInstalledHandler(twinNoPreCheck, 0x073c);
  assert.notDeepEqual(
    { fired: t.fired, returned: t.returned ?? null, threw: t.threw ?? null },
    { fired: o.fired, returned: o.returned ?? null, threw: o.threw ?? null },
    "the installed-handler check FAILED to catch the dropped-override-pre-check twin",
  );
  assert.equal(t.fired, 0, "the twin unexpectedly ran the installed handler");
  console.log(
    `  TEETH/pre-check: twin ran the installed handler ${t.fired}x (oracle ${o.fired}x) and ${
      t.threw ? "threw" : "returned"
    } — dropping the override pre-check is caught`,
  );
});

// -- 5. LIVE-OUT, measured over a whole run -----------------------------------

/**
 * Drive a whole attract run with `dispatcher` standing in the dispatch position at every one of the
 * ROM's computed jumps, and return the frame trace.
 *
 * The vehicle: a hook on each target, installed as an override, which is the only seam a routine
 * reached by direct import has. The hook hands the dispatch to `dispatcher`; the dispatcher's own
 * lookup of that same target (loc_00ca line 49 finds the hook in `m.overrides`) bounces straight back
 * into the hook, and the bounce flag routes that one re-entry to the frozen handler. Nested dispatches
 * inside the handler clear the flag, so they go through `dispatcher` too and the whole run is covered.
 *
 * This exercises the production override path — the only path the idiomatic layer has — against real
 * machine state for the whole run.
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

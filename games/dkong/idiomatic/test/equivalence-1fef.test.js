// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for stepBarrelLeft (ROM 0x1FEF) — the −X arm of the barrel walk: swap the
 * register file to its alternate bank, stage the two direction constants the shared roll tail
 * consumes (slope-step selector 255, orientation direction 4), and decrement this barrel's X.
 *
 * DISSOLVED FORM. stepBarrelLeft no longer reaches the shared tail through m.call(0x1FF6): it
 * direct-calls the idiomatic advanceRollingBarrel, which is the dissolved body of ROM 0x1FF6.
 * The whole fragment above the still-frozen object-walk step at ROM 0x1F83 therefore runs
 * cycle-free, and there is no observable "handoff" event to record any more — the two direction
 * constants and the decrement are proven by the finished work of the whole chain, run on both
 * sides, not by intercepting the boundary.
 *
 * WHAT THIS GATE COVERS, stated before the assertions rather than implied by them:
 *
 *   - REAL CAPTURES, ALL OF THEM. A 3000-frame attract run dispatches 0x1FEF 1967 times across
 *     the 7 records of the object sweep that attract makes live. All 1967 are replayed — no
 *     sampling — and the distinct entry shapes (record base × the branch class the decremented X
 *     puts the tail into) are counted and reported so the run says how varied the set was.
 *   - CRAFTED. The captures present a narrow X per record; the crafted arm re-seeds the X field
 *     across all 256 values on a real captured base, keeping that capture's real register banks and
 *     stack so the whole frozen chain below stays well-defined. Each of the four teeth below is
 *     caught by this sweep.
 *   - HOW MUCH RUNS PER CASE. stepBarrelLeft falls into the shared tail, whose chain re-glues the
 *     barrel to the girder, refreshes its sprite, routes it through the sweep's remaining slots and
 *     returns. Every case runs that WHOLE chain on both sides before anything is compared: the
 *     comparison is of the sweep's finished work, not of one decrement.
 *   - WHAT IS COMPARED — the memory-equivalence contract for the DISSOLVED form: RAM EXCLUDING the
 *     STACK_SCRATCH window {0x6be0,0x6c00}, the final guest SP, and the forwarded return value. The
 *     cycle-free rewrite cannot maintain pc, so pc and the rest of the register file are dropped
 *     with the frozen call bracket that used to make them comparable; the frozen chain below still
 *     rejoins the walk at the same guest SP, so final SP is kept and stays load-bearing (a stray
 *     push in the rewrite lands in the excluded window yet still moves SP). Cycles are NOT compared
 *     per case: the rewrite is cycle-free by design; the live case restores the fragment's true
 *     cost so the vblank NMI lands where the oracle puts it.
 *   - RE-ENTRANCY, handled explicitly. The chain below re-enters 0x1FEF (the sweep reaches a later
 *     slot in the same frame), so the capturing hook keeps firing during replay. It is frozen
 *     before any replay, and the hook stays installed but DELEGATES TO THE ORACLE, so nested
 *     dispatches are oracle on both sides and only the outer dispatch is under test.
 *   - LIVE-WIRED. The rewrite is wired at 0x1FEF for a whole 3000-frame attract run and every frame
 *     is diffed against the all-oracle baseline. The dissolved fragment's oracle cost is measured
 *     per dispatch and charged at the frozen walk step; without it the cycle-free code under-charges
 *     and forks the run on the spin counter for reasons unrelated to this routine.
 *   - LIVE-OUT. The only thing the candidate drops is the condition flags the memory decrement
 *     defines. They are scrambled at the ROM 0x1FF6 boundary on every entry across the same attract
 *     run and the trace stays byte-identical, so the tail redefines them before any read. This is a
 *     superset: 0x1FF6 is also entered from the twin arm at ROM 0x1FE5, whose flags get scrambled
 *     too.
 *   - WHAT IS NOT COVERED. Attract only, and attract is 25m only. Credited gameplay entry to this
 *     address is untested.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1fef.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1fef as oracle } from "../../translated/loc_1fef.js";
import { loc_1ff6 as tailOracle } from "../../translated/loc_1ff6.js";
import { stepBarrelLeft } from "../stepBarrelLeft.js";
import { OBJ_X, STACK_SCRATCH } from "../names.js";
import { Machine } from "../../machine.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1fef;
const SHARED_TAIL = 0x1ff6; // the tail this arm feeds; still frozen, entered by the twin arm too
const ATTRACT_FRAMES = 3000;

// The boundary where the frozen chain resumes: the object-walk step at ROM 0x1F83, reached through
// advanceRollingBarrel's still-live m.call. stepBarrelLeft direct-calls advanceRollingBarrel, so the
// whole fragment above 0x1F83 runs cycle-free; 0x1F83 and below stay frozen and charge their own
// T-states.
const WALK_STEP = 0x1f83;

// The alternate-bank constants this arm loads, and the twin arm's pair (ROM 0x1FE5), for the teeth.
const SLOPE_STEP_SELECTOR = 255;
const ORIENTATION_DIRECTION = 4;
const TWIN_SLOPE_STEP_SELECTOR = 1;
const TWIN_ORIENTATION_DIRECTION = 0;

// Attract's first 0x1FEF dispatch lands around frame 760, so a base for the crafted sweep needs a
// run at least that long.
const CRAFT_BASE_FRAMES = 900;

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const hb = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const inStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

/** First RAM byte that differs OUTSIDE the excluded STACK_SCRATCH window. */
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and a candidate on two fresh, byte-identical clones of one entry and report the
 * first contract breach: RAM − STACK_SCRATCH, final guest SP, and the forwarded return. A FAULT is
 * a RESULT, not a crash: a broken twin (or a crafted X the game never produces) can walk the frozen
 * chain into unmapped memory, and a gate that dies instead of reporting proves nothing. Two
 * identical faults are not a difference.
 */
function runPair(entry, candidate) {
  const a = entry.clone(), b = entry.clone();
  let retA, retB, faultA = null, faultB = null;
  try { retA = oracle(a); } catch (e) { faultA = String(e.message); }
  try { retB = candidate(b); } catch (e) { faultB = String(e.message); }

  if (faultA !== faultB) return { kind: "fault", detail: `oracle=${faultA} candidate=${faultB}` };
  if (faultA !== null) return null;

  const ram = firstRamDiff(a, b);
  if (ram) return { kind: "ram", detail: `${hx(ram.addr)} oracle=${hb(ram.a)} candidate=${hb(ram.b)}`, addr: ram.addr };
  if (a.regs.sp !== b.regs.sp) return { kind: "sp", detail: `oracle=${hx(a.regs.sp)} candidate=${hx(b.regs.sp)}` };
  if (retA !== retB) return { kind: "return", detail: `oracle=${retA} candidate=${retB}` };
  return null;
}

/** Replay a list of entry states; return the first case that breaches, or null. */
function sweep(entries, candidate) {
  for (const [i, e] of entries.entries()) {
    const breach = runPair(e, candidate);
    if (breach) return { i, base: e.regs.ix, ...breach };
  }
  return null;
}

/** How many of the entries breach — the teeth report quotes it, so "caught" is not just "once". */
function breachCount(entries, candidate) {
  let n = 0;
  for (const e of entries) if (runPair(e, candidate)) n += 1;
  return n;
}

const describe = (b) => b && `case ${b.i} (base ${hx(b.base)}): ${b.kind} — ${b.detail}`;

/**
 * The entry shape: which object record, and which branch class the DECREMENTED X puts the frozen
 * tail into (its low-three-bits gate, then its two range comparisons).
 */
function shapeOf(m) {
  const x = (m.mem.read8(m.regs.ix + OBJ_X) - 1) & 0xff;
  const cls = (x & 7) === 3 ? "gate" : x < 0x1c ? "low" : x < 0xe4 ? "mid" : "high";
  return `${hx(m.regs.ix)}/${cls}`;
}

// ---------------------------------------------------------------------------
// Capture: every real dispatch in an attract run, cloned at the instant of entry.
//
// THE `capturing` LATCH IS LOAD-BEARING. 0x1FEF re-enters ITSELF: its tail chain reaches the
// sweep's advance step, which dispatches the next live record straight back through the object
// loop. A capture is a clone, and a clone carries the source's override map, so without the latch
// every replay would append fresh "captures" to the list being iterated and the reported count
// would be an artefact of the replay. The latch closes once the attract run is over; nested
// re-entries during a replay still route through the override, which delegates to the oracle.
// ---------------------------------------------------------------------------
function captureDispatches(frames) {
  const caps = [];
  let capturing = true;
  const snap = new Map([[TARGET, (mm) => {
    if (capturing) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(frames);
  assert.equal(host.stoppedBy, null, `capture run stopped early: ${host.stoppedBy}`);
  capturing = false;
  return caps;
}

// A FRESH, override-free Machine carrying the source machine's observable state. Machine.clone()
// would rerun the constructor with the live override installed and re-enter this routine through
// its own tail chain; a fresh machine dispatches purely through the oracle registry, so pricing the
// oracle here is hermetic.
function rehost(m) {
  const c = new Machine(ROM);
  c.mem.workRam.set(m.mem.workRam);
  c.mem.spriteRam.set(m.mem.spriteRam);
  c.mem.videoRam.set(m.mem.videoRam);
  c.mem.discardedWrites = m.mem.discardedWrites;
  c.regs.copyFrom(m.regs);
  c.io.loadStateFrom(m.io);
  c.cycles = m.cycles;
  c.pc = m.pc;
  c.pcKnown = m.pcKnown;
  c.frame = m.frame;
  c.nmiCount = m.nmiCount;
  c.booted = m.booted;
  c.nextBoundary = Infinity;
  c.nextNmi = Infinity;
  c.maxFrames = Infinity;
  c.maxCycles = Infinity;
  return c;
}

// What the ORACLE spends on the fragment this rewrite replaces cycle-free: stepBarrelLeft's own
// decrement plus the dissolved advanceRollingBarrel chain, up to — but NOT including — the frozen
// m.call(0x1F83). Measured on a rehosted machine with that boundary stubbed to zero cost, so the
// price is exactly the fragment and not the frozen subtree past it (which the live run charges for
// itself when its own JS chain reaches the same frozen call).
function priceDissolved(m) {
  const probe = rehost(m);
  probe.routines.set(WALK_STEP, () => 0);
  const before = probe.cycles;
  oracle(probe);
  return probe.cycles - before;
}

// ---------------------------------------------------------------------------
// Crafted entries: a real captured base with the X field re-seeded across all 256 values, keeping
// that capture's real register banks and stack so the whole frozen chain below stays well-defined.
// ---------------------------------------------------------------------------
function craftedEntries(base) {
  const out = [];
  for (let x = 0; x < 256; x++) {
    const e = base.clone();
    e.mem.write8(e.regs.ix + OBJ_X, x & 0xff);
    out.push(e);
  }
  return out;
}

// ===========================================================================
// 1. EQUAL on every real dispatch
// ===========================================================================

test("CAPTURED: every real 0x1FEF dispatch == oracle over RAM − STACK_SCRATCH, final SP and return", () => {
  const caps = captureDispatches(ATTRACT_FRAMES);
  assert.ok(caps.length > 0, "no 0x1FEF dispatch was captured — this case would be vacuous");
  const before = caps.length;

  const shapes = new Set();
  for (let i = 0; i < caps.length; i++) {
    shapes.add(shapeOf(caps[i]));
    const breach = runPair(caps[i], stepBarrelLeft);
    assert.equal(breach, null, breach && `capture ${i} (shape ${shapeOf(caps[i])}): ${breach.kind} — ${breach.detail}`);
  }
  assert.equal(caps.length, before, "the capture list grew during replay — the count above is not what was replayed");

  // Non-vacuity: the routine must actually decrement the record's X on a real entry.
  const e = caps[0];
  const after = e.clone();
  const x0 = after.mem.read8(after.regs.ix + OBJ_X);
  stepBarrelLeft(after);
  assert.equal(after.mem.read8(e.regs.ix + OBJ_X), (x0 - 1) & 0xff, "the record's X field was not decremented");

  const records = new Set([...shapes].map((s) => s.split("/")[0]));
  console.log(
    `  CAPTURED: all ${caps.length} of ${caps.length} dispatches in ${ATTRACT_FRAMES} attract frames replayed ` +
      `— identical; ${shapes.size} distinct entry shapes over ${records.size} object records, all replayed`,
  );
});

// ===========================================================================
// 2. EQUAL on crafted entries (X swept over all 256 values)
// ===========================================================================

test("CRAFTED: stepBarrelLeft == oracle over the whole chain for all 256 X values on a real base", () => {
  const base = captureDispatches(CRAFT_BASE_FRAMES)[0];
  assert.ok(base, "no capture to build the crafted base from");
  const entries = craftedEntries(base);
  assert.equal(entries.length, 256);

  const bad = sweep(entries, stepBarrelLeft);
  assert.equal(bad, null, describe(bad));

  // Non-vacuity: on a mid-playfield X the chain really runs and decrements the field.
  const probe = entries[0x40].clone();
  const x0 = probe.mem.read8(probe.regs.ix + OBJ_X);
  stepBarrelLeft(probe);
  assert.equal(probe.mem.read8(entries[0x40].regs.ix + OBJ_X), (x0 - 1) & 0xff, "X was not decremented");

  console.log(
    `  CRAFTED: 256 X values on base ${hx(base.regs.ix)} — whole frozen chain on both sides, ` +
      "RAM − STACK_SCRATCH, final SP and return identical",
  );
});

// ===========================================================================
// 3. TEETH — four broken twins, each the real routine with one behaviour removed
// ===========================================================================

/** BUG (a): the alternate bank is never selected. */
function brokenNoBankSwap(m, objBase = m.regs.ix) {
  const { mem8, regs } = m;
  regs.b = SLOPE_STEP_SELECTOR;
  regs.c = ORIENTATION_DIRECTION;
  mem8[objBase + OBJ_X] = mem8[objBase + OBJ_X] - 1;
  return m.call(SHARED_TAIL);
}

/** BUG (b): X is incremented — this is the twin arm at ROM 0x1FE5, not this one. */
function brokenIncrement(m, objBase = m.regs.ix) {
  const { mem8, regs } = m;
  regs.exx();
  regs.b = SLOPE_STEP_SELECTOR;
  regs.c = ORIENTATION_DIRECTION;
  mem8[objBase + OBJ_X] = mem8[objBase + OBJ_X] + 1;
  return m.call(SHARED_TAIL);
}

/** BUG (c): the twin arm's constants are handed over instead of this arm's. */
function brokenTwinConstants(m, objBase = m.regs.ix) {
  const { mem8, regs } = m;
  regs.exx();
  regs.b = TWIN_SLOPE_STEP_SELECTOR;
  regs.c = TWIN_ORIENTATION_DIRECTION;
  mem8[objBase + OBJ_X] = mem8[objBase + OBJ_X] - 1;
  return m.call(SHARED_TAIL);
}

/** BUG (d): the X field is left alone. */
function brokenNoWrite(m) {
  const { regs } = m;
  regs.exx();
  regs.b = SLOPE_STEP_SELECTOR;
  regs.c = ORIENTATION_DIRECTION;
  return m.call(SHARED_TAIL);
}

const TWINS = [
  ["no-bank-swap", brokenNoBankSwap],
  ["increment", brokenIncrement],
  ["twin-constants", brokenTwinConstants],
  ["no-write", brokenNoWrite],
];

test("TEETH: each of the four broken twins is caught by the crafted sweep", () => {
  const base = captureDispatches(CRAFT_BASE_FRAMES)[0];
  const entries = craftedEntries(base);

  // Sanity: the correct routine passes the sweep, so a caught twin is a real defect signal and not
  // a suite that reds everything.
  assert.equal(sweep(entries, stepBarrelLeft), null, "the correct routine must pass the crafted sweep");

  const lines = [];
  for (const [label, twin] of TWINS) {
    const caught = sweep(entries, twin);
    assert.notEqual(caught, null, `the crafted sweep FAILED to catch the ${label} twin — it is worthless`);
    lines.push(`${label}: caught on ${breachCount(entries, twin)}/${entries.length} (${caught.kind} ${caught.detail})`);
  }
  console.log("  TEETH:\n    " + lines.join("\n    "));
});

// ===========================================================================
// 4. LIVE (whole-machine attract)
// ===========================================================================

test("LIVE: the candidate wired at 0x1FEF reproduces the oracle over a whole attract run", () => {
  const baseline = new Machine(ROM);
  const baseFrames = baseline.runFrames(ATTRACT_FRAMES);
  assert.equal(baseline.stoppedBy, null, `baseline run stopped early: ${baseline.stoppedBy}`);

  // Restore the dissolved fragment's true oracle cost, measured per dispatch and charged at the
  // frozen walk step. Cycle-free code charges none, which shifts the vblank NMI and forks the run.
  let fired = 0;
  const wired = new Map([[TARGET, (mm) => {
    fired += 1;
    const owed = priceDissolved(mm);
    if (owed) mm.step(WALK_STEP, owed);
    return stepBarrelLeft(mm);
  }]]);
  const cand = new Machine(ROM, { overrides: wired });
  const candFrames = cand.runFrames(ATTRACT_FRAMES);
  assert.equal(cand.stoppedBy, null, `candidate run stopped early: ${cand.stoppedBy}`);
  assert.ok(fired > 0, "the override never fired — this case would be vacuous");
  assert.equal(candFrames.length, baseFrames.length, "both runs must reach the frame budget");

  for (let f = 0; f < baseFrames.length; f++) {
    const a = baseFrames[f], b = candFrames[f];
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      const addr = baseline.stateOffsetToAddr(i);
      if (inStack(addr)) continue;
      assert.fail(`frame ${f}: RAM@${hx(addr)} baseline=${a[i]} live=${b[i]}`);
    }
  }
  assert.equal(cand.regs.sp, baseline.regs.sp, "guest SP drifted over the live run");
  console.log(
    `  LIVE: ${baseFrames.length} attract frames, ${fired} live dispatches — every frame byte-identical ` +
      "(RAM/sprite/video minus stack scratch), guest SP unchanged",
  );
});

// ===========================================================================
// 5. LIVE-OUT (the dropped flags really are dead)
// ===========================================================================

test("LIVE-OUT: scrambling the flags at the ROM 0x1FF6 boundary changes nothing over a whole attract run", () => {
  const baseline = new Machine(ROM);
  const baseFrames = baseline.runFrames(ATTRACT_FRAMES);
  assert.equal(baseline.stoppedBy, null, `baseline run stopped early: ${baseline.stoppedBy}`);

  // The candidate defines no flags, so what must be dead is whatever the oracle left at the
  // boundary. Scramble them right there. This also covers the twin arm at ROM 0x1FE5, which enters
  // the same tail — a superset of what this routine needs.
  let fired = 0;
  const poison = new Map([[SHARED_TAIL, (mm) => {
    fired += 1;
    mm.regs.f = 0xa5;
    return tailOracle(mm);
  }]]);
  const poisoned = new Machine(ROM, { overrides: poison });
  const poisonFrames = poisoned.runFrames(ATTRACT_FRAMES);
  assert.equal(poisoned.stoppedBy, null, `poisoned run stopped early: ${poisoned.stoppedBy}`);
  assert.ok(fired > 0, "the poison override never fired — this case would be vacuous");

  for (let f = 0; f < baseFrames.length; f++) {
    const a = baseFrames[f], b = poisonFrames[f];
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      const addr = baseline.stateOffsetToAddr(i);
      if (inStack(addr)) continue;
      assert.fail(`frame ${f}: RAM@${hx(addr)} baseline=${a[i]} poisoned=${b[i]}`);
    }
  }
  console.log(
    `  LIVE-OUT: flags scrambled at every one of ${fired} boundaries into ROM 0x1FF6 — ` +
      `${baseFrames.length} attract frames still byte-identical, so the tail redefines them before any read`,
  );
});

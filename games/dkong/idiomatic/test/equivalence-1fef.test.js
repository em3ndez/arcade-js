// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_1fef (ROM 0x1FEF) — the object-sweep arm that decrements one
 * object's X and hands the shared tail at ROM 0x1FF6 its two direction constants.
 *
 * The routine is four steps with no branches: swap the register file to its alternate
 * bank, load the slope-step selector, load the orientation direction code, decrement the
 * record's X field — then fall into ROM 0x1FF6, which is still the frozen oracle and does
 * everything observable downstream. So there are two different things to prove, and this
 * file proves them separately:
 *
 *   • THE HANDOFF is the whole of what this routine does. Test 2 stubs ROM 0x1FF6 and
 *     compares the handoff itself, field by field, over every possible X.
 *   • THE END-TO-END EFFECT is produced by the frozen tail running on that handoff.
 *     Test 1 replays real dispatches with the real tail in place.
 *
 * CONTRACT COMPARED: work/sprite/video RAM minus STACK_SCRATCH, the return value, and —
 * as EXTRAS beyond the required contract — pc and SP. Both extras are available here
 * because the frozen tail maintains them for both sides: it overwrites pc with its own
 * stepping, and its chain ends in the sweep's own return, so by the time control comes
 * back SP has landed two bytes higher either way. The candidate needs no stand-in `ret`.
 *
 * WHAT EACH TEST ACTUALLY COVERS — read this before trusting a green run:
 *
 *   1. CAPTURED (real dispatches, real tail). 0x1FEF is dispatched 1967 times in a
 *      3000-frame attract run, across the 7 records of OBJ_ARRAY_67 that attract makes
 *      live. ALL of them are replayed — no sampling, so shape coverage is total by
 *      construction rather than by a sampling rule. The 22 distinct entry shapes that
 *      appear (record base × the branch class the decremented X puts the tail into) are
 *      counted and reported so the run says how varied the replayed set actually was.
 *
 *   2. CRAFTED (exhaustive handoff). On a real captured base with ROM 0x1FF6 replaced by
 *      a recording stub, and with BOTH register banks poisoned to distinct known values
 *      so a missing bank swap cannot hide. All 256 values of the X field are swept and
 *      the handoff is compared field by field: the twelve bank registers, A, IX, SP, and
 *      the X byte in memory. The condition flags are recorded but DELIBERATELY EXCLUDED
 *      from the comparison — dropping them is this rewrite's declared live-out, and test
 *      5 is what measures that they are dead. The oracle's own cycle cost is measured on
 *      every one of the 256 and asserted constant; that constant is what test 4 restores.
 *
 *   3. TEETH — four deliberately-broken twins that test 2's sweep MUST catch:
 *        (a) the bank swap dropped;
 *        (b) X incremented instead of decremented (this is the twin arm at ROM 0x1FE5);
 *        (c) the two constants swapped for the twin arm's pair;
 *        (d) the X write dropped.
 *
 *   4. LIVE (whole-machine attract). The candidate is wired at 0x1FEF for a 3000-frame
 *      attract run and every frame's state dump is compared against the all-oracle
 *      baseline, minus STACK_SCRATCH. THE ORACLE'S CYCLE COST IS RESTORED AT THE HANDOFF:
 *      cycle-free code under-charges, which shifts the vblank NMI and diverges for
 *      reasons that have nothing to do with this routine. The oracle spreads its 37
 *      T-states across three instructions, the last 23 of them after the X write; the
 *      restoration charges all 37 at the ROM 0x1FF6 boundary, which is where the oracle
 *      FINISHES charging them, so the write is on the same side of the whole 37 as the
 *      oracle's largest share and the run comes out byte-identical. Attract only;
 *      gameplay is NOT covered.
 *
 *   5. LIVE-OUT. The only thing the candidate drops is the condition flags the memory
 *      decrement defines. They are scrambled at the ROM 0x1FF6 handoff on every dispatch
 *      across the same 3000-frame attract run and the trace stays byte-identical, so the
 *      tail really does redefine them before any read. THIS MEASUREMENT IS A SUPERSET:
 *      0x1FF6 is also entered from the twin arm at ROM 0x1FE5, whose flags get scrambled
 *      too, so it proves slightly more than this routine needs.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1fef.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1fef as oracle } from "../../translated/loc_1fef.js";
import { loc_1ff6 as tailOracle } from "../../translated/loc_1ff6.js";
import { loc_1fef } from "../loc_1fef.js";
import { OBJ_X, STACK_SCRATCH } from "../names.js";
import { Machine } from "../../machine.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1fef;
const SHARED_TAIL = 0x1ff6; // the frozen tail this routine falls into
const ATTRACT_FRAMES = 3000;

// The alternate-bank constants this arm loads, and the twin arm's pair (ROM 0x1FE5).
const SLOPE_STEP_SELECTOR = 255;
const ORIENTATION_DIRECTION = 4;
const TWIN_SLOPE_STEP_SELECTOR = 1;
const TWIN_ORIENTATION_DIRECTION = 0;

// The routine's own T-state cost: bank swap, constant load, memory decrement. Straight
// line, so it is a constant — test 2 measures it on all 256 inputs and asserts this value.
const OWN_CYCLES = 37;

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

/** First RAM byte that differs, skipping the dead STACK_SCRATCH region. */
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
 * RAM − STACK_SCRATCH, return value, pc and SP, on two byte-identical clones of `entry`.
 * The candidate needs no stand-in `ret`: the frozen tail performs the routine's return.
 */
function contractDiffs(entry, fn) {
  const o = entry.clone(); const oret = oracle(o);
  const c = entry.clone(); const cret = fn(c);
  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (oret !== cret) diffs.push(`return oracle=${String(oret)} cand=${String(cret)}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  return diffs;
}

/**
 * The entry shape: which object record, and which branch class the DECREMENTED X puts
 * the frozen tail into (its low-three-bits gate, then its two range comparisons).
 */
function shapeOf(m) {
  const x = (m.mem.read8(m.regs.ix + OBJ_X) - 1) & 0xff;
  const cls = (x & 7) === 3 ? "gate" : x < 0x1c ? "low" : x < 0xe4 ? "mid" : "high";
  return `${hx(m.regs.ix)}/${cls}`;
}

/**
 * Every real 0x1FEF dispatch in an attract run, captured as machine clones.
 *
 * THE `capturing` LATCH IS LOAD-BEARING. 0x1FEF re-enters ITSELF: its tail chain reaches
 * the sweep's advance step, which dispatches the next live record straight back through
 * ROM 0x1F93. A capture is a clone, and a clone carries the source's override map, so
 * without the latch every replay would append fresh "captures" to the list being iterated
 * and the reported count would be an artefact of the replay rather than a measurement of
 * attract. The latch closes once the attract run is over; nested re-entries during a
 * replay still route through the override, which delegates to the oracle — that is the
 * callee-is-oracle isolation the unit gate wants, and it is identical on both sides.
 */
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

// Attract's first 0x1FEF dispatch lands around frame 760, so a base for the crafted
// sweeps needs a run at least that long.
const CRAFT_BASE_FRAMES = 900;

// -- 1. CAPTURED --------------------------------------------------------------

test("CAPTURED: every real 0x1FEF dispatch matches the oracle", () => {
  const caps = captureDispatches(ATTRACT_FRAMES);
  assert.ok(caps.length > 0, "no 0x1FEF dispatch was captured — this case would be vacuous");

  const shapes = new Set();
  for (let i = 0; i < caps.length; i++) {
    shapes.add(shapeOf(caps[i]));
    const diffs = contractDiffs(caps[i], loc_1fef);
    assert.equal(diffs.length, 0, `capture ${i} (shape ${shapeOf(caps[i])}): ${diffs.join("; ")}`);
  }
  const records = new Set([...shapes].map((s) => s.split("/")[0]));
  console.log(
    `  CAPTURED: all ${caps.length} of ${caps.length} dispatches in ${ATTRACT_FRAMES} attract frames replayed ` +
      `— identical; ${shapes.size} distinct entry shapes over ${records.size} object records, all replayed`,
  );
});

// -- 2. CRAFTED (exhaustive handoff) ------------------------------------------

// The handoff fields. `f` is recorded but not compared — see the header.
const BANK_FIELDS = ["b", "c", "d", "e", "h", "l", "b_", "c_", "d_", "e_", "h_", "l_"];
const HANDOFF_FIELDS = [...BANK_FIELDS, "a", "ix", "sp"];

/**
 * A machine carrying `base`'s state with ROM 0x1FF6 replaced by `stub`. Built by
 * construction (not clone) because the override map is a constructor option.
 * The state comes from a REAL captured dispatch, so the guest stack holds real return
 * addresses and the stub's `ret` has something to pop.
 */
function withTailStub(base, stub) {
  const e = new Machine(ROM, { overrides: new Map([[SHARED_TAIL, stub]]) });
  e.mem.workRam.set(base.mem.workRam);
  e.mem.spriteRam.set(base.mem.spriteRam);
  e.mem.videoRam.set(base.mem.videoRam);
  e.regs.copyFrom(base.regs);
  e.io.loadStateFrom(base.io);
  e.cycles = base.cycles;
  e.pc = base.pc;
  e.pcKnown = base.pcKnown;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  e.maxFrames = Infinity;
  e.maxCycles = Infinity;
  return e;
}

/**
 * Poison both register banks with distinct known values, so a dropped bank swap shows
 * up in the handoff instead of being masked by two banks that happened to agree. Then
 * write the X field under test.
 */
function seedEntry(e, x) {
  const { regs } = e;
  regs.b = 0x11; regs.c = 0x22; regs.d = 0x33; regs.e = 0x44; regs.h = 0x55; regs.l = 0x66;
  regs.b_ = 0x99; regs.c_ = 0xaa; regs.d_ = 0xbb; regs.e_ = 0xcc; regs.h_ = 0xdd; regs.l_ = 0xee;
  regs.a = 0x77;
  regs.f = 0x00;
  e.mem.write8(regs.ix + OBJ_X, x & 0xff);
  return e;
}

/** Records the machine state at the ROM 0x1FF6 boundary, then returns as the tail does. */
function makeRecorder(sink) {
  return (mm) => {
    const rec = { x: mm.mem.read8(mm.regs.ix + OBJ_X), f: mm.regs.f };
    for (const k of HANDOFF_FIELDS) rec[k] = mm.regs[k];
    sink.push(rec);
    mm.ret(0);
  };
}

/** Run oracle and candidate over all 256 X values; return the first mismatch or null. */
function handoffSweep(base, fn) {
  for (let x = 0; x < 256; x++) {
    const oSink = [], cSink = [];
    const o = seedEntry(withTailStub(base, makeRecorder(oSink)), x);
    const c = seedEntry(withTailStub(base, makeRecorder(cSink)), x);
    const oret = oracle(o);
    const cret = fn(c);

    if (oSink.length !== cSink.length) {
      return { x, why: `tail entered ${oSink.length}x by the oracle, ${cSink.length}x by the candidate` };
    }
    const bad = HANDOFF_FIELDS.filter((k) => oSink[0][k] !== cSink[0][k]);
    if (oSink[0].x !== cSink[0].x) bad.push("X-in-memory");
    if (bad.length) {
      const show = bad.map((k) => {
        const a = k === "X-in-memory" ? oSink[0].x : oSink[0][k];
        const b = k === "X-in-memory" ? cSink[0].x : cSink[0][k];
        return `${k} oracle=${a} cand=${b}`;
      });
      return { x, why: show.join(", ") };
    }
    const ram = firstRamDiff(o, c);
    if (ram) return { x, why: `RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}` };
    if (oret !== cret) return { x, why: `return oracle=${String(oret)} cand=${String(cret)}` };
  }
  return null;
}

test("CRAFTED (exhaustive): the ROM 0x1FF6 handoff matches the oracle for all 256 X values", () => {
  const base = captureDispatches(CRAFT_BASE_FRAMES)[0];
  assert.ok(base, "no capture to build the crafted base from");

  const mismatch = handoffSweep(base, loc_1fef);
  assert.equal(mismatch, null, mismatch && `X=${mismatch.x}: ${mismatch.why}`);

  // Non-vacuity: the handoff really carries the swap, both constants and the decrement.
  const sink = [];
  const e = seedEntry(withTailStub(base, makeRecorder(sink)), 0x40);
  oracle(e);
  assert.equal(sink.length, 1, "the tail must be entered exactly once");
  assert.equal(sink[0].b, SLOPE_STEP_SELECTOR, "the slope-step selector must reach the tail");
  assert.equal(sink[0].c, ORIENTATION_DIRECTION, "the orientation direction must reach the tail");
  assert.equal(sink[0].x, 0x3f, "the X field must arrive decremented");
  assert.equal(sink[0].d, 0xbb, "the bank swap must have brought the alternate D through");
  assert.equal(sink[0].h, 0xdd, "the bank swap must have brought the alternate H through");

  // The routine's own cycle cost, MEASURED on every input rather than assumed — this is
  // the constant the live case restores. The candidate is cycle-free by design.
  let oracleCost = new Set(), candCost = new Set();
  for (let x = 0; x < 256; x++) {
    const o = seedEntry(withTailStub(base, () => {}), x);
    const so = o.cycles; oracle(o); oracleCost.add(o.cycles - so);
    const c = seedEntry(withTailStub(base, () => {}), x);
    const sc = c.cycles; loc_1fef(c); candCost.add(c.cycles - sc);
  }
  assert.deepEqual([...oracleCost], [OWN_CYCLES], `the oracle's own cost must be the constant ${OWN_CYCLES}`);
  assert.deepEqual([...candCost], [0], "the candidate must be cycle-free");

  // The flags ARE different at the handoff — that is the declared live-out, measured
  // separately in test 5. Assert the difference exists so the exclusion is not silent.
  const oSink = [], cSink = [];
  oracle(seedEntry(withTailStub(base, makeRecorder(oSink)), 0x40));
  loc_1fef(seedEntry(withTailStub(base, makeRecorder(cSink)), 0x40));
  assert.notEqual(oSink[0].f, cSink[0].f, "the flags are expected to differ at the handoff");

  console.log(
    `  CRAFTED/handoff: 256 X values — the 12 bank registers, A, IX, SP and the X byte identical; ` +
      `oracle cost constant at ${OWN_CYCLES} T-states, candidate 0; flags differ (${oSink[0].f} vs ${cSink[0].f}) ` +
      "and are excluded by contract",
  );
});

// -- 3. TEETH -----------------------------------------------------------------

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

for (const [label, twin] of [
  ["no-bank-swap", brokenNoBankSwap],
  ["increment", brokenIncrement],
  ["twin-constants", brokenTwinConstants],
  ["no-write", brokenNoWrite],
]) {
  test(`TEETH: the ${label} twin is CAUGHT`, () => {
    const base = captureDispatches(CRAFT_BASE_FRAMES)[0];
    // Sanity: the real routine passes the same sweep, so a caught twin is a real signal.
    assert.equal(handoffSweep(base, loc_1fef), null, "the correct routine must pass the sweep");
    const mm = handoffSweep(base, twin);
    assert.notEqual(mm, null, `the crafted sweep FAILED to catch the ${label} twin — it is worthless`);
    console.log(`  TEETH/${label}: caught at X=${mm.x} — ${mm.why}`);
  });
}

// -- 4. LIVE (whole-machine attract) ------------------------------------------

test("LIVE: the candidate wired at 0x1FEF reproduces the oracle over a whole attract run", () => {
  const baseline = new Machine(ROM);
  const baseFrames = baseline.runFrames(ATTRACT_FRAMES);
  assert.equal(baseline.stoppedBy, null, `baseline run stopped early: ${baseline.stoppedBy}`);

  let fired = 0;
  let owed = 0;
  const live = new Map([
    [TARGET, (mm) => { fired++; owed = OWN_CYCLES; return loc_1fef(mm); }],
    // Restore the oracle's cycle cost AT THE HANDOFF — where the oracle finishes charging
    // it, after the X write. Cycle-free code under-charges, which shifts the vblank NMI
    // and diverges for reasons unrelated to this rewrite. pc is restored with it because
    // the cycle-free rewrite does not maintain it and the NMI pushes it.
    [SHARED_TAIL, (mm) => {
      if (owed > 0) {
        const n = owed;
        owed = 0;
        mm.pc = SHARED_TAIL;
        mm.pcKnown = true;
        mm.tick(n);
      }
      return tailOracle(mm);
    }],
  ]);
  const cand = new Machine(ROM, { overrides: live });
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

// -- 5. LIVE-OUT (the dropped flags really are dead) --------------------------

test("LIVE-OUT: scrambling the flags at the ROM 0x1FF6 handoff changes nothing over a whole attract run", () => {
  const baseline = new Machine(ROM);
  const baseFrames = baseline.runFrames(ATTRACT_FRAMES);
  assert.equal(baseline.stoppedBy, null, `baseline run stopped early: ${baseline.stoppedBy}`);

  // The candidate defines no flags, so what must be dead is whatever the oracle left at
  // the handoff. Scramble them right there. This also covers the twin arm at ROM 0x1FE5,
  // which enters the same tail — a superset of what this routine needs.
  let fired = 0;
  const poison = new Map([[SHARED_TAIL, (mm) => {
    fired++;
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
    `  LIVE-OUT: flags scrambled at every one of ${fired} handoffs into ROM 0x1FF6 — ` +
      `${baseFrames.length} attract frames still byte-identical, so the tail redefines them before any read`,
  );
});

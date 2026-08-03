// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_2083 (ROM 0x2083).
 *
 * COVERAGE — ATTRACT ONLY, and there is no other board to be missing: the object walk this routine
 * hangs off (ROM 0x1F72) returns immediately unless BOARD is 1. Nothing here enters gameplay.
 *
 * WHAT RUNS, and the numbers each claim comes from:
 *   1. REACH   — an independent counting probe over 4000 attract frames: 72 dispatches, 3 arms,
 *                8 distinct entry shapes, 7 record bases.
 *   2. EQUAL   — every one of those 72 dispatches replayed INLINE at the dispatch (no sampling,
 *                no capture list), and the replayed count is cross-checked against (1). ★ Each
 *                replay is REHOSTED into a fresh override-free Machine: this routine's tail chain
 *                continues the object walk and RE-ENTERS 0x2083, so a plain clone (which carries
 *                the override map) would re-enter the capturing hook — that corrupts the count
 *                while still reporting green, which is why (1) exists as an independent check.
 *   3. STACK   — the STACK_SCRATCH exclusion siblings apply is INERT for this routine, asserted
 *                rather than assumed: the rewrite makes the same registry call the oracle's `jp`
 *                tail makes and opens no bracket of its own, so the comparison above is over the
 *                FULL dump with the scratch window INCLUDED.
 *   4. HANDOFF — the three frozen tails stubbed, comparing the state at the instant control leaves
 *                this routine. This is what makes the dropped accumulator and flags a MEASUREMENT:
 *                it asserts they genuinely DIFFER from the oracle's on every real dispatch (so the
 *                equality in (2) is not vacuous) while every other register and every RAM byte at
 *                the hand-off is identical.
 *   5. CRAFTED — poked onto real captures, one variable at a time: all 256 step-counter values
 *                (attract only ever produces 1, 2 and 3) and all 256 values of record byte +16
 *                (attract only produces 0, 1 and 255).
 *   6. TEETH   — five broken twins. Four are caught by the captured replay and one ONLY by a
 *                crafted entry; that one asserts BOTH halves (it escapes all 72 natural captures
 *                AND is caught by the craft), so the coverage hole is documented mechanically
 *                instead of assumed.
 *   7. LIVE    — the rewrite wired live at 0x2083 for a 4000-frame attract run under the CYCLE-FREE
 *                engine (runCycleFree fires the NMI on the poll PC, not on a cycle count, so a
 *                cycle-free rewrite cannot shift it and there is no charge to restore), diffed
 *                against the all-oracle baseline over the full dump. The dispatch count is
 *                ASSERTED non-zero and exact, so the arm cannot pass while the routine never ran.
 *
 * CONTRACT — stronger than the usual RAM-minus-STACK_SCRATCH one, because both sides run the
 * identical frozen continuation: the full state dump INCLUDING STACK_SCRATCH, the whole exit
 * register file, pc, SP and the propagated return value.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2083.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { loc_2083 as oracle } from "../../translated/loc_2083.js";
import { loc_2083 } from "../loc_2083.js";
import { STACK_SCRATCH } from "../ram.js";
import manifest from "../../manifest.js";
import { runCycleFree } from "../../../../core/frame-stepped.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/dkong/rom/maincpu.bin" }, fn);

const TARGET = 0x2083;
const ATTRACT_FRAMES = 4000;

/** Measured, and asserted so a change in either number is a failure rather than a silent drift. */
const EXPECTED_DISPATCHES = 72; // scheduler-driven attract (runFrames), 4000 frames
const EXPECTED_LIVE_DISPATCHES = 67; // cycle-free attract (runCycleFree), 4000 frames

// Record offsets this gate pokes and inspects. Deliberately re-stated here rather than exported
// from the routine: a gate that imports the value under test cannot disagree with it.
const ARM_SELECT = 2;
const SUBSTATE = 14;
const STEP_WHOLE = 16;

/** The three frozen continuations. Every exit of the routine goes to exactly one of them. */
const TAILS = [0x20a2, 0x20c3, 0x21ba];

const hx = (v) => "0x" + (v >>> 0).toString(16);

/**
 * A FRESH, OVERRIDE-FREE Machine carrying `src`'s observable state.
 *
 * ★ This is the load-bearing part of the harness. `Machine.clone()` rebuilds from `this.assets`,
 * so it carries the capturing override with it — and this routine's tail chain resumes the object
 * walk, which dispatches 0x2083 again. Replaying on a clone therefore re-enters the hook, and the
 * nested dispatches replay too. Rehosting into a machine built with no overrides makes every
 * nested dispatch run the pure oracle on BOTH sides, which is exactly the isolation the unit
 * comparison wants. Copies the same fields clone() does.
 */
function rehost(src) {
  const c = new Machine(ROM);
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

/** Which arm the ORACLE takes from this entry state — derived from the entry, never from the candidate. */
function armOf(m) {
  const next = (m.mem.read8((m.regs.ix + SUBSTATE) & 0xffff) + 1) & 0xff;
  return next === 1 ? 0x20a2 : next === 2 ? 0x20c3 : 0x21ba;
}

/** The entry shape: the arm the oracle takes, plus the two bytes that select within it. */
function shapeOf(m) {
  const base = m.regs.ix;
  return `${hx(armOf(m))}|step=${m.mem.read8((base + SUBSTATE) & 0xffff)}` +
    `|whole=${m.mem.read8((base + STEP_WHOLE) & 0xffff)}`;
}

/**
 * Run one entry state both ways on independent rehosted machines and return the first contract
 * breach, or null. A FAULT is a RESULT, not a crash: a broken twin can hand the frozen tail a bad
 * value and walk a ROM table off its end, and that must be reported as the breach rather than
 * killing the run.
 */
function contractBreach(entry, candidate) {
  const a = rehost(entry);
  const b = rehost(entry);

  let ra, rb, fa = null, fb = null;
  try { ra = oracle(a); } catch (e) { fa = `${e.name}: ${e.message}`; }
  try { rb = candidate(b); } catch (e) { fb = `${e.name}: ${e.message}`; }
  if (fa !== fb) return { kind: "fault", addr: null, a: fa ?? "(no fault)", b: fb ?? "(no fault)" };
  if (fa !== null) return null; // both faulted identically: the oracle's own behaviour, not a breach

  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) return { kind: "ram", addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  for (const k of REG_FIELDS) {
    if (a.regs[k] !== b.regs[k]) return { kind: `reg ${k}`, addr: null, a: a.regs[k], b: b.regs[k] };
  }
  if (a.pc !== b.pc) return { kind: "pc", addr: null, a: a.pc, b: b.pc };
  if (ra !== rb) return { kind: "return", addr: null, a: ra, b: rb };
  return null;
}

// ── 1. REACH: an independent probe, so the replay count below has something to be checked against ──

/** Count real dispatches WITHOUT replaying anything: the reference the replay pass is checked against. */
function reachabilityProbe() {
  let dispatches = 0;
  const arms = new Map();
  const shapes = new Set();
  const bases = new Set();
  const m = new Machine(ROM, {
    overrides: {
      "2083": (mm) => {
        dispatches++;
        arms.set(armOf(mm), (arms.get(armOf(mm)) ?? 0) + 1);
        shapes.add(shapeOf(mm));
        bases.add(mm.regs.ix);
        return oracle(mm);
      },
    },
  });
  m.runFrames(ATTRACT_FRAMES);
  return { dispatches, arms, shapes, bases };
}

const REACH = ROM_PRESENT ? reachabilityProbe() : null;

test("REACH: attract dispatches 0x2083, and this is the count everything else is measured against", () => {
  assert.equal(
    REACH.dispatches,
    EXPECTED_DISPATCHES,
    `attract reached 0x2083 ${REACH.dispatches} times, expected ${EXPECTED_DISPATCHES}`,
  );
  assert.deepEqual(
    [...REACH.arms.keys()].sort((p, q) => p - q),
    TAILS,
    "attract does not reach all three arms",
  );
  console.log(
    `  REACH: ${REACH.dispatches} dispatches in ${ATTRACT_FRAMES} attract frames; arms ` +
      [...REACH.arms].map(([a, n]) => `${hx(a)}x${n}`).join(" ") +
      `; ${REACH.shapes.size} entry shapes; ${REACH.bases.size} record bases`,
  );
});

// ── 2/3. EQUAL: every real dispatch replayed inline, full dump including STACK_SCRATCH ────────────

/**
 * Replay `candidate` inline at every real dispatch of a fresh attract run. O(1) memory, no capture
 * list to be corrupted, and EVERY dispatch is replayed rather than a stride of them. Also keeps one
 * rehosted entry per arm for the crafted cases to build on.
 */
function replayInline(candidate) {
  const breaches = [];
  let dispatches = 0;
  const perArm = new Map();
  const shapes = new Set();
  const bases = new Set();
  let scratchDiffers = false;

  const m = new Machine(ROM, {
    overrides: {
      "2083": (mm) => {
        dispatches++;
        const arm = armOf(mm);
        shapes.add(shapeOf(mm));
        bases.add(mm.regs.ix);
        if (!perArm.has(arm)) perArm.set(arm, rehost(mm)); // override-free, so it replays cleanly

        const breach = contractBreach(mm, candidate);
        if (breach) {
          // Keep the FIRST breaching entry (rehosted, so it replays cleanly) so a teeth case can
          // ask which cell the twin got wrong.
          const entry = breaches.length === 0 ? rehost(mm) : null;
          breaches.push({ arm, base: mm.regs.ix, dispatch: dispatches, breach, entry });
          if (
            breach.kind === "ram" &&
            breach.addr >= STACK_SCRATCH.lo &&
            breach.addr < STACK_SCRATCH.hi
          ) scratchDiffers = true;
        }
        return oracle(mm); // the host run itself always stays on the oracle
      },
    },
  });
  m.runFrames(ATTRACT_FRAMES);
  return { breaches, dispatches, perArm, shapes, bases, scratchDiffers };
}

const REPLAY = ROM_PRESENT ? replayInline(loc_2083) : null;

test("EQUAL: loc_2083 matches the oracle on every real attract dispatch", () => {
  assert.ok(REPLAY.dispatches > 0, "no dispatch of 0x2083 was replayed — this gate proves nothing");
  // ★ The cross-check the re-entrancy hazard makes necessary: a hook that re-enters itself during
  // replay inflates this count, and the run still goes green. It must equal the independent probe.
  assert.equal(
    REPLAY.dispatches,
    REACH.dispatches,
    `the replay pass saw ${REPLAY.dispatches} dispatches but the independent probe saw ` +
      `${REACH.dispatches} — the capturing hook is re-entering itself`,
  );
  assert.equal(
    REPLAY.breaches.length,
    0,
    REPLAY.breaches.length
      ? `${REPLAY.breaches.length} of ${REPLAY.dispatches} dispatches breached; first at dispatch ` +
        `${REPLAY.breaches[0].dispatch}, base ${hx(REPLAY.breaches[0].base)}, arm ` +
        `${hx(REPLAY.breaches[0].arm)}: ${REPLAY.breaches[0].breach.kind} at ` +
        `${hx(REPLAY.breaches[0].breach.addr ?? 0)} oracle=${REPLAY.breaches[0].breach.a} ` +
        `rewrite=${REPLAY.breaches[0].breach.b}`
      : "",
  );
  // The header claims the replays cover every arm, shape and base attract produces.
  assert.deepEqual([...REPLAY.perArm.keys()].sort((p, q) => p - q), TAILS, "an arm was never replayed");
  assert.equal(REPLAY.shapes.size, REACH.shapes.size, "the replay pass saw a different set of entry shapes");
  assert.equal(REPLAY.bases.size, REACH.bases.size, "the replay pass saw a different set of record bases");
  console.log(
    `  EQUAL: ${REPLAY.dispatches} of ${REACH.dispatches} real dispatches replayed inline ` +
      `(rehosted, no sampling), ${REPLAY.shapes.size} entry shapes, ${REPLAY.bases.size} record bases`,
  );
});

test("STACK: the STACK_SCRATCH exclusion is INERT here, so the comparison includes it", () => {
  // Asserting the exclusion "matters" would pass vacuously for a routine that writes no stack.
  // The honest assertion is the opposite one: nothing in the window differs, so the gate can and
  // does compare the full dump. contractBreach never excludes the window — this records why.
  assert.equal(REPLAY.scratchDiffers, false, "a STACK_SCRATCH byte differed — the exclusion is NOT inert");
  assert.equal(REPLAY.breaches.length, 0, "cannot judge the exclusion while the routine is breaching");
  console.log(
    `  STACK: no byte in [${hx(STACK_SCRATCH.lo)},${hx(STACK_SCRATCH.hi)}) differed across ` +
      `${REPLAY.dispatches} dispatches — the rewrite keeps the oracle's stack shape (its exit is a ` +
      "registry call standing in for a `jp` tail, so neither side opens a bracket)",
  );
});

// ── 4. HANDOFF: what the rewrite actually drops, measured at the seam ─────────────────────────────

/** Stub the three frozen tails on `mm` so control stops at the hand-off, and record what it hands over. */
function stubTails(mm) {
  const rec = { hit: null, fired: 0 };
  for (const t of TAILS) {
    mm.routines.set(t, (m2) => {
      rec.fired++;
      rec.hit = { tail: t, regs: Object.fromEntries(REG_FIELDS.map((k) => [k, m2.regs[k]])) };
      return undefined;
    });
  }
  return rec;
}

test("HANDOFF: the rewrite drops the accumulator and the flags, and nothing else", () => {
  let compared = 0;
  let aDiffers = 0;
  let fDiffers = 0;
  const armsWithADiff = new Set();
  const otherDiffs = [];

  const m = new Machine(ROM, {
    overrides: {
      "2083": (mm) => {
        const ha = rehost(mm);
        const recA = stubTails(ha);
        oracle(ha);
        const hb = rehost(mm);
        const recB = stubTails(hb);
        loc_2083(hb);

        // A stub nobody can see fire is indistinguishable from no stub — so prove it fired.
        assert.equal(recA.fired, 1, "the oracle side never reached a stubbed tail");
        assert.equal(recB.fired, 1, "the rewrite never reached a stubbed tail");
        assert.equal(recA.hit.tail, recB.hit.tail, "the two sides handed over to different tails");

        for (const k of REG_FIELDS) {
          if (recA.hit.regs[k] === recB.hit.regs[k]) continue;
          if (k === "a") { aDiffers++; armsWithADiff.add(recA.hit.tail); }
          else if (k === "f") fDiffers++;
          else otherDiffs.push({ reg: k, tail: recA.hit.tail, a: recA.hit.regs[k], b: recB.hit.regs[k] });
        }
        const da = ha.dumpState();
        const db = hb.dumpState();
        for (let i = 0; i < da.length; i++) {
          if (da[i] !== db[i]) {
            otherDiffs.push({ reg: `ram ${hx(ha.stateOffsetToAddr(i))}`, tail: recA.hit.tail, a: da[i], b: db[i] });
            break;
          }
        }
        compared++;
        return oracle(mm);
      },
    },
  });
  m.runFrames(ATTRACT_FRAMES);

  assert.equal(compared, EXPECTED_DISPATCHES, `compared ${compared} hand-offs, expected ${EXPECTED_DISPATCHES}`);
  assert.deepEqual(
    otherDiffs.slice(0, 3),
    [],
    `something other than the accumulator and flags differs at the hand-off: ` +
      otherDiffs.slice(0, 3).map((d) => `${d.reg} on tail ${hx(d.tail)} oracle=${d.a} rewrite=${d.b}`).join("; "),
  );
  // ★ Non-vacuity: if the two sides happened to agree on the accumulator, "the drop is safe" would
  // be an untested claim dressed as a measurement. They must genuinely differ.
  assert.ok(aDiffers > 0, "the accumulator NEVER differed at the hand-off — the drop is untested here");
  assert.ok(fDiffers > 0, "the flags NEVER differed at the hand-off — the drop is untested here");
  assert.deepEqual(
    [...armsWithADiff].sort((p, q) => p - q),
    TAILS,
    "at least one arm never exercised the dropped accumulator",
  );
  console.log(
    `  HANDOFF: ${compared} hand-offs compared with the tails stubbed; the accumulator differs on ` +
      `${aDiffers} and the flags on ${fDiffers}, on all three arms, while every other register and ` +
      "every RAM byte is identical — the drop is real, and EQUAL above runs the real tail on top of it",
  );
});

// ── 5. CRAFTED: values attract never produces, poked onto real captures ───────────────────────────

/** A real capture with ONE byte changed. Everything else — stack, shadow set, loop state — is real. */
function craft(entry, offset, value) {
  const c = rehost(entry);
  c.mem.write8((c.regs.ix + offset) & 0xffff, value);
  return c;
}

/** Sweep one record byte over all 256 values on each kept arm capture. */
function craftedSweep(candidate, offset) {
  const results = [];
  for (const [arm, entry] of REPLAY.perArm) {
    for (let v = 0; v < 256; v++) {
      const breach = contractBreach(craft(entry, offset, v), candidate);
      if (breach) results.push({ arm, offset, value: v, breach });
    }
  }
  return results;
}

test("CRAFTED: all 256 step-counter values, including the wrap attract never produces", () => {
  const bad = craftedSweep(loc_2083, SUBSTATE);
  assert.equal(
    bad.length,
    0,
    bad.length
      ? `${bad.length} of 768 crafted step counters breached; first: arm ${hx(bad[0].arm)} ` +
        `counter=${bad[0].value} ${bad[0].breach.kind} at ${hx(bad[0].breach.addr ?? 0)} ` +
        `oracle=${bad[0].breach.a} rewrite=${bad[0].breach.b}`
      : "",
  );
  console.log(
    `  CRAFTED: 768 entries (256 step-counter values x ${REPLAY.perArm.size} real captures). ` +
      "Attract produces only counters 0, 1 and 2 here, so everything else — every step past the " +
      "third, and the 255 -> 0 wrap — exists ONLY in this sweep.",
  );
});

test("CRAFTED: all 256 values of the horizontal step's whole-pixel byte", () => {
  const bad = craftedSweep(loc_2083, STEP_WHOLE);
  assert.equal(
    bad.length,
    0,
    bad.length
      ? `${bad.length} of 768 crafted whole-pixel bytes breached; first: arm ${hx(bad[0].arm)} ` +
        `whole=${bad[0].value} ${bad[0].breach.kind} at ${hx(bad[0].breach.addr ?? 0)} ` +
        `oracle=${bad[0].breach.a} rewrite=${bad[0].breach.b}`
      : "",
  );
  console.log(
    "  CRAFTED: 768 entries (256 whole-pixel bytes x 3 real captures). Attract presents only 0, 1 " +
      "and 255, so the whole 2..254 range — where the two arms are NOT a direction pair — is here only.",
  );
});

// ── 6. TEETH ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Broken twin: the advanced counter is dispatched on but never stored back.
 *
 * Written out in full rather than as a wrapper around the real routine: the routine does not
 * return until the whole frozen tail chain has run, and that chain advances the index register to
 * the next record, so a wrapper "restoring" the byte afterwards writes to the WRONG record and
 * tests something else entirely.
 */
function twinNoCounterStore(m) {
  const at = (o) => (m.regs.ix + o) & 0xffff;
  const step = (m.mem8[at(SUBSTATE)] + 1) & 0xff;
  // ... and the store that belongs here is missing.
  if (step === 1) return m.call(0x20a2);
  if (step === 2) return m.call(0x20c3);
  m.mem8[at(ARM_SELECT)] = m.mem8[at(STEP_WHOLE)] === 1 ? 2 : 4;
  return m.call(0x21ba);
}

/** Broken twin: dispatches on the counter BEFORE the increment — the classic off-by-one. */
function twinOffByOne(m) {
  const at = (o) => (m.regs.ix + o) & 0xffff;
  const step = m.mem8[at(SUBSTATE)];
  m.mem8[at(SUBSTATE)] = step + 1;
  if (step === 1) return m.call(0x20a2);
  if (step === 2) return m.call(0x20c3);
  m.mem8[at(ARM_SELECT)] = m.mem8[at(STEP_WHOLE)] === 1 ? 2 : 4;
  return m.call(0x21ba);
}

/** Broken twin: the walk direction the arm-select byte selects is reversed. */
function twinReversedDirection(m) {
  const at = (o) => (m.regs.ix + o) & 0xffff;
  const step = (m.mem8[at(SUBSTATE)] + 1) & 0xff;
  m.mem8[at(SUBSTATE)] = step;
  if (step === 1) return m.call(0x20a2);
  if (step === 2) return m.call(0x20c3);
  m.mem8[at(ARM_SELECT)] = m.mem8[at(STEP_WHOLE)] === 1 ? 4 : 2;
  return m.call(0x21ba);
}

/**
 * Broken twin: tests the whole-pixel byte for NON-ZERO instead of for exactly 1 — i.e. reads the
 * field as "has a whole-pixel step" rather than "is the rightward whole pixel". Attract presents
 * that byte as 0, 1 or 255, so the two readings part company only on 255, the leftward whole pixel.
 * It is the twin that would survive if the equality in the routine were loosened to a sign test.
 */
function twinNonZeroTest(m) {
  const at = (o) => (m.regs.ix + o) & 0xffff;
  const step = (m.mem8[at(SUBSTATE)] + 1) & 0xff;
  m.mem8[at(SUBSTATE)] = step;
  if (step === 1) return m.call(0x20a2);
  if (step === 2) return m.call(0x20c3);
  m.mem8[at(ARM_SELECT)] = m.mem8[at(STEP_WHOLE)] !== 0 ? 2 : 4;
  return m.call(0x21ba);
}

/**
 * Broken twin: treats the counter's 255 -> 0 wrap as a restart of the sequence. Structurally
 * invisible to attract, which never drives the counter past 2 — so this one is asserted BOTH ways
 * below: it must ESCAPE every natural capture and be CAUGHT by the crafted sweep.
 */
function twinWrapRestarts(m) {
  const at = (o) => (m.regs.ix + o) & 0xffff;
  const step = (m.mem8[at(SUBSTATE)] + 1) & 0xff;
  m.mem8[at(SUBSTATE)] = step;
  if (step === 0 || step === 1) return m.call(0x20a2);
  if (step === 2) return m.call(0x20c3);
  m.mem8[at(ARM_SELECT)] = m.mem8[at(STEP_WHOLE)] === 1 ? 2 : 4;
  return m.call(0x21ba);
}

const CAPTURED_TEETH = [
  { name: "counter advanced but never stored", twin: twinNoCounterStore, cell: SUBSTATE },
  { name: "dispatch on the pre-increment counter", twin: twinOffByOne, cell: null },
  { name: "reversed walk direction", twin: twinReversedDirection, cell: ARM_SELECT },
  { name: "non-zero test instead of equal-to-one", twin: twinNonZeroTest, cell: ARM_SELECT },
];

for (const { name, twin, cell } of CAPTURED_TEETH) {
  test(`TEETH: a twin with a ${name} is CAUGHT by the captured replay`, () => {
    const { breaches, dispatches } = replayInline(twin);
    assert.ok(
      breaches.length > 0,
      `the gate FAILED to catch the ${name} twin on any of ${dispatches} real dispatches`,
    );
    const first = breaches[0].breach;
    if (cell !== null) {
      // WHICH cell the twin got wrong is a claim about the ROUTINE's own write footprint, so ask it
      // with the frozen tails stubbed — otherwise the tail chain's own (correctly propagated)
      // divergence can surface at a lower address first and the check reads as a miss.
      const want = (breaches[0].base + cell) & 0xffff;
      const ha = rehost(breaches[0].entry); stubTails(ha); oracle(ha);
      const hb = rehost(breaches[0].entry); stubTails(hb); twin(hb);
      assert.notEqual(
        ha.mem.read8(want),
        hb.mem.read8(want),
        `the ${name} twin left ${hx(want)} agreeing with the oracle — it is caught on something else`,
      );
    }
    console.log(
      `  TEETH/${name}: caught on ${breaches.length} of ${dispatches} dispatches; first at base ` +
        `${hx(breaches[0].base)} arm ${hx(breaches[0].arm)} ${first.kind} ` +
        `${first.addr === null ? "" : hx(first.addr)} oracle=${first.a} twin=${first.b}`,
    );
  });
}

test("TEETH: the counter-wrap twin ESCAPES every natural capture and is CAUGHT only by the craft", () => {
  const natural = replayInline(twinWrapRestarts);
  assert.equal(
    natural.breaches.length,
    0,
    "the counter-wrap twin was caught naturally after all — then the crafted half is not what covers it",
  );
  const crafted = craftedSweep(twinWrapRestarts, SUBSTATE);
  assert.ok(
    crafted.length > 0,
    `the crafted sweep FAILED to catch the counter-wrap twin over ${256 * REPLAY.perArm.size} entries`,
  );
  const wrapOnly = crafted.every((c) => c.value === 255);
  console.log(
    `  TEETH/counter wrap: escaped all ${natural.dispatches} natural dispatches (attract never drives ` +
      `the counter past 2), caught on ${crafted.length} crafted entries` +
      `${wrapOnly ? " — every one of them the 255 -> 0 wrap" : ""}; first: arm ` +
      `${hx(crafted[0].arm)} counter=${crafted[0].value} ${crafted[0].breach.kind} at ` +
      `${hx(crafted[0].breach.addr ?? 0)} oracle=${crafted[0].breach.a} twin=${crafted[0].breach.b}`,
  );
});

// ── 7. LIVE: the whole run, with the rewrite wired in ─────────────────────────────────────────────

/**
 * The unit arms above compare one dispatch at a time. This wires the rewrite LIVE at 0x2083 for a
 * whole attract run and diffs the frame trace against the all-oracle baseline — the only check here
 * that can see something a caller reads back long after the hand-off.
 *
 * The vehicle is the CYCLE-FREE engine on BOTH sides: runCycleFree fires the NMI when control
 * reaches the vblank poll PC, not on a cycle count, so a cycle-free rewrite cannot move the
 * interrupt and there is no skipped T-state cost to charge back. (The scheduler-driven runFrames
 * would need that charge — and machine.js's installCallBracketSeam PRECONDITION warns against
 * wiring a non-delegating override into it at all.)
 *
 * The baseline differs from the live run in EXACTLY ONE THING: this routine. Nothing else is wired,
 * because this file direct-calls no idiomatic callee — all three continuations are still frozen.
 */
function runAttract(overrides) {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  const trace = [];
  const r = runCycleFree(m, {
    pollPCs: manifest.convergence.pollPCs,
    maxFrames: ATTRACT_FRAMES,
    stepBudget: ATTRACT_FRAMES * 200000,
    onFrame: (mm) => trace.push(Buffer.from(mm.dumpState())),
  });
  assert.equal(r.stopError, null, `run errored: ${r.stop}`);
  assert.equal(r.frames, ATTRACT_FRAMES, `run covered only ${r.frames}/${ATTRACT_FRAMES} frames (${r.stop})`);
  return { m, trace };
}

test("LIVE: wired live for a whole attract run, the rewrite leaves the same trace as the oracle", () => {
  const baseline = runAttract(null);
  let dispatches = 0;
  const live = runAttract({ "2083": (m) => { dispatches++; return loc_2083(m); } });

  // ★★ Without this the arm can pass while the routine never runs — the failure mode that took a
  // deliberately broken routine green for 800 frames.
  assert.equal(
    dispatches,
    EXPECTED_LIVE_DISPATCHES,
    `0x2083 was dispatched ${dispatches} times while wired live, expected ${EXPECTED_LIVE_DISPATCHES}`,
  );
  assert.equal(live.trace.length, baseline.trace.length, "the two runs did not reach the same frame count");

  for (let f = 0; f < baseline.trace.length; f++) {
    const a = baseline.trace[f];
    const b = live.trace[f];
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      assert.fail(
        `frame ${f}: ${hx(baseline.m.stateOffsetToAddr(i))} baseline=${a[i]} live=${b[i]}`,
      );
    }
  }
  console.log(
    `  LIVE: ${ATTRACT_FRAMES} cycle-free attract frames byte-identical (STACK_SCRATCH INCLUDED) ` +
      `with 0x2083 wired live and dispatched ${dispatches} times — nothing reads back what the ` +
      "rewrite drops at the hand-off",
  );
});

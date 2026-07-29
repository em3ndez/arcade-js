// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for drawTerrainColumn (ROM 0x2fb7, The Pit) — write one vertical
 * strip of tiles up a backdrop column (a strided tile-map blit driven by register
 * inputs), then fall through into the animation phase clock advanceZonkerAnimation.
 *
 * THREE WRINKLES this routine forces, all handled with a crafted entry:
 *
 *   1. drawTerrainColumn's live-ins are REGISTERS (a source pointer, the column's bottom
 *      cell, the one-row-up step, and a run length), not memory. And the blit is
 *      never dispatched at this address in attract — the column-animation step
 *      inlines the same body instead of calling it. So a real attract machine state
 *      is captured at the reachable sibling loc_2f71 (which drives this subsystem),
 *      and the four blit registers are set to exactly the values the real setup
 *      produces: source into the tile-pattern table, the column's bottom cell, the
 *      one-row-up step, a six-cell run. That is the crafted entry — a real state with
 *      a surgical register setup, swept over run lengths, source offsets, and (to
 *      drive the phase clock's three arms through the delegation) the animation phase.
 *
 *   2. The phase clock drawTerrainColumn falls into (advanceZonkerAnimation) itself ends in two still-
 *      untranslated continuations (0x2fe3 the oscillator body, 0x3029 the publish
 *      tail): calling them would throw. Both the oracle and the idiomatic routine
 *      reach them identically, so each is replaced by ONE stub installed on both
 *      sides at once. Each stub writes a DISTINCT mark byte and sets a distinct exit
 *      pc, so a mis-route is visible to the diff, but because the stub is the same
 *      function on both sides it can never manufacture or hide a difference.
 *
 *   3. drawTerrainColumn is a tail-jumping blit whose caller consumes no register (the phase
 *      clock overwrites the working registers and never reads the run pointers), so
 *      its honest live-out is MEMORY-ONLY. The oracle advances the pointers/count in
 *      registers; the idiomatic rewrite correctly drops those dead values, so the two
 *      agree on memory + exit pc but NOT on the leftover register file. The gate
 *      therefore compares memory (+ exit pc), never the full register file — exactly
 *      the memory-equivalence contract for a dead-register live-out.
 *
 * EQUAL is proven over every naturally-occurring captured state (standard six-cell
 * blit on real memory + real phase), an exhaustive sweep of source offsets x run
 * lengths x phase (reaching all three phase-clock arms), and a zero-length run that
 * exercises the 256-cell wrap. The teeth twins (corrupted tile code, wrong step) are
 * caught, and the whole thing is re-proven through the shared unitEquivalence harness.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-2fb7.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2fb7 as oracle } from "../../translated/loc_2fb7.js";
import { drawTerrainColumn as idiomatic } from "../drawTerrainColumn.js";
import { loc_2f71 } from "../../translated/loc_2f71.js";
import { advanceZonkerAnimation } from "../advanceZonkerAnimation.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x2fb7; // drawTerrainColumn
const SIB = 0x2f71; // the reachable sibling we capture real attract states at
const OSC = 0x2fe3; // the phase clock's oscillator-body tail (still untranslated)
const PUB = 0x3029; // the phase clock's publish tail (still untranslated)
const PATTERN_TABLE = 0x3048; // ROM base of the tile-pattern table the blit reads from
const COLUMN_BOTTOM = 0x938c; // the column's bottom tile-map cell (the blit's start)
const ROW_STEP = 0xffe0; // -0x20: the step one screen row up the column
const PHASE = 0x80e3; // the animation phase counter advanceZonkerAnimation ticks/reloads
const FLIP_TILE = 0x80dc; // the two-state flip tile cell the phase clock writes
const STUB_MARK = 0x87f0; // dead scratch byte the tail stubs mark, to make routing visible
const OSC_MARK = 0xe3; // stub value that says "the oscillator body ran"
const PUB_MARK = 0x29; // stub value that says "the publish tail ran"
const CAPTURE_FRAMES = 900; // the sibling first runs ~frame 695, so run well past it
const CAPTURE_LIMIT = 64; // how many real sibling states to collect
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// Stubs standing in for the phase clock's two untranslated continuations. Installed
// IDENTICALLY on both sides, so they can only move both in lockstep. Each gives its
// continuation a distinct, observable memory effect + exit pc, so the phase-clock
// routing that drawTerrainColumn delegates into is checkable end to end.
function oscStub(mm) {
  mm.mem.write8(STUB_MARK, OSC_MARK);
  mm.pc = OSC;
  return undefined;
}
function pubStub(mm) {
  mm.mem.write8(STUB_MARK, PUB_MARK);
  mm.pc = PUB;
  return undefined;
}
const STUBS = [
  [OSC, oscStub],
  [PUB, pubStub],
];

/**
 * Collect up to CAPTURE_LIMIT real machine states at the sibling loc_2f71's entry,
 * each carrying the tail stubs in its registry. The sibling hook clones the pristine
 * entry, then runs the real sibling so attract goes on. The captured states supply
 * realistic backdrop memory (pattern table, tile-map, phase counter) for the blit.
 */
function captureSiblingStates() {
  const states = [];
  const overrides = new Map([
    ...STUBS,
    [SIB, (mm) => {
      if (states.length < CAPTURE_LIMIT) states.push(mm.clone());
      return loc_2f71(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return states;
}

const STATES = ROM_PRESENT ? captureSiblingStates() : [];

/**
 * Craft a valid drawTerrainColumn entry from a real captured state: a clone with the four blit
 * registers set the way the oracle setup stages them, and optionally a poked phase /
 * flip tile so the delegation into the phase clock can be steered to a chosen arm.
 */
function buildEntry(base, { cursor = 0, count = 6, dst = COLUMN_BOTTOM, step = ROW_STEP, phase = null, tile = null } = {}) {
  const e = base.clone();
  e.regs.ix = (PATTERN_TABLE + cursor) & 0xffff; // read cursor into the pattern table
  e.regs.hl = dst; // the column's bottom cell
  e.regs.de = step; // the one-row-up step
  e.regs.b = count; // run length (0 -> a full 256-cell run)
  if (phase !== null) e.mem.write8(PHASE, phase);
  if (tile !== null) e.mem.write8(FLIP_TILE, tile);
  return e;
}

/**
 * Run the oracle and a candidate on two independent clones of one entry and diff
 * MEMORY + exit pc (the honest live-out; the leftover register file is dead and
 * deliberately not compared). Reports which phase-clock arm the oracle took.
 */
function runPair(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();

  oracle(a);
  candidate(b);

  const mark = a.mem.read8(STUB_MARK);
  let arm;
  if (a.mem.read8(PHASE) === 8 && mark === OSC_MARK) arm = "reload"; // countdown expired -> reload + flip
  else if (mark === PUB_MARK) arm = "off-beat";
  else arm = "on-beat";

  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    pc: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
    arm,
  };
}

// -- 1. EQUAL: every naturally-occurring captured state -----------------------

test("EQUAL (captured): idiomatic == oracle on a real six-cell blit over every sibling state", () => {
  assert.ok(STATES.length > 0, "captured at least one real attract state at the sibling loc_2f71");
  const arms = new Set();
  for (let i = 0; i < STATES.length; i++) {
    // Standard six-cell column blit on the real memory this state carries, with the
    // real phase this state carries steering the delegation.
    const entry = buildEntry(STATES[i], { cursor: (i * 6) & 0xff });
    const r = runPair(entry, idiomatic);
    assert.equal(
      r.ram,
      null,
      r.ram && `state ${i}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`,
    );
    assert.equal(r.pc, null, r.pc && `state ${i}: exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
    arms.add(r.arm);
  }
  console.log(`  EQUAL/captured: ${STATES.length} real states identical (memory + pc); phase-clock arms hit: ${[...arms].sort().join(", ")}`);
});

// -- 2. EQUAL: exhaustive over source offset x run length x phase --------------

test("EQUAL (exhaustive): idiomatic == oracle over source offsets x run lengths x phase", () => {
  const base = STATES[0];
  assert.ok(base, "have a base state to poke");
  const cursors = [0, 6, 12, 0x2a, 0x48, 0xf0]; // several 6-byte columns into the pattern table
  const counts = [1, 2, 3, 6, 8]; // run lengths (all exit via the same fall-through)
  const phases = [1, 2, 3, 4, 5, 8]; // -> reload, off-beat x3, on-beat, off-beat: all three arms
  const arms = new Set();
  for (const cursor of cursors) {
    for (const count of counts) {
      for (const phase of phases) {
        const entry = buildEntry(base, { cursor, count, phase });
        const r = runPair(entry, idiomatic);
        assert.equal(
          r.ram,
          null,
          r.ram &&
            `cursor=${hx(cursor)} count=${count} phase=${phase}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`,
        );
        assert.equal(r.pc, null, r.pc && `cursor=${hx(cursor)} count=${count} phase=${phase}: exit pc diverged`);
        arms.add(r.arm);
      }
    }
  }
  assert.ok(arms.has("reload") && arms.has("off-beat") && arms.has("on-beat"), `all three phase-clock arms must be exercised, got: ${[...arms].join(", ")}`);
  console.log(`  EQUAL/exhaustive: ${cursors.length}x${counts.length}x${phases.length} inputs identical to the oracle; arms: ${[...arms].sort().join(", ")}`);
});

// -- 3. EQUAL: a zero-length run exercises the 256-cell wrap -------------------
// The count is only tested after the first cell, so a zero start writes a full 256
// cells. At the real -0x20 step 256 cells would walk out of mapped RAM into ROM, so
// this uses a zero step: every write lands in one mapped cell and the FINAL byte is
// whichever the 256th read produced, which pins the iteration count to match the
// oracle's exactly (an off-by-one in the wrap would leave a different final byte).

test("EQUAL (wrap): a zero run length runs a full 256-cell loop, identical to the oracle", () => {
  const base = STATES[0];
  assert.ok(base, "have a base state to poke");
  const entry = buildEntry(base, { count: 0, step: 0, phase: 2 }); // 0 -> 256 iterations; step 0 keeps writes mapped
  const r = runPair(entry, idiomatic);
  assert.equal(r.ram, null, r.ram && `wrap: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
  assert.equal(r.pc, null, r.pc && "wrap: exit pc diverged");
  console.log("  EQUAL/wrap: zero-length run = full 256-iteration loop, identical to the oracle");
});

// -- 4. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin A: corrupts the tile code it copies into each cell. */
function brokenData(m) {
  const { regs, mem } = m;
  let src = regs.ix, dst = regs.hl;
  const rowStep = regs.de;
  let remaining = regs.b;
  do {
    mem.write8(dst, mem.read8(src) ^ 0xff); // BUG: writes the complement of the tile code
    dst = (dst + rowStep) & 0xffff;
    src = (src + 1) & 0xffff;
    remaining = (remaining - 1 + 256) % 256;
  } while (remaining !== 0);
  return advanceZonkerAnimation(m);
}

/** Broken twin B: steps the destination by the wrong stride, so every cell past the
 *  first lands one address off. */
function brokenStep(m) {
  const { regs, mem } = m;
  let src = regs.ix, dst = regs.hl;
  const rowStep = regs.de;
  let remaining = regs.b;
  do {
    mem.write8(dst, mem.read8(src));
    dst = (dst + rowStep - 1) & 0xffff; // BUG: one address short of a full row step
    src = (src + 1) & 0xffff;
    remaining = (remaining - 1 + 256) % 256;
  } while (remaining !== 0);
  return advanceZonkerAnimation(m);
}

test("TEETH: a corrupted tile code is CAUGHT in the tile-map column", () => {
  const entry = buildEntry(STATES[0], { phase: 2 }); // off-beat: isolate the blit from a reload write
  const r = runPair(entry, brokenData);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a corrupted tile code — it is worthless");
  // The six written cells are COLUMN_BOTTOM stepping up one row (0x20) at a time; the
  // diff surfaces at the lowest-address one. Assert it is one of those column cells.
  const cells = [0, 1, 2, 3, 4, 5].map((i) => (COLUMN_BOTTOM + i * ROW_STEP) & 0xffff);
  assert.ok(cells.includes(r.ram.addr), `teeth caught ${hx(r.ram.addr ?? 0)} (expected a written column cell ${cells.map(hx).join(",")})`);
  console.log(`  TEETH: corrupted tile code caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a wrong row step is CAUGHT in the tile-map column", () => {
  const entry = buildEntry(STATES[0], { phase: 2 });
  const r = runPair(entry, brokenStep);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong row step — it is worthless");
  assert.ok(r.ram.addr >= 0x9000 && r.ram.addr <= 0x93ff, `teeth caught ${hx(r.ram.addr ?? 0)} (expected a tile-map cell 0x9000-0x93ff)`);
  console.log(`  TEETH: wrong row step caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

// -- 5. EQUAL + TEETH through the shared unitEquivalence harness ---------------
// drawTerrainColumn is unreached in attract, so a makeMachine wrapper forces a real dispatch:
// run the real sibling, then invoke the target so the harness's snapshot hook fires on
// a genuine attract-derived state. The tail stubs are layered in the same wrapper. The
// harness also diffs registers, which are a DEAD live-out here, so we assert only the
// memory + pc it reports (res.ram / res.pc) — the honest contract for this routine.

function makeForced(overrides) {
  const merged = new Map(overrides ? [...overrides] : []);
  for (const [addr, fn] of STUBS) merged.set(addr, fn);
  merged.set(SIB, (mm) => {
    const r = loc_2f71(mm); // real sibling, natural attract behaviour
    // Stage a valid six-cell column blit — the way the real setup does — before
    // forcing the dispatch (the sibling leaves the pointers pointing into ROM).
    mm.regs.ix = PATTERN_TABLE;
    mm.regs.hl = COLUMN_BOTTOM;
    mm.regs.de = ROW_STEP;
    mm.regs.b = 6;
    mm.call(TARGET); // then force-enter the target so the snapshot hook captures it
    return r;
  });
  return makeMachine(merged);
}

test("EQUAL (harness): a forced real 0x2fb7 dispatch is memory-EQUAL through unitEquivalence", () => {
  const res = unitEquivalence(makeForced, TARGET, oracle, idiomatic, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.ram, null, `harness RAM diverged: ${JSON.stringify(res.ram)}`);
  assert.equal(res.pc, null, `harness exit pc diverged: ${JSON.stringify(res.pc)}`);
  console.log("  EQUAL/harness: unitEquivalence captured a real 0x2fb7 entry -> memory + pc EQUAL");
});

/**
 * Broken twin for the harness: the correct routine, then one wrong store to the phase
 * counter the phase-clock tail always writes, so it is caught whichever arm the single
 * forced capture happens to land on.
 */
function brokenHarness(m) {
  const r = idiomatic(m);
  m.mem.write8(PHASE, m.mem.read8(PHASE) ^ 0xff); // BUG: corrupts the ticked phase counter
  return r;
}

test("TEETH (harness): a corrupted phase counter is CAUGHT by unitEquivalence", () => {
  const res = unitEquivalence(makeForced, TARGET, oracle, brokenHarness, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, false, "unitEquivalence FAILED to catch the corrupted twin — it is worthless");
  assert.notEqual(res.ram, null, "the diff must include a RAM difference");
  assert.equal(res.ram.addr, PHASE, `harness caught ${hx(res.ram?.addr ?? 0)} (expected the phase counter ${hx(PHASE)})`);
  console.log(`  TEETH/harness: corrupted phase counter caught at ${hx(res.ram.addr)} (oracle=${res.ram.a} broken=${res.ram.b})`);
});

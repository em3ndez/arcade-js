// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_31b1 (ROM 0x31B1) — the five-record sweep of the 0x6400
 * object array.
 *
 * The routine runs armAlternateFireModeAtHighDifficulty, then five times: advance OBJ_ITER_PTR by one stride, store
 * it back, and call ROM 0x3202 when the record's occupancy flag (+0) is non-zero. The
 * pointer and the sweep index (0x63A2) both live in MEMORY and are re-read every
 * iteration, so a callee that rewrites either one steers the rest of the sweep.
 *
 * CONTRACT COMPARED HERE: work/sprite/video RAM minus STACK_SCRATCH, the return value,
 * and — as an EXTRA beyond the required contract, because this routine leaves a live
 * guest-stack bracket — pc and SP. The candidate replaces the oracle's `push16 0x31b4 /
 * call 0x31dd` bracket with a direct JS call, so the oracle writes two return-address
 * bytes into the dead STACK_SCRATCH that the candidate never writes; that region is
 * excluded. runCandidate performs ONE m.ret() after the routine, standing in for the
 * terminal `ret` the idiomatic layer models as a JS return (live, the machine's seam
 * supplies it), which is what lets pc and SP be compared at all.
 *
 * WHAT EACH TEST ACTUALLY COVERS — read this before trusting a green run:
 *
 *   1. CAPTURED (real dispatches). 0x31B1 is dispatched 481 times in a 3000-frame
 *      attract run. Sampling policy: every 20th capture PLUS the first capture at each
 *      distinct entry shape (the five occupancy flags), and the test asserts the sample
 *      covers every shape seen. ATTRACT PRESENTS EXACTLY ONE SHAPE — record 0 occupied,
 *      records 1-4 empty — so the captures prove the real path and nothing about the
 *      other 31 occupancy patterns. Those are the crafted cases below.
 *
 *   2. CRAFTED (occupancy, all 32 patterns). On a real attract base, with ROM 0x3202
 *      replaced by a STUB that bumps a marker byte in the record whose pointer it finds
 *      in OBJ_ITER_PTR and then returns through the guest stack exactly as the frozen
 *      0x3202 does. The stub makes every call observable in RAM, so a missing, extra, or
 *      wrong-record call shows as a diff. This covers loc_31b1's own iteration; it says
 *      NOTHING about 0x3202's behaviour (test 1 and test 4 run the real one).
 *
 *   3. CRAFTED (callee steering). The same harness with a stub that, when handed record
 *      0, adds an extra stride to OBJ_ITER_PTR and an extra count to the sweep index —
 *      i.e. a callee rewriting the two cells the loop re-reads. The test asserts the
 *      sweep was really steered (a record skipped and the pass cut short), so an
 *      implementation holding either value in a local diverges here.
 *
 *   4. LIVE (whole-machine). The candidate is wired at 0x31B1 for a 3000-frame attract
 *      run and every frame's state dump is compared against the all-oracle baseline,
 *      minus STACK_SCRATCH. THE OVERRIDE RESTORES THE ORACLE'S MEASURED CYCLE COST
 *      (measured per dispatch by running the oracle on a clone): cycle-free code
 *      under-charges, which shifts the vblank NMI and diverges for reasons that have
 *      nothing to do with this routine. Drop the `mm.tick(...)` line below and this run
 *      diverges at frame 870 (measured, on the same rewrite that passes with it).
 *      Attract only; gameplay is NOT covered by any test here.
 *
 *   5. LIVE-OUT. The registers this routine defines and the candidate drops — measured to
 *      be exactly A, F, B, C, H, L — are scrambled after every ORACLE dispatch across the
 *      same 3000-frame attract run. The trace stays byte-identical, so nothing downstream
 *      reads them. Attract only, again: this measures the states attract reaches.
 *
 *   6. TEETH — four deliberately-broken twins the cases above MUST catch:
 *        (a) the pointer kept in a local, written back only once;
 *        (b) the pointer advanced AFTER the record is read (record 0 skipped, a sixth
 *            record visited);
 *        (c) the sweep index kept in a local instead of re-read from memory;
 *        (d) the 0x3202 call skipped.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-31b1.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_31b1 as oracle } from "../../translated/loc_31b1.js";
import { loc_31b1 } from "../loc_31b1.js";
import { armAlternateFireModeAtHighDifficulty } from "../armAlternateFireModeAtHighDifficulty.js";
import { OBJ_ARRAY_64, OBJ_ACTIVE, OBJ_ITER_PTR, STACK_SCRATCH } from "../names.js";
import { u8, u16 } from "../../../../core/int.js";
import { Machine } from "../../machine.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x31b1;
const OBJECT_CALL = 0x3202; // the per-object state machine, still the frozen oracle
const RET_ADDR = 0x30f6; // the caller site right after `call 0x31b1` in ROM 0x30ED
const SWEEP_INDEX = 0x63a2; // loop counter cell (no names.js name)
const OBJECT_COUNT = 5;
const OBJECT_STRIDE = 32;
const MARKER = 1; // record field the stub bumps so every 0x3202 call is visible in RAM
const ATTRACT_FRAMES = 3000;
const SAMPLE_STRIDE = 20;

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const recordAddr = (i) => OBJ_ARRAY_64 + i * OBJECT_STRIDE;

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

function runOracle(entry) {
  const c = entry.clone();
  const ret = oracle(c);
  return { m: c, ret };
}

/** The candidate plus the one terminal `ret` the idiomatic layer models as a JS return. */
function runCandidate(entry, fn) {
  const c = entry.clone();
  const ret = fn(c);
  c.ret(0);
  return { m: c, ret };
}

/** RAM − STACK_SCRATCH, return value, pc and SP. */
function contractDiffs(entry, fn) {
  const o = runOracle(entry);
  const c = runCandidate(entry, fn);
  const diffs = [];
  const ram = firstRamDiff(o.m, c.m);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (o.ret !== c.ret) diffs.push(`return oracle=${String(o.ret)} cand=${String(c.ret)}`);
  if (o.m.pc !== c.m.pc) diffs.push(`pc oracle=${hx(o.m.pc)} cand=${hx(c.m.pc)}`);
  if (o.m.regs.sp !== c.m.regs.sp) diffs.push(`SP oracle=${hx(o.m.regs.sp)} cand=${hx(c.m.regs.sp)}`);
  return diffs;
}

/** The five occupancy flags — this routine's entry shape. */
const shapeOf = (m) => Array.from({ length: OBJECT_COUNT }, (_, i) => m.mem.read8(recordAddr(i))).join(",");

// A real, self-consistent machine: boot + a stretch of attract so work RAM is realistic.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

/**
 * A machine carrying `base`'s state but with ROM 0x3202 replaced by `stub`, so the
 * crafted sweeps observe loc_31b1's iteration without depending on the real object state
 * machine. Built by construction (not clone) because the override map is a constructor
 * option; clone() reruns the constructor, so clones keep the stub.
 */
function withObjectStub(base, stub) {
  const e = new Machine(ROM, { overrides: new Map([[OBJECT_CALL, stub]]) });
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

/** Seed a crafted entry: an occupancy pattern, cleared markers, poisoned loop cells. */
function seedEntry(e, pattern) {
  for (let i = 0; i < OBJECT_COUNT; i++) {
    e.mem.write8(recordAddr(i), (pattern >> i) & 1);
    e.mem.write8(recordAddr(i) + MARKER, 0);
  }
  // Poisoned so a candidate that fails to initialise either cell is caught.
  e.mem.write8(SWEEP_INDEX, 0xee);
  e.mem.write16(OBJ_ITER_PTR, 0xdead);
  e.regs.sp = 0x6bfa;
  e.push16(RET_ADDR);
  return e;
}

/** Plain stub: bump the marker in the record it is handed, then return like 0x3202 does. */
function markerStub(mm) {
  const record = mm.mem.read16(OBJ_ITER_PTR);
  mm.mem.write8(record + MARKER, u8(mm.mem.read8(record + MARKER) + 1));
  mm.ret(0);
}

/**
 * Steering stub: on record 0 it also rewrites the two cells the loop re-reads — one extra
 * stride on the pointer and one extra count on the index. Stateless, so it behaves the
 * same on the oracle run and the candidate run.
 */
function steeringStub(mm) {
  const record = mm.mem.read16(OBJ_ITER_PTR);
  mm.mem.write8(record + MARKER, u8(mm.mem.read8(record + MARKER) + 1));
  if (record === OBJ_ARRAY_64) {
    mm.mem.write16(OBJ_ITER_PTR, u16(record + OBJECT_STRIDE));
    mm.mem.write8(SWEEP_INDEX, u8(mm.mem.read8(SWEEP_INDEX) + 1));
  }
  mm.ret(0);
}

const markersOf = (m) => Array.from({ length: OBJECT_COUNT }, (_, i) => m.mem.read8(recordAddr(i) + MARKER));

// -- 1. CAPTURED --------------------------------------------------------------

test("CAPTURED: sampled real 0x31B1 dispatches match the oracle", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(ATTRACT_FRAMES);
  assert.ok(caps.length > 0, "no 0x31B1 dispatch was captured — this case would be vacuous");

  // Sample: every SAMPLE_STRIDE-th capture, plus the first capture at each distinct shape.
  const allShapes = new Set();
  const firstOfShape = new Map();
  caps.forEach((c, i) => {
    const s = shapeOf(c);
    allShapes.add(s);
    if (!firstOfShape.has(s)) firstOfShape.set(s, i);
  });
  const picked = new Set([...firstOfShape.values()]);
  for (let i = 0; i < caps.length; i += SAMPLE_STRIDE) picked.add(i);
  const sample = [...picked].sort((a, b) => a - b);

  const covered = new Set(sample.map((i) => shapeOf(caps[i])));
  assert.deepEqual([...covered].sort(), [...allShapes].sort(), "the sample must cover every entry shape seen");

  for (const i of sample) {
    const diffs = contractDiffs(caps[i], loc_31b1);
    assert.equal(diffs.length, 0, `capture ${i} (shape ${shapeOf(caps[i])}): ${diffs.join("; ")}`);
  }
  console.log(
    `  CAPTURED: ${sample.length} of ${caps.length} dispatches in ${ATTRACT_FRAMES} attract frames replayed — identical; ` +
      `${allShapes.size} distinct entry shape(s) seen, all covered: ${[...allShapes].join(" | ")}`,
  );
});

// -- 2. CRAFTED (occupancy) ---------------------------------------------------

test("CRAFTED (occupancy): all 32 occupancy patterns match the oracle", () => {
  const base = attractBase();
  let calls = 0;
  for (let pattern = 0; pattern < 32; pattern++) {
    const entry = seedEntry(withObjectStub(base, markerStub), pattern);
    const diffs = contractDiffs(entry, loc_31b1);
    assert.equal(diffs.length, 0, `pattern ${pattern}: ${diffs.join("; ")}`);

    // Non-vacuity: the stub fired exactly once per occupied record, in place.
    const o = runOracle(entry).m;
    const expected = Array.from({ length: OBJECT_COUNT }, (_, i) => (pattern >> i) & 1);
    assert.deepEqual(markersOf(o), expected, `pattern ${pattern}: the oracle called 0x3202 on the wrong records`);
    assert.equal(o.mem.read16(OBJ_ITER_PTR), recordAddr(OBJECT_COUNT - 1), "the sweep must end on the last record");
    assert.equal(o.mem.read8(SWEEP_INDEX), OBJECT_COUNT, "the sweep index must end at the record count");
    calls += expected.reduce((a, b) => a + b, 0);
  }
  assert.equal(calls, 80, `expected 80 stub calls across the 32 patterns, saw ${calls}`);
  console.log(`  CRAFTED/occupancy: 32 patterns — identical; ${calls} object calls exercised`);
});

// -- 3. CRAFTED (callee steering) ---------------------------------------------

test("CRAFTED (steering): a callee that rewrites the pointer and the index steers the sweep identically", () => {
  const base = attractBase();
  const entry = seedEntry(withObjectStub(base, steeringStub), 0x1f); // every record occupied
  const diffs = contractDiffs(entry, loc_31b1);
  assert.equal(diffs.length, 0, `steering: ${diffs.join("; ")}`);

  // Non-vacuity: the steer must have actually skipped a record and cut the pass short.
  const o = runOracle(entry).m;
  assert.deepEqual(markersOf(o), [1, 0, 1, 1, 1], "the steer should skip record 1");
  assert.equal(o.mem.read8(SWEEP_INDEX), OBJECT_COUNT, "the index still lands on the record count");
  console.log(`  CRAFTED/steering: markers ${markersOf(o).join(",")} — the steered sweep is reproduced`);
});

// -- 4. LIVE (whole-machine attract) ------------------------------------------

test("LIVE: the candidate wired at 0x31B1 reproduces the oracle over a whole attract run", () => {
  const baseline = new Machine(ROM);
  const baseFrames = baseline.runFrames(ATTRACT_FRAMES);
  assert.equal(baseline.stoppedBy, null, `baseline run stopped early: ${baseline.stoppedBy}`);

  let fired = 0;
  const live = new Map([[TARGET, (mm) => {
    fired++;
    // Restore the oracle's cycle cost for THIS entry state: cycle-free code under-charges,
    // which shifts the vblank NMI and diverges for reasons unrelated to the rewrite.
    const probe = mm.clone();
    const probeStart = probe.cycles;
    oracle(probe);
    const cost = probe.cycles - probeStart;

    const start = mm.cycles;
    const r = loc_31b1(mm);
    mm.tick(cost - (mm.cycles - start));
    return r;
  }]]);
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
  // The guest stack must not leak across the seam: the frozen 0x3202 still returns through it.
  assert.equal(cand.regs.sp, baseline.regs.sp, "guest SP drifted over the live run");
  console.log(
    `  LIVE: ${baseFrames.length} attract frames, ${fired} live dispatches — every frame byte-identical ` +
      "(RAM/sprite/video minus stack scratch), guest SP unchanged",
  );
});

// -- 5. LIVE-OUT (the dropped registers really are dead) ----------------------

test("LIVE-OUT: poisoning the registers the oracle leaves changes nothing over a whole attract run", () => {
  const baseline = new Machine(ROM);
  const baseFrames = baseline.runFrames(ATTRACT_FRAMES);
  assert.equal(baseline.stoppedBy, null, `baseline run stopped early: ${baseline.stoppedBy}`);

  // The registers that differ between oracle and candidate, measured: A, F, B, C, H, L.
  // (D, E, IX, IY, SP and the shadow set are left identical by both.) Poison exactly
  // those after the ORACLE runs — if any caller downstream read one, the trace moves.
  let fired = 0;
  const poison = new Map([[TARGET, (mm) => {
    fired++;
    const r = oracle(mm);
    mm.regs.a = 0x5a;
    mm.regs.f = 0xa5;
    mm.regs.b = 0x5a;
    mm.regs.c = 0xa5;
    mm.regs.h = 0x5a;
    mm.regs.l = 0xa5;
    return r;
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
    `  LIVE-OUT: A/F/B/C/H/L scrambled after every one of ${fired} oracle dispatches — ` +
      `${baseFrames.length} attract frames still byte-identical, so no caller reads them`,
  );
});

// -- 6. TEETH -----------------------------------------------------------------

/** BUG (a): the pointer is kept in a local and written back only once. */
function brokenLocalPointer(m) {
  const { mem8, mem16 } = m;
  armAlternateFireModeAtHighDifficulty(m);
  mem8[SWEEP_INDEX] = 0;
  let record = OBJ_ARRAY_64 - OBJECT_STRIDE;
  mem16[OBJ_ITER_PTR] = record;
  for (;;) {
    record = u16(record + OBJECT_STRIDE); // BUG: never stored back
    if (mem8[record + OBJ_ACTIVE] !== 0) {
      m.push16(0x31d0);
      m.call(OBJECT_CALL);
    }
    const visited = u8(mem8[SWEEP_INDEX] + 1);
    mem8[SWEEP_INDEX] = visited;
    if (visited === OBJECT_COUNT) return;
  }
}

/** BUG (b): the pointer is advanced AFTER the record is read. */
function brokenPostIncrement(m) {
  const { mem8, mem16 } = m;
  armAlternateFireModeAtHighDifficulty(m);
  mem8[SWEEP_INDEX] = 0;
  mem16[OBJ_ITER_PTR] = OBJ_ARRAY_64 - OBJECT_STRIDE;
  for (;;) {
    const record = mem16[OBJ_ITER_PTR]; // BUG: read before the advance
    if (mem8[record + OBJ_ACTIVE] !== 0) {
      m.push16(0x31d0);
      m.call(OBJECT_CALL);
    }
    mem16[OBJ_ITER_PTR] = u16(record + OBJECT_STRIDE);
    const visited = u8(mem8[SWEEP_INDEX] + 1);
    mem8[SWEEP_INDEX] = visited;
    if (visited === OBJECT_COUNT) return;
  }
}

/** BUG (c): the sweep index is kept in a local instead of re-read from memory. */
function brokenLocalIndex(m) {
  const { mem8, mem16 } = m;
  armAlternateFireModeAtHighDifficulty(m);
  let visited = 0;
  mem8[SWEEP_INDEX] = visited;
  mem16[OBJ_ITER_PTR] = OBJ_ARRAY_64 - OBJECT_STRIDE;
  for (;;) {
    const record = u16(mem16[OBJ_ITER_PTR] + OBJECT_STRIDE);
    mem16[OBJ_ITER_PTR] = record;
    if (mem8[record + OBJ_ACTIVE] !== 0) {
      m.push16(0x31d0);
      m.call(OBJECT_CALL);
    }
    visited = u8(visited + 1); // BUG: not re-read, so a callee cannot steer it
    mem8[SWEEP_INDEX] = visited;
    if (visited === OBJECT_COUNT) return;
  }
}

/** BUG (d): the object call is never made. */
function brokenNoObjectCall(m) {
  const { mem8, mem16 } = m;
  armAlternateFireModeAtHighDifficulty(m);
  mem8[SWEEP_INDEX] = 0;
  mem16[OBJ_ITER_PTR] = OBJ_ARRAY_64 - OBJECT_STRIDE;
  for (;;) {
    const record = u16(mem16[OBJ_ITER_PTR] + OBJECT_STRIDE);
    mem16[OBJ_ITER_PTR] = record;
    // BUG: the occupied arm is gone
    const visited = u8(mem8[SWEEP_INDEX] + 1);
    mem8[SWEEP_INDEX] = visited;
    if (visited === OBJECT_COUNT) return;
  }
}

/** Sweep a twin over the crafted spaces; return the first contract mismatch. */
function sweepForMismatch(base, twin) {
  for (let pattern = 0; pattern < 32; pattern++) {
    const entry = seedEntry(withObjectStub(base, markerStub), pattern);
    const diffs = contractDiffs(entry, twin);
    if (diffs.length) return { where: `occupancy pattern ${pattern}`, diffs };
  }
  const steered = seedEntry(withObjectStub(base, steeringStub), 0x1f);
  const diffs = contractDiffs(steered, twin);
  if (diffs.length) return { where: "steering stub, every record occupied", diffs };
  return null;
}

for (const [label, twin] of [
  ["local-pointer", brokenLocalPointer],
  ["post-increment", brokenPostIncrement],
  ["local-index", brokenLocalIndex],
  ["no-object-call", brokenNoObjectCall],
]) {
  test(`TEETH: the ${label} twin is CAUGHT`, () => {
    const base = attractBase();
    const mm = sweepForMismatch(base, twin);
    assert.notEqual(mm, null, `the crafted sweeps FAILED to catch the ${label} twin — they are worthless`);
    console.log(`  TEETH/${label}: caught at ${mm.where} — ${mm.diffs.join("; ")}`);
  });
}

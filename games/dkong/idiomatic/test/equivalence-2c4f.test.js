// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2c4f (ROM 0x2C4F) — one entry of the bonus-event slot-claim cluster.
 *
 * loc_2c4f takes two register live-ins (the caller's mode byte and the current bonus value) and
 * its whole memory-observable behaviour is: always write the mode byte to 0x638F and 1 to 0x6392;
 * then, ONLY when BONUS_EVENT_MARK equals the bonus value, step that mark down by 8 and scan the
 * five OBJ_ARRAY_64 records (stride 32) for the first zero active-byte — on a hit raise the top-bit
 * request flag on 0x6382 (via loc_2c72), otherwise do nothing more. It returns nothing a caller
 * consumes (the oracle threads residual registers/flags out; its callers reload), so the contract
 * is memory-only.
 *
 * The oracle's exits only READ the stack (a pop is never a memory write) and its free-slot tail is
 * a plain call into 0x2C72 (which pushes nothing), so nothing the routine does writes the stack.
 * The candidate models no stack (plain JS return + a direct loc_2c72 call), so the compared memory
 * (dumpState is RAM) is identical to the oracle's with NO stack-scratch exclusion — as for 0x2C72.
 *
 *   1. EQUAL — loc_2c4f == oracle on RAM (firstStateDiff over the whole dump) across:
 *        A-SWEEP (exhaustive) — all 256 caller mode bytes with the gate CLOSED, isolating the
 *          0x638F store + the 0x6392 write + the early return.
 *        SLOT sweep (crafted) — the gate OPEN over every first-free-slot position (records 0..4),
 *          the all-occupied case, several mark/bonus values including a low mark that wraps the
 *          −8 step, and a non-zero starting 0x6382 to prove loc_2c72's read-modify-write.
 *      Plus a non-vacuity block asserting the writes really happened on both sides.
 *
 *   2. TEETH — three deliberately-broken twins the same sweep MUST catch:
 *        (a) wrong mark step (−4 not −8) — caught at BONUS_EVENT_MARK on the gate-open path.
 *        (b) inverted gate (proceeds when mark != bonus) — caught on the gate-closed A-sweep,
 *            where the twin performs the RMW + scan the oracle skips.
 *        (c) dropped slot flag (skips loc_2c72) — caught at 0x6382 on a slot-found case.
 *
 *   3. REALISM (captured dispatches) — hook 0x2C4F in a real attract run (it is reached through the
 *      bonus-event cluster's dispatch), clone at each true dispatch, and confirm loc_2c4f reproduces
 *      the oracle's RAM on every real state the game actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2c4f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2c4f as oracle } from "../../translated/loc_2c4f.js";
import { loc_2c4f } from "../loc_2c4f.js";
import { loc_2c72 } from "../loc_2c72.js";
import { BONUS_EVENT_MARK, OBJ_ARRAY_64 } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2c4f;
const SCRATCH_MODE = 0x638f; // the caller's mode byte lands here
const SCRATCH_FLAG = 0x6392; // raised to 1 on every entry
const SCRATCH_REQ = 0x6382; // the slot-claim request flag (top bit set by loc_2c72)
const STRIDE = 32; // OBJ_ARRAY_64 record stride
const RECORDS = 5;
const EVENT_STEP = 8;
// The oracle's `ret`s pop the stack; point SP at work RAM so those pops read valid bytes (never
// I/O). The oracle writes no RAM through the stack (only pops), so this never affects the compared
// memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const OCCUPIED = [1, 2, 3, 4, 5]; // all non-zero -> no free slot

/**
 * A synthetic entry: a clone of `base` with the two register live-ins, the event mark, the five
 * OBJ_ARRAY_64 active bytes, and (optionally) a starting 0x6382 set, plus a safe stack. Frame
 * machinery is neutralised so the oracle's `m.step`/`m.ret` can't fire an NMI or push a frame.
 */
function makeEntry(base, { a, c, mark, records = OCCUPIED, req }) {
  const e = base.clone();
  e.regs.a = a;
  e.regs.c = c;
  e.mem.write8(BONUS_EVENT_MARK, mark);
  for (let i = 0; i < RECORDS; i++) e.mem.write8(OBJ_ARRAY_64 + i * STRIDE, records[i]);
  if (req !== undefined) e.mem.write8(SCRATCH_REQ, req);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). The candidate takes its two live-ins as
 * honest parameters, marshalled from the same registers the oracle reads.
 */
function runPair(base, opts, candidate) {
  const a = makeEntry(base, opts); // oracle
  const b = makeEntry(base, opts); // candidate
  oracle(a);
  candidate(b, b.regs.a, b.regs.c);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// The gate-open slot scenarios: every first-free-slot position, plus all-occupied. Each is run at a
// few (mode, mark=bonus) points, including a low mark whose −8 step wraps, and a non-zero 0x6382.
const SLOT_CASES = [
  { name: "slot@0", records: [0, 1, 1, 1, 1] },
  { name: "slot@1", records: [1, 0, 1, 1, 1] },
  { name: "slot@2", records: [1, 1, 0, 1, 1] },
  { name: "slot@3", records: [1, 1, 1, 0, 1] },
  { name: "slot@4", records: [1, 1, 1, 1, 0] },
  { name: "no-free", records: OCCUPIED },
];
const SLOT_POINTS = [
  { a: 0x00, mark: 0x50, req: 0x00 },
  { a: 0x03, mark: 0x08, req: 0x03 }, // req low bits must survive the flag
  { a: 0x2a, mark: 0x04, req: 0x00 }, // low mark: 0x04 − 8 wraps to 0xfc
  { a: 0xff, mark: 0x40, req: 0x7f },
];

/**
 * Both regimes in one pass: the exhaustive gate-closed A-sweep, then the crafted gate-open slot
 * cross-product. Returns the first mismatch (or null) + the number of comparisons.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // A-SWEEP — gate CLOSED (mark != bonus): only 0x638F and 0x6392 change; isolates the stash byte.
  for (let a = 0; a < 256; a++) {
    const ram = runPair(base, { a, c: 0x40, mark: 0x20, records: OCCUPIED }, candidate);
    count++;
    if (ram) return { mismatch: { where: `A-sweep a=${hx(a)}`, ram }, count };
  }

  // SLOT sweep — gate OPEN (mark == bonus): every first-free position × several mark/mode/req points.
  for (const pt of SLOT_POINTS) {
    for (const sc of SLOT_CASES) {
      const opts = { a: pt.a, c: pt.mark, mark: pt.mark, records: sc.records, req: pt.req };
      const ram = runPair(base, opts, candidate);
      count++;
      if (ram) return { mismatch: { where: `${sc.name} mark=${hx(pt.mark)} a=${hx(pt.a)}`, ram }, count };
    }
  }

  return { mismatch: null, count };
}

const describe = (mm) =>
  mm && `at ${mm.where}: RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: loc_2c4f == oracle across the A-sweep and every gate-open slot case", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_2c4f);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 256 + SLOT_POINTS.length * SLOT_CASES.length, "must have compared the full sweep");

  // Non-vacuity: the writes really happened, on both sides.
  // (i) gate closed -> only the two scratch writes; mark untouched.
  {
    const a = makeEntry(base, { a: 0x2a, c: 0x40, mark: 0x20 });
    const b = makeEntry(base, { a: 0x2a, c: 0x40, mark: 0x20 });
    oracle(a);
    loc_2c4f(b, b.regs.a, b.regs.c);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(SCRATCH_MODE), 0x2a, "mode byte must be stashed");
      assert.equal(mm.mem.read8(SCRATCH_FLAG), 1, "entry flag must be raised");
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x20, "gate closed -> mark unchanged");
    }
  }
  // (ii) gate open, slot found -> mark stepped by 8 and the request flag raised over the low bits.
  {
    const a = makeEntry(base, { a: 0x03, c: 0x08, mark: 0x08, records: [1, 0, 1, 1, 1], req: 0x03 });
    const b = makeEntry(base, { a: 0x03, c: 0x08, mark: 0x08, records: [1, 0, 1, 1, 1], req: 0x03 });
    oracle(a);
    loc_2c4f(b, b.regs.a, b.regs.c);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x08 - EVENT_STEP, "mark must step down by 8");
      assert.equal(mm.mem.read8(SCRATCH_REQ), 0x03 | 0x80, "request flag must OR the top bit over the low bits");
    }
  }
  // (iii) gate open, all occupied -> mark stepped, request flag untouched.
  {
    const a = makeEntry(base, { a: 0x03, c: 0x50, mark: 0x50, records: OCCUPIED, req: 0x11 });
    const b = makeEntry(base, { a: 0x03, c: 0x50, mark: 0x50, records: OCCUPIED, req: 0x11 });
    oracle(a);
    loc_2c4f(b, b.regs.a, b.regs.c);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x50 - EVENT_STEP, "mark must step down by 8");
      assert.equal(mm.mem.read8(SCRATCH_REQ), 0x11, "no free slot -> request flag untouched");
    }
  }
  console.log(`  EQUAL: ${count} combos (256 A-sweep + gate-open slot cross-product) — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** BUG (a): steps the mark by 4 instead of 8 — caught at BONUS_EVENT_MARK on the gate-open path. */
function brokenWrongStep(m, scratchValue, bonus) {
  const { mem } = m;
  mem.write8(SCRATCH_MODE, scratchValue);
  mem.write8(SCRATCH_FLAG, 1);
  const mark = mem.read8(BONUS_EVENT_MARK);
  if (mark !== bonus) return;
  mem.write8(BONUS_EVENT_MARK, mark - 4); // BUG: −4, not −8
  for (let i = 0; i < RECORDS; i++) {
    if (mem.read8(OBJ_ARRAY_64 + i * STRIDE) === 0) { loc_2c72(m); return; }
  }
}

/** BUG (b): inverts the gate — proceeds when the mark is NOT hit, so it does the RMW + scan the
 *  oracle skips. Caught on the gate-closed A-sweep. */
function brokenInvertedGate(m, scratchValue, bonus) {
  const { mem } = m;
  mem.write8(SCRATCH_MODE, scratchValue);
  mem.write8(SCRATCH_FLAG, 1);
  const mark = mem.read8(BONUS_EVENT_MARK);
  if (mark === bonus) return; // BUG: should be `mark !== bonus`
  mem.write8(BONUS_EVENT_MARK, mark - EVENT_STEP);
  for (let i = 0; i < RECORDS; i++) {
    if (mem.read8(OBJ_ARRAY_64 + i * STRIDE) === 0) { loc_2c72(m); return; }
  }
}

/** BUG (c): finds the free slot but never raises the flag — caught at 0x6382 on a slot-found case. */
function brokenDroppedFlag(m, scratchValue, bonus) {
  const { mem } = m;
  mem.write8(SCRATCH_MODE, scratchValue);
  mem.write8(SCRATCH_FLAG, 1);
  const mark = mem.read8(BONUS_EVENT_MARK);
  if (mark !== bonus) return;
  mem.write8(BONUS_EVENT_MARK, mark - EVENT_STEP);
  for (let i = 0; i < RECORDS; i++) {
    if (mem.read8(OBJ_ARRAY_64 + i * STRIDE) === 0) return; // BUG: dropped the loc_2c72 flag
  }
}

test("TEETH: the wrong-step twin is CAUGHT (BONUS_EVENT_MARK diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongStep);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong mark step — worthless");
  assert.equal(mismatch.ram.addr, BONUS_EVENT_MARK, "the wrong-step twin must diverge on BONUS_EVENT_MARK");
  console.log(`  TEETH/step: caught — ${describe(mismatch)}`);
});

test("TEETH: the inverted-gate twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenInvertedGate);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted gate — worthless");
  console.log(`  TEETH/gate: caught — ${describe(mismatch)}`);
});

test("TEETH: the dropped-slot-flag twin is CAUGHT (0x6382 diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDroppedFlag);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped slot flag — worthless");
  assert.equal(mismatch.ram.addr, SCRATCH_REQ, "the dropped-flag twin must diverge on 0x6382");
  console.log(`  TEETH/flag: caught — ${describe(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x2C4F in a real attract run and clone the machine at each real dispatch. It is reached
 * through the bonus-event cluster's dispatch, so it fires only occasionally. The wrapper clones
 * the entry state, then runs the oracle so the host game proceeds undisturbed.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("REALISM: real captured 0x2C4F dispatches — loc_2c4f matches oracle RAM", () => {
  const caps = captureDispatches(64, 3000);
  assert.ok(caps.length >= 1, "expected at least one real 0x2C4F dispatch during attract");

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const modeIn = hx(a.regs.a);
    const bonusIn = hx(a.regs.c);
    oracle(a);
    loc_2c4f(b, b.regs.a, b.regs.c);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (mode=${modeIn} bonus=${bonusIn}) ` +
          `at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x2C4F dispatches — RAM == oracle`);
});

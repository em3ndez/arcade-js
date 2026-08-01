// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2c49 (ROM 0x2C49) — the "mode byte 1" entry of the bonus-event
 * slot-claim cluster.
 *
 * loc_2c49 sets the mode byte to a hard constant 1 and tails into the shared slot-claim entry
 * (loc_2c4b) with the caller's bonus value (the register live-in). loc_2c4b stores the mode byte
 * into engine scratch 0x6382 and runs the shared body with it bumped by one — so this entry always
 * leaves 0x6382 = 1 and 0x638F = 2, independent of anything the caller holds. The shared body then
 * runs the periodic-event gate against the bonus: ONLY when BONUS_EVENT_MARK equals it does it step
 * the mark down by 8 and scan the five OBJ_ARRAY_64 records (stride 32) for the first zero
 * active-byte — on a hit it raises the top-bit request flag on that same 0x6382 byte (via loc_2c72),
 * so a claimed slot leaves 0x6382 = 0x81; on a miss it does just the scratch writes. It returns
 * nothing a caller consumes (the oracle threads residual registers/flags out; its callers reload),
 * so the contract is memory-only.
 *
 * The oracle writes NO stack: loc_2c49 falls THROUGH the whole chain (loc_2c49 -> loc_2c4b ->
 * loc_2c4f -> loc_2c72) with jumps, no CALL and no push, and every exit only READS the stack (a pop
 * is never a memory write). The candidate models no stack (plain JS calls), so the compared memory
 * (dumpState is RAM) is identical with NO stack-scratch exclusion — as for 0x2C4B / 0x2C4F / 0x2C72.
 *
 *   1. EQUAL — loc_2c49 == oracle on RAM (firstStateDiff over the whole dump) across:
 *        C-SWEEP (exhaustive) — all 256 bonus values with the gate CLOSED (mark != bonus), proving
 *          the three scratch writes (0x6382 = 1, 0x638F = 2, 0x6392 = 1) are constant and do NOT
 *          depend on the bonus. Each entry carries a NOISE accumulator value to pin that the mode
 *          byte is the hard constant 1, not something forwarded from the caller.
 *        SLOT sweep (crafted) — the gate OPEN (mark == bonus) over every first-free-slot position
 *          (records 0..4) and the all-occupied case, at several marks including a low one whose -8
 *          step wraps, proving the request flag ORs the top bit onto the stored mode byte (1 -> 0x81).
 *      Plus a non-vacuity block asserting the writes really happened on both sides.
 *
 *   2. TEETH — three deliberately-broken twins the same sweep MUST catch:
 *        (a) wrong mode byte (stashes 2, not 1) — caught at 0x6382 on the C-sweep.
 *        (b) mode byte forwarded from the caller's accumulator instead of the constant 1 — caught at
 *            0x6382 on the C-sweep (the entries carry a noise accumulator != 1).
 *        (c) mis-forwarded bonus (hands the body bonus+1) — caught at BONUS_EVENT_MARK, where the
 *            wrong bonus makes the event gate step the mark when it should not (or not when it
 *            should), pinning that the caller's bonus is forwarded faithfully.
 *
 *   3. REALISM (captured dispatches) — hook 0x2C49 in a real attract run (it is reached through the
 *      bonus-event cluster's dispatch, only occasionally), clone at each true dispatch, and confirm
 *      loc_2c49 reproduces the oracle's RAM on every real state the game actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2c49.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2c49 as oracle } from "../../translated/loc_2c49.js";
import { loc_2c49 } from "../loc_2c49.js";
import { loc_2c4b } from "../loc_2c4b.js";
import { BONUS_EVENT_MARK, OBJ_ARRAY_64 } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2c49;
const SCRATCH_REQ = 0x6382; // the mode byte lands here; the slot-claim flag later ORs the top bit
const SCRATCH_MODE = 0x638f; // the mode byte PLUS ONE lands here (inc between the two stores)
const SCRATCH_FLAG = 0x6392; // raised to 1 on every entry
const STRIDE = 32; // OBJ_ARRAY_64 record stride
const RECORDS = 5;
const EVENT_STEP = 8;
const MODE = 0x01; // the mode byte this entry hard-codes -> 0x6382 = 1, 0x638F = 2
const NOISE_A = 0x55; // accumulator noise: the routine must ignore it (mode byte is the constant 1)
// The oracle chain's `ret`s pop the stack; point SP at work RAM so those pops read valid bytes
// (never I/O). The chain writes no RAM through the stack (only pops), so this never affects the
// compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const OCCUPIED = [1, 2, 3, 4, 5]; // all non-zero -> no free slot

/**
 * A synthetic entry: a clone of `base` with the bonus live-in, a NOISE accumulator, the event mark,
 * and the five OBJ_ARRAY_64 active bytes set, plus a safe stack. 0x6382 is NOT preset — the routine
 * overwrites it with the mode byte. Frame machinery is neutralised so the oracle's `m.step`/`m.ret`
 * can't fire an NMI or push a frame while running in isolation.
 */
function makeEntry(base, { c, mark, records = OCCUPIED }) {
  const e = base.clone();
  e.regs.a = NOISE_A; // the routine hard-codes the mode byte; it must not read this
  e.regs.c = c; // the bonus value the event gate tests against
  e.mem.write8(BONUS_EVENT_MARK, mark);
  for (let i = 0; i < RECORDS; i++) e.mem.write8(OBJ_ARRAY_64 + i * STRIDE, records[i]);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). The candidate reads its bonus live-in from
 * the same register the oracle does.
 */
function runPair(base, opts, candidate) {
  const a = makeEntry(base, opts); // oracle
  const b = makeEntry(base, opts); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// The gate-open slot scenarios: every first-free-slot position, plus all-occupied. Each is run at a
// few marks (with bonus == mark to open the gate), including a low mark whose -8 step wraps.
const SLOT_CASES = [
  { name: "slot@0", records: [0, 1, 1, 1, 1] },
  { name: "slot@1", records: [1, 0, 1, 1, 1] },
  { name: "slot@2", records: [1, 1, 0, 1, 1] },
  { name: "slot@3", records: [1, 1, 1, 0, 1] },
  { name: "slot@4", records: [1, 1, 1, 1, 0] },
  { name: "no-free", records: OCCUPIED },
];
const SLOT_MARKS = [
  0x50,
  0x32, // the real attract slot-claim point (mark = 0x32)
  0x04, // low mark: 0x04 - 8 wraps to 0xfc
  0x40,
];

/**
 * Both regimes in one pass: the exhaustive gate-closed C-sweep, then the crafted gate-open slot
 * cross-product. Returns the first mismatch (or null) + the number of comparisons.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // C-SWEEP — gate CLOSED (mark != bonus): only 0x6382, 0x638F and 0x6392 change; they are constant
  // (independent of the bonus). mark = bonus+1 keeps the gate closed for every bonus.
  for (let c = 0; c < 256; c++) {
    const ram = runPair(base, { c, mark: (c + 1) & 0xff, records: OCCUPIED }, candidate);
    count++;
    if (ram) return { mismatch: { where: `C-sweep c=${hx(c)}`, ram }, count };
  }

  // SLOT sweep — gate OPEN (mark == bonus): every first-free position x several marks.
  for (const mark of SLOT_MARKS) {
    for (const sc of SLOT_CASES) {
      const opts = { c: mark, mark, records: sc.records };
      const ram = runPair(base, opts, candidate);
      count++;
      if (ram) return { mismatch: { where: `${sc.name} mark=${hx(mark)}`, ram }, count };
    }
  }

  return { mismatch: null, count };
}

const describe = (mm) =>
  mm && `at ${mm.where}: RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: loc_2c49 == oracle across the C-sweep and every gate-open slot case", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_2c49);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 256 + SLOT_MARKS.length * SLOT_CASES.length, "must have compared the full sweep");

  // Non-vacuity: the writes really happened, on both sides.
  // (i) gate closed -> the two constant stores plus the entry flag; mark untouched; A ignored.
  {
    const a = makeEntry(base, { c: 0x40, mark: 0x20 });
    const b = makeEntry(base, { c: 0x40, mark: 0x20 });
    oracle(a);
    loc_2c49(b);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(SCRATCH_REQ), MODE, "0x6382 must hold the constant mode byte 1");
      assert.equal(mm.mem.read8(SCRATCH_MODE), MODE + 1, "0x638F must hold the mode byte + 1");
      assert.equal(mm.mem.read8(SCRATCH_FLAG), 1, "entry flag must be raised");
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x20, "gate closed -> mark unchanged");
    }
  }
  // (ii) gate open, slot found -> mark stepped by 8 and the request flag ORed onto the mode byte.
  {
    const a = makeEntry(base, { c: 0x32, mark: 0x32, records: [1, 0, 1, 1, 1] });
    const b = makeEntry(base, { c: 0x32, mark: 0x32, records: [1, 0, 1, 1, 1] });
    oracle(a);
    loc_2c49(b);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x32 - EVENT_STEP, "mark must step down by 8");
      assert.equal(mm.mem.read8(SCRATCH_MODE), MODE + 1, "0x638F must hold the mode byte + 1");
      assert.equal(mm.mem.read8(SCRATCH_REQ), MODE | 0x80, "request flag must OR the top bit onto the mode byte (0x81)");
    }
  }
  // (iii) gate open, all occupied -> mark stepped, mode byte kept at 1, no top-bit flag.
  {
    const a = makeEntry(base, { c: 0x50, mark: 0x50, records: OCCUPIED });
    const b = makeEntry(base, { c: 0x50, mark: 0x50, records: OCCUPIED });
    oracle(a);
    loc_2c49(b);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x50 - EVENT_STEP, "mark must step down by 8");
      assert.equal(mm.mem.read8(SCRATCH_REQ), MODE, "no free slot -> mode byte kept at 1, no top bit");
    }
  }
  console.log(`  EQUAL: ${count} combos (256 C-sweep + gate-open slot cross-product) — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** BUG (a): stashes the WRONG mode byte (2 instead of 1) — so 0x6382 = 2 and 0x638F = 3. Caught at
 *  0x6382 on the C-sweep. */
function brokenWrongMode(m) {
  loc_2c4b(m, 0x02, m.regs.c); // BUG: mode byte 2
}

/** BUG (b): forwards the caller's accumulator as the mode byte instead of the hard constant 1 — so
 *  0x6382 = NOISE_A rather than 1. Caught at 0x6382 on the C-sweep (entries carry NOISE_A != 1). */
function brokenModeFromA(m) {
  loc_2c4b(m, m.regs.a, m.regs.c); // BUG: mode byte read from the accumulator
}

/** BUG (c): forwards the WRONG bonus, so the periodic-event gate opens/closes wrongly. Caught at
 *  BONUS_EVENT_MARK — the mark's -8 step is driven by the wrong bonus. */
function brokenBonusForward(m) {
  loc_2c4b(m, MODE, (m.regs.c + 1) & 0xff); // BUG: bonus + 1
}

test("TEETH: the wrong-mode-byte twin is CAUGHT (0x6382 diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongMode);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong mode byte — worthless");
  assert.equal(mismatch.ram.addr, SCRATCH_REQ, "the wrong-mode twin must diverge on 0x6382");
  console.log(`  TEETH/mode: caught — ${describe(mismatch)}`);
});

test("TEETH: the mode-from-accumulator twin is CAUGHT (0x6382 diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenModeFromA);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a mode byte forwarded from the accumulator — worthless");
  assert.equal(mismatch.ram.addr, SCRATCH_REQ, "the mode-from-A twin must diverge on 0x6382, pinning the constant 1");
  console.log(`  TEETH/const: caught — ${describe(mismatch)}`);
});

test("TEETH: the mis-forwarded-bonus twin is CAUGHT (BONUS_EVENT_MARK diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenBonusForward);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a mis-forwarded bonus — worthless");
  assert.equal(mismatch.ram.addr, BONUS_EVENT_MARK, "the bonus-forward twin must diverge on BONUS_EVENT_MARK");
  console.log(`  TEETH/bonus: caught — ${describe(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x2C49 in a real attract run and clone the machine at each real dispatch. It is reached
 * through the bonus-event cluster's dispatch, so it fires only occasionally. The wrapper clones the
 * entry state, then runs the oracle so the host game proceeds undisturbed.
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

test("REALISM: real captured 0x2C49 dispatches — loc_2c49 matches oracle RAM", () => {
  const caps = captureDispatches(64, 6000);
  assert.ok(caps.length >= 1, "expected at least one real 0x2C49 dispatch during attract");

  let sawClaim = 0, sawMiss = 0;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const bonusIn = hx(a.regs.c);
    oracle(a);
    loc_2c49(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (bonus=${bonusIn}) ` +
          `at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
    // Classify the arm for reporting: the slot-claim path leaves 0x6382's top bit set.
    if ((a.mem.read8(SCRATCH_REQ) & 0x80) !== 0) sawClaim++; else sawMiss++;
  }
  console.log(`  REALISM: ${caps.length} real 0x2C49 dispatches — RAM == oracle (${sawClaim} slot-claim, ${sawMiss} gate-closed)`);
});

// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2c4b (ROM 0x2C4B) — one entry of the bonus-event slot-claim cluster.
 *
 * loc_2c4b takes two register live-ins (the caller's mode byte and the current bonus value). It
 * stores the mode byte into BARREL_CLAIM_MODE, then falls into the shared body (loc_2c4f) with
 * the mode byte incremented — so 0x638F records the mode byte PLUS ONE while 0x6382 keeps the
 * un-incremented value (the increment sits between the two stores; that offset-by-one is this
 * entry's whole distinguishing move). The shared body then runs the periodic-event gate against the
 * bonus value: ONLY when BONUS_EVENT_MARK equals it does it step the mark down by 8 and scan the
 * five OBJ_ARRAY_64 records (stride 32) for the first zero active-byte — on a hit it raises the
 * bit 7 (the barrel-kind select) on that same BARREL_CLAIM_MODE byte (via loc_2c72), so a claimed slot leaves it as
 * the mode byte with its top bit set; on a miss it does just the two scratch writes. It returns
 * nothing a caller consumes (the oracle threads residual registers/flags out; its callers reload),
 * so the contract is memory-only.
 *
 * The oracle writes NO stack: loc_2c4b falls THROUGH into loc_2c4f (no CALL, no push), and every
 * exit in the chain only READS the stack (a pop is never a memory write). The candidate models no
 * stack (plain JS calls), so the compared memory (dumpState is RAM) is identical with NO
 * stack-scratch exclusion — as for 0x2C4F / 0x2C72.
 *
 *   1. EQUAL — loc_2c4b == oracle on RAM (firstStateDiff over the whole dump) across:
 *        A-SWEEP (exhaustive) — all 256 mode bytes with the gate CLOSED, isolating 0x6382 = mode,
 *          0x638F = mode+1 (incl. the 0xFF -> 0x00 wrap), and 0x6392 = 1.
 *        SLOT sweep (crafted) — the gate OPEN over every first-free-slot position (records 0..4)
 *          and the all-occupied case, at several (mode, mark=bonus) points including a low mark
 *          whose -8 step wraps, proving the claim ORs bit 7 onto the stored mode value.
 *      Plus a non-vacuity block asserting the writes really happened on both sides.
 *
 *   2. TEETH — three deliberately-broken twins the same sweep MUST catch:
 *        (a) dropped increment (0x638F = mode, not mode+1) — caught at 0x638F on the A-sweep.
 *        (b) first store gets the incremented value (0x6382 = mode+1) — caught at 0x6382 on the
 *            A-sweep, pinning the store-BEFORE-increment order.
 *        (c) mis-forwarded bonus (hands loc_2c4f bonus+1) — caught at BONUS_EVENT_MARK on the
 *            gate-open path, pinning that the caller's bonus is forwarded faithfully.
 *
 *   3. REALISM (captured dispatches) — hook 0x2C4B in a real attract run (it is reached through the
 *      bonus-event cluster's dispatch), clone at each true dispatch, and confirm loc_2c4b reproduces
 *      the oracle's RAM on every real state the game actually produces. Attract spans both arms: a
 *      gate-open slot claim (0x6382 -> mode|0x80) and a gate-closed miss.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2c4b.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2c4b as oracle } from "../../translated/loc_2c4b.js";
import { loc_2c4b } from "../loc_2c4b.js";
import { loc_2c4f } from "../loc_2c4f.js";
import { BONUS_EVENT_MARK, OBJ_ARRAY_64, BARREL_CLAIM_MODE } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2c4b;
const SCRATCH_MODE = 0x638f; // the mode byte PLUS ONE lands here (inc between the two stores)
const SCRATCH_FLAG = 0x6392; // raised to 1 on every entry
const STRIDE = 32; // OBJ_ARRAY_64 record stride
const RECORDS = 5;
const EVENT_STEP = 8;
// The oracle chain's `ret`s pop the stack; point SP at work RAM so those pops read valid bytes
// (never I/O). The chain writes no RAM through the stack (only pops), so this never affects the
// compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const OCCUPIED = [1, 2, 3, 4, 5]; // all non-zero -> no free slot

/**
 * A synthetic entry: a clone of `base` with the two register live-ins, the event mark, and the
 * five OBJ_ARRAY_64 active bytes set, plus a safe stack. 0x6382 is NOT preset — loc_2c4b overwrites
 * it with the mode byte. Frame machinery is neutralised so the oracle's `m.step`/`m.ret` can't fire
 * an NMI or push a frame while running in isolation.
 */
function makeEntry(base, { a, c, mark, records = OCCUPIED }) {
  const e = base.clone();
  e.regs.a = a;
  e.regs.c = c;
  e.mem.write8(BONUS_EVENT_MARK, mark);
  for (let i = 0; i < RECORDS; i++) e.mem.write8(OBJ_ARRAY_64 + i * STRIDE, records[i]);
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
// few (mode, mark=bonus) points, including a low mark whose -8 step wraps.
const SLOT_CASES = [
  { name: "slot@0", records: [0, 1, 1, 1, 1] },
  { name: "slot@1", records: [1, 0, 1, 1, 1] },
  { name: "slot@2", records: [1, 1, 0, 1, 1] },
  { name: "slot@3", records: [1, 1, 1, 0, 1] },
  { name: "slot@4", records: [1, 1, 1, 1, 0] },
  { name: "no-free", records: OCCUPIED },
];
const SLOT_POINTS = [
  { a: 0x00, mark: 0x50 },
  { a: 0x01, mark: 0x32 }, // the real attract slot-claim point (A=1, mark=0x32)
  { a: 0x2a, mark: 0x04 }, // low mark: 0x04 - 8 wraps to 0xfc
  { a: 0xff, mark: 0x40 }, // mode byte 0xff -> 0x638F wraps to 0x00, 0x6382 keeps 0xff|0x80
];

/**
 * Both regimes in one pass: the exhaustive gate-closed A-sweep, then the crafted gate-open slot
 * cross-product. Returns the first mismatch (or null) + the number of comparisons.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // A-SWEEP — gate CLOSED (mark != bonus): only 0x6382, 0x638F and 0x6392 change; isolates the two
  // stores and the +1 between them.
  for (let a = 0; a < 256; a++) {
    const ram = runPair(base, { a, c: 0x40, mark: 0x20, records: OCCUPIED }, candidate);
    count++;
    if (ram) return { mismatch: { where: `A-sweep a=${hx(a)}`, ram }, count };
  }

  // SLOT sweep — gate OPEN (mark == bonus): every first-free position x several mark/mode points.
  for (const pt of SLOT_POINTS) {
    for (const sc of SLOT_CASES) {
      const opts = { a: pt.a, c: pt.mark, mark: pt.mark, records: sc.records };
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

test("EQUAL: loc_2c4b == oracle across the A-sweep and every gate-open slot case", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_2c4b);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 256 + SLOT_POINTS.length * SLOT_CASES.length, "must have compared the full sweep");

  // Non-vacuity: the writes really happened, on both sides.
  // (i) gate closed -> the two-stores-plus-one and the entry flag; mark untouched.
  {
    const a = makeEntry(base, { a: 0x2a, c: 0x40, mark: 0x20 });
    const b = makeEntry(base, { a: 0x2a, c: 0x40, mark: 0x20 });
    oracle(a);
    loc_2c4b(b, b.regs.a, b.regs.c);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BARREL_CLAIM_MODE), 0x2a, "0x6382 must hold the un-incremented mode byte");
      assert.equal(mm.mem.read8(SCRATCH_MODE), 0x2b, "0x638F must hold the mode byte + 1");
      assert.equal(mm.mem.read8(SCRATCH_FLAG), 1, "entry flag must be raised");
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x20, "gate closed -> mark unchanged");
    }
  }
  // (ii) gate open, slot found -> mark stepped by 8 and bit 7 ORed onto the mode value.
  {
    const a = makeEntry(base, { a: 0x01, c: 0x32, mark: 0x32, records: [1, 0, 1, 1, 1] });
    const b = makeEntry(base, { a: 0x01, c: 0x32, mark: 0x32, records: [1, 0, 1, 1, 1] });
    oracle(a);
    loc_2c4b(b, b.regs.a, b.regs.c);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x32 - EVENT_STEP, "mark must step down by 8");
      assert.equal(mm.mem.read8(SCRATCH_MODE), 0x02, "0x638F must hold the mode byte + 1");
      assert.equal(mm.mem.read8(BARREL_CLAIM_MODE), 0x01 | 0x80, "the claim must OR bit 7 onto the mode value");
    }
  }
  // (iii) gate open, all occupied -> mark stepped, mode byte kept, no top-bit flag.
  {
    const a = makeEntry(base, { a: 0x03, c: 0x50, mark: 0x50, records: OCCUPIED });
    const b = makeEntry(base, { a: 0x03, c: 0x50, mark: 0x50, records: OCCUPIED });
    oracle(a);
    loc_2c4b(b, b.regs.a, b.regs.c);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x50 - EVENT_STEP, "mark must step down by 8");
      assert.equal(mm.mem.read8(BARREL_CLAIM_MODE), 0x03, "no free slot -> mode byte kept, no top bit");
    }
  }
  console.log(`  EQUAL: ${count} combos (256 A-sweep + gate-open slot cross-product) — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** BUG (a): drops the increment — hands the body the un-incremented mode byte, so 0x638F = mode
 *  instead of mode+1. Caught at 0x638F on the A-sweep. */
function brokenDroppedInc(m, modeByte, bonus) {
  m.mem.write8(BARREL_CLAIM_MODE, modeByte);
  loc_2c4f(m, modeByte, bonus); // BUG: no +1
}

/** BUG (b): the FIRST store gets the incremented value — 0x6382 = mode+1 rather than mode, so the
 *  increment is applied before the first store. Caught at 0x6382 on the A-sweep. */
function brokenFirstStoreValue(m, modeByte, bonus) {
  m.mem.write8(BARREL_CLAIM_MODE, modeByte + 1); // BUG: stores the incremented value
  loc_2c4f(m, modeByte + 1, bonus); // 0x638F still correct
}

/** BUG (c): forwards the WRONG bonus to the body, so the periodic-event gate opens/closes wrongly.
 *  Caught at BONUS_EVENT_MARK on the gate-open slot sweep. */
function brokenBonusForward(m, modeByte, bonus) {
  m.mem.write8(BARREL_CLAIM_MODE, modeByte);
  loc_2c4f(m, modeByte + 1, (bonus + 1) & 0xff); // BUG: bonus + 1
}

test("TEETH: the dropped-increment twin is CAUGHT (0x638F diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDroppedInc);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped increment — worthless");
  assert.equal(mismatch.ram.addr, SCRATCH_MODE, "the dropped-inc twin must diverge on 0x638F");
  console.log(`  TEETH/inc: caught — ${describe(mismatch)}`);
});

test("TEETH: the first-store-value twin is CAUGHT (0x6382 diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenFirstStoreValue);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a first-store using the incremented value — worthless");
  assert.equal(mismatch.ram.addr, BARREL_CLAIM_MODE, "the first-store twin must diverge on 0x6382");
  console.log(`  TEETH/order: caught — ${describe(mismatch)}`);
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
 * Hook 0x2C4B in a real attract run and clone the machine at each real dispatch. It is reached
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

test("REALISM: real captured 0x2C4B dispatches — loc_2c4b matches oracle RAM", () => {
  const caps = captureDispatches(64, 4000);
  assert.ok(caps.length >= 1, "expected at least one real 0x2C4B dispatch during attract");

  let sawClaim = 0, sawMiss = 0;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const modeIn = hx(a.regs.a);
    const bonusIn = hx(a.regs.c);
    oracle(a);
    loc_2c4b(b, b.regs.a, b.regs.c);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (mode=${modeIn} bonus=${bonusIn}) ` +
          `at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
    // Classify the arm for reporting: the slot-claim path leaves 0x6382's top bit set.
    if ((a.mem.read8(BARREL_CLAIM_MODE) & 0x80) !== 0) sawClaim++; else sawMiss++;
  }
  console.log(`  REALISM: ${caps.length} real 0x2C4B dispatches — RAM == oracle (${sawClaim} slot-claim, ${sawMiss} gate-closed)`);
});

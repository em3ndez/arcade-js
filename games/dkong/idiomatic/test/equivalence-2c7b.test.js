// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2c7b (ROM 0x2C7B) — the branch-and-dispatch entry of the bonus-event
 * slot-claim cluster.
 *
 * loc_2c7b takes two register live-ins from its (still-translated) caller: a small stepped value
 * and the current bonus value. It steps the value up by two (at byte width — it WRAPS) and compares
 * it with the bonus:
 *
 *   - stepped+2 == bonus  -> the mode-byte-1 entry (loc_2c49): records 0x6382 = 1, 0x638F = 2.
 *   - otherwise           -> the shared entry with mode byte 2 (loc_2c4b): records 0x6382 = 2,
 *                            0x638F = 3.
 *
 * Both arms forward the bonus so the shared body (armBarrelRelease) can run its periodic-event gate: ONLY
 * when BONUS_EVENT_MARK equals the forwarded bonus does it step the mark down by 8 and scan the five
 * OBJ_ARRAY_64 records (stride 32) for the first zero active-byte — on a hit it raises the top-bit
 * bit 7 on the same BARREL_CLAIM_MODE byte (via markNextBarrelAsAltKind), so a claimed slot leaves it as the mode
 * byte with its top bit set (0x81 in the match arm, 0x82 in the miss arm); on a miss it does just
 * the scratch writes. Nothing a caller consumes comes back (the oracle threads residual
 * registers/flags out; its callers reload), so the contract is memory-only.
 *
 * NO STACK-SCRATCH EXCLUSION. The oracle falls THROUGH the whole chain (entry_2c7b -> loc_2c49/
 * loc_2c4b -> armBarrelRelease -> markNextBarrelAsAltKind) with tail jumps — no CALL, no push16 anywhere — and every exit
 * only READS the stack (a pop is never a memory write). The candidate models no stack (plain JS
 * calls). So the compared memory (dumpState is RAM) is identical with NO stack exclusion, exactly as
 * for its callees 0x2C49 / 0x2C4B / 0x2C4F / 0x2C72.
 *
 * ★ NO CAPTURED DISPATCHES ARE REPLAYED — AND THE OLD REASON GIVEN FOR THAT WAS FALSE. This header
 * used to say "0x2C7B is NOT reached during attract ... so there is nothing to capture". Pass 13
 * refuted it on the real dkong ROM under MAME 0.288: an opcode-fetch tap in PURE attract (zero
 * coins, zero inputs, zero pokes, 24,243 frames) counted 18 dispatches of 0x2C7B — exactly two per
 * 25m board, at BONUS = BONUS_START (50) and BONUS_START − 1 (49) — reproduced by a second rig, and
 * 24 in a credited run (scratchpad/pass13-grounding.md §3). Real dispatches DO exist and could be
 * captured.
 *
 * The honest reason this suite is crafted-only is different, and weaker: 18 dispatches all sit on
 * the same two BONUS values, and the pass-13 tap was placed on the ENTRY address only — the two
 * branch arms (targets 0x2C49 / 0x2C4B) were never separated — so a capture replay would pin one
 * region of the input space and leave the arm split unmeasured. The crafted + exhaustive sweep
 * below is what actually provides arm coverage. This suite therefore makes NO real-capture coverage
 * claim; adding one is open work, not a closed hole. The gate:
 *
 *   1. EQUAL (branch sweep, gate CLOSED) — for all 256 stepped-value inputs, the TAKEN case
 *      (bonus = value+2) and the MISS case (bonus = value+3) both match the oracle on RAM, proving
 *      the branch condition is the byte-width `value+2 == bonus` (incl. the wrap at 254/255) and that
 *      the match arm records mode byte 1 (0x6382 = 1, 0x638F = 2) while the miss arm records mode
 *      byte 2 (0x6382 = 2, 0x638F = 3). The mark is kept != bonus so the event gate stays closed and
 *      only the scratch bytes move.
 *
 *   2. EQUAL (slot sweep, gate OPEN) — in BOTH arms, with bonus == mark to open the gate, over every
 *      first-free-slot position (records 0..4) and the all-occupied case, at several marks including
 *      a low one whose -8 step wraps. Proves the bonus is forwarded faithfully (the gate opens at
 *      all), the mark steps down by 8, and the slot-claim request bit ORs onto the recorded mode byte
 *      (0x81 in the match arm, 0x82 in the miss arm).
 *
 *   3. TEETH — three deliberately-broken twins the same sweep MUST catch:
 *        (a) compare drops the byte-width wrap (value+2 without the wrap) — caught at 0x6382 where a
 *            wrapped stepped value (254/255) flips the branch.
 *        (b) wrong constant mode byte in the miss arm (3 instead of 2) — caught at 0x6382 on the miss
 *            sweep.
 *        (c) mis-forwarded bonus in the miss arm (bonus+1) — caught at BONUS_EVENT_MARK on the
 *            gate-open miss sweep (the wrong bonus closes a gate that should open).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2c7b.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2c7b as oracle } from "../../translated/loc_2c7b.js";
import { loc_2c7b } from "../loc_2c7b.js";
import { loc_2c49 } from "../loc_2c49.js";
import { loc_2c4b } from "../loc_2c4b.js";
import { BONUS_EVENT_MARK, OBJ_ARRAY_64, BARREL_CLAIM_MODE } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { u8 } from "../../../../core/int.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const SCRATCH_MODE = 0x638f; // the mode byte PLUS ONE lands here (inc between the two stores)
const SCRATCH_FLAG = 0x6392; // raised to 1 on every entry into the shared body
const STRIDE = 32; // OBJ_ARRAY_64 record stride
const RECORDS = 5;
const EVENT_STEP = 8;
// The oracle chain's `ret`s pop the stack; point SP at work RAM so those pops read valid bytes
// (never I/O). The chain writes NO RAM through the stack (only pops), so this never affects the
// compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const OCCUPIED = [1, 2, 3, 4, 5]; // all non-zero -> no free slot

/**
 * A synthetic 0x2C7B entry: a clone of `base` with the stepped value and bonus live-ins in
 * registers, the event mark, and the five OBJ_ARRAY_64 active bytes, plus a safe stack. The scratch
 * bytes are NOT preset — the chain overwrites them. Frame machinery is neutralised so the oracle's
 * `m.step`/`m.ret` can't fire an NMI or push a frame while running in isolation.
 */
function makeEntry(base, { a, c, mark, records = OCCUPIED }) {
  const e = base.clone();
  e.regs.a = a; // the stepped value the routine adds 2 to
  e.regs.c = c; // the bonus value the branch tests against and the chain forwards
  e.mem.write8(BONUS_EVENT_MARK, mark);
  for (let i = 0; i < RECORDS; i++) e.mem.write8(OBJ_ARRAY_64 + i * STRIDE, records[i]);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). Both read their live-ins from registers.
 */
function runPair(base, opts, candidate) {
  const a = makeEntry(base, opts); // oracle
  const b = makeEntry(base, opts); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// The gate-open slot scenarios: every first-free-slot position, plus all-occupied.
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
  0x32, // the attract slot-claim point the cluster's siblings exercise
  0x04, // low mark: 0x04 - 8 wraps to 0xfc
  0x40,
];

/**
 * Both regimes in one pass:
 *   - the gate-CLOSED branch sweep over all 256 stepped values, in the TAKEN (bonus = value+2) and
 *     MISS (bonus = value+3) arms; and
 *   - the gate-OPEN slot cross-product in both arms.
 * Returns the first mismatch (or null) + the number of comparisons.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // BRANCH sweep — gate CLOSED (mark != bonus): only the scratch bytes move, isolating the branch
  // decision and the two constant mode bytes across the whole stepped-value range (incl. the wrap).
  for (let a = 0; a < 256; a++) {
    // TAKEN arm: bonus == value+2 (byte width) -> mode-byte-1 entry.
    const cTaken = u8(a + 2);
    const takenRam = runPair(base, { a, c: cTaken, mark: u8(cTaken + 1), records: OCCUPIED }, candidate);
    count++;
    if (takenRam) return { mismatch: { where: `taken a=${hx(a)}`, ram: takenRam }, count };

    // MISS arm: bonus == value+3 (never equals value+2) -> mode-byte-2 entry.
    const cMiss = u8(a + 3);
    const missRam = runPair(base, { a, c: cMiss, mark: u8(cMiss + 1), records: OCCUPIED }, candidate);
    count++;
    if (missRam) return { mismatch: { where: `miss a=${hx(a)}`, ram: missRam }, count };
  }

  // SLOT sweep — gate OPEN (bonus == mark) in BOTH arms, every first-free position x several marks.
  for (const mark of SLOT_MARKS) {
    for (const sc of SLOT_CASES) {
      // TAKEN arm, gate open: bonus == mark and value+2 == bonus -> value = mark-2.
      const takenRam = runPair(base, { a: u8(mark - 2), c: mark, mark, records: sc.records }, candidate);
      count++;
      if (takenRam) return { mismatch: { where: `taken ${sc.name} mark=${hx(mark)}`, ram: takenRam }, count };

      // MISS arm, gate open: bonus == mark but value+2 != bonus -> value = mark-1 (so value+2 = mark+1).
      const missRam = runPair(base, { a: u8(mark - 1), c: mark, mark, records: sc.records }, candidate);
      count++;
      if (missRam) return { mismatch: { where: `miss ${sc.name} mark=${hx(mark)}`, ram: missRam }, count };
    }
  }

  return { mismatch: null, count };
}

const describe = (mm) =>
  mm && `at ${mm.where}: RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: loc_2c7b == oracle across the branch sweep and every gate-open slot case", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_2c7b);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 256 * 2 + SLOT_MARKS.length * SLOT_CASES.length * 2, "must have compared the full sweep");

  // Non-vacuity: the writes really happened, on both sides.
  // (i) TAKEN arm, gate closed -> mode byte 1: 0x6382 = 1, 0x638F = 2, entry flag raised, mark kept.
  {
    const opts = { a: 0x10, c: u8(0x10 + 2), mark: 0x20 };
    const a = makeEntry(base, opts);
    const b = makeEntry(base, opts);
    oracle(a);
    loc_2c7b(b);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BARREL_CLAIM_MODE), 1, "taken arm: 0x6382 must hold mode byte 1");
      assert.equal(mm.mem.read8(SCRATCH_MODE), 2, "taken arm: 0x638F must hold mode byte + 1");
      assert.equal(mm.mem.read8(SCRATCH_FLAG), 1, "entry flag must be raised");
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x20, "gate closed -> mark unchanged");
    }
  }
  // (ii) MISS arm, gate closed -> mode byte 2: 0x6382 = 2, 0x638F = 3.
  {
    const opts = { a: 0x10, c: u8(0x10 + 3), mark: 0x20 };
    const a = makeEntry(base, opts);
    const b = makeEntry(base, opts);
    oracle(a);
    loc_2c7b(b);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BARREL_CLAIM_MODE), 2, "miss arm: 0x6382 must hold mode byte 2");
      assert.equal(mm.mem.read8(SCRATCH_MODE), 3, "miss arm: 0x638F must hold mode byte + 1");
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x20, "gate closed -> mark unchanged");
    }
  }
  // (iii) TAKEN arm, gate open, slot found -> mark steps by 8, request bit ORed onto mode byte -> 0x81.
  {
    const opts = { a: u8(0x32 - 2), c: 0x32, mark: 0x32, records: [1, 0, 1, 1, 1] };
    const a = makeEntry(base, opts);
    const b = makeEntry(base, opts);
    oracle(a);
    loc_2c7b(b);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x32 - EVENT_STEP, "mark must step down by 8");
      assert.equal(mm.mem.read8(BARREL_CLAIM_MODE), 1 | 0x80, "taken slot-claim -> 0x6382 = 0x81");
    }
  }
  // (iv) MISS arm, gate open, slot found -> mark steps, request bit ORed onto mode byte 2 -> 0x82.
  {
    const opts = { a: u8(0x50 - 1), c: 0x50, mark: 0x50, records: [1, 1, 0, 1, 1] };
    const a = makeEntry(base, opts);
    const b = makeEntry(base, opts);
    oracle(a);
    loc_2c7b(b);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x50 - EVENT_STEP, "mark must step down by 8");
      assert.equal(mm.mem.read8(BARREL_CLAIM_MODE), 2 | 0x80, "miss slot-claim -> 0x6382 = 0x82");
    }
  }
  console.log(`  EQUAL: ${count} combos (512 branch sweep + gate-open slot cross-product) — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** BUG (a): compares the stepped value WITHOUT the byte-width wrap. At value 254/255 the correct
 *  routine wraps to 0/1 and takes the match arm; this twin never does, so it records the wrong mode
 *  byte. Caught at 0x6382 on the TAKEN branch sweep. */
function brokenNoWrap(m) {
  const probe = m.regs.a + 0x02; // BUG: no u8() wrap
  if (probe === m.regs.c) loc_2c49(m);
  else loc_2c4b(m, 0x02, m.regs.c);
}

/** BUG (b): the miss arm records mode byte 3 instead of the constant 2 — so 0x6382 = 3 / 0x638F = 4.
 *  Caught at 0x6382 on the MISS branch sweep. */
function brokenWrongMode(m) {
  const probe = u8(m.regs.a + 0x02);
  if (probe === m.regs.c) loc_2c49(m);
  else loc_2c4b(m, 0x03, m.regs.c); // BUG: mode byte 3
}

/** BUG (c): the miss arm forwards bonus+1, so the periodic-event gate opens/closes wrongly. Caught
 *  at BONUS_EVENT_MARK — with the wrong bonus the mark's -8 step does not fire when it should. */
function brokenBonusForward(m) {
  const probe = u8(m.regs.a + 0x02);
  if (probe === m.regs.c) loc_2c49(m);
  else loc_2c4b(m, 0x02, u8(m.regs.c + 1)); // BUG: bonus + 1
}

test("TEETH: the no-wrap-compare twin is CAUGHT (0x6382 diverges on a wrapped stepped value)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenNoWrap);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a compare that drops the byte-width wrap — worthless");
  assert.equal(mismatch.ram.addr, BARREL_CLAIM_MODE, "the no-wrap twin must diverge on 0x6382 (the mode byte from the wrong arm)");
  console.log(`  TEETH/wrap: caught — ${describe(mismatch)}`);
});

test("TEETH: the wrong-mode-byte twin is CAUGHT (0x6382 diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongMode);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong constant mode byte — worthless");
  assert.equal(mismatch.ram.addr, BARREL_CLAIM_MODE, "the wrong-mode twin must diverge on 0x6382");
  console.log(`  TEETH/mode: caught — ${describe(mismatch)}`);
});

test("TEETH: the mis-forwarded-bonus twin is CAUGHT (BONUS_EVENT_MARK diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenBonusForward);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a mis-forwarded bonus — worthless");
  assert.equal(mismatch.ram.addr, BONUS_EVENT_MARK, "the bonus-forward twin must diverge on BONUS_EVENT_MARK");
  console.log(`  TEETH/bonus: caught — ${describe(mismatch)}`);
});

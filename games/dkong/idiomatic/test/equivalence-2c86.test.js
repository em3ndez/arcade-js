// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2c86 (ROM 0x2C86) — one entry of the bonus-event slot-claim cluster.
 *
 * loc_2c86 CLEARS the slot-claim request flag 0x6382 to zero, then tails into loc_2c4f with the
 * mode byte 3 and the caller's bonus value (a register live-in). loc_2c4f always stashes the mode
 * byte at 0x638F and raises 1 at 0x6392; then, ONLY when BONUS_EVENT_MARK equals the bonus value,
 * it steps that mark down by 8 and scans the five OBJ_ARRAY_64 records (stride 32) for the first
 * free (zero) one — on a hit it raises the top bit of the request flag 0x6382 (via loc_2c72). So on
 * this entry the flag ends at 0 (no claim) or 0x80 (claimed), never carrying an older value. It
 * returns nothing a caller consumes (the oracle threads residual registers/flags out; its callers
 * reload), so the contract is memory-only.
 *
 * The oracle's exits only READ the stack (a `ret` pop is never a memory write) and its free-slot
 * tail is a plain call into 0x2C72 (which pushes nothing), so nothing the whole subtree does writes
 * the stack. The candidate models no stack (plain JS return + a direct loc_2c4f call), so the
 * compared memory (dumpState is RAM) is identical to the oracle's with NO stack-scratch exclusion.
 *
 *   1. EQUAL — loc_2c86 == oracle on RAM (firstStateDiff over the whole dump) across:
 *        BONUS-SWEEP (exhaustive) — all 256 bonus values with a PRE-DIRTIED request flag and a
 *          fixed mark, so the gate is closed for every bonus but one (bonus == mark, all-occupied);
 *          isolates the up-front clear of 0x6382 + the 0x638F/0x6392 writes across the whole space.
 *        SLOT sweep (crafted) — the gate OPEN (mark == bonus) over every first-free-slot position
 *          (records 0..4) and the all-occupied case, with a pre-dirtied 0x6382, proving the flag is
 *          cleared to 0 and then re-raised to 0x80 only on a claim.
 *      Plus a non-vacuity block asserting the clear / stash / step / raise really happened.
 *
 *   2. TEETH — two deliberately-broken twins the same sweep MUST catch:
 *        (a) skip-clear — omits the 0x6382 clear; caught at 0x6382 on the pre-dirtied gate-closed
 *            sweep (oracle clears to 0, twin leaves the dirty value).
 *        (b) wrong mode byte — passes 0x02 not 0x03; caught at 0x638F (loc_2c4f always stashes it).
 *
 *   3. REALISM (captured dispatches) — hook 0x2C86 in a real attract run (reached through the
 *      cluster's `jp nz,0x2c86`), clone at each true dispatch, and confirm loc_2c86 reproduces the
 *      oracle's RAM on every real state the game actually produces (these span both gate arms).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2c86.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2c86 as oracle } from "../../translated/loc_2c86.js";
import { loc_2c86 } from "../loc_2c86.js";
import { loc_2c4f } from "../loc_2c4f.js";
import { BONUS_EVENT_MARK, OBJ_ARRAY_64 } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2c86;
const SCRATCH_REQ = 0x6382; // the slot-claim request flag — cleared here, top bit set by loc_2c72
const SCRATCH_MODE = 0x638f; // loc_2c4f stashes the mode byte here (this entry always passes 0x03)
const SCRATCH_FLAG = 0x6392; // loc_2c4f raises this to 1 on every entry
const MODE_BYTE = 0x03; // the mode byte this entry hands loc_2c4f
const STRIDE = 32; // OBJ_ARRAY_64 record stride
const RECORDS = 5;
const EVENT_STEP = 8;
const DIRTY = 0x55; // a non-zero request flag seeded in, to prove the up-front clear
// The oracle's `ret`s pop the stack; point SP at work RAM so those pops read valid bytes (never
// I/O). The oracle writes no RAM through the stack (only pops), so this never affects the compared
// memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const OCCUPIED = [1, 2, 3, 4, 5]; // all non-zero -> no free slot

/**
 * A synthetic entry: a clone of `base` with the bonus register live-in, the event mark, the five
 * OBJ_ARRAY_64 active bytes, and a pre-dirtied request flag / mode / entry scratch, plus a safe
 * stack. The mode-byte register is seeded with NOISE (loc_2c86 overwrites it internally, so it must
 * be ignored). Frame machinery is neutralised so the oracle's `m.step`/`m.ret` can't fire an NMI or
 * push a frame.
 */
function makeEntry(base, { c, mark, records = OCCUPIED, req = DIRTY, aNoise = 0xa5 }) {
  const e = base.clone();
  e.regs.a = aNoise; // must be ignored: this entry sets its own mode byte
  e.regs.c = c;
  e.mem.write8(BONUS_EVENT_MARK, mark);
  for (let i = 0; i < RECORDS; i++) e.mem.write8(OBJ_ARRAY_64 + i * STRIDE, records[i]);
  e.mem.write8(SCRATCH_REQ, req);
  e.mem.write8(SCRATCH_MODE, 0xee); // noise: prove loc_2c4f rewrites it
  e.mem.write8(SCRATCH_FLAG, 0xee); // noise: prove loc_2c4f rewrites it
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). The candidate reads its bonus live-in from
 * the same register the oracle does, so both are called with just the machine.
 */
function runPair(base, opts, candidate) {
  const a = makeEntry(base, opts); // oracle
  const b = makeEntry(base, opts); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// The gate-open slot scenarios: every first-free-slot position, plus all-occupied. Each is run at a
// few mark(=bonus)/req points, including a low mark whose −8 step wraps.
const SLOT_CASES = [
  { name: "slot@0", records: [0, 1, 1, 1, 1] },
  { name: "slot@1", records: [1, 0, 1, 1, 1] },
  { name: "slot@2", records: [1, 1, 0, 1, 1] },
  { name: "slot@3", records: [1, 1, 1, 0, 1] },
  { name: "slot@4", records: [1, 1, 1, 1, 0] },
  { name: "no-free", records: OCCUPIED },
];
const SLOT_POINTS = [
  { mark: 0x50, req: 0x00 },
  { mark: 0x08, req: 0x7f }, // req low bits are cleared, then the top bit is set on a claim
  { mark: 0x04, req: 0x55 }, // low mark: 0x04 − 8 wraps to 0xfc
  { mark: 0x40, req: 0x80 },
];

/**
 * Both regimes in one pass: the exhaustive gate-mostly-closed BONUS-sweep, then the crafted
 * gate-open slot cross-product. Returns the first mismatch (or null) + the number of comparisons.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // BONUS-SWEEP — pre-dirtied 0x6382, fixed mark 0x80: the gate is closed for every bonus except
  // 0x80 (all-occupied there), so this isolates the up-front clear + the two scratch writes.
  for (let c = 0; c < 256; c++) {
    const ram = runPair(base, { c, mark: 0x80, records: OCCUPIED, req: DIRTY }, candidate);
    count++;
    if (ram) return { mismatch: { where: `bonus-sweep c=${hx(c)}`, ram }, count };
  }

  // SLOT sweep — gate OPEN (mark == bonus): every first-free position × several mark/req points.
  for (const pt of SLOT_POINTS) {
    for (const sc of SLOT_CASES) {
      const opts = { c: pt.mark, mark: pt.mark, records: sc.records, req: pt.req };
      const ram = runPair(base, opts, candidate);
      count++;
      if (ram) return { mismatch: { where: `${sc.name} mark=${hx(pt.mark)} req=${hx(pt.req)}`, ram }, count };
    }
  }

  return { mismatch: null, count };
}

const describe = (mm) =>
  mm && `at ${mm.where}: RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: loc_2c86 == oracle across the bonus-sweep and every gate-open slot case", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_2c86);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 256 + SLOT_POINTS.length * SLOT_CASES.length, "must have compared the full sweep");

  // Non-vacuity: the writes really happened, on both sides.
  // (i) gate closed, request flag pre-dirtied -> flag cleared to 0, both scratch writes, mark kept.
  {
    const a = makeEntry(base, { c: 0x40, mark: 0x20, req: DIRTY });
    const b = makeEntry(base, { c: 0x40, mark: 0x20, req: DIRTY });
    oracle(a);
    loc_2c86(b);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(SCRATCH_REQ), 0x00, "request flag must be cleared to 0");
      assert.equal(mm.mem.read8(SCRATCH_MODE), MODE_BYTE, "mode byte 3 must be stashed");
      assert.equal(mm.mem.read8(SCRATCH_FLAG), 1, "entry flag must be raised");
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x20, "gate closed -> mark unchanged");
    }
  }
  // (ii) gate open, slot found -> flag cleared then top bit set; mark stepped by 8.
  {
    const a = makeEntry(base, { c: 0x08, mark: 0x08, records: [1, 0, 1, 1, 1], req: 0x7f });
    const b = makeEntry(base, { c: 0x08, mark: 0x08, records: [1, 0, 1, 1, 1], req: 0x7f });
    oracle(a);
    loc_2c86(b);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(SCRATCH_REQ), 0x80, "cleared then top bit set -> exactly 0x80 (dirty low bits gone)");
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x08 - EVENT_STEP, "mark must step down by 8");
    }
  }
  // (iii) gate open, all occupied -> mark stepped, request flag stays cleared (no claim).
  {
    const a = makeEntry(base, { c: 0x50, mark: 0x50, records: OCCUPIED, req: DIRTY });
    const b = makeEntry(base, { c: 0x50, mark: 0x50, records: OCCUPIED, req: DIRTY });
    oracle(a);
    loc_2c86(b);
    for (const mm of [a, b]) {
      assert.equal(mm.mem.read8(SCRATCH_REQ), 0x00, "no free slot -> flag stays cleared");
      assert.equal(mm.mem.read8(BONUS_EVENT_MARK), 0x50 - EVENT_STEP, "mark must step down by 8");
    }
  }
  console.log(`  EQUAL: ${count} combos (256 bonus-sweep + gate-open slot cross-product) — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** BUG (a): omits the up-front clear of 0x6382 — caught on the pre-dirtied gate-closed sweep. */
function brokenSkipClear(m) {
  // BUG: no `mem.write8(SCRATCH_REQ, 0)` here.
  loc_2c4f(m, MODE_BYTE, m.regs.c);
}

/** BUG (b): hands loc_2c4f the wrong mode byte (0x02) — caught at 0x638F, which it always stashes. */
function brokenWrongMode(m) {
  m.mem.write8(SCRATCH_REQ, 0);
  loc_2c4f(m, 0x02, m.regs.c); // BUG: 0x02, not 0x03
}

test("TEETH: the skip-clear twin is CAUGHT (0x6382 diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenSkipClear);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a skipped clear — worthless");
  assert.equal(mismatch.ram.addr, SCRATCH_REQ, "the skip-clear twin must diverge on 0x6382");
  console.log(`  TEETH/clear: caught — ${describe(mismatch)}`);
});

test("TEETH: the wrong-mode-byte twin is CAUGHT (0x638F diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongMode);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong mode byte — worthless");
  assert.equal(mismatch.ram.addr, SCRATCH_MODE, "the wrong-mode twin must diverge on 0x638F");
  console.log(`  TEETH/mode: caught — ${describe(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x2C86 in a real attract run and clone the machine at each real dispatch. It is reached
 * through the cluster's `jp nz,0x2c86`, so it fires only occasionally. The wrapper clones the entry
 * state, then runs the oracle so the host game proceeds undisturbed.
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

test("REALISM: real captured 0x2C86 dispatches — loc_2c86 matches oracle RAM", () => {
  const caps = captureDispatches(64, 4000);
  assert.ok(caps.length >= 1, "expected at least one real 0x2C86 dispatch during attract");

  let sawGateOpen = 0;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const bonusIn = hx(a.regs.c);
    if (a.regs.c === a.mem.read8(BONUS_EVENT_MARK)) sawGateOpen++;
    oracle(a);
    loc_2c86(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (bonus=${bonusIn}) ` +
          `at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x2C86 dispatches — RAM == oracle (${sawGateOpen} gate-open)`);
});

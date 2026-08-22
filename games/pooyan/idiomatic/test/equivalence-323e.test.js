// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence test for loc_323e (ROM 0x323e, Pooyan) — "scan 4 display-list slots".
 *
 * The cycle-free / memory-equivalence gate (docs/decompiler-pipeline): a fresh clone per side,
 * the oracle on one and loc_323e on the other, compared on RAM (dumpState, minus STACK_SCRATCH)
 * PLUS the declared register live-out B. pc/SP/cycles are deliberately not compared.
 *
 * INPUTS: IX (record base) and B (loop count; the real callers preset B=4). For each slot whose
 * tag byte (IX+1) is 0x8c the routine runs loc_324d on that slot; IX steps by 2 each iteration.
 *
 * LIVE-OUT B: the djnz loop counter, drained to 0 at exit; checked equal to the oracle and
 * asserted SET on the module's clone. IX is left advanced but no caller reads it back.
 *
 * loc_324d preserves B on every path exercised here (below-threshold skip, no-borrow drop, borrow
 * + paired dec, and the board-clear tail with TILE_CHECKSUM_LATCH pre-set so loc_3278 no-ops). The
 * board-clear FULL-scan path (BOARD_CLEAR_FLAG set AND the latch clear) is the ONE state where
 * loc_3278 sets B=4 and djnz-drains it, clobbering the caller's counter mid-scan; the oracle's
 * register-B loop would diverge from this local-counter loop there, so it is deliberately not
 * crafted (see the batch return notes) — the same state loc_324d's own gate also avoids.
 *
 * The leaf is not reached in a plain boot, so every case is CRAFTED (identical pokes on both sides).
 *
 * Jobs:
 *   1. EQUAL — over crafted 4-slot layouts (no match; match+skip; no-borrow; borrow; borrow+
 *      board-clear no-op), oracle == loc_323e in RAM (−stack) and B.
 *   2. WRITE-SET — a single borrow match writes only the counter cell and the paired byte.
 *   3. TEETH — a wrong counter byte (RAM) and a clobbered B (live-out) are each CAUGHT.
 *
 * Run: node --test games/pooyan/idiomatic/test/equivalence-323e.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_323e as oracle } from "../../translated/loc_323e.js";
import { loc_323e } from "../loc_323e.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/pooyan rom'" }, fn);

const REC = 0x8d90; // isolated 4-slot record region (bytes REC..REC+7)
const HUNTER_PAGE = 0x8c00;
const BOARD_CLEAR_FLAG = 0x89e5;
const TILE_CHECKSUM_LATCH = 0x8f55;
const COUNT = 0x04; // the callers' preset loop count

const counterAddr = (field0) => HUNTER_PAGE | ((field0 + 0x05) & 0xff);
const pairedAddr = (field0) => (counterAddr(field0) + 1) & 0xffff;
const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inDeadStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;
function ramDiffMinusStack(ma, mb) {
  return firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);
}

const BASE = ROM_PRESENT ? new Machine(ROM).clone() : null;

/** A fresh clone with IX=REC, B=4, the 4 slots and any counter/gate cells seated. */
function craft(pokes) {
  const m = BASE.clone();
  m.regs.ix = REC;
  m.regs.b = COUNT;
  m.regs.sp = 0x8ffe; // stack lives in STACK_SCRATCH; oracle call/ret only touch it there
  // default all 4 slots to a non-matching tag, field-0 zero
  for (let i = 0; i < 4; i++) {
    m.mem8[REC + 2 * i] = 0x00;
    m.mem8[REC + 2 * i + 1] = 0x00;
  }
  m.mem8[BOARD_CLEAR_FLAG] = 0x00;
  for (const [addr, val] of pokes) m.mem8[addr] = val & 0xff;
  return m;
}

// slot n's field-0 is REC+2n, its tag REC+2n+1. Tag 0x8c triggers loc_324d.
const CASES = [
  { name: "no match (all tags != 0x8c)", pokes: [] },
  { name: "match slot0, below threshold (skip)", pokes: [[REC + 0, 0x30], [REC + 1, 0x8c]] },
  {
    name: "match slot1, no borrow",
    pokes: [[REC + 2, 0x44], [REC + 3, 0x8c], [counterAddr(0x44), 0x50]],
  },
  {
    name: "match slot2, borrow (board-clear off)",
    pokes: [[REC + 4, 0x48], [REC + 5, 0x8c], [counterAddr(0x48), 0x10], [pairedAddr(0x48), 0x05]],
  },
  {
    name: "match slot3, borrow + board-clear tail (loc_3278 no-op)",
    pokes: [
      [REC + 6, 0x4c], [REC + 7, 0x8c], [counterAddr(0x4c), 0x10], [pairedAddr(0x4c), 0x05],
      [BOARD_CLEAR_FLAG, 0x01], [TILE_CHECKSUM_LATCH, 0x01],
    ],
  },
];

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: crafted 4-slot layouts — loc_323e == oracle in RAM (−stack) + IX/B", () => {
  for (const cse of CASES) {
    const o = craft(cse.pokes);
    oracle(o);
    const c = craft(cse.pokes);
    loc_323e(c);

    const d = ramDiffMinusStack(o, c);
    assert.equal(d, null, d && `[${cse.name}] RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} module=${d.b}`);
    assert.equal(c.regs.ix & 0xffff, o.regs.ix & 0xffff, `[${cse.name}] IX live-out mismatch (advanced cursor)`);
    assert.equal(c.regs.b, o.regs.b, `[${cse.name}] B live-out mismatch`);
    assert.equal(c.regs.ix & 0xffff, (REC + 2 * COUNT) & 0xffff, `[${cse.name}] IX must advance base + 2*count`);
    assert.equal(c.regs.b, 0x00, `[${cse.name}] the djnz counter must drain to 0`);
  }
  console.log(`  EQUAL: ${CASES.length} crafted layouts identical (RAM −stack + IX/B)`);
});

// -- 2. WRITE-SET -------------------------------------------------------------

test("WRITE-SET: a single borrow match writes only the counter cell and paired byte", () => {
  const field0 = 0x48;
  const footprint = new Set([counterAddr(field0), pairedAddr(field0)]);
  const pokes = [[REC + 4, field0], [REC + 5, 0x8c], [counterAddr(field0), 0x10], [pairedAddr(field0), 0x05]];

  const before = craft(pokes);
  const after = craft(pokes);
  const b = before.dumpState();
  oracle(after);
  const a = after.dumpState();

  const changed = [];
  for (let off = 0; off < b.length; off++) {
    const ad = after.stateOffsetToAddr(off);
    if (b[off] !== a[off] && !inDeadStack(ad)) changed.push(ad); // -stack: oracle call trampolines push there
  }
  assert.equal(changed.length, 2, `expected 2 writes, got ${changed.length}`);
  for (const addr of changed) assert.ok(footprint.has(addr), `unexpected write at ${hx(addr)}`);
  assert.equal(after.mem8[counterAddr(field0)], (0x10 - 0x40) & 0xff, "counter dropped by 0x40 (borrow)");
  assert.equal(after.mem8[pairedAddr(field0)], 0x04, "paired byte decremented (0x05 -> 0x04)");
  console.log(`  WRITE-SET: ${hx(counterAddr(field0))} + ${hx(pairedAddr(field0))} (2 cells)`);
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: a wrong counter byte is CAUGHT by the RAM diff", () => {
  const field0 = 0x44;
  const pokes = [[REC + 2, field0], [REC + 3, 0x8c], [counterAddr(field0), 0x50]];
  const o = craft(pokes);
  const c = craft(pokes);
  oracle(o);
  loc_323e(c);
  c.mem8[counterAddr(field0)] = 0x00; // BUG: counter must be 0x50 - 0x40 = 0x10

  const d = ramDiffMinusStack(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch a wrong counter byte — it is worthless");
  assert.equal(d.addr, counterAddr(field0), `teeth caught wrong address ${hx(d.addr ?? 0)}`);
  console.log(`  TEETH/RAM: wrong counter caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

test("TEETH: a clobbered B and an under-advanced IX are CAUGHT by the live-out checks", () => {
  const o = craft([]);
  const c = craft([]);
  oracle(o);
  loc_323e(c);
  // BUG twin 1: the drained loop counter must match the oracle (0)
  const brokenB = (o.regs.b + 1) & 0xff;
  assert.notEqual(brokenB, o.regs.b, "the B live-out check must reject a clobbered counter");
  // BUG twin 2: an IX left un-advanced (still at REC) must be rejected
  assert.notEqual(REC & 0xffff, o.regs.ix & 0xffff, "the IX live-out check must reject an un-advanced cursor");
  console.log(`  TEETH: clobbered B ${hx(brokenB)} and un-advanced IX ${hx(REC)} rejected (oracle B=${hx(o.regs.b)} IX=${hx(o.regs.ix)})`);
});

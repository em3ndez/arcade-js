// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_52f6 (ROM 0x52f6, Pooyan) -- the gated slot-sweep + ROM checksum
 * tripwire. Gated on guard (0x8d6d) set and latch (0x8d6e) clear; counts empty {word==0} slots in the
 * 6-entry stride-0x17 table at 0x8ae0; bails (ret c) if fewer than 4 free, else latches the count and
 * runs a 23-byte rolling checksum (0x0bf3 downward) via the rst 0x20 helper (loc_0020: HL += A, A=(HL)).
 * A checksum whose low byte != 0x15 or high byte != 0x09 bumps 0x89e8.
 *
 * The mock's `call` POPS the return the rst pushed (modelling loc_0020's `ret`), then models loc_0020's
 * net effect (HL += A; A = (HL)). Because it pops, a rst site missing its push16 desyncs the stack and
 * fails the final ret assertion -- a real stack-fidelity tooth.
 *
 * Paths: GUARD-CLEAR (ret z), LATCHED (ret nz), FEW-FREE (mixed slots -> ret c, exercises both jr-nz
 * slot outcomes + djnz), MATCH (all-free, checksum == 0x0915 -> ret z, no bump), MISMATCH-L (checksum
 * low byte wrong -> jr nz taken -> bump), MISMATCH-H (low ok, high wrong -> ret z not taken -> bump).
 * TEETH: mis-charge `add a,l` (4T) as 7T -> the 1331-T MATCH golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_52f6.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_52f6 } from "../loc_52f6.js";

const CALLER_RET = 0xabcd;
const PRE_SEAT = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x52f6, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The rst 0x20 handler (loc_0020) pops the return the rst pushed, then does HL += A (16-bit), A=(HL).
    // Model both so the stack balances and the running checksum in HL advances (a missing push16 desyncs).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) {
        regs.hl = (regs.hl + regs.a) & 0xffff;
        regs.a = mem.read8(regs.hl);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = PRE_SEAT;
  m.push16(CALLER_RET);
}

// Fill the 23 checksum bytes at 0x0bf3 downward so they sum to `target` (HL accumulates that sum).
function setChecksumSum(m, target) {
  let rem = target;
  for (let i = 0; i < 23; i++) {
    const b = Math.min(255, rem);
    m.mem.write8((0x0bf3 - i) & 0xffff, b);
    rem -= b;
  }
  assert.equal(rem, 0, "target must fit in 23 bytes");
}

// Slot leading-word first-byte addresses in ROM-derived order (inc l then add hl,de(0x17)).
const SLOT_BYTE = [0x8ae0, 0x8af8, 0x8b10, 0x8b28, 0x8b40, 0x8b58];

// ── expected-pcSeq builders, derived from the ROM instruction stream (not the JS) ──
const PRO = [0x52f9, 0x52fa, 0x52fb, 0x52fe, 0x52ff, 0x5300, 0x5303, 0x5306, 0x5309];

function slotSeq(freeFlags) {
  const out = [];
  const n = freeFlags.length;
  for (let i = 0; i < n; i++) {
    out.push(0x530a, 0x530b, 0x530c);
    if (freeFlags[i]) out.push(0x530e, 0x530f); else out.push(0x530f);
    out.push(0x5310);
    out.push(i === n - 1 ? 0x5312 : 0x5309);
  }
  return out;
}

const MID = [0x5313, 0x5315, 0x5316, 0x5319, 0x531c, 0x531e, 0x531f, 0x5320, 0x5321];

function checkSeq(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(0x5322, 0x0020, 0x5324);
    out.push(i === n - 1 ? 0x5326 : 0x5321);
  }
  return out;
}

test("loc_52f6 GUARD-CLEAR: 0x8d6d == 0 -> ret z immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x00);

  loc_52f6(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ld a + and a + ret z");
  assert.deepEqual(m.pcSeq, [0x52f9, 0x52fa, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, PRE_SEAT, "no push -- baseline intact");
});

test("loc_52f6 LATCHED: 0x8d6e != 0 -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x01); // guard set
  m.mem.write8(0x8d6e, 0x01); // already latched

  loc_52f6(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 13 + 4 + 11, "ret z not taken -> ld a + and a + ret nz");
  assert.deepEqual(m.pcSeq, [0x52f9, 0x52fa, 0x52fb, 0x52fe, 0x52ff, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, PRE_SEAT);
});

test("loc_52f6 FEW-FREE: mixed slots (2 free < 4) -> ret c, exercises both slot branches", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x01);
  // slots 0,2,4,5 in use (first byte nonzero); slots 1,3 free -> C = 2
  const free = [false, true, false, true, false, false];
  free.forEach((f, i) => { if (!f) m.mem.write8(SLOT_BYTE[i], 0x01); });

  loc_52f6(m);

  const slotT = 54 + 53 + 54 + 53 + 54 + 49; // inuse/free continues + final inuse(last)
  assert.equal(m.tstates, 74 + slotT + (4 + 7 + 11), "prologue + slot loop + ld a,c/cp/ret c");
  assert.deepEqual(m.pcSeq, [...PRO, ...slotSeq(free), 0x5313, 0x5315, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [], "ret c before the checksum loop");
  assert.equal(m.mem.read8(0x8d6e), 0x00, "latch not written on the ret-c path");
  assert.equal(m.regs.sp, PRE_SEAT);
});

test("loc_52f6 MATCH: 6 free, checksum == 0x0915 -> ret z, no tamper bump", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x01);          // guard set, latch clear, all 6 slots free
  setChecksumSum(m, 0x0915);            // L=0x15, H=0x09 -> both checks pass

  loc_52f6(m);

  const slotT = 5 * 53 + 48;            // 5 free-continue + free-last
  const checkT = 22 * 37 + 32;          // 22 continue + last
  const postT = 7 + 4 + 7 + 4 + 7 + 11; // ld a,0xeb + add a,l + jr nz nt + ld a,h + add + ret z
  assert.equal(m.tstates, 74 + slotT + 58 + checkT + postT, "MATCH golden");
  assert.equal(m.tstates, 1331, "MATCH golden literal");
  assert.deepEqual(m.pcSeq, [
    ...PRO, ...slotSeq([true, true, true, true, true, true]), ...MID, ...checkSeq(23),
    0x5328, 0x5329, 0x532b, 0x532c, 0x532e, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8d6e), 0x06, "latch = free count (6)");
  assert.deepEqual(m.calls, Array(23).fill(0x0020), "23 rst-0x20 helper calls");
  assert.equal(m.mem.read8(0x89e8), 0x00, "checksum matched -> no bump");
  // Every rst push16 matched a helper ret pop, and the final ret popped CALLER_RET.
  assert.equal(m.regs.sp, PRE_SEAT, "stack fully unwound to the pre-seat baseline");
});

test("loc_52f6 MISMATCH-L: checksum low byte wrong -> jr nz taken -> bump 0x89e8", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x01);
  setChecksumSum(m, 0x0910);            // L=0x10 != 0x15 -> jr nz taken

  loc_52f6(m);

  const slotT = 5 * 53 + 48;
  const checkT = 22 * 37 + 32;
  const postT = 7 + 4 + 12 + 10 + 11 + 10; // ld a,0xeb + add a,l + jr nz taken + ld hl + inc(hl) + ret
  assert.equal(m.tstates, 74 + slotT + 58 + checkT + postT, "MISMATCH-L golden");
  assert.deepEqual(m.pcSeq, [
    ...PRO, ...slotSeq([true, true, true, true, true, true]), ...MID, ...checkSeq(23),
    0x5328, 0x5329, 0x532f, 0x5332, 0x5333, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x89e8), 0x01, "tamper cell bumped");
  assert.equal(m.regs.sp, PRE_SEAT);
});

test("loc_52f6 MISMATCH-H: low byte ok, high byte wrong -> ret z not taken -> bump 0x89e8", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x01);
  setChecksumSum(m, 0x0815);            // L=0x15 (jr nz not taken), H=0x08 != 0x09 (ret z not taken)

  loc_52f6(m);

  const slotT = 5 * 53 + 48;
  const checkT = 22 * 37 + 32;
  const postT = 7 + 4 + 7 + 4 + 7 + 5 + 10 + 11 + 10; // ... ret z not taken + ld hl + inc(hl) + ret
  assert.equal(m.tstates, 74 + slotT + 58 + checkT + postT, "MISMATCH-H golden");
  assert.deepEqual(m.pcSeq, [
    ...PRO, ...slotSeq([true, true, true, true, true, true]), ...MID, ...checkSeq(23),
    0x5328, 0x5329, 0x532b, 0x532c, 0x532e, 0x532f, 0x5332, 0x5333, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x89e8), 0x01, "tamper cell bumped");
  assert.equal(m.regs.sp, PRE_SEAT);
});

test("loc_52f6 MUTATION: `add a,l` mis-charged 7T (not 4T) is caught by the MATCH golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5329 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x01);
  setChecksumSum(m, 0x0915);

  loc_52f6(m);

  assert.equal(m.tstates, 1334, "mutation adds 3 T (4 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 1331, "MATCH golden"),
    /1331/,
    "the 1331-T golden must fail on the mutant",
  );
});

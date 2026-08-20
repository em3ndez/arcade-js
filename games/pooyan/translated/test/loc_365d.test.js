// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_365d (ROM 0x365d, Pooyan) -- the pre-spawn gate. When (ix+0x0b)
 * bit0 is set it counts 6 stride-0x18 records (base 0x8ae2) whose first byte == 3 into C; a count
 * != 1 rets (dec c -> ret nz). Otherwise, or when the bit is clear, it seats the IY scan window
 * (0x8b70, stride 0x18, B=5) and falls through into loc_3680. The 0x366c djnz body is inlined.
 *
 * loc_365d has no push16 of its own; its only stack effects are m.ret and the tail delegate to
 * loc_3680 (fall-through, no push). The mock's `call` still POPS so the tail delegate unwinds the
 * seated caller -- the SP tooth. Because there is no push16 to delete, the positive control is a
 * T-state mutation (the MUTATION test) rather than a push deletion.
 *
 * Paths: SKIP (bit clear -> straight to the IY seat + fall through), ONE (bit set, exactly one
 * record == 3 -> count 1 -> fall through), MANY (bit set, no record == 3 -> count 0 -> ret nz).
 * TEETH: mis-charge the DDCB `bit` (20->8) and assert the golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_365d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_365d } from "../loc_365d.js";

const CALLER_RET = 0xabcd;
const IX = 0x8c00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x365d, pcSeq: [],
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
    // The tail delegate to loc_3680 reuses the frame; its callee `ret` pops the seated caller, so
    // the mock's `call` pops and records (a stray push here would leave SP off baseline).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_365d Path SKIP: (ix+0x0b) bit0 clear -> seat IY window + fall through to loc_3680", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x0b, 0x00); // bit0 clear -> jr z taken

  loc_365d(m);

  assert.equal(m.tstates, 63, "T = bit + jr z taken + ld iy + ld de + ld b");
  assert.deepEqual(m.pcSeq, [0x3661, 0x3677, 0x367b, 0x367e, 0x3680]);
  assert.equal(m.pc, 0x3680, "falls through into loc_3680");
  assert.deepEqual(m.calls, [0x3680]);
  assert.equal(m.regs.iy, 0x8b70, "IY scan window seated");
  assert.equal(m.regs.b, 0x05, "B = 5 scan slots");
  assert.equal(m.regs.sp, 0x8780, "tail delegate unwinds the seated caller");
});

test("loc_365d Path ONE: bit set, exactly one record == 3 -> count 1 -> fall through", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x0b, 0x01); // bit0 set -> run the count scan
  m.mem.write8(0x8ae2, 0x03);    // record 0 == 3 (the only match)
  // records 1..5 (stride 0x18) left 0 -> not counted

  loc_365d(m);

  assert.equal(m.tstates, 392, "Path ONE T-state total");
  assert.deepEqual(m.pcSeq, [
    0x3661, 0x3663, 0x3666, 0x3669, 0x366a, 0x366c,
    0x366d, 0x366f, 0x3671, 0x3672, 0x3673, 0x366c, // iter1: match -> inc c
    0x366d, 0x366f, 0x3672, 0x3673, 0x366c,         // iter2
    0x366d, 0x366f, 0x3672, 0x3673, 0x366c,         // iter3
    0x366d, 0x366f, 0x3672, 0x3673, 0x366c,         // iter4
    0x366d, 0x366f, 0x3672, 0x3673, 0x366c,         // iter5
    0x366d, 0x366f, 0x3672, 0x3673, 0x3675,         // iter6: djnz falls out
    0x3676, 0x3677, 0x367b, 0x367e, 0x3680,
  ]);
  assert.equal(m.pc, 0x3680, "count == 1 -> falls through into loc_3680");
  assert.deepEqual(m.calls, [0x3680]);
  assert.equal(m.regs.c, 0x00, "C = 1 counted, then dec c -> 0");
  assert.equal(m.regs.b, 0x05, "B reloaded to 5 for the IY scan");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_365d Path MANY: bit set, no record == 3 -> count 0 -> dec c wraps -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x0b, 0x01); // bit0 set -> run the count scan
  // all 6 records left 0 -> none == 3 -> C stays 0

  loc_365d(m);

  assert.equal(m.tstates, 368, "Path MANY T-state total");
  assert.deepEqual(m.pcSeq, [
    0x3661, 0x3663, 0x3666, 0x3669, 0x366a, 0x366c,
    0x366d, 0x366f, 0x3672, 0x3673, 0x366c, // iter1 (no match)
    0x366d, 0x366f, 0x3672, 0x3673, 0x366c, // iter2
    0x366d, 0x366f, 0x3672, 0x3673, 0x366c, // iter3
    0x366d, 0x366f, 0x3672, 0x3673, 0x366c, // iter4
    0x366d, 0x366f, 0x3672, 0x3673, 0x366c, // iter5
    0x366d, 0x366f, 0x3672, 0x3673, 0x3675, // iter6
    0x3676, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret nz at 0x3676 to the seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.c, 0xff, "C = 0 counted, then dec c -> 0xff (non-zero -> ret nz)");
  assert.equal(m.regs.sp, 0x8780, "ret unwinds the seated caller");
});

test("loc_365d MUTATION: DDCB `bit` mis-charged 8T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x3661 ? 8 : cycles);
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x0b, 0x00);

  loc_365d(m);

  assert.equal(m.tstates, 51, "mutation loses 12 T (20 -> 8)");
  assert.throws(() => assert.equal(m.tstates, 63), /63/, "the 63-T golden must fail on the mutant");
});

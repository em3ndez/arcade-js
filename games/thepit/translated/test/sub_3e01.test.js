// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_3e01 (ROM 0x3E01-0x3E12): the column fill that loads a
// base pointer INDIRECTLY from (0x805e), reads a row count from (0x8055) and a
// tile from (0x8057), then writes that tile down B rows at stride 0x20.
//
// Asserts the T-state total (61 + 31*B), the exact set of memory writes (which
// proves the stride AND the loop count are right), the register/flag residue
// (HL advanced B*0x20, B counted to 0, carry from the final add hl,de), and the
// ret landing back at the caller. Ends with a MUTATION (the `add hl,de` stride
// advance dropped) proven to be caught by both the memory and the T-state teeth.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_3e01 } from "../sub_3e01.js";

const RET = 0x1234; // sentinel return address pushed before the call

// Minimal machine: real Regs + real Pit AddressSpace + the step/ret/push16/pop16
// seam sub_3e01 drives (no m.call in this routine).
function makeMachine(presets = {}) {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)

  const m = {
    regs,
    mem,
    tstates: 0,
    pc: 0x3e01,
    returned: false,
    step(addr, cycles) {
      this.pc = addr;
      this.tstates += cycles;
    },
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
    ret(cycles = 10) {
      this.pc = this.pop16();
      this.tstates += cycles;
      this.returned = true;
    },
    call(addr) {
      throw new Error(`unexpected m.call(0x${addr.toString(16).padStart(4, "0")})`);
    },
  };

  for (const [addr, val] of Object.entries(presets)) {
    mem.write8(Number(addr), val);
  }
  m.push16(RET); // the return address sub_3e01's `ret` must pop
  return m;
}

// Base pointer 0x9040 (video RAM, writable), lo/hi at 0x805e/0x805f; count 4 at
// 0x8055; fill 0x2a at 0x8057. The four rows land at 0x9040 + k*0x20.
const FILL = { 0x805e: 0x40, 0x805f: 0x90, 0x8055: 4, 0x8057: 0x2a };
const ROWS = [0x9040, 0x9060, 0x9080, 0x90a0];

// The canonical column-fill facts, shared by the real routine and the mutant so
// the mutation is measured against exactly the assertions the routine must pass.
function assertColumnFill(fn) {
  const m = makeMachine({ ...FILL });
  fn(m);
  for (let k = 0; k < ROWS.length; k++) {
    assert.equal(m.mem.read8(ROWS[k]), 0x2a, `row ${k} at 0x${ROWS[k].toString(16)} filled`);
  }
  // 61 + 31*B for B = 4  (head 56 + loop 31*4-5 + ret 10)
  assert.equal(m.tstates, 61 + 31 * 4, "B=4 column fill costs 61 + 31*4 = 185 T");
}

test("fills a 4-row column at stride 0x20, then returns", () => {
  const m = makeMachine({ ...FILL });
  sub_3e01(m);

  // exactly four rows written -- and NOT a fifth (proves the djnz count is exact)
  for (let k = 0; k < ROWS.length; k++) {
    assert.equal(m.mem.read8(ROWS[k]), 0x2a, `row ${k} at 0x${ROWS[k].toString(16)} filled`);
  }
  assert.equal(m.mem.read8(0x90c0), 0x00, "the 5th row is NOT written (loop count exact)");

  assert.equal(m.regs.hl, 0x90c0, "HL advanced base + 4*0x20");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.a, 0x2a, "A holds the fill byte at exit");
  assert.equal(m.regs.de, 0x0020, "DE holds the stride at exit");
  // final add hl,de (0x90a0 + 0x20 = 0x90c0) does not overflow 16 bits -> C clear
  assert.equal(m.regs.fC, false, "no carry out of the final add hl,de");
  // control flow: the ret popped the caller's address
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);
});

test("B=1 writes a single cell and the djnz falls straight through", () => {
  const m = makeMachine({ 0x805e: 0x00, 0x805f: 0x91, 0x8055: 1, 0x8057: 0x55 });
  sub_3e01(m);

  assert.equal(m.mem.read8(0x9100), 0x55, "the one cell is written");
  assert.equal(m.mem.read8(0x9120), 0x00, "the next row is NOT written");
  assert.equal(m.regs.hl, 0x9120, "HL advanced by exactly one stride");
  assert.equal(m.regs.b, 0x00);
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);
  // 61 + 31*1
  assert.equal(m.tstates, 92, "B=1 costs 61 + 31 = 92 T");
});

test("the base pointer is loaded INDIRECTLY from (0x805e), not as an immediate", () => {
  // word at 0x805e = 0x88c0 -> writes must land at colour RAM, proving ld hl,(nn)
  const m = makeMachine({ 0x805e: 0xc0, 0x805f: 0x88, 0x8055: 2, 0x8057: 0x07 });
  sub_3e01(m);
  assert.equal(m.mem.read8(0x88c0), 0x07, "row 0 at the indirect base");
  assert.equal(m.mem.read8(0x88e0), 0x07, "row 1 at base + stride");
  assert.equal(m.regs.hl, 0x8900);
  assert.equal(m.tstates, 61 + 31 * 2);
});

// ---- MUTATION: the `add hl,de` stride advance (and its 11 T) dropped ---------
// Faithful copy of sub_3e01 with the row-advance removed: every write lands on
// the same HL, so rows 1..3 stay 0 and the total loses 4*11 = 44 T. Both the
// memory teeth (row 1 must be 0x2a) and the T-state teeth (must be 185) reject it.
function sub_3e01_mut(m) {
  const { regs, mem } = m;
  regs.hl = mem.read16(0x805e); m.step(0x3e04, 16);
  regs.de = 0x0020; m.step(0x3e07, 10);
  regs.a = mem.read8(0x8055); m.step(0x3e0a, 13);
  regs.b = regs.a; m.step(0x3e0b, 4);
  regs.a = mem.read8(0x8057); m.step(0x3e0e, 13);
  do {
    mem.write8(regs.hl, regs.a); m.step(0x3e0f, 7);
    // BUG: `add hl,de` (regs.addHl) and its 11 T-states omitted -> HL never advances.
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3e0e : 0x3e12, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  m.ret();
}

test("the assertions have teeth: the dropped-stride mutation is caught", () => {
  assertColumnFill(sub_3e01); // the real routine passes it
  assert.throws(
    () => assertColumnFill(sub_3e01_mut),
    /row 1 .* filled|185 T/,
    "mutant must fail the memory or T-state assertion",
  );
});

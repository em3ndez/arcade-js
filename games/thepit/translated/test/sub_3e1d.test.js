// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_3e1d (ROM 0x3E1D-0x3E31): the colour-RAM column fill that
// takes the column offset in A and the fill byte in C, forms a base pointer
// 0x8840 + A, caches C at 0x8057, then writes C down a FIXED 0x1C (28) rows at
// stride 0x20.
//
// Asserts the T-state total (71 + 31*0x1C = 939), the exact set of memory writes
// (which proves the base = 0x8840 + A, the stride 0x20, AND the fixed 28-row
// count), the 0x8057 cache write, the register/flag residue (DE reloaded to the
// stride 0x0020 — so E does NOT survive as A — HL advanced base + 0x1C*0x20, B=0,
// carry from the final add hl,de), and the ret landing back at the caller. Ends
// with a MUTATION (the loop `add hl,de` stride advance dropped) proven caught by
// both the memory and the T-state teeth.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_3e1d } from "../sub_3e1d.js";

const RET = 0x1234; // sentinel return address pushed before the call

// Minimal machine: real Regs + real Pit AddressSpace + the step/ret/push16/pop16
// seam sub_3e1d drives (no m.call in this routine).
function makeMachine({ a = 0x00, c = 0x00 } = {}) {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)
  regs.a = a; // column offset
  regs.c = c; // fill byte

  const m = {
    regs,
    mem,
    tstates: 0,
    pc: 0x3e1d,
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

  m.push16(RET); // the return address sub_3e1d's `ret` must pop
  return m;
}

const OFFSET = 0x04; // column offset in A
const FILL = 0x2a; // fill byte in C
const BASE = 0x8840 + OFFSET; // 0x8844 -- colour RAM, all 28 rows stay in 0x8800-0x8BFF
const ROWS = Array.from({ length: 0x1c }, (_, k) => BASE + k * 0x20); // 28 rows
const HL_END = BASE + 0x1c * 0x20; // 0x8bc4 -- one stride past the last write

// The canonical column-fill facts, shared by the real routine and the mutant so
// the mutation is measured against exactly the assertions the routine must pass.
function assertColumnFill(fn) {
  const m = makeMachine({ a: OFFSET, c: FILL });
  fn(m);
  for (let k = 0; k < ROWS.length; k++) {
    assert.equal(m.mem.read8(ROWS[k]), FILL, `row ${k} at 0x${ROWS[k].toString(16)} filled`);
  }
  // 71 + 31*B for B = 0x1c: head 66 + loop 31*28-5 + ret 10 = 939.
  assert.equal(m.tstates, 71 + 31 * 0x1c, "0x1C-row column fill costs 71 + 31*28 = 939 T");
}

test("fills 28 rows at 0x8840+A, stride 0x20, caches the fill byte, then returns", () => {
  const m = makeMachine({ a: OFFSET, c: FILL });
  sub_3e1d(m);

  // exactly 28 rows written -- and NOT a 29th (proves base + stride + fixed count)
  for (let k = 0; k < ROWS.length; k++) {
    assert.equal(m.mem.read8(ROWS[k]), FILL, `row ${k} at 0x${ROWS[k].toString(16)} filled`);
  }
  assert.equal(m.mem.read8(HL_END), 0x00, "the 29th row is NOT written (loop count fixed at 28)");
  // the ld (0x8057),a cache write
  assert.equal(m.mem.read8(0x8057), FILL, "fill byte cached at 0x8057");

  assert.equal(m.regs.hl, HL_END, "HL advanced base + 0x1C*0x20 = 0x8bc4");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.a, FILL, "A holds the fill byte (from ld a,c) at exit");
  assert.equal(m.regs.c, FILL, "C is unchanged");
  // E carried A only transiently (ld e,a) -- `ld de,0x0020` overwrites it, so at
  // exit DE is the stride 0x0020 (E=0x20, D=0x00), NOT the original offset.
  assert.equal(m.regs.de, 0x0020, "DE holds the stride at exit");
  assert.equal(m.regs.e, 0x20, "E was clobbered to the stride low byte");
  assert.equal(m.regs.d, 0x00, "D = stride high byte");
  // final add hl,de (0x8ba4 + 0x20 = 0x8bc4) does not overflow 16 bits -> C clear
  assert.equal(m.regs.fC, false, "no carry out of the final add hl,de");
  // control flow: the ret popped the caller's address
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);
});

test("the base pointer tracks A: offset 0x00 fills the column at 0x8840", () => {
  const m = makeMachine({ a: 0x00, c: 0x07 });
  sub_3e1d(m);
  assert.equal(m.mem.read8(0x8840), 0x07, "row 0 at the un-offset base");
  assert.equal(m.mem.read8(0x8860), 0x07, "row 1 at base + stride");
  assert.equal(m.mem.read8(0x8840 + 0x1c * 0x20), 0x00, "29th row NOT written");
  assert.equal(m.regs.hl, 0x8840 + 0x1c * 0x20, "HL = 0x8bc0");
  assert.equal(m.regs.de, 0x0020, "DE = stride regardless of offset");
  assert.equal(m.tstates, 71 + 31 * 0x1c);
});

// ---- MUTATION: the loop `add hl,de` stride advance (and its 11 T) dropped -----
// Faithful copy of sub_3e1d with the row-advance removed: every write lands on
// the same HL (the base), so rows 1..27 stay 0 and the total loses 28*11 = 308 T.
// Both the memory teeth (row 1 must be filled) and the T-state teeth (must be 939)
// reject it.
function sub_3e1d_mut(m) {
  const { regs, mem } = m;
  regs.e = regs.a; m.step(0x3e1e, 4);
  regs.d = 0x00; m.step(0x3e20, 7);
  regs.hl = 0x8840; m.step(0x3e23, 10);
  regs.addHl(regs.de); m.step(0x3e24, 11);
  regs.a = regs.c; m.step(0x3e25, 4);
  mem.write8(0x8057, regs.a); m.step(0x3e28, 13);
  regs.de = 0x0020; m.step(0x3e2b, 10);
  regs.b = 0x1c; m.step(0x3e2d, 7);
  do {
    mem.write8(regs.hl, regs.a); m.step(0x3e2e, 7);
    // BUG: `add hl,de` (regs.addHl) and its 11 T-states omitted -> HL never advances.
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3e2d : 0x3e31, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  m.ret();
}

test("the assertions have teeth: the dropped-stride mutation is caught", () => {
  assertColumnFill(sub_3e1d); // the real routine passes it
  assert.throws(
    () => assertColumnFill(sub_3e1d_mut),
    /row 1 .* filled|939 T/,
    "mutant must fail the memory or T-state assertion",
  );
});

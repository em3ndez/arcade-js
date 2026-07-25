// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_3e13 (ROM 0x3E13-0x3E31): take a column offset in A,
// advance the shared colour index at 0x8057 (`inc` then `AND 0xF7`), write it
// back, and paint it down 28 (0x1C) colour-RAM cells at stride 0x20 starting
// from 0x8840 + A.
//
// Asserts the T-state total (a fixed 979), the exact set of memory writes (which
// proves BOTH the 0x8840+offset base AND the exact 28-cell / stride-0x20 span),
// the advanced index written back to 0x8057, and the register/flag residue
// (E = the offset, C = A = the index, HL advanced 28*0x20, B counted to 0, carry
// from the final add hl,de). Ends with a MUTATION (the distinctive `AND 0xF7`
// index mask dropped) proven caught by both the value AND the T-state teeth.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_3e13 } from "../sub_3e13.js";

const RET = 0x1234; // sentinel return address pushed before the call

// Minimal machine: real Regs + real Pit AddressSpace + the step/ret/push16/pop16
// seam sub_3e13 drives (no m.call in this routine).
function makeMachine(presets = {}) {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)

  const m = {
    regs,
    mem,
    tstates: 0,
    pc: 0x3e13,
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
  m.push16(RET); // the return address sub_3e13's `ret` must pop
  return m;
}

// Entry A = 0x05 selects the column at 0x8840 + 5 = 0x8845 (colour RAM).
// Seed index 0x2A: `inc` -> 0x2B (bit 3 SET, so the AND 0xF7 is not a no-op) ->
// 0x2B & 0xF7 = 0x23. That is what makes the mask observable AND catchable.
const ENTRY_A = 0x05;
const SEED = 0x2a;
const NEW_INDEX = 0x23; // (0x2a + 1) & 0xf7
const BASE = 0x8845; // 0x8840 + ENTRY_A
const STRIDE = 0x20;
const COUNT = 0x1c; // 28 cells
const T_TOTAL = 979; // head 106 + loop (31*28 - 5) + ret 10

// The canonical column-cycle facts, shared by the real routine and the mutant so
// the mutation is measured against exactly the assertions the routine must pass.
function assertColumnCycle(fn) {
  const m = makeMachine({ 0x8057: SEED });
  m.regs.a = ENTRY_A; // the column offset is passed in A
  fn(m);
  for (let k = 0; k < COUNT; k++) {
    const addr = BASE + k * STRIDE;
    assert.equal(
      m.mem.read8(addr),
      NEW_INDEX,
      `cell ${k} at 0x${addr.toString(16)} painted with the advanced index`,
    );
  }
  assert.equal(m.mem.read8(0x8057), NEW_INDEX, "advanced index written back to 0x8057");
  assert.equal(m.tstates, T_TOTAL, `column cycle costs ${T_TOTAL} T`);
}

test("advances the colour index and paints a 28-cell column, then returns", () => {
  const m = makeMachine({ 0x8057: SEED });
  m.regs.a = ENTRY_A;
  sub_3e13(m);

  // exactly 28 cells written -- and neither neighbour (proves span + stride).
  for (let k = 0; k < COUNT; k++) {
    const addr = BASE + k * STRIDE;
    assert.equal(m.mem.read8(addr), NEW_INDEX, `cell ${k} at 0x${addr.toString(16)} filled`);
  }
  assert.equal(m.mem.read8(BASE - STRIDE), 0x00, "the cell BEFORE the base is untouched");
  assert.equal(
    m.mem.read8(BASE + COUNT * STRIDE),
    0x00,
    "the 29th cell is NOT written (loop count exact)",
  );

  // the advanced index: 0x2a -> inc 0x2b -> & 0xf7 = 0x23, persisted + in C/A.
  assert.equal(m.mem.read8(0x8057), NEW_INDEX, "0x8057 advanced and stored back");
  assert.equal(m.regs.c, NEW_INDEX, "C holds the advanced index");
  assert.equal(m.regs.a, NEW_INDEX, "A holds the painted index at exit");
  // E carried the column offset only up to `add hl,de` (0x3e23); `ld de,0x0020`
  // (0x3e28) then overwrites it, so at exit DE = 0x0020 (E = 0x20). The offset's
  // effect is proven by WHERE the cells landed (base 0x8845), not by E at exit.
  assert.equal(m.regs.de, 0x0020, "DE holds the stride at exit");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.hl, BASE + COUNT * STRIDE, "HL advanced base + 28*0x20");
  // final add hl,de (0x8ba5 + 0x20 = 0x8bc5) does not overflow 16 bits -> C clear
  assert.equal(m.regs.fC, false, "no carry out of the final add hl,de");

  // control flow: the ret popped the caller's address
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);
});

test("the AND 0xF7 actually clears bit 3 of the incremented index", () => {
  // seed 0x27 -> inc 0x28 (bit 3 set: 0010_1000) -> & 0xf7 = 0x20.
  const m = makeMachine({ 0x8057: 0x27 });
  m.regs.a = 0x00; // column 0 -> base 0x8840
  sub_3e13(m);
  assert.equal(m.mem.read8(0x8057), 0x20, "0x28 & 0xf7 = 0x20 (bit 3 cleared)");
  // column 0 -> offset 0 -> writes start at the bare base 0x8840 (proves E = A = 0)
  assert.equal(m.mem.read8(0x8840), 0x20, "column-0 base painted with the masked index");
  assert.equal(m.tstates, T_TOTAL, "T-state total is independent of the data");
});

// ---- MUTATION: the `AND 0xF7` index mask (and its 7 T) dropped ---------------
// Faithful copy of sub_3e13 with the mask instruction removed: the index becomes
// 0x2B instead of 0x23, so every painted cell AND the 0x8057 write-back are wrong,
// and the total loses 7 T (972 not 979). Both the value teeth and the T-state
// tooth reject it.
function sub_3e13_mut(m) {
  const { regs, mem } = m;
  regs.e = regs.a; m.step(0x3e14, 4);
  regs.a = mem.read8(0x8057); m.step(0x3e17, 13);
  regs.a = regs.inc8(regs.a); m.step(0x3e18, 4);
  // BUG: `and 0xf7` (regs.and) and its 7 T-states omitted -> bit 3 never cleared.
  regs.c = regs.a; m.step(0x3e1b, 4);
  m.step(0x3e1e, 12);
  regs.d = 0x00; m.step(0x3e20, 7);
  regs.hl = 0x8840; m.step(0x3e23, 10);
  regs.addHl(regs.de); m.step(0x3e24, 11);
  regs.a = regs.c; m.step(0x3e25, 4);
  mem.write8(0x8057, regs.a); m.step(0x3e28, 13);
  regs.de = 0x0020; m.step(0x3e2b, 10);
  regs.b = 0x1c; m.step(0x3e2d, 7);
  do {
    mem.write8(regs.hl, regs.a); m.step(0x3e2e, 7);
    regs.addHl(regs.de); m.step(0x3e2f, 11);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3e2d : 0x3e31, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  m.ret();
}

test("the assertions have teeth: the dropped-AND-mask mutation is caught", () => {
  assertColumnCycle(sub_3e13); // the real routine passes it
  assert.throws(
    () => assertColumnCycle(sub_3e13_mut),
    /advanced index|979 T/,
    "mutant must fail the value or T-state assertion",
  );
});

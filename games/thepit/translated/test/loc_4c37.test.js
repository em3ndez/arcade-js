// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4c37 (ROM 0x4C37-0x4C46): fill all 1024 bytes of colour
// RAM (0x8800..0x8BFF) with the byte held at 0x8057, via a nested inner
// `inc l`/`jr nz` page loop and an outer `inc h`/`djnz` page counter.
//
// Asserts the T-state total (a fixed 23635), the EXACT fill span (every one of
// the 1024 colour-RAM cells set to the source byte -- which proves BOTH the
// 0x8800 base AND the full 4*256 walk across all four pages), the source read
// (0x8057 untouched, A holds it), and the register/control residue (HL advanced
// to 0x8C00, B counted to 0, the ret popped the caller). Ends with a MUTATION
// (the outer `inc h` page-advance dropped) proven caught by both the span teeth
// AND the T-state teeth.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4c37 } from "../loc_4c37.js";

const RET = 0x1234; // sentinel return address pushed before the call

const SRC = 0x8057; // work-RAM cell holding the fill byte
const FILL = 0x5a; // the byte to spray across colour RAM
const BASE = 0x8800; // colour RAM base
const COUNT = 0x400; // 1024 cells filled (0x8800..0x8BFF)
const END = BASE + COUNT; // 0x8C00 -- HL exits here; never written
const SENTINEL = 0xa5; // pre-fill so a filled cell (FILL) is an OBSERVABLE change
const T_TOTAL = 23635; // head 30 + 4 pages*(256*7 + 256*4 + 255*12+7 + inc h 4)
//                        + djnz 3*13+8 + ret 10

// Minimal machine: real Regs + real Pit AddressSpace + the step/ret/push16/pop16
// seam loc_4c37 drives (no m.call in this routine).
function makeMachine() {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)

  const m = {
    regs,
    mem,
    tstates: 0,
    pc: 0x4c37,
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

  // The source byte the fill reads once.
  mem.write8(SRC, FILL);
  // Pre-fill all of colour RAM (0x8800..0x8BFF) with a sentinel != FILL so
  // "filled with FILL" is a real, observable change on every cell.
  for (let a = BASE; a < END; a++) mem.write8(a, SENTINEL);

  m.push16(RET); // the return address loc_4c37's `ret` must pop
  return m;
}

// The canonical fill-span facts, shared by the real routine and the mutant so
// the mutation is measured against exactly the assertions the routine must pass.
function assertFillSpan(fn) {
  const m = makeMachine();
  fn(m);
  for (let k = 0; k < COUNT; k++) {
    const addr = BASE + k;
    assert.equal(
      m.mem.read8(addr),
      FILL,
      `cell ${k} at 0x${addr.toString(16)} set to FILL`,
    );
  }
  assert.equal(m.tstates, T_TOTAL, `fill costs ${T_TOTAL} T`);
}

test("fills 0x8800..0x8BFF with (0x8057), then returns", () => {
  const m = makeMachine();
  loc_4c37(m);

  // every one of the 1024 colour-RAM cells now holds the source byte -- proves
  // the 0x8800 base, the 4-page count, and the inc l / inc h walk across pages.
  for (let k = 0; k < COUNT; k++) {
    const addr = BASE + k;
    assert.equal(m.mem.read8(addr), FILL, `cell ${k} at 0x${addr.toString(16)} filled`);
  }

  // the source cell is read, never written -- one load feeds all 1024 stores.
  assert.equal(m.mem.read8(SRC), FILL, "0x8057 (the source) is left untouched");
  assert.equal(m.regs.a, FILL, "A holds the fill byte read from 0x8057");

  // register / flag residue
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.hl, END, "HL advanced to 0x8C00 (H: 0x88 -> 0x8C, L wrapped to 0)");
  // last flag-setting op is `inc h` producing H = 0x8C: S set, Z clear.
  assert.equal(m.regs.fM, true, "S set from the final inc h (H = 0x8C)");
  assert.equal(m.regs.fZ, false, "Z clear from the final inc h");

  // control flow: the ret popped the caller's address
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);

  // exact cycle budget
  assert.equal(m.tstates, T_TOTAL, `whole routine costs ${T_TOTAL} T`);
});

// ---- MUTATION: the outer `inc h` page-advance (and its 4 T) dropped ----------
// Faithful copy of loc_4c37 with `inc h` removed: H never leaves 0x88, so all
// four pages re-fill 0x8800..0x88FF and 0x8900..0x8BFF stay at the sentinel.
// The total also loses 4*4 = 16 T (23619 not 23635). Both the span teeth (cells
// >= 256 unfilled) and the T-state tooth reject it.
function loc_4c37_mut(m) {
  const { regs, mem } = m;
  regs.b = 0x04;
  m.step(0x4c39, 7);
  regs.a = mem.read8(0x8057);
  m.step(0x4c3c, 13);
  regs.hl = 0x8800;
  m.step(0x4c3f, 10);
  do {
    do {
      mem.write8(regs.hl, regs.a);
      m.step(0x4c40, 7);
      regs.l = regs.inc8(regs.l);
      m.step(0x4c41, 4);
      m.step(regs.fNZ ? 0x4c3f : 0x4c43, regs.fNZ ? 12 : 7);
    } while (regs.fNZ);
    // BUG: `inc h` (regs.inc8) and its 4 T-states omitted -> H never advances.
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4c3f : 0x4c46, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  m.ret();
}

test("the assertions have teeth: the dropped-`inc h` mutation is caught", () => {
  assertFillSpan(loc_4c37); // the real routine passes it
  assert.throws(
    () => assertFillSpan(loc_4c37_mut),
    /set to FILL|23635 T/,
    "mutant must fail the span or T-state assertion",
  );
});

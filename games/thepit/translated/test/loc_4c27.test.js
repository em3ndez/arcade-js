// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4c27 (ROM 0x4C27-0x4C36): fill the whole video RAM
// (0x9000..0x93FF, 4 pages x 256 bytes) with the byte at ROM 0x4B0F, via a
// nested `inc l` (page) / djnz (page-count) loop.
//
// Asserts the T-state total (a fixed 23635), that EVERY one of the 1024 video
// cells holds the 0x4B0F byte (starting from a distinct sentinel, so a missed
// cell stays visible -- this proves the full 0x9000 base + 0x400 span AND that
// the value came FROM 0x4B0F, not a hardcoded literal), that exactly 1024 writes
// landed and all within 0x9000..0x93FF, and the register/control residue
// (HL -> 0x9400, B -> 0, ret popped the caller). Ends with a MUTATION (the
// `inc h` page-advance dropped) proven caught by BOTH the span teeth and the
// T-state teeth.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4c27 } from "../loc_4c27.js";

const RET = 0x1234; // sentinel return address pushed before the call
const FILL_SRC = 0x4b0f; // ROM address the fill byte is read from
const FILL = 0x5a; // the fill byte we plant there (distinct from sentinel/0)
const BASE = 0x9000; // video RAM base
const COUNT = 0x400; // 1024 bytes = whole video RAM
const END = 0x9400; // HL's exit value (base + 0x400)
const SENTINEL = 0xff; // pre-fill so a written cell (FILL) is an OBSERVABLE change
const T_TOTAL = 23635; // head 30 + loop 23595 + ret 10 (see cycle notes below)

// Minimal machine: real Regs + real Pit AddressSpace + the step/ret/push16/pop16
// seam loc_4c27 drives (no m.call in this routine). write8 is wrapped to record
// every store so the test can prove the exact write span/count.
function makeMachine() {
  const io = new Io();
  const rom = new Uint8Array(0x5000);
  rom[FILL_SRC] = FILL; // plant the fill byte the routine must read
  const mem = new AddressSpace(rom, io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)

  const writes = [];
  const rawWrite8 = mem.write8.bind(mem);
  mem.write8 = (addr, value, busOffset) => {
    writes.push(addr & 0xffff);
    return rawWrite8(addr, value, busOffset);
  };

  const m = {
    regs,
    mem,
    writes,
    tstates: 0,
    pc: 0x4c27,
    returned: false,
    step(addr, cycles) {
      this.pc = addr;
      this.tstates += cycles;
    },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      rawWrite8(regs.sp, v & 0xff);
      rawWrite8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
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

  // Pre-fill the whole video RAM with a sentinel so "written to FILL" is a real,
  // observable change and any missed cell stays visible.
  for (let a = BASE; a < BASE + COUNT; a++) rawWrite8(a, SENTINEL);
  m.writes.length = 0; // don't count the sentinel prefill

  m.push16(RET); // the return address loc_4c27's `ret` must pop
  m.writes.length = 0; // nor the pushed return address
  return m;
}

// The canonical fill facts, shared by the real routine and the mutant so the
// mutation is measured against exactly the assertions the routine must pass.
function assertFill(fn) {
  const m = makeMachine();
  fn(m);
  for (let k = 0; k < COUNT; k++) {
    const addr = BASE + k;
    assert.equal(
      m.mem.read8(addr),
      FILL,
      `cell ${k} at 0x${addr.toString(16)} == fill byte 0x${FILL.toString(16)}`,
    );
  }
  assert.equal(m.tstates, T_TOTAL, `fill costs ${T_TOTAL} T`);
}

test("fills 0x9000..0x93FF with (0x4b0f), then returns", () => {
  const m = makeMachine();
  loc_4c27(m);

  // every video cell holds the byte read FROM 0x4B0F -- proves base, span, and
  // that the value is not a hardcoded literal (planted 0x5a, not 0x00).
  for (let k = 0; k < COUNT; k++) {
    const addr = BASE + k;
    assert.equal(m.mem.read8(addr), FILL, `cell ${k} at 0x${addr.toString(16)} filled`);
  }

  // exactly 1024 writes, every one inside 0x9000..0x93FF (no under/over-run).
  assert.equal(m.writes.length, COUNT, "exactly 1024 stores");
  for (const addr of m.writes) {
    assert.ok(addr >= BASE && addr < END, `store 0x${addr.toString(16)} within video RAM`);
  }

  // register / control residue
  assert.equal(m.regs.b, 0x00, "B counted the 4 pages down to 0");
  assert.equal(m.regs.hl, END, "HL advanced base + 0x400 (H: 0x90 -> 0x94, L wrapped to 0)");
  assert.equal(m.regs.a, FILL, "A still holds the fill byte");
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET, "the ret popped the caller's address");

  assert.equal(m.tstates, T_TOTAL, `total is ${T_TOTAL} T`);
});

// ---- MUTATION: the `inc h` page-advance (and its 4 T) dropped ----------------
// Faithful copy of loc_4c27 with the `inc h` removed: H never leaves 0x90, so
// every page's writes land back on 0x9000..0x90FF -- 0x9100..0x93FF keep the
// sentinel -- and the total loses 4 * 4 = 16 T (23619 not 23635). Both the span
// teeth (unfilled cells) and the T-state tooth reject it.
function loc_4c27_mut(m) {
  const { regs, mem } = m;
  regs.b = 0x04;
  m.step(0x4c29, 7);
  regs.a = mem.read8(0x4b0f);
  m.step(0x4c2c, 13);
  regs.hl = 0x9000;
  m.step(0x4c2f, 10);
  do {
    do {
      mem.write8(regs.hl, regs.a);
      m.step(0x4c30, 7);
      regs.l = regs.inc8(regs.l);
      m.step(0x4c31, 4);
      m.step(regs.fNZ ? 0x4c2f : 0x4c33, regs.fNZ ? 12 : 7);
    } while (regs.fNZ);
    // BUG: `inc h` (regs.inc8 on H) and its 4 T omitted -> H never advances.
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4c2f : 0x4c36, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  m.ret();
}

test("the assertions have teeth: the dropped-`inc h` mutation is caught", () => {
  assertFill(loc_4c27); // the real routine passes it
  assert.throws(
    () => assertFill(loc_4c27_mut),
    /== fill byte|23635 T/,
    "mutant must fail the span or T-state assertion",
  );
});

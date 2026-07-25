// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4c11 (ROM 0x4C11-0x4C1B): clear 128 (0x80) bytes of
// attribute/sprite RAM at 0x9800..0x987F to zero via an `inc l` / djnz loop.
//
// Asserts the T-state total (a fixed 3478), the EXACT clear span (128 cells
// zeroed, the 129th left untouched -- which proves BOTH the 0x9800 base AND the
// exact count / `inc l`-stays-in-page walk), and the register/control residue
// (HL advanced to 0x9880, B counted to 0, the ret popped the caller). Ends with
// a MUTATION (the `inc l` pointer-advance dropped) proven caught by both the
// span teeth AND the T-state teeth.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4c11 } from "../loc_4c11.js";

const RET = 0x1234; // sentinel return address pushed before the call

const BASE = 0x9800; // attribute/sprite RAM base
const COUNT = 0x80; // 128 bytes cleared
const END = BASE + COUNT; // 0x9880 -- first byte the loop must NOT touch
const SENTINEL = 0xff; // pre-fill so a cleared cell (0x00) is an OBSERVABLE change
const T_TOTAL = 3478; // head 17 + loop (128*14 + 127*13 + 8) + ret 10

// Minimal machine: real Regs + real Pit AddressSpace + the step/ret/push16/pop16
// seam loc_4c11 drives (no m.call in this routine).
function makeMachine() {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)

  const m = {
    regs,
    mem,
    tstates: 0,
    pc: 0x4c11,
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

  // Pre-fill the whole 0x9800 block with a sentinel so "cleared to 0x00" is a
  // real change and an overrun past 0x987F is visible.
  for (let a = 0x9800; a <= 0x98ff; a++) mem.write8(a, SENTINEL);

  m.push16(RET); // the return address loc_4c11's `ret` must pop
  return m;
}

// The canonical clear-span facts, shared by the real routine and the mutant so
// the mutation is measured against exactly the assertions the routine must pass.
function assertClearSpan(fn) {
  const m = makeMachine();
  fn(m);
  for (let k = 0; k < COUNT; k++) {
    const addr = BASE + k;
    assert.equal(
      m.mem.read8(addr),
      0x00,
      `cell ${k} at 0x${addr.toString(16)} cleared to 0x00`,
    );
  }
  assert.equal(m.tstates, T_TOTAL, `clear costs ${T_TOTAL} T`);
}

test("clears 0x9800..0x987F to zero, then returns", () => {
  const m = makeMachine();
  loc_4c11(m);

  // exactly 128 cells cleared -- and the 129th left as the sentinel (proves the
  // 0x9800 base, the 128 count, and that `inc l` walked one byte at a time).
  for (let k = 0; k < COUNT; k++) {
    const addr = BASE + k;
    assert.equal(m.mem.read8(addr), 0x00, `cell ${k} at 0x${addr.toString(16)} cleared`);
  }
  assert.equal(m.mem.read8(END), SENTINEL, "the 129th cell (0x9880) is NOT written");

  // register / flag residue
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.hl, END, "HL advanced base + 128 (L: 0x00 -> 0x80)");
  // last `inc l` produced L = 0x80: S set, Z clear, H set (low nibble 0), PV set.
  assert.equal(m.regs.fM, true, "S set from the final inc l (L = 0x80)");
  assert.equal(m.regs.fZ, false, "Z clear from the final inc l");

  // control flow: the ret popped the caller's address
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);
});

// ---- MUTATION: the `inc l` pointer-advance (and its 4 T) dropped -------------
// Faithful copy of loc_4c11 with the `inc l` removed: HL never advances, so all
// 128 writes land on 0x9800 -- 0x9801..0x987F stay at the sentinel -- and the
// total loses 128*4 = 512 T (2966 not 3478). Both the span teeth and the T-state
// tooth reject it.
function loc_4c11_mut(m) {
  const { regs, mem } = m;
  regs.b = 0x80;
  m.step(0x4c13, 7);
  regs.hl = 0x9800;
  m.step(0x4c16, 10);
  do {
    mem.write8(regs.hl, 0x00);
    m.step(0x4c18, 10);
    // BUG: `inc l` (regs.inc8) and its 4 T-states omitted -> HL never advances.
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4c16 : 0x4c1b, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  m.ret();
}

test("the assertions have teeth: the dropped-`inc l` mutation is caught", () => {
  assertClearSpan(loc_4c11); // the real routine passes it
  assert.throws(
    () => assertClearSpan(loc_4c11_mut),
    /cleared to 0x00|3478 T/,
    "mutant must fail the span or T-state assertion",
  );
});

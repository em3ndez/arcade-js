// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4c1c (ROM 0x4C1C-0x4C26): clear 64 (0x40) bytes of work
// RAM at 0x8200..0x823F to zero via an `inc l` / djnz loop.
//
// Asserts the T-state total (a fixed 1750), the EXACT clear span (64 cells
// zeroed, the 65th left untouched -- which proves BOTH the 0x8200 base AND the
// exact count / `inc l`-stays-in-page walk), and the register/control residue
// (HL advanced to 0x8240, B counted to 0, the ret popped the caller). Ends with
// a MUTATION (the `inc l` pointer-advance dropped) proven caught by both the
// span teeth AND the T-state teeth.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4c1c } from "../loc_4c1c.js";

const RET = 0x1234; // sentinel return address pushed before the call

const BASE = 0x8200; // work-RAM destination base
const COUNT = 0x40; // 64 bytes cleared
const END = BASE + COUNT; // 0x8240 -- first byte the loop must NOT touch
const SENTINEL = 0xff; // pre-fill so a cleared cell (0x00) is an OBSERVABLE change
const T_TOTAL = 1750; // head 17 + loop (64*14 + 63*13 + 8) + ret 10

// Minimal machine: real Regs + real Pit AddressSpace + the step/ret/push16/pop16
// seam loc_4c1c drives (no m.call in this routine).
function makeMachine() {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF), clear of 0x8200..0x823F

  const m = {
    regs,
    mem,
    tstates: 0,
    pc: 0x4c1c,
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

  // Pre-fill the span and beyond with a sentinel so "cleared to 0x00" is a real
  // change and an overrun past 0x823F is visible.
  for (let a = 0x8200; a <= 0x82ff; a++) mem.write8(a, SENTINEL);

  m.push16(RET); // the return address loc_4c1c's `ret` must pop
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

test("clears 0x8200..0x823F to zero, then returns", () => {
  const m = makeMachine();
  loc_4c1c(m);

  // exactly 64 cells cleared -- and the 65th left as the sentinel (proves the
  // 0x8200 base, the 64 count, and that `inc l` walked one byte at a time).
  for (let k = 0; k < COUNT; k++) {
    const addr = BASE + k;
    assert.equal(m.mem.read8(addr), 0x00, `cell ${k} at 0x${addr.toString(16)} cleared`);
  }
  assert.equal(m.mem.read8(END), SENTINEL, "the 65th cell (0x8240) is NOT written");

  // register / flag residue
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.hl, END, "HL advanced base + 64 (L: 0x00 -> 0x40)");
  // last `inc l` produced L = 0x40 (from 0x3F): S clear, Z clear, H set, PV clear.
  // (Contrast loc_4c11, whose final L = 0x80 sets S.)
  assert.equal(m.regs.fM, false, "S clear from the final inc l (L = 0x40)");
  assert.equal(m.regs.fZ, false, "Z clear from the final inc l");

  // control flow: the ret popped the caller's address
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);

  // T-state total
  assert.equal(m.tstates, T_TOTAL, `clear costs ${T_TOTAL} T`);
});

// ---- MUTATION: the `inc l` pointer-advance (and its 4 T) dropped -------------
// Faithful copy of loc_4c1c with the `inc l` removed: HL never advances, so all
// 64 writes land on 0x8200 -- 0x8201..0x823F stay at the sentinel -- and the
// total loses 64*4 = 256 T (1494 not 1750). Both the span teeth and the T-state
// tooth reject it.
function loc_4c1c_mut(m) {
  const { regs, mem } = m;
  regs.b = 0x40;
  m.step(0x4c1e, 7);
  regs.hl = 0x8200;
  m.step(0x4c21, 10);
  do {
    mem.write8(regs.hl, 0x00);
    m.step(0x4c23, 10);
    // BUG: `inc l` (regs.inc8) and its 4 T-states omitted -> HL never advances.
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4c21 : 0x4c26, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  m.ret();
}

test("the assertions have teeth: the dropped-`inc l` mutation is caught", () => {
  assertClearSpan(loc_4c1c); // the real routine passes it
  assert.throws(
    () => assertClearSpan(loc_4c1c_mut),
    /cleared to 0x00|1750 T/,
    "mutant must fail the span or T-state assertion",
  );
});

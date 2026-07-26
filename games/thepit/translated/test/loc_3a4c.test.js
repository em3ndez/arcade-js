// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_3a4c (ROM 0x3a4c-0x3a6e), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a seeded fake
// ROM (the copyrighted image is never committed). loc_3a4c has NO callees; it is
// two 3-byte ldir copies (0x810a->0x8238, 0x811b->0x823c) each followed by an
// appended 4th byte = source[3] + (0x8051). All destinations are work RAM.
//
// Asserts the T-state total (247), the two 3-byte copies, both biased 4th bytes,
// the exit registers, and that the final `ret` lands on the caller. A deliberate
// mutation (drops the bias-preservation `ld a,b`, so record 2's 4th byte uses a
// stale bias) is asserted to be caught -- a memory-only break at identical cycles.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3a4c } from "../loc_3a4c.js";

// -- fixture values placed in WORK RAM (writable; ROM content is irrelevant) ---
const BIAS = 0x10; // (0x8051)
const SRC1 = [0x11, 0x22, 0x33, 0x44]; // 0x810a..0x810d; [0..2] copied, [3] biased
const SRC2 = [0x55, 0x66, 0x77, 0x88]; // 0x811b..0x811e; [0..2] copied, [3] biased

const SENTINEL = 0xbeef; // return address the final `ret` must land on

// -- minimal machine: real mem/io/regs + the step/ret/ldir seam ---------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3a4c;
    this.regs.sp = 0x8780; // inside work RAM (0x8000-0x87ff) so pushes are mapped
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
  // Byte-for-byte the machine.js semantics: 21 T per repeating iter, 16 on exit.
  ldirAt(self, nextAddr) {
    const { regs, mem } = this;
    for (;;) {
      mem.write8(regs.de, mem.read8(regs.hl));
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.de = (regs.de + 1) & 0xffff;
      regs.bc = (regs.bc - 1) & 0xffff;
      if (regs.bc === 0) {
        this.step(nextAddr, 16);
        return;
      }
      this.step(self, 21);
    }
  }
}

function seed(m) {
  m.mem.write8(0x8051, BIAS);
  for (let i = 0; i < 4; i++) {
    m.mem.write8(0x810a + i, SRC1[i]);
    m.mem.write8(0x811b + i, SRC2[i]);
  }
}

function run(fn) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new TestMachine(rom);
  seed(m);
  m.push16(SENTINEL); // the caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    // dest record 1 (0x8238..0x823b) and record 2 (0x823c..0x823f)
    dest1: [0, 1, 2, 3].map((i) => m.mem.read8(0x8238 + i)),
    dest2: [0, 1, 2, 3].map((i) => m.mem.read8(0x823c + i)),
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    c: m.regs.c,
    bc: m.regs.bc,
    de: m.regs.de,
    hl: m.regs.hl,
  };
}

const EXP_DEST1 = [SRC1[0], SRC1[1], SRC1[2], (SRC1[3] + BIAS) & 0xff]; // [11,22,33,54]
const EXP_DEST2 = [SRC2[0], SRC2[1], SRC2[2], (SRC2[3] + BIAS) & 0xff]; // [55,66,77,98]

// Full spec, factored so the mutant runs the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, 247, "T-state total");
  assert.deepEqual(res.dest1, EXP_DEST1, "record 1: 3 bytes copied + biased 4th");
  assert.deepEqual(res.dest2, EXP_DEST2, "record 2: 3 bytes copied + biased 4th");
  assert.equal(res.pc, SENTINEL, "ret lands on caller");
  assert.equal(res.sp, 0x8780, "stack balanced");
  assert.equal(res.a, (SRC2[3] + BIAS) & 0xff, "A = last biased sum (0x98)");
  assert.equal(res.b, BIAS, "B holds the bias on exit");
  assert.equal(res.c, 0, "C = 0 after final ldir");
  assert.equal(res.hl, 0x811e, "HL past source 2 record");
  assert.equal(res.de, 0x823f, "DE at dest2[3]");
}

test("loc_3a4c: two records copied + biased 4th byte, 247 T", () => {
  checkSpec(run(loc_3a4c));
});

// -- MUTATION: drop the bias-preservation `ld a,b` at 0x3a5e (A keeps record 1's
// biased sum). `ld b,a` at 0x3a6a then loads a STALE bias, so record 2's 4th byte
// is wrong -- a memory-only divergence at the SAME 247 T total. The spec must
// reject it, proving the memory assertions (not just the cycle count) have teeth.
function loc_3a4c_mutant(m) {
  const { regs, mem } = m;
  regs.de = 0x8238;
  m.step(0x3a4f, 10);
  regs.hl = 0x810a;
  m.step(0x3a52, 10);
  regs.bc = 0x0003;
  m.step(0x3a55, 10);
  m.ldirAt(0x3a55, 0x3a57);
  regs.a = mem.read8(0x8051);
  m.step(0x3a5a, 13);
  regs.b = regs.a;
  m.step(0x3a5b, 4);
  regs.a = mem.read8(regs.hl);
  m.step(0x3a5c, 7);
  regs.add(regs.b);
  m.step(0x3a5d, 4);
  mem.write8(regs.de, regs.a);
  m.step(0x3a5e, 7);
  // BUG: `ld a,b` dropped -- A stays as record 1's biased sum instead of the bias.
  m.step(0x3a5f, 4);
  regs.de = 0x823c;
  m.step(0x3a62, 10);
  regs.hl = 0x811b;
  m.step(0x3a65, 10);
  regs.bc = 0x0003;
  m.step(0x3a68, 10);
  m.ldirAt(0x3a68, 0x3a6a);
  regs.b = regs.a; // now B = stale sum, not the bias
  m.step(0x3a6b, 4);
  regs.a = mem.read8(regs.hl);
  m.step(0x3a6c, 7);
  regs.add(regs.b);
  m.step(0x3a6d, 4);
  mem.write8(regs.de, regs.a);
  m.step(0x3a6e, 7);
  m.ret();
}

test("mutation (dropped bias preservation) is caught by the spec", () => {
  const bad = run(loc_3a4c_mutant);
  // Sanity: the mutant really diverges in record 2's 4th byte, at identical cycles.
  assert.equal(bad.cycles, 247, "mutant mischarges nothing -- memory-only break");
  assert.notDeepEqual(bad.dest2, EXP_DEST2, "mutant's record-2 4th byte is wrong");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkSpec(bad));
});

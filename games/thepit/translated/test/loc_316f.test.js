// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_316f (ROM 0x316f-0x319c), The Pit.
//
// loc_316f stages the live object record 0x80f9 into the scratch slot 0x8083 (ldir,
// 0x11 bytes), probes/advances it via `call 0x319d`, copies the scratch record BACK
// over 0x80f9 (ldir, 0x11 bytes), then emits a display record at 0x8234: the first 3
// bytes of 0x80f9 verbatim (ldir) plus a 4th byte = record[3] + (0x8051). It ends with
// `jp 0x3748`, a TAIL-JUMP (0x3748's ret returns to loc_316f's caller).
//
// The call seam is stubbed and records the target while modelling a bare `ret`
// (pop -> pc): the regular `call 0x319d` pushed its own return address (0x317d), so the
// stub pops that and resumes in-line; the tail `jp 0x3748` pushed nothing, so its stub
// pops the SENTINEL -- the caller's return address. With 0x319d stubbed to a no-op, the
// two 0x11-byte copies round-trip 0x80f9 unchanged and leave a copy in 0x8083, isolating
// loc_316f's OWN T-state cost (914) and memory effects.
//
// Asserts the T-state total (914), the scratch copy, the round-tripped live record, the
// 3-byte display record + biased 4th byte, the exit registers/flags, the call sequence
// ([0x319d, 0x3748]), that the tail-jump lands on the caller, and a balanced stack.
// A deliberate mutation (drops the `add a,b` bias at 0x3198, still charging its 4 T) is
// asserted to be caught -- a memory-only break at the IDENTICAL 914 T total.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_316f } from "../loc_316f.js";

const PROBE = 0x319d; // the collision/move probe called on the scratch copy
const TAIL = 0x3748; // render/continue tail-jump target
const SENTINEL = 0xbeef; // caller return address the tail-callee's ret lands on
const SP0 = 0x8780; // SP inside work RAM (0x8000-0x87ff) so pushes/pops are mapped

const BIAS = 0x20; // (0x8051), the shared 4th-byte bias
// 17-byte live object record at 0x80f9..0x8109, distinct so the copies are verifiable.
// record[3] = 0xF0 so record[3] + BIAS = 0x110 -> A = 0x10 with CARRY set (a flag check).
const REC = [
  0x11, 0x22, 0x33, 0xf0, 0x55, 0x66, 0x77, 0x88,
  0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x01, 0x02, 0x03,
];

// -- minimal machine: real mem/io/regs + the step/call/ldir/push16 seam --------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x316f;
    this.calls = [];
    this.regs.sp = SP0;
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
  // Records the target and models a bare `ret` (pop -> pc). Both the regular call
  // (pops its own 0x317d) and the tail-jump (pops the SENTINEL) are handled uniformly.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
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
  for (let i = 0; i < REC.length; i++) m.mem.write8(0x80f9 + i, REC[i]);
}

function run(fn) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new TestMachine(rom);
  seed(m);
  m.push16(SENTINEL); // the caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    hl: m.regs.hl,
    de: m.regs.de,
    fC: m.regs.fC,
    fZ: m.regs.fZ,
    scratch: Array.from({ length: 17 }, (_, i) => m.mem.read8(0x8083 + i)), // 0x8083..0x8093
    live: Array.from({ length: 17 }, (_, i) => m.mem.read8(0x80f9 + i)), // 0x80f9..0x8109
    display3: [0, 1, 2].map((i) => m.mem.read8(0x8234 + i)), // 0x8234..0x8236
    display4: m.mem.read8(0x8237), // biased 4th byte
  };
}

const EXP_BIASED = (REC[3] + BIAS) & 0xff; // 0x10

// Full spec, factored so the mutant runs the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, 914, "T-state total (own instructions)");
  assert.deepEqual(res.calls, [PROBE, TAIL], "regular call 0x319d then tail-jump 0x3748");
  assert.equal(res.pc, SENTINEL, "tail-jump: 0x3748's ret lands on loc_316f's caller");
  assert.equal(res.sp, SP0, "stack balanced (call pop + tail-jump pop)");
  assert.deepEqual(res.scratch, REC, "scratch 0x8083 holds the copied object record");
  assert.deepEqual(res.live, REC, "live 0x80f9 round-tripped unchanged (probe stubbed)");
  assert.deepEqual(res.display3, REC.slice(0, 3), "display record: 3 bytes copied verbatim");
  assert.equal(res.display4, EXP_BIASED, "display record 4th byte = record[3] + (0x8051)");
  assert.equal(res.hl, 0x80fc, "HL past the 3-byte display source");
  assert.equal(res.de, 0x8237, "DE at the display 4th-byte slot");
  assert.equal(res.b, BIAS, "B holds the bias on exit");
  assert.equal(res.a, EXP_BIASED, "A = record[3] + bias (0x10)");
  assert.equal(res.fC, true, "add a,b carried (0xF0 + 0x20 = 0x110)");
  assert.equal(res.fZ, false, "result 0x10 is non-zero");
}

test("loc_316f: stage/probe/restore + biased display record, 914 T, tail-jump to 0x3748", () => {
  checkSpec(run(loc_316f));
});

// -- MUTATION: drop the `add a,b` bias at 0x3198 (still charge its 4 T). A stays as
// record[3] (0xF0), so the display 4th byte is 0xF0 not 0x10 -- a memory-AND-register
// break at the SAME 914 T total. The spec the real routine passes must REJECT it,
// proving the memory/register assertions (not just the cycle count) have teeth.
function loc_316f_mutant(m) {
  const { regs, mem } = m;
  regs.hl = 0x80f9;
  m.step(0x3172, 10);
  regs.de = 0x8083;
  m.step(0x3175, 10);
  regs.bc = 0x0011;
  m.step(0x3178, 10);
  m.ldirAt(0x3178, 0x317a);
  m.push16(0x317d);
  m.step(0x319d, 17);
  m.call(0x319d);
  regs.hl = 0x8083;
  m.step(0x3180, 10);
  regs.de = 0x80f9;
  m.step(0x3183, 10);
  regs.bc = 0x0011;
  m.step(0x3186, 10);
  m.ldirAt(0x3186, 0x3188);
  regs.de = 0x8234;
  m.step(0x318b, 10);
  regs.hl = 0x80f9;
  m.step(0x318e, 10);
  regs.bc = 0x0003;
  m.step(0x3191, 10);
  m.ldirAt(0x3191, 0x3193);
  regs.a = mem.read8(0x8051);
  m.step(0x3196, 13);
  regs.b = regs.a;
  m.step(0x3197, 4);
  regs.a = mem.read8(regs.hl);
  m.step(0x3198, 7);
  // BUG: `add a,b` dropped -- A keeps record[3], the bias is never applied.
  m.step(0x3199, 4);
  mem.write8(regs.de, regs.a);
  m.step(0x319a, 7);
  m.step(0x3748, 10);
  return m.call(0x3748);
}

test("mutation (dropped bias add) is caught by the spec", () => {
  const bad = run(loc_316f_mutant);
  // Sanity: the mutant really diverges in the 4th byte, at the identical cycle total.
  assert.equal(bad.cycles, 914, "mutant mischarges nothing -- memory/register-only break");
  assert.equal(bad.display4, REC[3], "mutant's 4th byte is the unbiased record[3]");
  assert.notEqual(bad.display4, EXP_BIASED, "mutant diverges from the biased value");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkSpec(bad));
});

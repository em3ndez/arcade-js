// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_4cca (ROM 0x4cca-0x4d09 + fall-through into
// loc_4d0c), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. The three format
// callees (0x4d0c) are stubbed as "pop-and-return" routines that balance the
// stack but add no cycles, so the asserted T-state total is loc_4cca's OWN
// instruction cost (424 T). The KEY control-flow claim under test is that the
// THIRD format call is reached by FALL-THROUGH -- a tail-call: no push, no
// trailing ret -- so loc_4d0c's ret lands on loc_4cca's own caller (pc=SENTINEL)
// and the stack stays balanced (no double-pop). A deliberate mutation (record 3's
// value store dropped) is asserted to be caught by both the value and T-state
// assertions.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4cca } from "../loc_4cca.js";

const SENTINEL = 0xbeef; // return address loc_4d0c's ret (via fall-through) must land on

// -- source records seeded in work RAM ----------------------------------------
// Contiguous: block1 39..3b, value1 3c..3d, block2 3e..40, value2 41..42,
//             block3 43..45, value3 46..47.
const BLOCK1 = [0x11, 0x12, 0x13];
const BLOCK2 = [0x21, 0x22, 0x23];
const BLOCK3 = [0x31, 0x32, 0x33];
const VALUE1 = 0x1234; // -> lo 0x34 @0x8037, hi 0x12 @0x8038 (overwritten by later records)
const VALUE2 = 0x5678;
const VALUE3 = 0x9abc; // the LAST value store -- what 0x8037/0x8038 must hold at exit

// -- minimal machine: real mem/io/regs + the step/call/ldir seam --------------
class TestMachine {
  constructor() {
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x4cca;
    this.calls = [];
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
  // Stubbed callee: record it, then behave as a bare `ret` (pop whatever the site
  // left on the stack). For the two mid-routine CALLs that is the pushed return;
  // for the FALL-THROUGH tail-call (no push) it is the SENTINEL -- which is the
  // whole point: loc_4d0c returns to loc_4cca's caller.
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
  for (let i = 0; i < 3; i++) {
    m.mem.write8(0x8039 + i, BLOCK1[i]);
    m.mem.write8(0x803e + i, BLOCK2[i]);
    m.mem.write8(0x8043 + i, BLOCK3[i]);
  }
  m.mem.write16(0x803c, VALUE1);
  m.mem.write16(0x8041, VALUE2);
  m.mem.write16(0x8046, VALUE3);
}

function run(fn) {
  const m = new TestMachine();
  seed(m);
  m.push16(SENTINEL); // the caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    copy1: [0, 1, 2].map((i) => m.mem.read8(0x8283 + i)),
    copy2: [0, 1, 2].map((i) => m.mem.read8(0x828c + i)),
    copy3: [0, 1, 2].map((i) => m.mem.read8(0x8295 + i)),
    val: m.mem.read16(0x8037), // 0x8037 lo / 0x8038 hi -- the LAST record's value
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    de: m.regs.de,
    bc: m.regs.bc,
    hl: m.regs.hl,
  };
}

// Full spec, factored so the mutant runs through the same checks.
function checkSpec(res) {
  assert.equal(res.cycles, 424, "T-state total (own instructions)");
  assert.deepEqual(res.copy1, BLOCK1, "record-1 block copied to 0x8283");
  assert.deepEqual(res.copy2, BLOCK2, "record-2 block copied to 0x828c");
  assert.deepEqual(res.copy3, BLOCK3, "record-3 block copied to 0x8295");
  assert.equal(res.val, VALUE3, "0x8037/0x8038 hold the THIRD record's value");
  assert.deepEqual(res.calls, [0x4d0c, 0x4d0c, 0x4d0c], "three format calls to loc_4d0c");
  assert.equal(res.pc, SENTINEL, "fall-through tail-call: loc_4d0c ret lands on caller");
  assert.equal(res.sp, 0x8780, "stack balanced (no double-push from the tail-call)");
  assert.equal(res.de, 0x8298, "DE advanced past record-3 dest by the last ldir");
  assert.equal(res.bc, 0x0000, "BC = 0 after the last ldir");
  assert.equal(res.hl, 0x8298, "HL = 0x8298, the pointer handed to loc_4d0c");
}

test("loc_4cca: copies 3 blocks, stages 3 values, formats 3 records, 424 T", () => {
  checkSpec(run(loc_4cca));
});

// -- MUTATION: record 3's `ld (0x8037),hl` (and its 16 T) dropped. The 0x8037
// value then holds record 2's value, and the total is 408 T instead of 424 --
// so BOTH the value-memory assertion and the T-state assertion must reject it.
function loc_4cca_mut(m) {
  const { regs, mem } = m;
  regs.de = 0x8283; m.step(0x4ccd, 10);
  regs.hl = 0x8039; m.step(0x4cd0, 10);
  regs.bc = 0x0003; m.step(0x4cd3, 10);
  m.ldirAt(0x4cd3, 0x4cd5);
  regs.hl = mem.read16(0x803c); m.step(0x4cd8, 16);
  mem.write16(0x8037, regs.hl); m.step(0x4cdb, 16);
  regs.hl = 0x8286; m.step(0x4cde, 10);
  m.push16(0x4ce1); m.step(0x4d0c, 17); m.call(0x4d0c);
  regs.de = 0x828c; m.step(0x4ce4, 10);
  regs.hl = 0x803e; m.step(0x4ce7, 10);
  regs.bc = 0x0003; m.step(0x4cea, 10);
  m.ldirAt(0x4cea, 0x4cec);
  regs.hl = mem.read16(0x8041); m.step(0x4cef, 16);
  mem.write16(0x8037, regs.hl); m.step(0x4cf2, 16);
  regs.hl = 0x828f; m.step(0x4cf5, 10);
  m.push16(0x4cf8); m.step(0x4d0c, 17); m.call(0x4d0c);
  regs.de = 0x8295; m.step(0x4cfb, 10);
  regs.hl = 0x8043; m.step(0x4cfe, 10);
  regs.bc = 0x0003; m.step(0x4d01, 10);
  m.ldirAt(0x4d01, 0x4d03);
  regs.hl = mem.read16(0x8046); m.step(0x4d06, 16);
  // BUG: `ld (0x8037),hl` and its 16 T dropped -- 0x8037 keeps record 2's value.
  regs.hl = 0x8298; m.step(0x4d0c, 10);
  return m.call(0x4d0c);
}

test("mutation (record-3 value store dropped) is caught by the spec", () => {
  // Sanity: the mutant really does diverge (wrong 0x8037 value, 408 T).
  const bad = run(loc_4cca_mut);
  assert.equal(bad.val, VALUE2, "mutant leaves record 2's value at 0x8037");
  assert.equal(bad.cycles, 408, "mutant is 16 T short");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad), /THIRD record|T-state total/);
});

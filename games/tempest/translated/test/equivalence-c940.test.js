// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c940 (ROM 0xc940-0xc97a). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam); JSRs are opaque (harness records the call target, does not run the callee). Covers the beq-taken
// short path, the bpl-taken short path, and the full "new-level" path. Run:
//   node --test games/tempest/translated/test/equivalence-c940.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c940 } from "../loc_c940.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_c940: $3f==$3d -> beq short path to c96c; tail-jmp cd95; 47 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x3f] = 0x03;
  m.ram[0x3d] = 0x03; // equal -> beq at c94e taken
  m.ram[0x49] = 0x11; // $46,x with x=$3d=3 -> $49
  loc_c940(m);
  assert.equal(m.ram[0x00], 0x1e, "$00 = 0x1e (only the early sta)");
  assert.equal(m.ram[0x01], 0x00, "$01 = 0x00");
  assert.equal(m.ram[0x02], 0x1e, "$02 = 0x1e");
  assert.equal(m.ram[0x9f], 0x11, "$9f = $46,x");
  assert.equal(m.regs.x, 0x03, "X = $3d");
  assert.equal(m.regs.a, 0x11, "A = $46,x");
  assert.equal(m.pc, 0xcd95, "tail jmp $cd95");
  assert.deepEqual(m.calls, [0xca48, 0x9025, 0xcd95], "jsr ca48, jsr 9025, jmp cd95");
  assert.equal(m.cycles, 47, "beq-short T-state total");
});

test("loc_c940: $3f!=$3d & $05 positive -> bpl short path; 55 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x3f] = 0x05;
  m.ram[0x3d] = 0x04; // not equal -> beq not taken
  m.ram[0x05] = 0x00; // positive -> bpl at c954 taken
  m.ram[0x4b] = 0x22; // $46,x with x=(sta $3d)=5 -> $4b
  loc_c940(m);
  assert.equal(m.ram[0x3d], 0x05, "sta $3d wrote A (=$3f)");
  assert.equal(m.regs.x, 0x05, "X = $3d after sta");
  assert.equal(m.ram[0x9f], 0x22, "$9f = $46,x");
  assert.equal(m.pc, 0xcd95, "tail jmp");
  assert.deepEqual(m.calls, [0xca48, 0x9025, 0xcd95], "no jsr 92b2 on this path");
  assert.equal(m.cycles, 55, "bpl-short T-state total");
});

test("loc_c940: full new-level path ($05 neg, $0117==0 keeps A=0x50); 82 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x3f] = 0x02;
  m.ram[0x3d] = 0x01;   // not equal
  m.ram[0x05] = 0x80;   // negative -> bpl not taken
  m.ram[0x0117] = 0x00; // Y==0 -> beq at c963 taken -> A stays 0x50
  m.ram[0x48] = 0x37;   // $46,x with x=(sta $3d)=2 -> $48
  loc_c940(m);
  assert.equal(m.ram[0x01], 0x0e, "$01 = 0x0e");
  assert.equal(m.ram[0x00], 0x0a, "$00 = 0x0a (overwrote the 0x1e)");
  assert.equal(m.ram[0x02], 0x1e, "$02 = 0x1e");
  assert.equal(m.ram[0x04], 0x50, "$04 = 0x50 ($0117==0 keeps #$50)");
  assert.equal(m.ram[0x3d], 0x02, "sta $3d");
  assert.equal(m.ram[0x9f], 0x37, "$9f = $46,x");
  assert.equal(m.regs.y, 0x00, "Y = $0117");
  assert.equal(m.pc, 0xcd95, "tail jmp");
  assert.deepEqual(m.calls, [0x92b2, 0xca48, 0x9025, 0xcd95], "jsr 92b2 taken on full path");
  assert.equal(m.cycles, 82, "full-path T-state total");
});

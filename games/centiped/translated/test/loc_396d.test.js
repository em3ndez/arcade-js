// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_396d (ROM 0x396d-0x39ea). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam + rti), author-derived; the whole-machine boot-first state diff vs MAME is the
// integration check. Run: node --test games/centiped/translated/test/loc_396d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_396d } from "../loc_396d.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    rti(c = 6) { regs.p = this.pull8(); this.step(this.pull16() & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

// Path: $0c00 bit5 set -> BNE $3993 taken (skip the $d5 counter); the $1c00 copy loop (X=2..0);
// the $2003 EOR loop XORs to zero so TAX/BEQ $39b3 taken; two passes of the $0c00,X delta loop
// (X=2 full accumulate, X=0 short via BEQ $39dd); STA $1800 then PLA/PLA/PLA + RTI off the stack.
test("loc_396d: IRQ tail runs the copy + EOR + delta loops and returns via RTI; 284 T", () => {
  const m = makeMachine();
  m.ram[0x0c00] = 0x20;                 // bit5 set -> BNE $3993 taken; also X=0 delta input
  m.ram[0x00c5] = 0x33; m.ram[0x00c6] = 0x22; m.ram[0x00c7] = 0x11; // $c5,X copy source
  m.ram[0x2003] = 0xf4;                 // XOR accumulator over $2003..$200d -> 0xf4^0xf4 = 0
  m.ram[0x0c02] = 0x05;                 // $0c00,X (X=2) delta input
  m.ram[0x00bf] = 0x02;                 // $bd,X (X=2)
  m.ram[0x00bc] = 0x00;                 // $ba,X (X=2)
  m.ram[0x00bb] = 0x10;                 // $b9,X (X=2)
  m.ram[0x00bd] = 0x10;                 // $bd,X (X=0)
  m.regs.s = 0xf9;                      // RTI epilogue stack
  m.ram[0x01fa] = 0x11;                 // 1st PLA -> Y
  m.ram[0x01fb] = 0x22;                 // 2nd PLA -> X
  m.ram[0x01fc] = 0x33;                 // 3rd PLA -> A
  m.ram[0x01fd] = 0x00;                 // RTI pull P
  m.ram[0x01fe] = 0x00; m.ram[0x01ff] = 0x40; // RTI pull PC -> 0x4000

  loc_396d(m);

  assert.equal(m.ram[0x1c00], 0x33, "copy $c5->$1c00");
  assert.equal(m.ram[0x1c01], 0x22, "copy $c6->$1c01");
  assert.equal(m.ram[0x1c02], 0x11, "copy $c7->$1c02");
  assert.equal(m.ram[0x00bf], 0x05, "STY $bd,x (X=2) <- Y=0x05");
  assert.equal(m.ram[0x00bc], 0x03, "STA $ba,x (X=2) <- 0x03");
  assert.equal(m.ram[0x00bb], 0x13, "STA $b9,x (X=2) <- 0x03 + 0x10");
  assert.equal(m.ram[0x00bd], 0x20, "STY $bd,x (X=0) <- Y=0x20");
  assert.equal(m.ram[0x1800], 0x00, "STA $1800 <- A(0x00)");
  assert.equal(m.regs.y, 0x11, "Y from 1st PLA");
  assert.equal(m.regs.x, 0x22, "X from 2nd PLA");
  assert.equal(m.regs.a, 0x33, "A from 3rd PLA");
  assert.deepEqual(m.calls, [0x335e], "single JSR $335e");
  assert.equal(m.pc, 0x4000, "RTI restores PC (no +1)");
  assert.equal(m.cycles, 284, "golden T-state total for this path");
});

test("loc_396d MUTATION: JSR $335e return step mischarged 5T not 6T blows the total", () => {
  const m = makeMachine();
  m.ram[0x0c00] = 0x20;
  m.ram[0x2003] = 0xf4;
  m.ram[0x0c02] = 0x05;
  m.ram[0x00bf] = 0x02; m.ram[0x00bb] = 0x10; m.ram[0x00bd] = 0x10;
  m.regs.s = 0xf9;
  m.ram[0x01fe] = 0x00; m.ram[0x01ff] = 0x40;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3996 ? 5 : c); // the JSR $335e return-addr step is 6T
  loc_396d(m);
  assert.notEqual(m.cycles, 284, "a mischarged JSR cycle blows the golden T-state total");
});

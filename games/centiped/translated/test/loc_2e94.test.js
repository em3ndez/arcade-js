// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2e94 (ROM 0x2e94-0x2ec5). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. This routine has TWO entries: the 0x2e94 top and the 0x2e9d body (reached by an external JMP);
// the body is selected by m.pc (see the FLAG in the fan report). m.call is a no-op recorder.
// Run: node --test games/centiped/translated/test/loc_2e94.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2e94 } from "../loc_2e94.js";

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
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_2e94 top entry: ($EF^A)>=0xFA branches out to the loc_2ec5 RTS", () => {
  const m = makeMachine();
  m.regs.a = 0x05; m.ram[0x00ef] = 0xff; // EOR -> 0xfa; CMP #$fa -> C set

  loc_2e94(m);

  assert.equal(m.regs.a, 0xfa, "A = 0x05 ^ 0xff = 0xfa");
  assert.equal(m.pc, 0x2ec5, "BCS $2ec5 out lands at loc_2ec5");
  assert.deepEqual(m.calls, [0x2ec5], "the RTS out-branch");
  assert.equal(m.cycles, 8, "3 + 2 + 3 (taken, same page)");
});

test("loc_2e94 top entry: ($EF^A)<0xFA JMPs out to loc_20e8", () => {
  const m = makeMachine();
  m.regs.a = 0x00; m.ram[0x00ef] = 0x00; // EOR -> 0x00; CMP #$fa -> C clear

  loc_2e94(m);

  assert.equal(m.pc, 0x20e8, "JMP $20e8");
  assert.deepEqual(m.calls, [0x20e8], "the JMP transfer");
  assert.equal(m.cycles, 10, "3 + 2 + 2 (BCS not taken) + 3 (JMP)");
});

test("loc_2e94 body (0x2e9d): 4th-tick $40 advance then the [0x3C,0x40) $70 fold writes through ($32)", () => {
  const m = makeMachine();
  m.pc = 0x2e9d; // enter the body
  m.ram[0x0000] = 0x08; // ($00 & 3) == 0 -> BNE not taken -> advance $40
  m.ram[0x0040] = 0x01;
  m.ram[0x00ef] = 0x00; // EOR identity keeps values readable
  m.ram[0x0070] = 0x3e; // fold sits in [0x3c,0x40)
  m.ram[0x0032] = 0x00; m.ram[0x0033] = 0x40; // ($32) -> 0x4000

  loc_2e94(m);

  assert.equal(m.ram[0x0040], 0x32, "$40 = ((($40+1)&3)|0x30)^$EF = 0x32");
  assert.equal(m.regs.a, 0x3a, "A = (0x3e & 0xfb) ^ 0x00 = 0x3a");
  assert.equal(m.ram[0x4000], 0x3a, "STA ($32),Y wrote A through the 0x4000 pointer");
  assert.equal(m.pc, 0x2ec5, "falls through to loc_2ec5 (RTS)");
  assert.deepEqual(m.calls, [0x2c2b, 0x2ec5], "the $2C2B fold then the fall-through");
  assert.equal(m.cycles, 54, "golden T-state total for the body fall-through path");
});

test("loc_2e94 MUTATION: mischarging the body JSR $2c2b (6T->5T) blows the golden total", () => {
  const m = makeMachine();
  m.pc = 0x2e9d;
  m.ram[0x0000] = 0x08; m.ram[0x0040] = 0x01; m.ram[0x00ef] = 0x00;
  m.ram[0x0070] = 0x3e; m.ram[0x0032] = 0x00; m.ram[0x0033] = 0x40;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2eb7 ? 5 : c); // the JSR $2c2b step lands at 0x2eb7
  loc_2e94(m);
  assert.notEqual(m.cycles, 54, "a mischarged JSR is caught by the T-state total");
});

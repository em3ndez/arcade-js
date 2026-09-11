// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_d8cd (ROM 0xd8cd) -- the second (external) entry of loc_d8ca, reached by
// loc_d931's `jmp $d8cd` with Y/A already set. Enters at `sty $79` (so $79 = the caller's Y). Same
// hardware-sync harness as equivalence-d8ca (toggling $0c00 bit7 per read to keep the inner loops phased).
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_d8cd } from "../loc_d8ca.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  let tick = 0;
  const mem = {
    read8: (a) => { a &= 0xffff; if (a === 0x0c00) return (tick++ & 1) ? 0x80 : 0x00; return ram[a]; },
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return { regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    call(target) { this.calls.push(target); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); } };
}

test("loc_d8cd: entered with Y=5,A=0 -> sty 0x79=5, runs the body, tail-jmp loc_da0a", () => {
  const m = makeMachine();
  m.regs.y = 0x05; m.regs.a = 0x00; // as loc_d931 leaves them (A = and-result low nibble 0 -> inx path)
  loc_d8cd(m);
  assert.equal(m.mem.read8(0x79), 0x05, "sty 0x79 = the caller's Y (not re-seeded from A)");
  assert.equal(m.pc, 0xda0a, "tail jmp target");
  assert.deepEqual(m.calls, [0xda0a], "jmp 0xda0a delegated once");
  assert.ok(m.cycles > 50000, "hardware-sync loops accrue a large cycle total");
});

// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0563 (ROM 0x0563-0x062e): a CALLed head modeled as a `block` dispatch
// loop over its interior labels. Two data-seeded arms are pinned:
//   (1) the entry arm falling to the `rz` at 0x0578 (no calls) -- flags flow cpi->jz through the
//       interleaved `lda`, and the rz pops the caller's seeded return address;
//   (2) the `jnz 0x05c1` forward-jump arm reaching the external conditional delegate `jnz 0x0644`,
//       exercising a push16+call and the dispatch transition (the callee 0x1a06's carry is seated).
// Plus a mutation test proving the T-state golden has teeth.
//
// Run: node --test games/invaders/translated/test/loc_0563.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0563 } from "../loc_0563.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

// Arm 1: bit7 of [0x2073] clear -> jnz 0x05c1 not taken; [0x20c1] != 4 -> jz 0x05b7 not taken;
// [0x2069] == 0 -> `ana a` sets Z -> `rz` at 0x0578 returns. No calls on this path.
test("loc_0563 arm-1: entry -> rz@0x0578 returns to caller; 92 T, no calls", () => {
  const m = makeMachine();
  m.mem.write8(0x2073, 0x00); // bit7 clear
  m.mem.write8(0x20c1, 0x00); // != 0x04
  m.mem.write8(0x2069, 0x00); // -> ana a Z set -> rz
  m.regs.sp = 0x23fc;
  m.mem.write16(0x23fc, 0x0526); // caller return addr (instr after `call 0x0563`)

  loc_0563(m);

  assert.equal(m.regs.a, 0x00, "A := 0 after `ana a` on [0x2069]==0");
  assert.equal(m.regs.hl, 0x2073, "HL still points at 0x2073");
  assert.equal(m.regs.b, 0x00, "B untouched on this arm");
  assert.equal(m.tstates, 92, "T: 10+7+7+10+13+7+13+10+4+11");
  assert.equal(m.pc, 0x0526, "rz pops the seeded return address");
  assert.equal(m.regs.sp, 0x23fe, "rz pops one word");
  assert.deepEqual(m.calls, [], "no delegations/calls on the rz arm");
});

test("loc_0563 arm-1 MUTATION: `cpi 0x04` mis-charged 4T not 7T is caught", () => {
  const m = makeMachine();
  m.mem.write8(0x2073, 0x00);
  m.mem.write8(0x20c1, 0x00);
  m.mem.write8(0x2069, 0x00);
  m.regs.sp = 0x23fc;
  m.mem.write16(0x23fc, 0x0526);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0571 ? 4 : c); // cpi 0x04 steps to 0x0571
  loc_0563(m);
  assert.notEqual(m.tstates, 92, "golden T-state total catches the mutant");
  assert.equal(m.tstates, 89);
});

// Arm 2: bit7 of [0x2073] set -> jnz 0x05c1 taken. Seat the compare helper 0x1a06 to return carry
// so `rnc` at 0x05c7 falls through; [0x2074]&1 != 0 -> `jnz 0x0644` delegates to the external head.
test("loc_0563 arm-2: jnz 0x05c1 -> call 0x1a06 -> delegate to 0x0644; 95 T", () => {
  const m = makeMachine();
  m.mem.write8(0x2073, 0x80); // bit7 set
  m.mem.write8(0x2074, 0x01); // ani 0x01 nonzero -> jnz 0x0644
  m.regs.sp = 0x2400;
  m.call = (addr) => { m.calls.push(addr); if (addr === 0x1a06) m.regs.fC = true; return undefined; };

  loc_0563(m);

  assert.equal(m.regs.de, 0x207c, "DE := 0x207c in the 0x05c1 block");
  assert.equal(m.regs.hl, 0x2074, "HL advanced by `inx h` at 0x05c8");
  assert.equal(m.regs.a, 0x01, "A = [0x2074] & 0x01");
  assert.equal(m.tstates, 95, "T: 34 (to jnz) + 10+17+5+5+7+7+10");
  assert.equal(m.pc, 0x0644, "final step lands at the external delegate");
  assert.deepEqual(m.calls, [0x1a06, 0x0644], "compare helper then delegate");
  assert.equal(m.regs.sp, 0x23fe, "one push16 (call 0x1a06), no matching ret");
  assert.equal(m.mem.read16(0x23fe), 0x05c7, "call 0x1a06 pushed return addr 0x05c7");
});

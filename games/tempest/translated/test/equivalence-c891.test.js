// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c891 (ROM 0xc891-0xc90b). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check. The three
// JSRs (loc_c81b, loc_de1b, loc_ccfa) are opaque here -- the harness records the call and does NOT run it,
// balancing the return it pushed. Covers: the $0c00&0x10 clear seed-then-c8e3 path, the $0a&1 -> jsr c81b
// path, the $05-bit6 early bvs, and the cpy>=2 (c8ca) + bcs-skips-sed path. Run: node --test .../c891.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c891 } from "../loc_c891.js";

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

test("loc_c891: $0c00&0x10 clear -> $00=0x22, jumps to c8e3; odd frame calls loc_de1b; 65 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  m.ram[0x0c00] = 0x00; // & 0x10 == 0 -> bne not taken -> seed path
  m.ram[0x03] = 0x00;   // inc -> 0x01 (odd) -> jsr de1b
  m.ram[0x0c] = 0x00;   // beq c8f5 -> no jsr ccfa
  m.ram[0x016c] = 0x00; // beq c901 -> no decimal check
  m.ram[0x4e] = 0x00;   // & 0x80 == 0 -> beq c90b (rts)

  loc_c891(m);

  assert.equal(m.ram[0x00], 0x22, "$00 seeded 0x22");
  assert.equal(m.ram[0x03], 0x01, "frame $03 incremented");
  assert.deepEqual(m.calls, [0xde1b], "odd frame -> jsr loc_de1b only");
  assert.equal(m.pc, 0x1001, "rts -> pushed + 1");
  assert.equal(m.cycles, 65, "seed + c8e3 tail total");
});

test("loc_c891: $0a&1 set, bit a2 set, Y=0 -> ... actually $0a&1==0 -> c8d2 -> jsr c81b; reseeds $06; 92 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000);
  m.ram[0x0c00] = 0x10; // & 0x10 set -> bne c89f
  m.ram[0x05] = 0x00;   // bit -> V clear -> bvs not taken
  m.ram[0x0a] = 0x00;   // & 1 == 0 -> beq c8d2
  m.ram[0x06] = 0x01;   // nonzero -> jsr c81b
  m.ram[0x09] = 0x04;   // & 3 == 0 -> reseed $06 = 2
  m.ram[0x03] = 0x00;   // inc -> odd -> jsr de1b
  m.ram[0x0c] = 0x00;   // no ccfa
  m.ram[0x016c] = 0x00; // no decimal check
  m.ram[0x4e] = 0x00;   // rts

  loc_c891(m);

  assert.equal(m.ram[0x06], 0x02, "$06 reseeded to 2 ($09&3==0)");
  assert.equal(m.ram[0x03], 0x01, "frame incremented");
  assert.deepEqual(m.calls, [0xc81b, 0xde1b], "jsr loc_c81b then odd-frame loc_de1b");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
  assert.equal(m.cycles, 92, "c8d2 jsr path total");
});

test("loc_c891: $05 bit6 set -> bvs c8e3 short path; no jsr c81b; 57 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x3000);
  m.ram[0x0c00] = 0x10; // bne c89f
  m.ram[0x05] = 0x40;   // bit -> V = bit6 = 1 -> bvs c8e3 taken
  m.ram[0x03] = 0x01;   // inc -> 0x02 (even) -> no de1b
  m.ram[0x0c] = 0x00;   // no ccfa
  m.ram[0x016c] = 0x00; // no decimal check
  m.ram[0x4e] = 0x00;   // rts
  m.ram[0x00] = 0x99;   // must stay untouched (seed path skipped)

  loc_c891(m);

  assert.equal(m.ram[0x00], 0x99, "$00 untouched (bvs skipped seed and gameplay branch)");
  assert.equal(m.ram[0x03], 0x02, "frame incremented to even");
  assert.deepEqual(m.calls, [], "even frame, no branches -> no jsr");
  assert.equal(m.pc, 0x3001, "rts -> pushed + 1");
  assert.equal(m.cycles, 57, "bvs short path total");
});

test("loc_c891: Y>=2 (c8ca) sets $00=0x14/$a2=0; $016c!=0 & $9f<=0x13 -> bcs skips sed; clears $4e; 127 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x4000);
  m.ram[0x0c00] = 0x10; // bne c89f
  m.ram[0x05] = 0x00;   // bvs not taken
  m.ram[0x0a] = 0x01;   // & 1 == 1 -> beq c8d2 not taken
  m.ram[0x06] = 0x03;   // Y = 3 -> bne c8b1 (skip F)
  m.ram[0xa2] = 0x80;   // bit a2 -> N set -> bpl not taken
  m.ram[0x09] = 0x01;   // & 3 != 0 -> no reseed
  m.ram[0x03] = 0x00;   // inc -> odd -> jsr de1b
  m.ram[0x0c] = 0x01;   // nonzero -> jsr ccfa
  m.ram[0x016c] = 0x01; // nonzero -> decimal check
  m.ram[0x9f] = 0x05;   // 0x13 >= 0x05 -> bcs c901 taken -> sed SKIPPED
  m.ram[0x4e] = 0x80;   // bit7 set -> clear $4e

  loc_c891(m);

  assert.equal(m.ram[0x00], 0x14, "c8ca: $00 = 0x14");
  assert.equal(m.ram[0xa2], 0x00, "c8ca: $a2 cleared");
  assert.equal(m.ram[0x06], 0x03, "$06 not reseeded ($09&3!=0)");
  assert.equal(m.regs.fD, false, "sed skipped (bcs taken: $9f <= 0x13) -> decimal clear");
  assert.equal(m.ram[0x4e], 0x00, "$4e cleared (bit7 was set)");
  assert.deepEqual(m.calls, [0xc81b, 0xde1b, 0xccfa], "jsr c81b (Y>=2 via c8d2), de1b, ccfa");
  assert.equal(m.pc, 0x4001, "rts -> pushed + 1");
  assert.equal(m.cycles, 127, "cpy>=2 full path total (bcs c8fe->c901 taken same-page = 3T)");
});

test("loc_c891: $016c!=0 & $9f>0x13 -> sed sets decimal mode", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0c00] = 0x10;
  m.ram[0x05] = 0x40;   // bvs c8e3 -> straight to the tail
  m.ram[0x03] = 0x01;   // even after inc -> no de1b
  m.ram[0x0c] = 0x00;
  m.ram[0x016c] = 0x01; // decimal check armed
  m.ram[0x9f] = 0x40;   // 0x13 < 0x40 -> bcs not taken -> sed runs
  m.ram[0x4e] = 0x00;

  loc_c891(m);

  assert.equal(m.regs.fD, true, "sed ran: decimal mode set ($9f > 0x13)");
});

test("loc_c891 MUTATION: mischarging the c8f8 beq-to-c901 as 3T (no page cross) blows the total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x6000);
  m.ram[0x0c00] = 0x00; // seed path, minimal
  m.ram[0x03] = 0x01;   // even -> no de1b
  m.ram[0x0c] = 0x00;
  m.ram[0x016c] = 0x00; // beq c901 taken (the page-cross branch under test)
  m.ram[0x4e] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, (n === 0xc901 && c === 4) ? 3 : c);
  loc_c891(m);
  // golden for this seed path = 60 T: 18 (prologue+seed+bvc c8e3) + 5+3+2+3 (c8e3..beq c8ee taken)
  //   + 3+3 (c8ee..beq c8f5 taken) + 4+4 (c8f5 lda + beq c901 taken pgcross) + 3+2+4 (c901..beq c90b) + 6 rts.
  // Mutating the c8f8->c901 page-cross branch from 4T to 3T drops the total to 59.
  assert.equal(m.cycles, 59, "the mischarged page-cross branch shows up as 59 (golden is 60)");
});

// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2962 (ROM 0x2962-0x2a90). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2962.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2962 } from "../loc_2962.js";

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

// Entity X=0, all $34/$44/$54/$64/$74 = 0, $F0=$EF=0, $0094=1: drives the mover down the "no-turn /
// still-empty" path 2962->2978->298c->29ac->29c1->29d7->29e2->29e6->2a03->2a1f->2a7a->2a81->2a8d, whose
// callees ($2310/$2c2b/$382d) are harness no-ops, and tail-exits via the 2a8e fall-through into loc_2a90.
// Author-derived cycle budget along that block chain = 236 T.
function setup(m) {
  m.regs.x = 0;
  m.ram[0x34] = 0x00; m.ram[0x00] = 0x01; m.ram[0x64] = 0x00; m.ram[0xf0] = 0x00;
  m.ram[0x88] = 0x00; m.ram[0x0094] = 0x01; m.ram[0x44] = 0x00; m.ram[0x74] = 0x00;
  m.ram[0x54] = 0x00; m.ram[0xef] = 0x00; m.ram[0x0035] = 0x00;
}

test("loc_2962: empty-path mover exits into loc_2a90 with A = -$74; 236 T", () => {
  const m = makeMachine();
  setup(m);

  loc_2962(m);

  assert.equal(m.ram[0x97], 0x01, "$97 <- Y(=1) on the CMP #$10 fall path");
  assert.equal(m.ram[0x44], 0x02, "$44+X <- 2 (positive delta seed)");
  assert.equal(m.ram[0x74], 0x02, "$74+X <- 2");
  assert.equal(m.ram[0x34], 0x00, "$34+X cleared of bit5 (AND #$df)");
  assert.equal(m.regs.a, 0xfe, "A = $64+X(0) - $74+X(2) = 0xFE (the SEC/SBC exit)");
  assert.equal(m.regs.x, 0x00, "X unchanged");
  assert.equal(m.regs.y, 0x00, "Y = $EF = 0 (last LDY before the exit)");
  assert.equal(m.regs.fC, false, "C clear: SBC borrowed (0 - 2)");
  assert.equal(m.regs.fN, true, "N set from 0xFE");
  assert.equal(m.cycles, 236, "236 T total");
  assert.equal(m.pc, 0x2a90, "tail-exits into loc_2a90");
  assert.deepEqual(m.calls, [0x2310, 0x2c2b, 0x382d, 0x2a90], "the path's JSRs, then the fall-through call");
});

test("loc_2962 MUTATION: the SBC exit step mischarged 5T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2a90 ? 5 : c); // the 2a8e SBC step lands at 0x2a90 (once)
  loc_2962(m);
  assert.notEqual(m.cycles, 236, "a mischarged cycle blows the golden T-state total");
});

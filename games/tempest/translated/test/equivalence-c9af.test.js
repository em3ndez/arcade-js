// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c9af (ROM 0xc9af-0xc9f0). Minimal 6502 harness; JSR $c9f1 opaque. Covers the
// ($48|$49==0 -> jsr c9f1 + rts) path, a single-pass slot-select path, and a path that iterates the $3f
// toggle loop once and hits the iny-wrap edge. Run:
//   node --test games/tempest/translated/test/equivalence-c9af.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c9af } from "../loc_c9af.js";

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

test("loc_c9af: $48|$49 == 0 after dec -> jsr c9f1, clv, bvc, rts; 39 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000); // rts -> 0x1001
  m.ram[0x3d] = 0x00; // X=0
  m.ram[0x48] = 0x01; // dec -> 0x00
  m.ram[0x49] = 0x00; // ora -> 0 -> bne not taken
  loc_c9af(m);
  assert.equal(m.ram[0x48], 0x00, "$48 decremented to 0");
  assert.equal(m.ram[0x04], 0x00, "$04 cleared");
  assert.equal(m.pc, 0x1001, "rts -> pushed+1");
  assert.deepEqual(m.calls, [0xc9f1], "jsr c9f1 only");
  assert.equal(m.cycles, 39, "jsr-c9f1 path T-state total");
});

test("loc_c9af: nonzero slot, single pass ($3e==0, slot occupied); 73 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.ram[0x3d] = 0x00; // X=0
  m.ram[0x48] = 0x03; // dec -> 0x02, ora with $49=0 -> nonzero -> bne taken
  m.ram[0x49] = 0x00;
  m.ram[0x3e] = 0x00; // beq at c9d3 taken (skip eor)
  m.ram[0x3f] = 0x00; // ldx $3f = 0
  m.ram[0x46] = 0x05; // ldy $46,x -> 0x05, iny -> 0x06 nonzero -> bne taken (skip #$1c)
  loc_c9af(m);
  assert.equal(m.ram[0x48], 0x02, "$48 decremented");
  assert.equal(m.ram[0x02], 0x02, "$02 = A(#$02)");
  assert.equal(m.ram[0x00], 0x0a, "$00 = 0x0a");
  assert.equal(m.ram[0x04], 0x00, "$04 stays 0 (bne at c9c7 skipped #$28)");
  assert.equal(m.regs.a, 0x0a, "A = 0x0a");
  assert.equal(m.regs.y, 0x06, "Y = iny result");
  assert.equal(m.pc, 0x2001, "rts");
  assert.deepEqual(m.calls, [], "no jsr on this path");
  assert.equal(m.cycles, 73, "single-pass T-state total");
});

test("loc_c9af: loop iterates once via $3f toggle, iny wraps to 0 -> #$1c; 104 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000); // rts -> 0x3001
  m.ram[0x3d] = 0x00;
  m.ram[0x48] = 0x03; // dec -> 0x02 (slot 0 occupied)
  m.ram[0x49] = 0x00; // slot 1 empty
  m.ram[0x3e] = 0x01; // nonzero -> beq at c9d3 not taken -> eor toggles $3f
  m.ram[0x3f] = 0x00; // toggles 0->1 (slot1 empty -> loop back), then 1->0 (slot0 occupied -> exit)
  m.ram[0x46] = 0xff; // ldy $46,x (x=0) -> 0xff, iny -> 0x00 -> bne not taken -> lda #$1c
  loc_c9af(m);
  assert.equal(m.ram[0x3f], 0x00, "$3f toggled twice -> back to 0");
  assert.equal(m.ram[0x02], 0x1c, "$02 = 0x1c (iny wrapped to 0)");
  assert.equal(m.ram[0x00], 0x0a, "$00 = 0x0a");
  assert.equal(m.regs.y, 0x00, "Y wrapped to 0");
  assert.equal(m.regs.a, 0x0a, "A = 0x0a");
  assert.equal(m.pc, 0x3001, "rts");
  assert.deepEqual(m.calls, [], "no jsr");
  assert.equal(m.cycles, 104, "loop-iterating T-state total");
});

// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ac20 (ROM 0xac20). Minimal 6502 harness; jsr d6bb recorded not run. The
// routine ends in a branch: match on both compares -> beq to the shared rts at $ac3e; any mismatch ->
// fall into loc_ac36. Both outcomes are tail-calls (no rts of its own).
// Run: node --test games/tempest/translated/test/equivalence-ac20.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ac20 } from "../loc_ac20.js";

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

test("loc_ac20: first compare mismatch -> bne to ac34 -> falls into loc_ac36; 20 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x0a, 0x38);   // & 0xf8 = 0x38
  m.mem.write8(0x071e, 0x00); // != 0x38 -> bne taken to ac34, Z clear -> beq not taken

  loc_ac20(m);

  assert.equal(m.pc, 0xac36, "mismatch -> fall into loc_ac36");
  assert.deepEqual(m.calls, [0xd6bb, 0xac36], "d6bb then tail into ac36");
  assert.equal(m.cycles, 6 + 3 + 2 + 4 + 3 + 2, "20 T (jsr, lda, and, cmp, bne taken, beq not-taken)");
});

test("loc_ac20: both compares match -> beq to shared rts ac3e; 30 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x0a, 0x30);   // & 0xf8 = 0x30
  m.mem.write8(0x071e, 0x30); // match -> bne not taken
  m.mem.write8(0x016a, 0x02); // & 3 = 0x02
  m.mem.write8(0x071f, 0x02); // match -> beq taken

  loc_ac20(m);

  assert.equal(m.pc, 0xac3e, "both match -> beq to shared rts ac3e");
  assert.deepEqual(m.calls, [0xd6bb, 0xac3e], "d6bb then tail to ac3e");
  assert.equal(m.cycles, 6 + 3 + 2 + 4 + 2 + 4 + 2 + 4 + 3, "30 T");
});

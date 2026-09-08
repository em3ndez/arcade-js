// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2f4f (ROM 0x2f4f-0x3031). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2f4f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2f4f } from "../loc_2f4f.js";

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

// Early-out path: $34,X = 0x80 lies in [0x76, 0xB9), so CMP #$76 (C set, BCC not taken) then
// CMP #$B9 (C clear, BCC $2FC2 taken) -> JMP $3031. No JSRs on this path.
test("loc_2f4f: mid-range $34,X bails to 0x3031 via the 0x2FC2 join; 16 T; JMP out", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0034] = 0x80; // $34,X in [0x76, 0xB9)

  loc_2f4f(m);

  assert.equal(m.regs.a, 0x80, "A holds $34,X untouched (CMP only)");
  assert.equal(m.regs.fC, false, "C clear from CMP #$B9 (0x80 < 0xB9)");
  assert.deepEqual(m.pcSeq, [0x2f51, 0x2f53, 0x2f55, 0x2f57, 0x2fc2, 0x3031], "the executed step boundaries");
  assert.deepEqual(m.calls, [0x3031], "JMP $3031 is the only transfer on this path");
  assert.equal(m.cycles, 4 + 2 + 2 + 2 + 3 + 3, "16 T");
  assert.equal(m.pc, 0x3031, "lands on the JMP target");
});

// Second early-out: $34,X = 0xF9 (>= 0xF8) -> CMP #$76 C set, CMP #$B9 C set (BCC skipped),
// CMP #$F8 C set -> BCS $2FC2 taken -> JMP $3031.
test("loc_2f4f: out-of-range high $34,X also bails via BCS $2FC2; 20 T", () => {
  const m = makeMachine();
  m.regs.x = 0x03;
  m.ram[0x0037] = 0xf9; // $34,X with X=3 -> $37

  loc_2f4f(m);

  assert.deepEqual(m.pcSeq, [0x2f51, 0x2f53, 0x2f55, 0x2f57, 0x2f59, 0x2f5b, 0x2fc2, 0x3031], "path through 0x2f5b BCS");
  assert.deepEqual(m.calls, [0x3031], "JMP $3031");
  assert.equal(m.cycles, 4 + 2 + 2 + 2 + 2 + 2 + 3 + 3, "20 T");
  assert.equal(m.pc, 0x3031, "lands on 0x3031");
});

test("loc_2f4f MUTATION: the BCS-taken branch mischarged 2T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.x = 0x03;
  m.ram[0x0037] = 0xf9;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2fc2 ? 2 : c); // the 0x2f5b BCS-taken step lands at 0x2fc2
  loc_2f4f(m);
  assert.notEqual(m.cycles, 20, "an undercharged taken branch blows the golden T-state total");
});

// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3049 (ROM 0x3049-0x3067). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3049.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3049 } from "../loc_3049.js";

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

// ($94,X | $87) == 0 -> BEQ $3061: INC $9c,X, $87 := $40, RTS.
test("loc_3049: zero branch bumps $9c,X and sets $87:=$40; 30 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x0088] = 0x02;   // X = 2
  m.ram[0x0096] = 0x00;   // $94+2 = 0 ...
  m.ram[0x0087] = 0x00;   // ... | $87 = 0 -> Z set
  m.ram[0x009e] = 0x10;   // $9c+2 pre-INC

  loc_3049(m);

  assert.equal(m.regs.x, 0x02, "X = $88");
  assert.equal(m.ram[0x009e], 0x11, "INC $9c,X");
  assert.equal(m.ram[0x0087], 0x40, "$87 := $40");
  assert.equal(m.regs.a, 0x40, "A = #$40");
  assert.deepEqual(m.calls, [], "no JSR on this path");
  assert.equal(m.cycles, 3 + 4 + 3 + 3 + 6 + 2 + 3 + 6, "30 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.pcSeq, [0x304b, 0x304d, 0x304f, 0x3061, 0x3063, 0x3065, 0x3067, 0x1234], "sequence");
});

// nonzero + $41^$ef >= $9c (C set) + DEC $9f -> 0 -> JSR $21c7 then RTS at $3060.
test("loc_3049: overflow path DECs $9f to zero and JSRs loc_21c7; 41 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0088] = 0x00;   // X = 0
  m.ram[0x0094] = 0x01;   // $94,X = 1 -> ORA nonzero -> BEQ not taken
  m.ram[0x0087] = 0x00;
  m.ram[0x0041] = 0xff;
  m.ram[0x00ef] = 0x00;   // $41 ^ $ef = 0xff, CMP #$9c -> C set (BCC not taken)
  m.ram[0x009f] = 0x01;   // DEC -> 0 (BNE not taken -> JSR $21c7)

  loc_3049(m);

  assert.equal(m.ram[0x009f], 0x00, "DEC $9f -> 0");
  assert.equal(m.regs.fZ, true, "Z from DEC result 0");
  assert.deepEqual(m.calls, [0x21c7], "JSR loc_21c7 on the zero-DEC path");
  assert.equal(m.cycles, 3 + 4 + 3 + 2 + 3 + 3 + 2 + 2 + 5 + 2 + 6 + 6, "41 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(
    m.pcSeq,
    [0x304b, 0x304d, 0x304f, 0x3051, 0x3053, 0x3055, 0x3057, 0x3059, 0x305b, 0x305d, 0x3060, 0x1234],
    "sequence",
  );
});

test("loc_3049 MUTATION: INC $9c,X mischarged 5T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0088] = 0x02;
  m.ram[0x0096] = 0x00;
  m.ram[0x0087] = 0x00;
  m.ram[0x009e] = 0x10;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3063 ? 5 : c); // INC $9c,X step lands at 0x3063
  loc_3049(m);
  assert.notEqual(m.cycles, 30, "a mischarged cycle blows the golden T-state total");
});

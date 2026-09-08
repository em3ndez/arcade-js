// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2059 (ROM 0x2059-0x20b8). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Branch-heavy leaf: several paths early-RTS via the shared 0x20e3 RTS in loc_20b8, and two paths
// tail into loc_20b8. Run: node --test games/centiped/translated/test/loc_2059.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2059 } from "../loc_2059.js";

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

test("loc_2059: $43 & $af non-zero -> early RTS at 2067; 14 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0043] = 0x01; // & 0xaf = 0x01 -> BNE $2067

  loc_2059(m);

  assert.equal(m.regs.a, 0x01, "A = $43 & $af");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.cycles, 3 + 2 + 3 + 6, "14 T: LDA 3 + AND 2 + BNE taken 3 + RTS 6");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no m.call on the early-RTS path");
});

test("loc_2059: BEQ-not-taken path adds $80 into $70 and JMPs (tail-calls) loc_20b8; 59 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0043] = 0x50; // & 0xaf = 0 -> BNE not taken
  m.ram[0x0040] = 0x00;
  m.ram[0x00ef] = 0x10; // $40^$ef = 0x10 < 0x20 -> BCC $2068; and non-zero -> BEQ not taken later
  m.ram[0x0070] = 0x00;
  m.ram[0x00f0] = 0x00; // $70^$f0 = 0 < 0xf8 -> BCC $2090
  m.ram[0x0000] = 0x01; // & 0x03 = 1 -> BNE $20a5 (skip the INC $40 block)
  m.ram[0x0060] = 0x42; // -> $8b
  m.ram[0x0080] = 0x07; // added into A

  loc_2059(m);

  assert.equal(m.ram[0x008b], 0x42, "$8b = $60");
  assert.equal(m.regs.a, 0x07, "A = $70(=0) + $80 with C clear");
  assert.equal(m.regs.y, 0x10, "Y = $ef");
  assert.equal(m.cycles, 59, "59 T to the JMP $20b8");
  assert.equal(m.pc, 0x20b8, "PC at loc_20b8 entry");
  assert.deepEqual(m.calls, [0x20b8], "tail-calls loc_20b8");
});

test("loc_2059: $9a,x >= $0c -> BCS to the shared 0x20e3 RTS in loc_20b8; 46 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0043] = 0x00; // BNE not taken
  m.ram[0x0040] = 0x00;
  m.ram[0x00ef] = 0x00; // $40^$ef = 0 < 0x20 -> BCC $2068
  m.ram[0x0070] = 0xff;
  m.ram[0x00f0] = 0x00; // $70^$f0 = 0xff >= 0xf8 -> BCC not taken -> 0x2070
  m.ram[0x0088] = 0x00; // X = 0
  m.ram[0x009a] = 0x20; // $9a,x = 0x20 >= 0x0c -> BCS $20e3

  loc_2059(m);

  assert.equal(m.regs.x, 0x00, "X = $88");
  assert.equal(m.cycles, 46, "46 T: ... BCS taken 3 + shared RTS 6");
  assert.equal(m.pc, 0x1234, "returns via the 0x20e3 RTS");
  assert.deepEqual(m.calls, [], "the 0x20e3 exit is a bare RTS, not a call");
});

test("loc_2059: BEQ-taken path subtracts $80 from $70 and falls through into loc_20b8; 57 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0043] = 0x50; // BNE not taken
  m.ram[0x0040] = 0x00;
  m.ram[0x00ef] = 0x00; // $40^$ef = 0 < 0x20 -> BCC $2068; and zero -> BEQ taken later
  m.ram[0x0070] = 0x00;
  m.ram[0x00f0] = 0x00; // BCC $2090
  m.ram[0x0000] = 0x01; // BNE $20a5
  m.ram[0x0060] = 0x42; // -> $8b
  m.ram[0x0080] = 0x07; // subtracted from A

  loc_2059(m);

  assert.equal(m.ram[0x008b], 0x42, "$8b = $60");
  assert.equal(m.regs.a, 0xf9, "A = 0 - $80 with SEC (0x00 - 0x07 = 0xF9)");
  assert.equal(m.regs.fC, false, "borrow -> C clear");
  assert.equal(m.regs.y, 0x00, "Y = $ef = 0");
  assert.equal(m.cycles, 57, "57 T to the SBC before the loc_20b8 fall-through");
  assert.equal(m.pc, 0x20b8, "PC at loc_20b8 entry");
  assert.deepEqual(m.calls, [0x20b8], "fall-through tail-calls loc_20b8");
});

test("loc_2059 MUTATION: a spurious BCC page-cross (2065 -> 4T not 3T) is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x0043] = 0x50;
  m.ram[0x0040] = 0x00;
  m.ram[0x00ef] = 0x10;
  m.ram[0x0070] = 0x00;
  m.ram[0x00f0] = 0x00;
  m.ram[0x0000] = 0x01;
  m.ram[0x0060] = 0x42;
  m.ram[0x0080] = 0x07;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2068 ? 4 : c); // 2065 BCC $2068 is same-page: no +1
  loc_2059(m);
  assert.notEqual(m.cycles, 59, "a spurious branch page-cross blows the golden T-state total");
});

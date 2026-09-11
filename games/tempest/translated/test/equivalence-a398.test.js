// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a398 (ROM 0xa398-0xa3c4). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam); JSRs opaque (recorded, return balanced), the terminal JMP 0xca6c is a tail-call (no push, PC
// left at target). Whole-machine boot-first diff vs MAME is the integration check.
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a398 } from "../loc_a398.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], _retPushed: false,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_a398: top-2 bits set -> decrement branch ($02b9,y - 1 & 0x0f -> $2d); tail JMP 0xca6c; 53 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.y = 0x00;
  m.ram[0x0283] = 0xc0; // $0283,0 & 0xc0 == 0xc0 -> BEQ taken (decrement arm)
  m.ram[0x02b9] = 0x05; // -1 (carry set by SEC) -> 0x04, & 0x0f -> 0x04
  m.ram[0xa3c5] = 0x33; // table[0] read by LDX 0xa3c5,y (y=0 after TAY)

  loc_a398(m);

  assert.equal(m.mem.read8(0x2d), 0x04, "$2d = ($02b9,y - 1) & 0x0f");
  assert.equal(m.regs.a, 0x00, "A = $0283,y & 0x07 = 0xc0 & 7 = 0");
  assert.equal(m.regs.y, 0x00, "Y = A after TAY = 0");
  assert.equal(m.regs.x, 0x33, "X = table[0] = 0x33");
  assert.deepEqual(m.calls, [0xa3ca, 0xa06f, 0xca6c], "two JSRs then tail-JMP 0xca6c");
  assert.equal(m.pc, 0xca6c, "PC left at the tail-JMP target");
  assert.equal(m.cycles, 4 + 2 + 2 + 3 + 4 + 2 + 2 + 2 + 3 + 2 + 6 + 6 + 4 + 2 + 2 + 4 + 3, "53 T");
});

test("loc_a398: top-2 bits clear -> straight copy ($02b9,y -> $2d via CLV/BVC skip); 51 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.y = 0x00;
  m.ram[0x0283] = 0x00; // & 0xc0 != 0xc0 -> BEQ not taken (copy arm)
  m.ram[0x02b9] = 0x07;
  m.ram[0xa3c5] = 0x44;

  loc_a398(m);

  assert.equal(m.mem.read8(0x2d), 0x07, "$2d = $02b9,y unchanged");
  assert.equal(m.regs.x, 0x44, "X = table[0] = 0x44");
  assert.deepEqual(m.calls, [0xa3ca, 0xa06f, 0xca6c], "same call sequence");
  assert.equal(m.pc, 0xca6c, "tail-JMP target");
  assert.equal(m.cycles, 4 + 2 + 2 + 2 + 4 + 2 + 3 + 3 + 2 + 6 + 6 + 4 + 2 + 2 + 4 + 3, "51 T");
});

test("loc_a398: abs,y page-carry adds a cycle to the first LDA", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.y = 0x7f;       // 0x0283 + 0x7f = 0x0302 -> crosses into page 0x0300
  m.ram[0x0283 + 0x7f] = 0x00; // copy arm
  m.ram[0x02b9 + 0x7f] = 0x09;
  m.ram[0xa3c5] = 0x00;  // $0302 & 7 = 2? -> ensure TAY index; here $0283,y=0 -> &7=0 -> y=0

  loc_a398(m);

  // All three 0x02xx-based abs,y reads (0x0283,y twice + 0x02b9,y) cross into the next page with
  // y=0x7f -> 5 each (+3 vs the 51 T non-cross copy path). The 0xa3c5,y read uses y=0 (post-TAY), no cross.
  assert.equal(m.cycles, 5 + 2 + 2 + 2 + 5 + 2 + 3 + 3 + 2 + 6 + 6 + 5 + 2 + 2 + 4 + 3, "54 T (three page-carries)");
});

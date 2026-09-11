// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9a88 (ROM 0x9a88) -- RTS-trick dispatch: Y=2*A indexes a (target-1) word table
// at 0x9a93 (lo) / 0x9a94 (hi); RTS jumps to word+1. Harness records the dispatched m.call. The word table
// is placed in the flat RAM at ROM addresses. Run: node --test games/tempest/translated/test/equivalence-9a88.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9a88 } from "../loc_9a88.js";

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

test("loc_9a88: A=1 -> Y=2, dispatch to word(0x9a95)+1; net-zero stack; 24 T", () => {
  const m = makeMachine();
  m.regs.a = 0x01;
  m.regs.s = 0xfd;
  // Y = 2*1 = 2. lda 0x9a94+2 = 0x9a96 (hi), lda 0x9a93+2 = 0x9a95 (lo). word = 0x1234 -> target 0x1235.
  m.ram[0x9a95] = 0x34; // lo
  m.ram[0x9a96] = 0x12; // hi
  loc_9a88(m);
  assert.equal(m.regs.y, 0x02, "Y = 2*A");
  assert.deepEqual(m.calls, [0x1235], "dispatched to (0x1234 + 1)");
  assert.equal(m.pc, 0x1235, "PC set to the dispatch target");
  assert.equal(m.regs.s, 0xfd, "stack pointer back to start (pushed 2, pulled 2)");
  assert.equal(m.cycles, 24, "2(asl)+2(tay)+4(lda)+3(pha)+4(lda)+3(pha)+6(rts)");
});

test("loc_9a88: A=0x81 -> asl sets carry, Y = 2 (0x102 & 0xff)", () => {
  const m = makeMachine();
  m.regs.a = 0x81;
  m.regs.s = 0xfd;
  // asl 0x81 -> 0x02, C set; Y = 2. Same table slot 0x9a95/0x9a96 -> target 0x1235.
  m.ram[0x9a95] = 0x00; // lo
  m.ram[0x9a96] = 0xc0; // hi -> word 0xc000, target 0xc001
  loc_9a88(m);
  assert.equal(m.regs.y, 0x02, "asl 0x81 = 0x02 (bit7 shifted out to carry)");
  assert.equal(m.regs.fC, true, "carry from asl 0x81");
  assert.deepEqual(m.calls, [0xc001], "dispatched to 0xc000 + 1");
});

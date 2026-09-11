// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9b98 (ROM 0x9b98) -- RTS-trick dispatch: Y=A indexes a (target-1) word table at
// 0x9ba2 (lo) / 0x9ba3 (hi); RTS jumps to word+1. Harness records the dispatched m.call.
// Run: node --test games/tempest/translated/test/equivalence-9b98.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9b98 } from "../loc_9b98.js";

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

test("loc_9b98: A=3 -> Y=3, dispatch to word(0x9ba5)+1; net-zero stack; 22 T", () => {
  const m = makeMachine();
  m.regs.a = 0x03;
  m.regs.s = 0xfd;
  // Y = 3. lda 0x9ba3+3 = 0x9ba6 (hi), lda 0x9ba2+3 = 0x9ba5 (lo). word 0xabcd -> target 0xabce.
  m.ram[0x9ba5] = 0xcd; // lo
  m.ram[0x9ba6] = 0xab; // hi
  loc_9b98(m);
  assert.equal(m.regs.y, 0x03, "Y = A");
  assert.deepEqual(m.calls, [0xabce], "dispatched to 0xabcd + 1");
  assert.equal(m.pc, 0xabce, "PC set to dispatch target");
  assert.equal(m.regs.s, 0xfd, "stack pointer restored (pushed 2, pulled 2)");
  assert.equal(m.cycles, 22, "2(tay)+4(lda)+3(pha)+4(lda)+3(pha)+6(rts)");
});

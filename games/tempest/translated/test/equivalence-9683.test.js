// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9683 (ROM 0x9683) -- RTS-dispatch (computed JMP) through the $969d/$969e
// pointer table indexed by $015e. The pha/pha/rts tail-calls the handler at pointer+1: no return is
// pushed for it (stack untouched) and the seam m.call's the target. Run: node --test .../equivalence-9683.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9683 } from "../loc_9683.js";

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

test("loc_9683: index 1 -> tail-call handler at pointer+1 = 0x5679, 24 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x015e, 0x01);
  m.mem.write8(0x969d + 1, 0x78); // lo byte at $969e
  m.mem.write8(0x969e + 1, 0x56); // hi byte at $969f

  loc_9683(m);

  assert.equal(m.regs.x, 0x01, "X = $015e");
  assert.deepEqual(m.calls, [0x5679], "tail-calls handler at pointer 0x5678 + 1");
  assert.equal(m.pc, 0x5679, "stepped to pointer+1 for the rts jump");
  assert.equal(m.regs.a, 0x78, "A = low byte (last lda), setNZ(low)");
  assert.equal(m.regs.s, 0xfd, "no return pushed for the target -> stack untouched");
  assert.equal(m.cycles, 24, "4 + 4 + 3 + 4 + 3 + 6");
});

test("loc_9683: index 0 -> pointer at $969d/$969e", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x015e, 0x00);
  m.mem.write8(0x969d, 0x00); // lo
  m.mem.write8(0x969e, 0x90); // hi

  loc_9683(m);

  assert.deepEqual(m.calls, [0x9001], "tail-call to 0x9000 + 1");
  assert.equal(m.pc, 0x9001, "0x9000 + 1 = 0x9001");
});

// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_926f (ROM 0x926f-0x928e) -- zero $02df..$02e5 and seven scattered $01xx cells. Run:
//   node --test games/tempest/translated/test/equivalence-926f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_926f } from "../loc_926f.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_926f: zeroes $02df..$02e5 and the seven $01xx cells; 107 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000);
  for (let a = 0x02df; a <= 0x02e5; a++) m.ram[a] = 0x77;
  for (const a of [0x0108, 0x0109, 0x0145, 0x0142, 0x0144, 0x0143, 0x0146]) m.ram[a] = 0x77;
  loc_926f(m);
  for (let a = 0x02df; a <= 0x02e5; a++) assert.equal(m.mem.read8(a), 0x00, `zeroed ${a.toString(16)}`);
  for (const a of [0x0108, 0x0109, 0x0145, 0x0142, 0x0144, 0x0143, 0x0146]) assert.equal(m.mem.read8(a), 0x00, `zeroed ${a.toString(16)}`);
  assert.equal(m.mem.read8(0x02e6), 0x00, "one past the block untouched (was 0)");
  assert.equal(m.regs.x, 0xff, "x underflowed at loop exit");
  assert.equal(m.pc, 0x5001, "rts -> pushed+1");
  assert.equal(m.cycles, 2 + 2 + (6 * 10 + 9) + 7 * 4 + 6, "107 T");
});

// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b1b6 (ROM 0xb1b6). Frame housekeeping: jsr 0xc1c3; early-rts when
// $2000==$cec6 && $0133==0; if $01==0 tail-jmp 0xb230; else b2be/b332 (bcs skip), b20d, a checksum
// loop over ($b6),y into $0455, b2fe, then copy $cec4/$cec5 -> $2000/$2001. The callees are opaque
// (harness records the m.call); the b332 test path models its carry-clear return. Minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-b1b6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b1b6 } from "../loc_b1b6.js";

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

test("loc_b1b6: $2000==$cec6 && $0133==0 -> early rts; 28 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.ram[0x2000] = 0x33; m.ram[0xcec6] = 0x33; // equal -> bne not taken
  m.ram[0x0133] = 0x00; // zero -> bne not taken -> rts
  loc_b1b6(m);
  assert.equal(m.pc, 0x1234, "early rts to pushed+1");
  assert.deepEqual(m.calls, [0xc1c3], "only the leading jsr 0xc1c3 ran");
  assert.equal(m.cycles, 6 + 4 + 4 + 2 + 4 + 2 + 6, "28 T");
});

test("loc_b1b6: $01==0 -> tail-jmp 0xb230; 28 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x2000] = 0x01; m.ram[0xcec6] = 0x02; // not equal -> bne taken to b1c7
  m.ram[0x01] = 0x00; // -> beq b209 -> jmp b230
  loc_b1b6(m);
  assert.equal(m.pc, 0xb230, "tail-jmp lands at 0xb230");
  assert.deepEqual(m.calls, [0xc1c3, 0xb230], "jsr 0xc1c3 then tail-call 0xb230");
  assert.equal(m.cycles, 6 + 4 + 4 + 3 + 3 + 2 + 3 + 3, "28 T");
});

test("loc_b1b6: full path, carry-clear from b332, $016e!=0 -> checksum loop; 506 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x00fe); // rts -> 0x00ff
  m.ram[0x2000] = 0x01; m.ram[0xcec6] = 0x02; // not equal -> to b1c7
  m.ram[0x01] = 0x07; // != 0 -> continue past beq b209
  m.ram[0x016e] = 0x05; // != 0 -> run the loop
  m.ram[0xb6] = 0x00; m.ram[0xb7] = 0x06; // ($b6) -> 0x0600, data region left 0x00
  m.ram[0xcec4] = 0x77; m.ram[0xcec5] = 0x88; // copied to $2000/$2001 at the end
  // Model b332's real carry-clear return so the bcs at b1d5 falls through into the loop.
  const realCall = m.call.bind(m);
  m.call = (a) => { if (a === 0xb332) m.regs.fC = false; return realCall(a); };
  loc_b1b6(m);
  // Loop: A starts 0x0e, sec, sbc 0 x40 (A unchanged) -> tay(0x0e) -> eor #e5 -> 0xeb -> eor #29 -> 0xc2
  assert.equal(m.ram[0x0455], 0xc2, "$0455 = checksum 0x0e ^ 0xe5 ^ 0x29 = 0xc2");
  assert.equal(m.ram[0x2000], 0x77, "$2000 := $cec4");
  assert.equal(m.ram[0x2001], 0x88, "$2001 := $cec5");
  assert.equal(m.pc, 0x00ff, "rts to pushed+1");
  assert.deepEqual(m.calls, [0xc1c3, 0xb2be, 0xb332, 0xb20d, 0xb2fe], "callees dispatched in ROM order");
  assert.equal(m.cycles, 506, "golden T-state total for the full loop path");
});

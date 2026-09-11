// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_98a2 (ROM 0x98a2-0x9922) -- the $0243 slot-timer scan (x=0x3f..0). Minimal 6502
// harness (Regs + flat RAM + page-1 stack seam); JSR $9923 is opaque (recorded, not run). The 64-entry loop
// and every intra-routine branch are exercised. Run: node --test games/tempest/translated/test/equivalence-98a2.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_98a2 } from "../loc_98a2.js";

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

// Common header state: A+carry sum stays below $011c so y=0, $0125==0 -> y=0, $2f=0.
function seedHeader(m) {
  m.regs.s = 0xfd;
  m.push16(0x4000); // RTS -> 0x4001
  m.ram[0x0108] = 0x01;
  m.ram[0x0109] = 0x01; // 0x01+0x01 = 0x02
  m.ram[0x011c] = 0x10; // 0x02 < 0x10 -> BCC taken, y stays 0
  m.ram[0x0125] = 0x00; // BEQ taken, y stays 0
}

test("loc_98a2: all timers zero -> BEQ skip every slot, $0150 = $014f = 0; 943 T", () => {
  const m = makeMachine();
  seedHeader(m);

  loc_98a2(m);

  assert.equal(m.ram[0x2f], 0x00, "$2f seeded 0 (y was 0)");
  assert.equal(m.ram[0x0150], 0x00, "$0150 = accumulated mask = 0");
  assert.equal(m.pc, 0x4001, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no slot expired -> no JSR $9923");
  // 35 header + 63*14 (BEQ-skip, BPL taken) + 12 (last, BPL fall) + 14 tail
  assert.equal(m.cycles, 35 + 63 * 14 + 12 + 14, "943 T");
});

test("loc_98a2: one active slot ages 5 -> 4, no expiry; 978 T", () => {
  const m = makeMachine();
  seedHeader(m);
  m.ram[0x0243 + 0x10] = 0x05; // slot 0x10 timer = 5

  loc_98a2(m);

  assert.equal(m.ram[0x0243 + 0x10], 0x04, "timer decremented 5 -> 4");
  assert.equal(m.ram[0x0150], 0x00, "still no mask bits (timer < 0x20)");
  assert.deepEqual(m.calls, [], "4 != 0 -> no JSR $9923");
  // 62*14 + 12 (last) + 49 (aging slot: two taken branches cross a page -- 98f3 bcc->9909 and 991a bpl->98c2 -- 4T each) + 49 (header 35 + tail 14)
  assert.equal(m.cycles, 62 * 14 + 12 + 49 + 49, "978 T");
});

test("loc_98a2: slot timer 1 expires to 0 -> JSR $9923 fires; 983 T", () => {
  const m = makeMachine();
  seedHeader(m);
  m.ram[0x0243 + 0x10] = 0x01; // slot 0x10 timer = 1 -> sbc 1 -> 0

  loc_98a2(m);

  assert.equal(m.ram[0x0243 + 0x10], 0x00, "timer hit 0 (written before the JSR)");
  assert.deepEqual(m.calls, [0x9923], "expiry calls loc_9923");
  assert.equal(m.ram[0x0150], 0x00, "value 0 -> BCC skips mask accumulation");
  // 62*14 + 12 (last) + 54 (expiry slot w/ JSR path) + 49
  assert.equal(m.cycles, 62 * 14 + 12 + 54 + 49, "983 T");
});

test("loc_98a2 MUTATION: a mischarged loop LDA (5T not 4T) blows the golden total", () => {
  const m = makeMachine();
  seedHeader(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x98c5 ? 5 : c); // the LDA $0243,x step lands PC at 0x98c5
  loc_98a2(m);
  assert.notEqual(m.cycles, 943, "over-charging the per-slot LDA breaks the T-state total");
});

// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_db0f (ROM 0xdb0f-0xdb21). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// loc_db0f is an rts-trampoline: it pushes hi(@$db02,x)/lo(@$db01,x) then rts-dispatches to (pushed)+1.
// The correct seam behavior is to CALL that computed target (m.call), not to return to the caller (m.ret) --
// so the test seeds the $db01/$db02 table and asserts the computed handler address is m.call'd.
// Run: node --test games/tempest/translated/test/equivalence-db0f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_db0f } from "../loc_db0f.js";

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
    // The dispatch seam: record the target so the test can prove it was invoked.
    call(target) { this.calls.push(target & 0xffff); return target & 0xffff; },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_db0f: in-range index -> dispatches table[x]+1 via m.call; 28 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x00] = 0x04; // index < 0x0e -> used as-is
  // table entry at $db01+4=$db05 (lo), $db02+4=$db06 (hi): 0x33/0x12 -> pushed 0x1233 -> rts +1 = 0x1234
  m.ram[0xdb05] = 0x33;
  m.ram[0xdb06] = 0x12;

  loc_db0f(m);

  assert.equal(m.regs.x, 0x04, "X = index unchanged when < 0x0e");
  assert.equal(m.mem.read8(0x00), 0x04, "$00 untouched on the in-range path");
  assert.deepEqual(m.calls, [0x1234], "dispatches (hi<<8|lo)+1 = 0x1234 exactly once via m.call");
  assert.equal(m.regs.s, 0xfd, "stack fully unwound: the two pushed bytes are pulled back off");
  assert.equal(m.cycles, 3 + 2 + 3 + 4 + 3 + 4 + 3 + 6, "ldx3 cpx2 bcc-taken3 lda4 pha3 lda4 pha3 rts6 = 28");
});

test("loc_db0f: index >= 0x0e clamps X to 2, writes $00, dispatches table[2]+1 via m.call", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x00] = 0x20; // >= 0x0e -> clamp to 2
  m.ram[0xdb03] = 0x00; // $db01+2 lo
  m.ram[0xdb04] = 0xa0; // $db02+2 hi -> 0xa000 -> +1 = 0xa001
  m.ram[0xdb05] = 0xff; m.ram[0xdb06] = 0xff; // guard: the index-4 slot must NOT be used

  loc_db0f(m);

  assert.equal(m.regs.x, 0x02, "X clamped to 2");
  assert.equal(m.mem.read8(0x00), 0x02, "$00 rewritten to 2 on the clamp path");
  assert.deepEqual(m.calls, [0xa001], "dispatches table[2]+1 = 0xa001 via m.call (not the index-4 slot)");
  assert.equal(m.regs.s, 0xfd, "stack fully unwound");
  assert.equal(m.cycles, 3 + 2 + 2 + 2 + 3 + 4 + 3 + 4 + 3 + 6, "clamp path adds ldx2 stx3");
});

test("loc_db0f: boundary index 0x0d stays in range (bcc taken), 0x0e clamps", () => {
  const inRange = makeMachine();
  inRange.regs.s = 0xfd;
  inRange.ram[0x00] = 0x0d;
  inRange.ram[0xdb0e] = 0x00; inRange.ram[0xdb0f] = 0x50; // $db01+d / $db02+d
  loc_db0f(inRange);
  assert.equal(inRange.regs.x, 0x0d, "0x0d < 0x0e -> in range");
  assert.deepEqual(inRange.calls, [0x5001], "table[0x0d]+1 dispatched via m.call");

  const clamped = makeMachine();
  clamped.regs.s = 0xfd;
  clamped.ram[0x00] = 0x0e; // first value that clamps
  clamped.ram[0xdb03] = 0x40; clamped.ram[0xdb04] = 0x70; // table[2] -> 0x7040 +1 = 0x7041
  loc_db0f(clamped);
  assert.equal(clamped.regs.x, 0x02, "0x0e >= 0x0e -> clamped to 2");
  assert.deepEqual(clamped.calls, [0x7041], "clamped path dispatches table[2]+1 via m.call");
});

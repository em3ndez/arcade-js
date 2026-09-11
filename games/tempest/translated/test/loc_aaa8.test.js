// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aaa8 (ROM 0xaaa8-0xaaf2). Minimal 6502 harness (Regs + flat RAM + page-1
// stack seam), author-derived. The sub-draws (loc_ab14, loc_aeca, loc_af77, loc_df39) are opaque --
// the harness records each call, does not run it -- so we assert the driver's own state and the exact
// ordered call list. Run: node --test .../loc_aaa8.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aaa8 } from "../loc_aaa8.js";

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

test("loc_aaa8: $0a&1==0 -> calls loc_aeca; $06>0x28 clamped; $17!=0 -> loc_df39; 98 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.regs.y = 0x00;
  m.push16(0x7000);          // rts -> 0x7001
  m.ram[0x09] = 0x00;        // ($09&3)=0
  m.ram[0xa8b0] = 0x20;      // table[0] -> X = 0x20 for the first loc_ab14
  m.ram[0x016e] = 0x05;
  m.ram[0x0a] = 0x00;        // $0a&1 == 0 -> beq taken -> loc_aeca
  m.ram[0x06] = 0x30;        // > 0x28 -> clamped to 0x28
  m.ram[0x17] = 0x01;        // != 0 -> loc_df39
  m.ram[0xaaf4] = 0x11; m.ram[0xaaf3] = 0x22;

  loc_aaa8(m);

  assert.equal(m.ram[0x016e], 0x04, "dec $016e");
  assert.equal(m.ram[0x06], 0x28, "$06 clamped to 0x28");
  assert.equal(m.regs.a, 0x11, "A <- $aaf4");
  assert.equal(m.regs.x, 0x22, "X <- $aaf3");
  assert.deepEqual(m.calls, [0xab14, 0xaeca, 0xab14, 0xab14, 0xaf77, 0xdf39], "ordered draw calls (aeca path)");
  assert.equal(m.pc, 0x7001, "rts -> pushed + 1");
  assert.equal(m.cycles, 98, "aeca-path total");
});

test("loc_aaa8: $0a&1 & !($03&0x20) -> loc_ab14(#$32)+bvc skip aeca; $06<0x28 no clamp; $17==0 -> rts; 94 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.regs.y = 0x00;
  m.push16(0x8000);          // rts -> 0x8001
  m.ram[0x09] = 0x01;        // ($09&3)=1
  m.ram[0xa8b1] = 0x10;      // table[1] -> X = 0x10
  m.ram[0x016e] = 0x01;
  m.ram[0x0a] = 0x01;        // $0a&1 != 0 -> beq not taken
  m.ram[0x03] = 0x00;        // $03&0x20 == 0 -> bne not taken -> ldx #$32 path
  m.ram[0x06] = 0x10;        // < 0x28 -> bcc taken (no clamp)
  m.ram[0x17] = 0x00;        // == 0 -> beq taken -> rts (no df39)

  loc_aaa8(m);

  assert.equal(m.ram[0x016e], 0x00, "dec $016e");
  assert.equal(m.ram[0x06], 0x10, "$06 not clamped");
  assert.equal(m.regs.a, 0x00, "A <- $17 (0)");
  assert.equal(m.regs.x, 0x2e, "X last set #$2e (df39 branch skipped)");
  assert.deepEqual(m.calls, [0xab14, 0xab14, 0xab14, 0xab14, 0xaf77], "aeca skipped, df39 skipped");
  assert.equal(m.pc, 0x8001, "rts -> pushed + 1");
  assert.equal(m.cycles, 94, "ldx-#$32 / bvc-skip / rts path total");
});

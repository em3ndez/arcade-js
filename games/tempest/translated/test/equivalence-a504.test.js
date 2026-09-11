// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a504 (ROM 0xa504-0xa5ca). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam); JSRs opaque (recorded, return balanced). $0201's sign selects the two arms; CLV/BVC pairs and
// the several jumps to the terminal RTS are exercised. Whole-machine boot-first diff vs MAME is the check.
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a504 } from "../loc_a504.js";

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

test("loc_a504: negative arm, $0135|$a6|$0116 nonzero -> BNE 0xa57e -> CLV/BVC -> RTS; 31 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x0201] = 0x80; // negative -> BPL not taken
  m.ram[0x0135] = 0x01; // nonzero -> BNE 0xa57e taken (no shot-aging)
  m.ram[0x00a6] = 0x00;
  m.ram[0x0116] = 0x00;

  loc_a504(m);

  assert.equal(m.regs.a, 0x01, "A = $0135 | $a6 | $0116 = 0x01");
  assert.deepEqual(m.calls, [], "no JSR on this path");
  assert.equal(m.pc, 0x3001, "RTS -> pushed + 1");
  assert.equal(m.cycles, 4 + 2 + 4 + 3 + 4 + 3 + 2 + 3 + 6, "31 T");
});

test("loc_a504: positive arm, $0106 nonzero -> BNE 0xa5ca -> RTS; 31 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3100);
  m.ram[0x0201] = 0x00; // non-negative -> BPL 0xa581 taken
  m.ram[0x0455] = 0x00;
  m.ram[0x011b] = 0x00; // -> BEQ 0xa593
  m.ram[0x0106] = 0x01; // nonzero -> BNE 0xa5ca taken

  loc_a504(m);

  assert.equal(m.regs.a, 0x01, "A = $0106 = 0x01");
  assert.deepEqual(m.calls, [], "no JSR on this path");
  assert.equal(m.pc, 0x3101, "RTS -> pushed + 1");
  assert.equal(m.cycles, 4 + 3 + 4 + 4 + 3 + 4 + 3 + 6, "31 T");
});

test("loc_a504: negative arm, shot loop (one entry, zero) + $02 advance, clamp -> BCC 0xa57e; 76 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3200);
  m.ram[0x0201] = 0x80; // negative arm
  m.ram[0x0135] = 0x00;
  m.ram[0x00a6] = 0x00;
  m.ram[0x0116] = 0x00; // -> continue past BNE 0xa57e
  m.ram[0x011c] = 0x00; // X = 0 -> loop runs once (dex -> 0xff exits)
  m.ram[0x02df] = 0x00; // $02df,0 == 0 -> BEQ 0xa529 (no aging store)
  m.ram[0x003d] = 0x00; // X = $3d = 0
  m.ram[0x0048] = 0x00; // $48,0 != 1 -> BNE 0xa554 ($0202 advance arm)
  m.ram[0x0202] = 0x00; // +0x0f = 0x0f, no carry, < 0xf0 -> BCC 0xa57e

  loc_a504(m);

  assert.equal(m.mem.read8(0x0202), 0x0f, "$0202 advanced by 0x0f");
  assert.equal(m.regs.a, 0x0f, "A holds the advanced value");
  assert.deepEqual(m.calls, [], "the 0x928f JSR is on the other branch");
  assert.equal(m.pc, 0x3201, "RTS -> pushed + 1");
  assert.equal(m.cycles,
    4 + 2 + 4 + 3 + 4 + 2 + 4          // a504..a513 (into arm)
    + 4 + 3 + 2 + 2                    // a516 lda,x=0 / a519 beq taken / a529 dex / a52a bpl exit
    + 3 + 4 + 2 + 3                    // a52c ldx 3d / a52e lda 48,x / a530 cmp / a532 bne taken
    + 4 + 2 + 2 + 4 + 2 + 2 + 3        // a554..a561 (advance $0202, BCC 0xa57e taken)
    + 2 + 3 + 6,                       // a57e clv / a57f bvc / a5ca rts
    "76 T");
});

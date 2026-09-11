// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9b1e (ROM 0x9b1e). Two paths: (1) $0201<0 (bmi) skips the loop straight to the
// signed-accumulate tail; (2) the outer/inner loop over $37/$010b that calls loc_9b98 per entry. loc_9b98
// is opaque -- the override clears $010a so the inner loop terminates (its real dispatch target does).
// Run: node --test games/tempest/translated/test/equivalence-9b1e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9b1e } from "../loc_9b1e.js";

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

test("loc_9b1e: $0201<0 (bmi) -> tail, sum 0+0 stays in [0x0f,0xc1], no negate; no calls; 51 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000); // final rts -> 0x4001
  m.ram[0x0201] = 0x80; // bit7 set -> bmi taken
  m.ram[0x0148] = 0x00;
  m.ram[0x0147] = 0x00;
  loc_9b1e(m);
  assert.equal(m.ram[0x0148], 0x00, "sty $0148 wrote the (0+0) sum");
  assert.equal(m.ram[0x0147], 0x00, "$0147 not negated (0x00 in [0x0f? no] -> cmp #0x0f gives C clear -> falls to rts via bvc)");
  assert.deepEqual(m.calls, [], "no cd06/cd02 on this branch");
  assert.equal(m.pc, 0x4001, "final rts -> pushed + 1");
  assert.equal(m.cycles, 51, "4+3 + 4+2+4+2+4+4+3 + 4+2+2+2+2+3 + 6");
});

test("loc_9b1e: outer loop one nonzero slot -> inner loop calls loc_9b98 once, writes $0291,x", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.ram[0x0201] = 0x00;   // bmi not taken -> enter loop
  m.ram[0x011c] = 0x00;   // outer index start = 0 (single pass: 0 then dec -> -1 exits)
  m.ram[0x02df] = 0x01;   // slot 0 nonzero -> enter inner block
  m.ram[0x0291] = 0x05;   // $010b start
  // tail cells left 0 -> clean rts path
  const realCall = m.call.bind(m);
  m.call = (a) => { if (a === 0x9b98) m.ram[0x010a] = 0x00; return realCall(a); }; // dispatch target ends the loop
  loc_9b1e(m);
  assert.deepEqual(m.calls, [0x9b98], "inner loop dispatched loc_9b98 once, then $010a==0 exits");
  assert.equal(m.ram[0x010b], 0x06, "$010b incremented from 5 to 6");
  assert.equal(m.ram[0x0291], 0x06, "sta $0291,x wrote final $010b");
  assert.equal(m.ram[0x37] & 0xff, 0xff, "dec $37 wrapped 0 -> 0xff (N set) -> outer loop exits");
  assert.equal(m.pc, 0x4001, "final rts -> pushed + 1");
});

test("loc_9b1e: tail negate path -- $0148 result >= 0xc1 negates $0147", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.ram[0x0201] = 0x80;   // skip loop
  m.ram[0x0148] = 0xc0;
  m.ram[0x0147] = 0x02;   // sum 0xc0+0x02 = 0xc2 -> eor 0xc0 = 0x02 (N clear) -> bpl 9b7c
  // 9b7c lda 0148=0xc2 -> bmi 9b88 (N set); cmp #0xc1 -> 0xc2>=0xc1 C set -> bcs 9b97 (no negate)
  loc_9b1e(m);
  assert.equal(m.ram[0x0148], 0xc2, "sum written");
  assert.equal(m.ram[0x0147], 0x02, "0xc2 >= 0xc1 -> bcs to rts, $0147 NOT negated");
});

test("loc_9b1e: tail negate path -- 0x0f<=result<0xc1 two's-complement negates $0147", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.ram[0x0201] = 0x80;
  m.ram[0x0148] = 0x40;
  m.ram[0x0147] = 0x10;  // sum 0x50 -> eor 0x40 = 0x10 (N clear) -> bpl 9b7c; lda 0148=0x50 (N clear) not bmi;
                         // cmp #0x0f -> 0x50 >= 0x0f -> C set -> bcs 9b8c -> negate $0147.
  loc_9b1e(m);
  assert.equal(m.ram[0x0148], 0x50, "sum 0x40+0x10 written to $0148");
  assert.equal(m.ram[0x0147], 0xf0, "$0147 negated: -(0x10) = 0xf0 (eor 0xff + 1)");
});

test("loc_9b1e: tail no-negate -- result 0x08 < 0x0f falls to rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.ram[0x0201] = 0x80;
  m.ram[0x0148] = 0x05;
  m.ram[0x0147] = 0x03;  // sum 0x08 -> eor 0x05 = 0x0d (N clear) -> bpl 9b7c; lda 0148=0x08 (N clear);
  loc_9b1e(m);
  // 0x08 < 0x0f: bcs not taken -> clv; bvc 0x9b97 -> rts, no negate.
  assert.equal(m.ram[0x0147], 0x03, "0x08 < 0x0f -> falls to rts, no negate");
});

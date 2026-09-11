// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_da62 (ROM 0xda62) -- the SELF-TEST main loop. The routine NEVER returns in
// hardware (daf5 loops to da8d while the self-test switch is unchanged; daf7 is a forever-hang), so we
// cannot let it run free. The harness bounds execution to ONE full main-loop iteration by throwing a
// sentinel on the SECOND write to $5800 (the AVG-reset pulse fires exactly once per iteration, early),
// then asserts the writes / call sequence / cycles accrued through that first iteration.
//
// The two sync spins on $0c00 (bit7 = video sync) are made to terminate by toggling bit7 on each read;
// bit6 (V) and bit4 (self-test switch) are held clear so the drain exits via Y underflow and the outer
// loop always takes `beq 0xda8d`.
// Run: node --test games/tempest/translated/test/equivalence-da62.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_da62 } from "../loc_da62.js";

const STOP = Symbol("stop-after-one-iteration");
const COLOR_TABLE = [0x00, 0x04, 0x08, 0x0c, 0x03, 0x07, 0x0b, 0x0b]; // ROM $daf9..$db00

function makeMachine({ boundOn5800 = 2 } = {}) {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  // Seed the color table the copy loop reads from $daf9,x.
  for (let i = 0; i < COLOR_TABLE.length; i++) ram[0xdaf9 + i] = COLOR_TABLE[i];
  let tick = 0;
  let count5800 = 0;
  const kicks5000 = []; // value (=A) of every watchdog $5000 write, in order
  const mem = {
    read8: (a) => {
      a &= 0xffff;
      // $0c00: toggle bit7 each read so bmi/bpl spins consume 2 reads; bit6/bit4 held clear.
      if (a === 0x0c00) return (tick++ & 1) ? 0x80 : 0x00;
      return ram[a];
    },
    write8: (a, v) => {
      a &= 0xffff;
      if (a === 0x5000) kicks5000.push(v & 0xff);
      if (a === 0x5800) { count5800++; if (count5800 >= boundOn5800) throw STOP; }
      ram[a] = v & 0xff;
    },
  };
  return {
    regs, mem, ram, kicks5000, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    call(target) { this.calls.push(target); }, // record the JSR target; do not execute it
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

function runBounded(m) {
  try { loc_da62(m); assert.fail("loc_da62 returned -- expected a non-terminating loop"); }
  catch (e) { if (e !== STOP) throw e; }
}

test("loc_da62: preamble + one main-loop iteration ($01c9 == 0 -> ddf1 skipped)", () => {
  const m = makeMachine();
  m.regs.a = 0x55; // arbitrary; da62's jsr de11 result is not modeled (m.call is a no-op recorder)
  m.ram[0x01c9] = 0x00; // beq da76 taken -> ddf1 branch skipped, Y stays 0x02

  runBounded(m);

  // preamble: color table copied to colorram $0800-$0807
  for (let i = 0; i < COLOR_TABLE.length; i++)
    assert.equal(m.ram[0x0800 + i], COLOR_TABLE[i], `colorram $080${i.toString(16)}`);
  assert.equal(m.ram[0x00], 0x02, "sty 0x00 wrote Y (=2, beq-taken path)");
  assert.equal(m.ram[0x4000], 0x10, "sta 0x4000 = 0x10 (da8a)");

  // main iteration: drain kicked the watchdog $5000 and pulsed one AVG reset $5800.
  // The kick value = current A. In iteration 1, A=0x10 (da88 lda #$10, never reloaded in the drain).
  // NB: ram[$5000] is NOT 0x10 at STOP -- the harness bounds on the 2nd $5800, so iteration 2's drain
  // has already re-kicked $5000 with A = ($0c00 & 0x10) = 0 (daf3 and #$10, self-test switch clear).
  // Assert the ground-truth first-kick value instead of the final RAM cell.
  assert.equal(m.kicks5000[0], 0x10, "first watchdog $5000 kick used A=0x10 (da88 lda #$10)");
  assert.equal(m.ram[0x5800], 0x10, "AVG reset $5800 (first pulse, A=0x10)");
  // body scratch writes
  assert.equal(m.ram[0x74], 0x00, "sta 0x74 = 0");
  assert.equal(m.ram[0x75], 0x20, "sta 0x75 = 0x20");
  assert.equal(m.ram[0x60cb], 0x20, "sta 0x60cb = 0x20");
  assert.equal(m.ram[0x52], 0x00, "sta 0x52 = [60c8] = 0");
  assert.equal(m.ram[0x50], 0x00, "sta 0x50 = [60c8] & 0x0f = 0");

  // call sequence: de11 (preamble), then db0f + df0d in the body; ddf1 skipped, de1b skipped (03&3==1)
  assert.deepEqual(m.calls, [0xde11, 0xdb0f, 0xdf0d], "one-iteration call order");
  // AVG GO write happened (value comes from df0d, not modeled -> assert presence via calls above)
  assert.ok(m.cycles > 1000, "3kHz-sync drain accrues a large cycle total");
});

test("loc_da62: $01c9 nonzero -> ddf1 called, $7c stashed, $01c9 cleared, Y=0", () => {
  const m = makeMachine();
  m.ram[0x01c9] = 0x33; // beq da76 NOT taken -> sta 0x7c, jsr ddf1, ldy #0, sty 0x01c9

  runBounded(m);

  assert.equal(m.ram[0x7c], 0x33, "sta 0x7c = pending request byte");
  assert.equal(m.ram[0x01c9], 0x00, "sty 0x01c9 cleared the request");
  assert.equal(m.ram[0x00], 0x00, "sty 0x00 wrote Y (=0, fall-through path)");
  assert.deepEqual(m.calls, [0xde11, 0xddf1, 0xdb0f, 0xdf0d], "ddf1 now in the call order");
});

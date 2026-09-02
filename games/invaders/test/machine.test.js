// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders Machine (games/invaders/machine.js): the 8080 + mw8080bw board and its NOVEL piece,
// the TWO maskable RST interrupts per frame (RST 1 mid-screen -> 0x08, RST 2 vblank -> 0x10), gated by
// the 8080 INTE flip-flop. Modeled on the pooyan machine tests but for the 8080 two-interrupt model.
// Every Machine here is built from a SYNTHETIC all-zero ROM + a routines Map we control -- never the
// real (gitignored) ROM. Authorities cited inline: i8085.cpp (i8080 core) and mw8080bw.cpp/.h.

import test from "node:test";
import assert from "node:assert/strict";

import {
  Machine,
  CYCLES_PER_FRAME,
  INT1_VECTOR,
  INT2_VECTOR,
  INT1_CYCLE,
  INT2_CYCLE,
} from "../machine.js";
import { Regs, REG_FIELDS } from "../../../core/cpu/8080.js";
import { STATE_DUMP_SIZE, RAM_BASE, RAM_END, ROM_END } from "../../../boards/invaders/memory.js";

// AddressSpace demands exactly a ROM_END+1 (8192) byte ROM; all-zero is fine for these unit tests.
function makeMachine(routines = new Map()) {
  return new Machine(new Uint8Array(ROM_END + 1), routines);
}

test("reset: every register is 0 and F=0x00 per MAME i8080 device_reset", () => {
  const m = makeMachine();
  for (const k of REG_FIELDS) assert.equal(m.regs[k], 0, `reg ${k} should reset to 0`);
  // i8085.cpp: device_start sets m_AF.d=0 and device_reset (line 376) never touches m_AF -> F resets
  // to 0. Mutation: a "0x02 always-1" draft reset would fail this exact assertion.
  assert.equal(m.regs.f, 0x00);
  // The always-1 bit still reads 1 THROUGH the PSW (af getter) though the raw F register is 0.
  assert.equal(m.regs.af & 0x02, 0x02);
});

test("fireInt: pushes the return PC to the RAM stack, vectors PC, charges 11T, clears INTE", () => {
  const seen = [];
  const m = makeMachine(new Map([[INT1_VECTOR, (mm) => seen.push(mm.pc)]]));
  m.io.inte = true;
  m.regs.sp = 0x2400; // stack in work RAM (0x2000-0x23ff), so the push lands in writable RAM
  m.pc = 0x1234;
  m.pcKnown = true;
  m.nextInt1 = m.nextInt2 = m.nextBoundary = Infinity; // isolate fireInt from tick's frame logic

  const spBefore = m.regs.sp;
  m.fireInt(INT1_VECTOR);

  assert.equal(m.regs.sp, (spBefore - 2) & 0xffff); // SP-2
  const lo = m.mem.read8(m.regs.sp);
  const hi = m.mem.read8(m.regs.sp + 1);
  assert.equal(lo | (hi << 8), 0x1234, "pushed return PC (little-endian)");
  assert.ok(m.regs.sp >= RAM_BASE && m.regs.sp <= RAM_END, "return PC landed on the RAM stack");
  assert.equal(m.io.inte, false); // 8080 clears the enable on accept until the handler's EI
  assert.equal(m.pc, INT1_VECTOR); // vectored to the RST target
  assert.equal(m.cycles, 11); // RST is 11 T-states (i8085.cpp lut_cycles_8080: 0xcf/0xd7 = 11)
  assert.deepEqual(seen, [INT1_VECTOR]); // handler ran with PC at the vector
  assert.equal(m.intCount, 1);
});

test("fireInt: throws (not a stale push) when PC is unknown after a tick()-advanced routine", () => {
  const m = makeMachine(new Map([[INT1_VECTOR, () => {}]]));
  m.io.inte = true;
  m.regs.sp = 0x2400;
  m.pcKnown = false; // the state a routine leaves when it used tick() instead of step()
  const spBefore = m.regs.sp;

  assert.throws(() => m.fireInt(INT1_VECTOR), /PC is unknown|stale/);
  // The guard fires BEFORE any mutation: no push, no INTE change, no count.
  assert.equal(m.regs.sp, spBefore);
  assert.equal(m.io.inte, true);
  assert.equal(m.intCount, 0);
});

test("interrupt model: two per frame, mid-screen precedes vblank, vectors per mw8080bw", () => {
  // mw8080bw.cpp: mid counter 0x80 -> vpos 96, vector 0xcf (RST 1) -> 0x08; vblank counter 0xda ->
  // vpos 224, vector 0xd7 (RST 2) -> 0x10. Two RSTs/frame, not a single NMI; mid comes first.
  assert.ok(INT1_CYCLE < INT2_CYCLE, "mid-screen interrupt precedes vblank within the frame");
  assert.equal(INT1_VECTOR, 0x08);
  assert.equal(INT2_VECTOR, 0x10);
});

test("tick: both RSTs fire once/frame when INTE set, mid (0x08) before vblank (0x10)", () => {
  const order = [];
  const handler = (tag) => (mm) => { order.push(tag); mm.io.inte = true; }; // EI re-arms in the handler
  const m = makeMachine(new Map([
    [INT1_VECTOR, handler("mid")],
    [INT2_VECTOR, handler("vblank")],
  ]));
  m.io.inte = true;
  m.regs.sp = 0x2400;
  m.pc = 0x1000;
  m.pcKnown = true;

  m.tick(INT1_CYCLE); // cross the mid threshold only (INT1_CYCLE < INT2_CYCLE)
  assert.deepEqual(order, ["mid"]);
  m.pcKnown = true; // the returned handler's caller resumes with a known PC
  m.tick(INT2_CYCLE - m.cycles); // now cross the vblank threshold
  assert.deepEqual(order, ["mid", "vblank"]);
  assert.equal(m.intCount, 2);
});

test("fireNmi: the clock-free frame interrupt is the RST pair, mid (0x08) before vblank (0x10), and re-asserts pcKnown so the second accept never throws on a stale PC", () => {
  const order = [];
  // A real ISR leaves the PC unknown at its tick/ret exit; model that so fireNmi's pcKnown re-assert is exercised.
  const handler = (tag) => (mm) => { order.push(tag); mm.io.inte = true; mm.pcKnown = false; };
  const m = makeMachine(new Map([
    [INT1_VECTOR, handler("mid")],
    [INT2_VECTOR, handler("vblank")],
  ]));
  m.io.inte = true;
  m.regs.sp = 0x2400;
  m.pc = 0x1000;
  m.pcKnown = true;
  m.nextInt1 = m.nextInt2 = m.nextBoundary = Infinity; // isolate from tick's frame logic
  assert.doesNotThrow(() => m.fireNmi()); // without the pre-each-fireInt pcKnown re-assert, the 2nd accept would throw
  assert.deepEqual(order, ["mid", "vblank"]); // ordered RST1 then RST2
  assert.equal(m.intCount, 2); // both accepted
});

test("tick: interrupts are suppressed while INTE is clear (DI)", () => {
  const order = [];
  const m = makeMachine(new Map([
    [INT1_VECTOR, () => order.push("mid")],
    [INT2_VECTOR, () => order.push("vblank")],
  ]));
  m.io.inte = false; // DI: the INTE flip-flop gates the accept
  m.regs.sp = 0x2400;
  m.pc = 0x1000;
  m.pcKnown = true;

  m.tick(CYCLES_PER_FRAME); // crosses both thresholds
  assert.deepEqual(order, []); // nothing accepted
  assert.equal(m.intCount, 0);
  // The counter still advances (it is the accept, not the schedule, that INTE gates).
  assert.equal(m.nextInt1, INT1_CYCLE + CYCLES_PER_FRAME);
  assert.equal(m.nextInt2, INT2_CYCLE + CYCLES_PER_FRAME);
});

test("CYCLES_PER_FRAME is a positive integer == CPU_CLOCK/refresh (mw8080bw)", () => {
  assert.ok(Number.isInteger(CYCLES_PER_FRAME) && CYCLES_PER_FRAME > 0);
  // MW8080BW_CPU_CLOCK 1996800 / MW8080BW_60HZ 59.541985 = 33536 (mw8080bw.h). Mutation: an exact-60Hz
  // guess (33280) would fail.
  assert.equal(CYCLES_PER_FRAME, Math.round(1996800 / 59.541985));
});

test("runFrames(n): returns n RAM dumps of STATE_DUMP_SIZE for a cleanly-yielding reset", () => {
  const N = 4;
  // Synthetic reset routine: advance the clock across N frame boundaries, then return.
  const reset = (mm) => mm.step(0x0000, mm.maxFrames * CYCLES_PER_FRAME);
  const m = makeMachine(new Map([[0x0000, reset]]));

  const frames = m.runFrames(N);
  assert.equal(frames.length, N);
  for (const f of frames) {
    assert.ok(f instanceof Uint8Array);
    assert.equal(f.length, STATE_DUMP_SIZE); // 8192 = main_ram (boards/invaders/memory.js)
  }
  assert.equal(m.stoppedBy, "returned"); // clean yield -- not a NotImplemented gap or a crash
});

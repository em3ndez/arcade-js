// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_36de (ROM 0x36de, Pooyan) -- the actor-attribute builder.
 * Index A = 2*(0x8820) + clamp(0x8907,0x0e) reads table 0x3737 via rst 0x20, is decremented past the
 * (ix+0x16)/(ix+0x13) flag gates and the (ix+0x06) phase gate (biased by 0x8901), then a second index
 * reads table 0x3727 and is OR'd into (ix+0x08).
 *
 * The mock's `call` POPS the pushed return (modelling the callee's `ret`); for loc_0020 it also applies
 * that helper's net effect (HL += A, then A = mem[HL]) so the looked-up bytes are exercised. Both rst
 * push16 sites stay balanced, and the final `ret` unwinds the seated caller -- so a missing push16
 * desyncs SP and lands PC off the seated return (the stack-fidelity tooth).
 *
 * Six paths cover both outcomes of all 8 conditional jr's:
 *   P1  36e3 c, 36f5 z, 370a nc, 3717 nc              (all four "jump" outcomes)
 *   P2  full spine: 36e3/36f5/36f8/36fe/3701/370a/370d/3717 all NOT taken (+ the 3719 bias branch)
 *   P3  36f8 z taken     P4  36fe z taken     P5  3701 z taken     P6  370d z taken
 * TEETH: mis-charge `bit 0,(ix+0x16)` (20->19) on P1 and assert the 265-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_36de.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_36de } from "../loc_36de.js";

const CALLER_RET = 0xabcd;
const IX = 0x8c00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x36de, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The callee's `ret` pops the return address the call site pushed. loc_0020 additionally does
    // HL += A then A = mem[HL] (its documented net effect) -- so a forgotten push16 unbalances SP.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) {
        const idx = regs.a;
        regs.hl = (regs.hl + idx) & 0xffff;
        regs.a = mem.read8(regs.hl);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Common baseline: index feeder 0x8820=0, first-table probe at 0x3737, 0x8901>=4 (skip the 3719 bias).
function baseline(m) {
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(0x8820, 0x00); // index base 0 -> first rst reads 0x3737 + clamp(0x8907)
  m.mem.write8(0x8901, 0x04); // >= 4 -> 3717 jr nc taken (A stays = B)
}

test("loc_36de P1: 36e3 c, 36f5 z, 370a nc, 3717 nc -> all jump outcomes", () => {
  const m = makeMachine();
  baseline(m);
  m.mem.write8(0x8907, 0x00);      // < 0x10 -> 36e3 jr c taken; index = 0
  m.mem.write8(0x3737, 0x02);      // first lookup -> A = 2
  m.mem.write8(IX + 0x16, 0x00);   // bit0 clear -> 36f5 jr z taken -> 0x3703
  m.mem.write8(IX + 0x06, 0x0a);   // >= 9 -> 370a jr nc taken -> 0x3710
  m.mem.write8(0x3729, 0x10);      // second lookup 0x3727 + 2 -> A = 0x10
  m.mem.write8(IX + 0x08, 0x01);   // or -> 0x11

  loc_36de(m);

  assert.equal(m.tstates, 265, "P1 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x36e1, 0x36e3, 0x36e7, 0x36e8, 0x36eb, 0x36ec, 0x36ed, 0x36f0, 0x0020,
    0x36f5, 0x3703,
    0x3704, 0x3707, 0x3709, 0x370a, 0x3710,
    0x3711, 0x3714, 0x3716, 0x3717, 0x371c,
    0x371f, 0x0020, 0x3723, 0x3726, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, [0x0020, 0x0020], "two rst 0x20 lookups");
  assert.equal(m.mem.read8(IX + 0x08), 0x11, "attribute = 0x10 | 0x01");
  assert.equal(m.regs.sp, 0x8780, "both rst push/pop balanced + ret unwinds the caller");
});

test("loc_36de P2: full spine, every conditional jr NOT taken (+ 3719 bias)", () => {
  const m = makeMachine();
  baseline(m);
  m.mem.write8(0x8907, 0x10);      // >= 0x10 -> 36e3 jr c NOT taken -> ld a,0x0e (clamp); B=0x0e
  m.mem.write8(0x3745, 0x05);      // 0x3737 + 0x0e -> A = 5
  m.mem.write8(IX + 0x16, 0x01);   // bit0 set -> 36f5 not taken
  m.mem.write8(IX + 0x13, 0x01);   // bit0 set -> 36fe not taken
  m.mem.write8(IX + 0x06, 0x02);   // < 9 -> 370a jr nc NOT taken
  m.mem.write8(0x8901, 0x01);      // < 4 -> 3717 jr nc NOT taken -> 3719 bias branch
  m.mem.write8(0x372b, 0x20);      // second lookup 0x3727 + (V1-1=4) -> A = 0x20
  m.mem.write8(IX + 0x08, 0x04);   // or -> 0x24

  loc_36de(m);

  assert.equal(m.tstates, 327, "P2 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x36e1, 0x36e3, 0x36e5, 0x36e7, 0x36e8, 0x36eb, 0x36ec, 0x36ed, 0x36f0, 0x0020,
    0x36f5, 0x36f7, 0x36f8, 0x36fa, 0x36fe, 0x3700, 0x3701, 0x3703,
    0x3704, 0x3707, 0x3709, 0x370a, 0x370c, 0x370d, 0x370f, 0x3710,
    0x3711, 0x3714, 0x3716, 0x3717, 0x3719, 0x371b, 0x371c,
    0x371f, 0x0020, 0x3723, 0x3726, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x0020, 0x0020]);
  assert.equal(m.mem.read8(IX + 0x08), 0x24, "attribute = 0x20 | 0x04");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_36de P3: 36f8 z taken -> 0x3710", () => {
  const m = makeMachine();
  baseline(m);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x3737, 0x01);      // A = 1 -> 36f7 dec -> 0 -> 36f8 jr z taken
  m.mem.write8(IX + 0x16, 0x01);   // bit0 set -> 36f5 not taken
  m.mem.write8(0x3727, 0x08);      // second lookup 0x3727 + 0
  m.mem.write8(IX + 0x08, 0x00);

  loc_36de(m);

  assert.equal(m.tstates, 230, "P3 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x36e1, 0x36e3, 0x36e7, 0x36e8, 0x36eb, 0x36ec, 0x36ed, 0x36f0, 0x0020,
    0x36f5, 0x36f7, 0x36f8, 0x3710,
    0x3711, 0x3714, 0x3716, 0x3717, 0x371c,
    0x371f, 0x0020, 0x3723, 0x3726, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(IX + 0x08), 0x08);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_36de P4: 36fe z taken -> 0x3703", () => {
  const m = makeMachine();
  baseline(m);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x3737, 0x03);      // A = 3 -> 36f7 dec 2 (36f8 nt); 36fa gate clear -> 36fe taken
  m.mem.write8(IX + 0x16, 0x01);   // bit0 set -> 36f5 not taken
  m.mem.write8(IX + 0x13, 0x00);   // bit0 clear -> 36fe jr z taken -> 0x3703
  m.mem.write8(IX + 0x06, 0x0a);   // >= 9 -> 370a jr nc taken -> 0x3710
  m.mem.write8(0x3729, 0x40);      // second lookup 0x3727 + 2
  m.mem.write8(IX + 0x08, 0x00);

  loc_36de(m);

  assert.equal(m.tstates, 303, "P4 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x36e1, 0x36e3, 0x36e7, 0x36e8, 0x36eb, 0x36ec, 0x36ed, 0x36f0, 0x0020,
    0x36f5, 0x36f7, 0x36f8, 0x36fa, 0x36fe, 0x3703,
    0x3704, 0x3707, 0x3709, 0x370a, 0x3710,
    0x3711, 0x3714, 0x3716, 0x3717, 0x371c,
    0x371f, 0x0020, 0x3723, 0x3726, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(IX + 0x08), 0x40);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_36de P5: 3701 z taken -> 0x3710", () => {
  const m = makeMachine();
  baseline(m);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x3737, 0x02);      // A = 2 -> 36f7 dec 1 (36f8 nt); 36fe nt; 3700 dec 0 -> 3701 taken
  m.mem.write8(IX + 0x16, 0x01);   // bit0 set -> 36f5 not taken
  m.mem.write8(IX + 0x13, 0x01);   // bit0 set -> 36fe not taken
  m.mem.write8(0x3727, 0x08);      // second lookup 0x3727 + 0
  m.mem.write8(IX + 0x08, 0x00);

  loc_36de(m);

  assert.equal(m.tstates, 268, "P5 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x36e1, 0x36e3, 0x36e7, 0x36e8, 0x36eb, 0x36ec, 0x36ed, 0x36f0, 0x0020,
    0x36f5, 0x36f7, 0x36f8, 0x36fa, 0x36fe, 0x3700, 0x3701, 0x3710,
    0x3711, 0x3714, 0x3716, 0x3717, 0x371c,
    0x371f, 0x0020, 0x3723, 0x3726, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(IX + 0x08), 0x08);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_36de P6: 370d z taken -> 0x3710", () => {
  const m = makeMachine();
  baseline(m);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x3737, 0x01);      // A = 1
  m.mem.write8(IX + 0x16, 0x00);   // bit0 clear -> 36f5 jr z taken -> 0x3703 (B = 1)
  m.mem.write8(IX + 0x06, 0x00);   // < 9 -> 370a jr nc NOT taken; 370c dec -> 0 -> 370d taken
  m.mem.write8(0x3727, 0x08);      // second lookup 0x3727 + 0
  m.mem.write8(IX + 0x08, 0x00);

  loc_36de(m);

  assert.equal(m.tstates, 276, "P6 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x36e1, 0x36e3, 0x36e7, 0x36e8, 0x36eb, 0x36ec, 0x36ed, 0x36f0, 0x0020,
    0x36f5, 0x3703,
    0x3704, 0x3707, 0x3709, 0x370a, 0x370c, 0x370d, 0x3710,
    0x3711, 0x3714, 0x3716, 0x3717, 0x371c,
    0x371f, 0x0020, 0x3723, 0x3726, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(IX + 0x08), 0x08);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_36de MUTATION: `bit 0,(ix+0x16)` mis-charged 19T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x36f5 ? 19 : cycles);
  baseline(m);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x3737, 0x02);
  m.mem.write8(IX + 0x16, 0x00);
  m.mem.write8(IX + 0x06, 0x0a);
  m.mem.write8(0x3729, 0x10);
  m.mem.write8(IX + 0x08, 0x01);

  loc_36de(m);

  assert.equal(m.tstates, 264, "mutation loses 1 T (20 -> 19)");
  assert.throws(() => assert.equal(m.tstates, 265), /265/, "the 265-T golden must fail on the mutant");
});

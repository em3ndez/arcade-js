// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_142c (ROM 0x142c, Pooyan) -- spawn/init a child actor at IY from
 * parent IX. Seeds fixed IY slots, copies parent position with offsets, clamps (0x8900) to <=7 and
 * indexes speed table 0x148e via rst 0x20, negates the speed per (0x8907) bit0, mirrors it into
 * iy/ix+0a and iy+0b, seeds vector 0x38cb and timer 0x28, then tail-jumps loc_0ee3.
 *
 * The mock's `call` POPS the return address the call site pushed (models the callee's ret). For the
 * rst 0x20 (loc_0020) it also applies that helper's net effect: HL += A, then A = mem[HL]. The single
 * push16 (rst 0x20) is matched by loc_0020's pop; the tail jp loc_0ee3's pop consumes the seated
 * CALLER_RET, so the stack unwinds to baseline -- a missing push16 desyncs SP (stack-fidelity tooth).
 *
 * Paths: P1 = (0x8900)<8 (jr c taken, no clamp) and (0x8907) bit0 clear (jr z taken, speed kept).
 * P2 = (0x8900)>=8 (clamp to 7) and (0x8907) bit0 set (jr z not taken, speed negated via neg).
 * TEETH: mis-charge the rst 0x20 (11T) as 17T -> the P1 golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_142c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_142c } from "../loc_142c.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x142c, pcSeq: [],
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
    // The callee's ret pops the return address the call site pushed; loc_0020 also does HL += A, A=(HL).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) { regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const IX = 0x9000;
const IY = 0x9100;

// Common parent source bytes + speed table used by both paths.
function seedCommon(m) {
  m.regs.ix = IX;
  m.regs.iy = IY;
  m.regs.c = 0x55;
  m.mem.write8((IX + 0x03) & 0xffff, 0x10);
  m.mem.write8((IX + 0x04) & 0xffff, 0x20);
  m.mem.write8((IX + 0x05) & 0xffff, 0x30);
  m.mem.write8((IX + 0x06) & 0xffff, 0x40);
  // speed table at 0x148e (rst 0x20 reads 0x148e + clamped-index)
  m.mem.write8(0x1491, 0x14); // index 3 -> speed 0x14
  m.mem.write8(0x1495, 0x0a); // index 7 -> speed 0x0a
}

const PC_P1 = [
  0x1430, 0x1434, 0x1437, 0x1438, 0x143b, 0x143e,
  0x1441, 0x1443, 0x1446, 0x1449, 0x144b, 0x144e, 0x1451, 0x1453,
  0x1456, 0x1459, 0x145b, 0x145e, 0x1461, 0x1463,
  0x1467,                 // jr c taken (A<8, no clamp)
  0x146a, 0x0020,         // ld hl + rst 0x20 -> target
  0x146e, 0x1470, 0x1471,
  0x1475,                 // jr z taken (facing bit0 clear -> keep speed)
  0x1478, 0x147b, 0x147e, 0x1481, 0x1484, 0x1487, 0x148b,
  0x0ee3,                 // tail jp
];

test("loc_142c P1: (0x8900)<8, facing bit0 clear -> positive speed", () => {
  const m = makeMachine();
  seatCaller(m);
  seedCommon(m);
  m.mem.write8(0x8900, 0x03); // < 8 -> jr c taken, index 3
  m.mem.write8(0x8907, 0x00); // bit0 clear -> jr z taken (no neg)

  loc_142c(m);

  assert.equal(m.tstates, 505, "P1 T-state total");
  assert.deepEqual(m.pcSeq, PC_P1, "P1 step boundaries");
  assert.equal(m.pc, 0x0ee3, "tail jp lands on loc_0ee3");
  assert.deepEqual(m.calls, [0x0020, 0x0ee3], "rst 0x20 then tail loc_0ee3");
  // fixed slots
  assert.equal(m.mem.read8(IY + 0x00), 0x01);
  assert.equal(m.mem.read8(IY + 0x02), 0x04);
  assert.equal(m.mem.read8(IY + 0x14), 0x55, "iy+14 = C");
  assert.equal(m.mem.read8(IY + 0x07), 0x00);
  assert.equal(m.mem.read8(IY + 0x0e), 0x00);
  // position copies
  assert.equal(m.mem.read8(IY + 0x05), (0x30 + 0x80) & 0xff, "iy+5 = ix+5 + 0x80");
  assert.equal(m.mem.read8(IY + 0x03), (0x10 + 0x80) & 0xff, "iy+3 = ix+3 + 0x80");
  assert.equal(m.mem.read8(IY + 0x04), 0x1f, "iy+4 = ix+4 - 1");
  assert.equal(m.mem.read8(IY + 0x06), 0x41, "iy+6 = ix+6 + 1");
  // speed (index 3 -> 0x14, not negated) mirrored into iy/ix+0a, iy+0b
  assert.equal(m.mem.read8(IY + 0x0a), 0x14, "iy+0a speed");
  assert.equal(m.mem.read8(IX + 0x0a), 0x14, "ix+0a speed");
  assert.equal(m.mem.read8(IY + 0x0b), 0x14, "iy+0b speed");
  // vector + timer
  assert.equal(m.mem.read8(IY + 0x0c), 0xcb, "iy+0c = DE low");
  assert.equal(m.mem.read8(IY + 0x0d), 0x38, "iy+0d = DE high");
  assert.equal(m.mem.read8(IY + 0x11), 0x28, "iy+11 timer");
  // Stack: rst 0x20 push matched by loc_0020's pop; tail loc_0ee3 pop consumes CALLER_RET.
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_142c P2: (0x8900)>=8 clamps to 7, facing bit0 set -> negated speed", () => {
  const m = makeMachine();
  seatCaller(m);
  seedCommon(m);
  m.mem.write8(0x8900, 0x20); // >= 8 -> jr c not taken -> clamp A=7, index 7
  m.mem.write8(0x8907, 0x01); // bit0 set -> jr z not taken (neg)

  loc_142c(m);

  assert.equal(m.tstates, 510, "P2 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x1430, 0x1434, 0x1437, 0x1438, 0x143b, 0x143e,
    0x1441, 0x1443, 0x1446, 0x1449, 0x144b, 0x144e, 0x1451, 0x1453,
    0x1456, 0x1459, 0x145b, 0x145e, 0x1461, 0x1463,
    0x1465, 0x1467,       // jr c not taken -> clamp to 7
    0x146a, 0x0020,
    0x146e, 0x1470, 0x1471,
    0x1473, 0x1475,       // jr z not taken -> neg
    0x1478, 0x147b, 0x147e, 0x1481, 0x1484, 0x1487, 0x148b,
    0x0ee3,
  ], "P2 step boundaries (clamp + neg)");
  assert.equal(m.pc, 0x0ee3);
  assert.deepEqual(m.calls, [0x0020, 0x0ee3]);
  // index 7 -> speed 0x0a, negated -> 0xf6
  assert.equal(m.mem.read8(IY + 0x0a), 0xf6, "iy+0a negated speed");
  assert.equal(m.mem.read8(IX + 0x0a), 0xf6, "ix+0a negated speed");
  assert.equal(m.mem.read8(IY + 0x0b), 0xf6, "iy+0b negated speed");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_142c MUTATION: rst 0x20 mis-charged 17T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0020 ? 17 : cycles);
  seatCaller(m);
  seedCommon(m);
  m.mem.write8(0x8900, 0x03);
  m.mem.write8(0x8907, 0x00);

  loc_142c(m);

  assert.equal(m.tstates, 511, "mutation adds 6 T (11 -> 17)");
  assert.throws(
    () => assert.equal(m.tstates, 505, "P1 T-state total"),
    /505/,
    "the 505-T golden must fail on the mutant",
  );
});

// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1119 (ROM 0x1119, Pooyan) -- draw byte A as two stacked digit
 * tiles at HL: high nibble to mem[HL] (blank tile 0x10 when zero), then HL one row up (+= 0xffe0)
 * and low nibble to mem[HL-0x20]. Pure leaf, no calls.
 *
 * Path HI (high nibble nonzero): jr nz taken, both nibbles written. Path LO (high nibble zero):
 * jr nz not taken, high tile forced to 0x10.
 * TEETH: mis-charge one `srl a` (8 T) as 4 T -> the 108-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_1119.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1119 } from "../loc_1119.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1119, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

const CALLER_RET = 0xabcd;
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const PC_COMMON_TAIL = [0x112b, 0x112c, 0x112d, 0x112f, 0x1130, CALLER_RET];

test("loc_1119 Path HI: high nibble nonzero -> both digit tiles written", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x37;      // hi=3 lo=7
  m.regs.hl = 0x85d0;

  loc_1119(m);

  assert.equal(m.tstates, 108, "Path HI T-state total");
  assert.deepEqual(m.pcSeq, [
    0x111c, 0x111d, 0x111f, 0x1121, 0x1123, 0x1125, 0x1126, 0x112a, // jr nz taken -> 0x112a
    ...PC_COMMON_TAIL,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x85d0), 0x03, "high nibble tile");
  assert.equal(m.mem.read8(0x85b0), 0x07, "low nibble tile one row up (0x85d0+0xffe0)");
  assert.equal(m.regs.e, 0x37, "E holds the original A");
  assert.equal(m.regs.a, 0x07, "A ends as the low nibble");
  assert.equal(m.regs.hl, 0x85b0, "HL advanced by 0xffe0");
  assert.equal(m.regs.bc, 0xffe0, "BC = row stride");
});

test("loc_1119 Path LO: high nibble zero -> blank tile 0x10", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x08;      // hi=0 lo=8
  m.regs.hl = 0x85d0;

  loc_1119(m);

  assert.equal(m.tstates, 110, "Path LO T-state total (jr nz not taken + ld a,0x10)");
  assert.deepEqual(m.pcSeq, [
    0x111c, 0x111d, 0x111f, 0x1121, 0x1123, 0x1125, 0x1126, 0x1128, 0x112a, // not taken -> ld a,0x10
    ...PC_COMMON_TAIL,
  ]);
  assert.equal(m.mem.read8(0x85d0), 0x10, "leading zero -> blank tile");
  assert.equal(m.mem.read8(0x85b0), 0x08, "low nibble tile");
  assert.equal(m.regs.e, 0x08, "E holds the original A");
});

test("loc_1119 MUTATION: a `srl a` mis-charged 4T (not 8T) is caught by the golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1121 ? 4 : cycles);
  seatCaller(m);
  m.regs.a = 0x37;
  m.regs.hl = 0x85d0;

  loc_1119(m);

  assert.equal(m.tstates, 104, "mutation loses 4 T (8 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 108, "Path HI T-state total"),
    /108/,
    "the 108-T golden must fail on the mutant",
  );
});

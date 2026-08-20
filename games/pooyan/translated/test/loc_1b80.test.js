// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1b80 (ROM 0x1b80-0x1b8a, Pooyan) -- the +8 copy loop. Reads
 * bytes from (DE); a 0xa0 byte is the terminator (`ret z` -- the only exit). Every other byte is
 * written to (HL) after adding 0x08, then DE/HL advance and it loops via the unconditional
 * `jr 0x1b80`.
 *
 * loc_1b80 is a leaf: no call/push16, only `ret z`. The mock's real push16/pop16 + a seated
 * CALLER_RET give the ret a stack to unwind -- the ret-to-caller path asserts pc===CALLER_RET AND
 * sp===baseline (stack tooth). With no push16 to delete, the positive control is a T-state
 * mutation: mis-charging `add a,0x08` (0x1b86) makes the COPY-2 golden throw (performed below).
 *
 * Path EMPTY (first byte 0xa0): read + cp + ret z, T=25, nothing copied.
 * Path COPY-2 (two bytes, then 0xa0): two loop bodies + terminator, full pcSeq + T=139, both bytes
 *   copied +8 to (HL), DE/HL advanced past them, ret to the seated caller.
 *
 * Run: node --test games/pooyan/translated/test/loc_1b80.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1b80 } from "../loc_1b80.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1b80, pcSeq: [],
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

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_1b80 Path EMPTY: first byte is the 0xa0 terminator -> ret z immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x2000;
  m.regs.hl = 0x3000;
  m.mem.write8(0x2000, 0xa0); // terminator on the first read

  loc_1b80(m);

  assert.equal(m.tstates, 7 + 7 + 11, "ld a,(de) + cp 0xa0 + ret z taken");
  assert.deepEqual(m.pcSeq, [0x1b81, 0x1b83, CALLER_RET], "read, compare, ret");
  assert.equal(m.pc, CALLER_RET, "ret z to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.equal(m.mem.read8(0x3000), 0x00, "nothing copied to (HL)");
  assert.equal(m.regs.de, 0x2000, "DE unchanged (never advanced)");
  assert.equal(m.regs.hl, 0x3000, "HL unchanged");
});

const LOOP_BODY = [0x1b81, 0x1b83, 0x1b84, 0x1b86, 0x1b87, 0x1b88, 0x1b89, 0x1b80];
const PC_COPY2 = [
  ...LOOP_BODY, ...LOOP_BODY,
  0x1b81, 0x1b83, CALLER_RET, // terminator iter: read 0xa0 -> ret z
];
const GOLDEN_COPY2 = 57 + 57 + 25;

function setupCopy2(m) {
  seatCaller(m);
  m.regs.de = 0x2000;
  m.regs.hl = 0x3000;
  m.mem.write8(0x2000, 0x10);
  m.mem.write8(0x2001, 0x20);
  m.mem.write8(0x2002, 0xa0); // terminator
}

test("loc_1b80 Path COPY-2: two bytes copied +8, then 0xa0 -> ret z", () => {
  const m = makeMachine();
  setupCopy2(m);

  loc_1b80(m);

  assert.equal(m.tstates, GOLDEN_COPY2, "COPY-2 T-state total (57+57+25)");
  assert.deepEqual(m.pcSeq, PC_COPY2, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret z at 0x1b83 returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.equal(m.mem.read8(0x3000), 0x18, "byte 0x10 + 8 -> 0x18");
  assert.equal(m.mem.read8(0x3001), 0x28, "byte 0x20 + 8 -> 0x28");
  assert.equal(m.regs.a, 0xa0, "A holds the 0xa0 terminator on exit");
  assert.equal(m.regs.de, 0x2002, "DE points at the terminator");
  assert.equal(m.regs.hl, 0x3002, "HL advanced past the 2 copied bytes");
});

test("loc_1b80 MUTATION: `add a,0x08` at 0x1b86 mis-charged 4T (not 7) is caught", () => {
  const m = makeMachine();
  setupCopy2(m);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1b86 ? 4 : cycles);

  loc_1b80(m);

  assert.equal(m.tstates, GOLDEN_COPY2 - 6, "mutation loses 3 T x 2 iters (7 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, GOLDEN_COPY2, "COPY-2 T-state total"),
    /COPY-2 T-state total/,
    "the 139-T golden must fail on the mutant",
  );
});

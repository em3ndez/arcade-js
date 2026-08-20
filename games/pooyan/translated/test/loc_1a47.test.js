// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1a47 (ROM 0x1a47, Pooyan) -- a leaf. It clears the (H:0x04) byte the
 * caller seated (H is NOT reloaded, so the store lands in the caller's page), block-copies 0x3f bytes
 * from 0x8900 into the active player's bank (0x8940 for player 0, 0x8980 when 0x880d bit is set), then
 * zeroes 0x880a and rets. Two paths: the jr z at 0x1a58 selecting the destination.
 *
 * No calls and no push16 here, so the stack tooth is a bare ret to the seated caller (SP back to
 * baseline) and the positive control is a T-state mutation (the MUTATION test below): mis-charge one
 * instruction and the golden fails; unmutated it passes. `ldirAt` mirrors Machine.ldirAt's 21/16 timing.
 *
 * Run: node --test games/pooyan/translated/test/loc_1a47.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1a47 } from "../loc_1a47.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1a47, pcSeq: [],
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
    // Mirrors Machine.ldirAt: LDIR with the exact per-iteration flag and 21/16 T timing.
    ldirAt(self, nextAddr) {
      for (;;) {
        const byte = mem.read8(regs.hl);
        mem.write8(regs.de, byte);
        regs.hl = (regs.hl + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff;
        regs.bc = (regs.bc - 1) & 0xffff;
        const n = (regs.a + byte) & 0xff;
        regs.f = (regs.f & (0x80 | 0x40 | 0x01)) | (regs.bc !== 0 ? 0x04 : 0) | (n & 0x08 ? 0x08 : 0) | (n & 0x02 ? 0x20 : 0);
        if (regs.bc === 0) { this.step(nextAddr, 16); return; }
        regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28);
        this.step(self, 21);
      }
    },
  };
}

function seatSource(m) {
  // 0x3f = 63 bytes at 0x8900; distinctive pattern so the copy destination can be checked.
  for (let i = 0; i < 0x3f; i++) m.mem.write8(0x8900 + i, (0x40 + i) & 0xff);
}

// pcSeq up through `and a`, then the ldir body (63 x 0x1a5d landing + one 0x1a5f exit), then the tail.
const PREFIX = [0x1a49, 0x1a4b, 0x1a4e, 0x1a51, 0x1a54, 0x1a57, 0x1a58];
const LDIR_BODY = [...Array(62).fill(0x1a5d), 0x1a5f];
const TAIL = [0x1a60, 0x1a63, CALLER_RET];

test("loc_1a47 player 0 (0x880d=0): copy 0x8900->0x8940, zero 0x880a, ret", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.h = 0x81;             // caller's page: the first `ld (hl),0` store lands at 0x8104
  m.mem.write8(0x880d, 0x00);  // jr z taken -> destination stays 0x8940
  seatSource(m);

  loc_1a47(m);

  assert.equal(m.tstates, 7+10+10+10+10+13+4 + 12 + (62*21+16) + 4+13+10, "player-0 T-state total");
  assert.deepEqual(m.pcSeq, [...PREFIX, 0x1a5d, ...LDIR_BODY, ...TAIL], "jr z taken -> dest 0x8940; ret");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.mem.read8(0x8104), 0x00, "first store cleared (H:0x04) in the caller's page");
  assert.equal(m.mem.read8(0x8940), 0x40, "copy dest[0]");
  assert.equal(m.mem.read8(0x897e), (0x40 + 0x3e) & 0xff, "copy dest[62]");
  assert.equal(m.mem.read8(0x897f), 0x00, "byte past the copy untouched");
  assert.equal(m.mem.read8(0x8900), 0x40, "source[0] unchanged (ldir copies)");
  assert.equal(m.mem.read8(0x880a), 0x00, "0x880a zeroed");
});

test("loc_1a47 player 1 (0x880d=1): copy 0x8900->0x8980, zero 0x880a, ret", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.h = 0x81;
  m.mem.write8(0x880d, 0x01);  // jr z not taken -> destination reloaded to 0x8980
  seatSource(m);

  loc_1a47(m);

  assert.equal(m.tstates, 7+10+10+10+10+13+4 + 7 + 10 + (62*21+16) + 4+13+10, "player-1 T-state total");
  assert.deepEqual(m.pcSeq, [...PREFIX, 0x1a5a, 0x1a5d, ...LDIR_BODY, ...TAIL], "jr z not taken -> dest 0x8980");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
  assert.equal(m.mem.read8(0x8980), 0x40, "copy dest[0]");
  assert.equal(m.mem.read8(0x89be), (0x40 + 0x3e) & 0xff, "copy dest[62]");
  assert.equal(m.mem.read8(0x89bf), 0x00, "byte past the copy untouched");
  assert.equal(m.mem.read8(0x8940), 0x00, "the player-0 bank was NOT written on this path");
  assert.equal(m.mem.read8(0x880a), 0x00, "0x880a zeroed");
});

test("loc_1a47 MUTATION: `ld (hl),0x00` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.h = 0x81;
  m.mem.write8(0x880d, 0x00);
  seatSource(m);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1a4b ? 7 : cycles);

  loc_1a47(m);

  const golden = 7+10+10+10+10+13+4 + 12 + (62*21+16) + 4+13+10;
  assert.equal(m.tstates, golden - 3, "mutation loses 3 T (10 -> 7)");
  assert.throws(() => assert.equal(m.tstates, golden, "player-0 T-state total"), /player-0/);
});

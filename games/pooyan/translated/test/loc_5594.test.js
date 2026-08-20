// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_5594 (ROM 0x5594, Pooyan) -- actor-table scan/seed loop with an
 * inlined guard-sum loop (the 0x55a5 djnz body, which is only a loop latch, is inlined -- no own file).
 * Live blocks ((ix+0)|(ix+1) != 0) are skipped (IX += DE, djnz). At the first free block it sums the
 * 8-byte guard 0x0bad against the local signature 0x55b5; any nonzero pair bumps 0x881e. Then it seeds
 * (ix+17) via rst 0x20 and loc_5489, which ends `pop af; ret` and skip-returns past loc_5594.
 *
 * The mock's `call` POPS the pushed return (models the callee `ret`); loc_0020 also does HL += A;
 * A = (HL). loc_5489 pops TWICE and sets pc to the second pop -- the `pop af; ret` skip-return; a
 * missing push16 at that site then makes the final pop miss CALLER_RET and desyncs SP.
 *
 * Paths: FREE-MATCH (all 8 guard pairs sum to 0 -> no 0x881e bump -> seed), FREE-MISMATCH (first pair
 * nonzero -> bump 0x881e -> seed), LIVE (both blocks live -> djnz exhausts -> ret at 0x55d3).
 * MUTATION: inner `add a,(hl)` mis-charged 4T (not 7T).
 *
 * Run: node --test games/pooyan/translated/test/loc_5594.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5594 } from "../loc_5594.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5594, pcSeq: [],
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
    call(addr) {
      this.calls.push(addr);
      if (addr === 0x5489) {
        // loc_5489 ends `pop af; ret`: drop the return we pushed, then return past loc_5594.
        this.pop16();
        this.pc = this.pop16();
        return undefined;
      }
      this.pop16(); // normal callee `ret` consumes the pushed return
      if (addr === 0x0020) { regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      return undefined;
    },
  };
}

function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Seed the rst-0x20 lookup for the 0x55bd block: 0x8d14=2 -> loc_0020 reads mem[0x5627+2].
function seatSeedLookup(m) {
  m.mem.write8(0x8d14, 0x02);
  m.mem.write8(0x5629, 0x2a);
}

const SEED_TAIL = [0x55bd, 0x55bf, 0x55c2, 0x55c5, 0x55c7, 0x0020, 0x55cb, 0x5489];
const T_SEED_BLOCK = 84; // ld b 7 + ld hl 10 + ld a 13 + and 7 + rst 11 + ld(ix+17) 19 + call 17

test("loc_5594 FREE-MATCH: all 8 guard pairs sum to 0 -> no bump -> seed + skip-return", () => {
  const m = makeMachine();
  seat(m);
  seatSeedLookup(m);
  m.regs.ix = 0x8c60;
  m.mem.write8(0x8c60, 0x00); m.mem.write8(0x8c61, 0x00); // free block
  for (let i = 0; i < 8; i++) { m.mem.write8(0x0bad + i, 0x00); m.mem.write8(0x55b5 + i, 0x00); }

  loc_5594(m);

  // 76 (outer) + 363 (8 inner iters: 7*46 + 41) + 12 (jr 0x55bd) + 84 (seed block)
  assert.equal(m.tstates, 535, "FREE-MATCH T-state total");
  const inner = [];
  for (let i = 0; i < 7; i++) inner.push(0x55a6, 0x55a7, 0x55a9, 0x55aa, 0x55ab, 0x55a5);
  inner.push(0x55a6, 0x55a7, 0x55a9, 0x55aa, 0x55ab, 0x55ad); // last iter: djnz falls out
  assert.deepEqual(m.pcSeq, [0x5595, 0x5598, 0x559b, 0x559d, 0x55a0, 0x55a3, 0x55a5, ...inner, ...SEED_TAIL]);
  assert.deepEqual(m.calls, [0x0020, 0x5489]);
  assert.equal(m.mem.read8(0x881e), 0x00, "no mismatch -> tally untouched");
  assert.equal(m.mem.read8(0x8c77), 0x2a, "(ix+0x17) seeded from rst 0x20");
  assert.equal(m.pc, CALLER_RET, "loc_5489 skip-return to loc_5594's caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_5594 FREE-MISMATCH: first guard pair nonzero -> bump 0x881e -> seed + skip-return", () => {
  const m = makeMachine();
  seat(m);
  seatSeedLookup(m);
  m.regs.ix = 0x8c60;
  m.mem.write8(0x8c60, 0x00); m.mem.write8(0x8c61, 0x00);
  m.mem.write8(0x0bad, 0x01); m.mem.write8(0x55b5, 0x01); // sum 2 -> mismatch on iter 1
  m.mem.write8(0x881e, 0x07);

  loc_5594(m);

  // 76 (outer) + (7+7+12) inner-hit + (10+11+12) mismatch block + 84 seed
  assert.equal(m.tstates, 219, "FREE-MISMATCH T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5595, 0x5598, 0x559b, 0x559d, 0x55a0, 0x55a3, 0x55a5,
    0x55a6, 0x55a7, 0x55af, 0x55b2, 0x55b3, // sum nonzero -> 0x55af bump -> jr 0x55bd
    ...SEED_TAIL,
  ]);
  assert.deepEqual(m.calls, [0x0020, 0x5489]);
  assert.equal(m.mem.read8(0x881e), 0x08, "miss tally bumped 0x07 -> 0x08");
  assert.equal(m.mem.read8(0x8c77), 0x2a, "(ix+0x17) seeded");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5594 LIVE: both blocks live -> djnz exhausts -> ret at 0x55d3", () => {
  const m = makeMachine();
  seat(m);
  m.regs.ix = 0x8c60;
  m.regs.de = 0x0018;
  m.regs.b = 0x02;
  m.mem.write8(0x8c60, 0x01); // both live
  m.mem.write8(0x8c78, 0x01);

  loc_5594(m);

  assert.equal(m.tstates, 177, "two live iters (86 + 81) + ret 10");
  assert.deepEqual(m.pcSeq, [
    0x5595, 0x5598, 0x559b, 0x55ce, 0x55cf, 0x55d1, 0x5594, // iter1 djnz taken
    0x5595, 0x5598, 0x559b, 0x55ce, 0x55cf, 0x55d1, 0x55d3, // iter2 djnz not taken
    CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [], "no block seeded");
  assert.equal(m.pc, CALLER_RET, "ret at 0x55d3 to the seated caller");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5594 MUTATION: inner `add a,(hl)` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x55a7 ? 4 : cycles);
  seat(m);
  seatSeedLookup(m);
  m.regs.ix = 0x8c60;
  m.mem.write8(0x8c60, 0x00); m.mem.write8(0x8c61, 0x00);
  m.mem.write8(0x0bad, 0x01); m.mem.write8(0x55b5, 0x01);

  loc_5594(m);

  assert.equal(m.tstates, 216, "mutation loses 3 T (7 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 219), /219/, "the 219-T golden must fail on the mutant");
});

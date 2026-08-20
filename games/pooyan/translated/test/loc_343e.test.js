// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_343e (ROM 0x343e, Pooyan) -- the object X-movement handler.
 * Advances (ix+0x05)/(ix+0x06), compares the masked column against the limit at 0x8d4b, and
 * either starts the turn animation (jp loc_381e), re-arms the sprite row via rst 0x20 + the
 * 0x86e3 band, or falls through into the shared movement tail loc_34b0.
 *
 * The mock's `call` POPS the pushed/seated return address so a missing push16 desyncs SP (the
 * balance tooth). Tail exits (jp loc_381e, jp/jr loc_34b0, fall-through into loc_34b0) reuse the
 * frame: loc_XXX's ret pops the seated CALLER_RET, so SP returns to the pre-seat baseline. The
 * rst 0x20 at 0x3494 pushes 0x3495 (balanced by the mock pop).
 *
 * Paths cover both outcomes of every conditional except the 0x348d jr nc TAKEN edge, which is
 * unreachable: reaching 0x348d requires A < 0x07 (0x3489 jr nc not taken), so `cp 0x0a` always
 * sets carry and 0x348d never takes -- dead ROM code, documented not tested.
 * TEETH: `add hl,de` (11T) mis-charged 7T is caught by the full-path golden.
 *
 * Run: node --test games/pooyan/translated/test/loc_343e.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_343e } from "../loc_343e.js";

const CALLER_RET = 0xabcd;
const IX = 0x8a00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x343e, pcSeq: [],
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
    // Callee's `ret` pops the pushed return address -- model it so a missing push16 desyncs SP.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_343e P1: column past limit, not equal -> jp loc_381e (tail)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x05, 0x10); m.mem.write8(IX + 0x09, 0x00); // add -> 0x10, no carry
  m.mem.write8(IX + 0x06, 0x07); m.mem.write8(0x8d4b, 0x05);    // 0x07 > 0x05 -> NC,NZ

  loc_343e(m);

  assert.deepEqual(m.pcSeq, [
    0x3441, 0x3444, 0x3449, 0x344c, 0x344d, 0x3450, 0x3451, 0x3454, 0x3456,
    0x3457, 0x3458, 0x345a, 0x345e, 0x3461, 0x381e,
  ], "P1 boundaries");
  assert.equal(m.tstates, 171, "P1 T-total");
  assert.equal(m.pc, 0x381e, "tail lands on loc_381e");
  assert.deepEqual(m.calls, [0x381e]);
  assert.equal(m.regs.sp, 0x8780, "tail: loc_381e ret pops seated CALLER_RET -> pre-seat baseline");
  assert.equal(m.mem.read8(IX + 0x08), 0x01, "(ix+8) latched to 1");
});

test("loc_343e P2: carry into column, column < limit -> ret c at 0x3457", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x05, 0xff); m.mem.write8(IX + 0x09, 0x02); // add -> carry -> inc (ix+6)
  m.mem.write8(IX + 0x06, 0x1f); m.mem.write8(0x8d4b, 0x05);    // (0x1f+1)&0x1f = 0 < 5 -> C

  loc_343e(m);

  assert.deepEqual(m.pcSeq, [
    0x3441, 0x3444, 0x3446, 0x3449, 0x344c, 0x344d, 0x3450, 0x3451, 0x3454, 0x3456, 0x3457,
    CALLER_RET,
  ], "P2 boundaries (jr nc not taken -> inc (ix+6))");
  assert.equal(m.tstates, 149, "P2 T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(IX + 0x06), 0x20, "(ix+6) incremented");
  assert.equal(m.mem.read8(IX + 0x05), 0x01, "(ix+5) stored");
});

test("loc_343e P3: column == limit, A==0 -> jp z loc_34b0 (tail)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x05, 0x00); m.mem.write8(IX + 0x09, 0x00);
  m.mem.write8(IX + 0x06, 0x00); m.mem.write8(0x8d4b, 0x00);    // A==C==0 -> Z, and a -> Z

  loc_343e(m);

  assert.deepEqual(m.pcSeq, [
    0x3441, 0x3444, 0x3449, 0x344c, 0x344d, 0x3450, 0x3451, 0x3454, 0x3456,
    0x3457, 0x3458, 0x3464, 0x3465, 0x34b0,
  ], "P3 boundaries");
  assert.equal(m.tstates, 151, "P3 T-total");
  assert.equal(m.pc, 0x34b0, "tail into loc_34b0");
  assert.deepEqual(m.calls, [0x34b0]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_343e P4: A!=0, 0x880a!=4 -> ret nz at 0x346d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x05, 0x00); m.mem.write8(IX + 0x09, 0x00);
  m.mem.write8(IX + 0x06, 0x05); m.mem.write8(0x8d4b, 0x05);    // A==C==5 -> Z; and a -> NZ
  m.mem.write8(0x880a, 0x00);                                   // != 4 -> ret nz

  loc_343e(m);

  assert.deepEqual(m.pcSeq, [
    0x3441, 0x3444, 0x3449, 0x344c, 0x344d, 0x3450, 0x3451, 0x3454, 0x3456, 0x3457,
    0x3458, 0x3464, 0x3465, 0x3468, 0x346b, 0x346d, CALLER_RET,
  ], "P4 boundaries");
  assert.equal(m.tstates, 182, "P4 T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
});

test("loc_343e P5: 0x880a==4, (ix+9) < b -> ret c at 0x3472", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x05, 0x08); m.mem.write8(IX + 0x09, 0x00); // b becomes 0x08
  m.mem.write8(IX + 0x06, 0x08); m.mem.write8(0x8d4b, 0x08);    // A==C==8 -> Z; and a -> NZ
  m.mem.write8(0x880a, 0x04);                                   // == 4 -> ret nz not taken

  loc_343e(m);

  assert.deepEqual(m.pcSeq, [
    0x3441, 0x3444, 0x3449, 0x344c, 0x344d, 0x3450, 0x3451, 0x3454, 0x3456, 0x3457,
    0x3458, 0x3464, 0x3465, 0x3468, 0x346b, 0x346d, 0x346e, 0x3471, 0x3472, CALLER_RET,
  ], "P5 boundaries");
  assert.equal(m.tstates, 210, "P5 T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
});

test("loc_343e P6: into 0x3473, 0x8f63!=0 -> latch (ix+1)=1, ret at 0x347e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x05, 0x00); m.mem.write8(IX + 0x09, 0x00); // (ix+9)==b==0 -> ret c not taken
  m.mem.write8(IX + 0x06, 0x05); m.mem.write8(0x8d4b, 0x05);
  m.mem.write8(0x880a, 0x04);
  m.mem.write8(0x8f63, 0x01);                                  // != 0 -> jp z not taken

  loc_343e(m);

  assert.deepEqual(m.pcSeq, [
    0x3441, 0x3444, 0x3449, 0x344c, 0x344d, 0x3450, 0x3451, 0x3454, 0x3456, 0x3457,
    0x3458, 0x3464, 0x3465, 0x3468, 0x346b, 0x346d, 0x346e, 0x3471, 0x3472, 0x3473,
    0x3476, 0x3477, 0x347a, 0x347e, CALLER_RET,
  ], "P6 boundaries");
  assert.equal(m.tstates, 260, "P6 T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(IX + 0x01), 0x01, "(ix+1) latched to 1");
});

test("loc_343e P7: into 0x347f, phase>=0x07 -> jr nc loc_34b0 (tail)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x05, 0x00); m.mem.write8(IX + 0x09, 0x00);
  m.mem.write8(IX + 0x06, 0x05); m.mem.write8(0x8d4b, 0x05);
  m.mem.write8(0x880a, 0x04);
  m.mem.write8(0x8f63, 0x00);                                  // == 0 -> jp z taken -> 0x347f
  m.mem.write8(0x8d43, 0x08);                                 // >= 0x07 -> jr nc taken

  loc_343e(m);

  assert.deepEqual(m.pcSeq, [
    0x3441, 0x3444, 0x3449, 0x344c, 0x344d, 0x3450, 0x3451, 0x3454, 0x3456, 0x3457,
    0x3458, 0x3464, 0x3465, 0x3468, 0x346b, 0x346d, 0x346e, 0x3471, 0x3472, 0x3473,
    0x3476, 0x3477, 0x347f, 0x3483, 0x3486, 0x3487, 0x3489, 0x34b0,
  ], "P7 boundaries");
  assert.equal(m.tstates, 286, "P7 T-total");
  assert.equal(m.pc, 0x34b0, "tail into loc_34b0");
  assert.deepEqual(m.calls, [0x34b0]);
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(IX + 0x01), 0x00, "(ix+1) cleared at 0x347f");
});

test("loc_343e P8: full row re-arm (phase<0x07 -> inc, rst 0x20, 0x86e3 band) -> fall into loc_34b0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x05, 0x00); m.mem.write8(IX + 0x09, 0x00);
  m.mem.write8(IX + 0x06, 0x05); m.mem.write8(0x8d4b, 0x05);
  m.mem.write8(0x880a, 0x04);
  m.mem.write8(0x8f63, 0x00);
  m.mem.write8(0x8d43, 0x03);                                 // < 0x07 -> jr nc not taken; < 0x0a -> inc (hl)

  loc_343e(m);

  assert.deepEqual(m.pcSeq, [
    0x3441, 0x3444, 0x3449, 0x344c, 0x344d, 0x3450, 0x3451, 0x3454, 0x3456, 0x3457,
    0x3458, 0x3464, 0x3465, 0x3468, 0x346b, 0x346d, 0x346e, 0x3471, 0x3472, 0x3473,
    0x3476, 0x3477, 0x347f, 0x3483, 0x3486, 0x3487, 0x3489, 0x348b, 0x348d, 0x348f,
    0x3490, 0x3491, 0x3494, 0x0020, 0x3498, 0x349b, 0x349e, 0x34a0, 0x34a1, 0x34a3,
    0x34a5, 0x34a6, 0x34a8, 0x34a9, 0x34ab, 0x34ad, 0x34b0,
  ], "P8 boundaries (rst 0x20 visits 0x0020, then falls into loc_34b0)");
  assert.equal(m.tstates, 457, "P8 T-total");
  assert.equal(m.pc, 0x34b0, "fall-through tail into loc_34b0");
  assert.deepEqual(m.calls, [0x0020, 0x34b0], "rst 0x20 then the fall-through tail");
  assert.equal(m.regs.sp, 0x8780, "rst push16 balanced; tail pops seated CALLER_RET");
  assert.equal(m.mem.read8(0x8d43), 0x04, "phase incremented");
  assert.equal(m.mem.read8(0x86e3), 0xd8, "band tile 0");
  assert.equal(m.mem.read8(0x86e4), 0xd9, "band tile 1");
  assert.equal(m.mem.read8(0x8703), 0xda, "band tile 2 (hl += 0x1f)");
  assert.equal(m.mem.read8(0x8704), 0xdb, "band tile 3");
  assert.equal(m.mem.read8(0x8f63), 0x01, "0x8f63 armed");
});

test("loc_343e MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught on P8", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x34a6 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(IX + 0x05, 0x00); m.mem.write8(IX + 0x09, 0x00);
  m.mem.write8(IX + 0x06, 0x05); m.mem.write8(0x8d4b, 0x05);
  m.mem.write8(0x880a, 0x04); m.mem.write8(0x8f63, 0x00); m.mem.write8(0x8d43, 0x03);

  loc_343e(m);

  assert.equal(m.tstates, 453, "mutation loses 4 T");
  assert.throws(() => assert.equal(m.tstates, 457, "P8 golden"), /457/,
    "the 457-T golden must fail on the mutant");
});

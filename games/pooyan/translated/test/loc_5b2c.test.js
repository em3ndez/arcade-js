// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5b2c (ROM 0x5b2c, Pooyan) -- end-of-wave object-table cleanup.
 * Gated by 0x8d75 (ret z) and 0x8d79 (ret nz). When 0x8d77==0 it scans 6 records at 0x8ae4
 * (stride 0x18) for a first byte == C (0x13, or 0x0b when 0x8907 bit0 set); a miss-through rets
 * at 0x5b56, a hit -- or 0x8d77 set -- falls into the exx sweep that calls loc_5b71 (BOUNDARY)
 * six times over IX objects at 0x8ae0 then zeroes 0x8d75/0x8f20.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`).
 * loc_5b71 is a boundary with no result loc_5b2c reads, so no net register effect is modelled; the
 * push16(0x5b64)/callee-ret pair stays balanced, and the final ret at 0x5b70 unwinds CALLER_RET.
 *
 * Paths: A ret z, B ret nz, C scan exhaust (bit0=1 -> c=0x0b), D scan hit (bit0=0 -> c=0x13) ->
 * exx sweep, E 0x8d77 set -> exx sweep. TEETH: mis-charge `ld ix,nn` (14 T) as 10 T on path E.
 *
 * Run: node --test games/pooyan/translated/test/loc_5b2c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5b2c } from "../loc_5b2c.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5b2c, pcSeq: [],
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
    // The callee's `ret` pops the return address loc_5b2c pushed at the call site -- model that pop so
    // the stack stays balanced (a missing push16 then desyncs SP and fails the baseline tooth).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_5b2c A: 0x8d75==0 -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d75, 0x00);

  loc_5b2c(m);

  assert.equal(m.tstates, 28, "ld a + and a + ret z");
  assert.deepEqual(m.pcSeq, [0x5b2f, 0x5b30, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
  assert.deepEqual(m.calls, []);
});

test("loc_5b2c B: 0x8d79!=0 -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d75, 0x01);
  m.mem.write8(0x8d79, 0x01);

  loc_5b2c(m);

  assert.equal(m.tstates, 50);
  assert.deepEqual(m.pcSeq, [0x5b2f, 0x5b30, 0x5b31, 0x5b34, 0x5b35, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
});

test("loc_5b2c C: scan exhaust (bit0=1 -> c=0x0b, no hit) -> ret 0x5b56", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d75, 0x01);
  m.mem.write8(0x8d79, 0x00);
  m.mem.write8(0x8d77, 0x00);
  m.mem.write8(0x8907, 0x01); // bit0 set -> c = 0x0b
  for (const a of [0x8ae4, 0x8afc, 0x8b14, 0x8b2c, 0x8b44, 0x8b5c]) m.mem.write8(a, 0xff);

  loc_5b2c(m);

  assert.equal(m.tstates, 394);
  assert.deepEqual(m.pcSeq, [
    0x5b2f, 0x5b30, 0x5b31, 0x5b34, 0x5b35, 0x5b36, 0x5b39, 0x5b3a, 0x5b3c,
    0x5b3f, 0x5b42, 0x5b44, 0x5b46, 0x5b49, 0x5b4b, 0x5b4d, 0x5b4f,
    0x5b50, 0x5b51, 0x5b53, 0x5b54, 0x5b4f,
    0x5b50, 0x5b51, 0x5b53, 0x5b54, 0x5b4f,
    0x5b50, 0x5b51, 0x5b53, 0x5b54, 0x5b4f,
    0x5b50, 0x5b51, 0x5b53, 0x5b54, 0x5b4f,
    0x5b50, 0x5b51, 0x5b53, 0x5b54, 0x5b4f,
    0x5b50, 0x5b51, 0x5b53, 0x5b54, 0x5b56, CALLER_RET,
  ]);
  assert.equal(m.regs.c, 0x0b, "bit0 set -> c stayed 0x0b");
  assert.equal(m.regs.b, 0x00, "djnz drained B");
  assert.equal(m.regs.hl, (0x8ae4 + 6 * 0x18) & 0xffff, "hl advanced 6 records");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
  assert.deepEqual(m.calls, [], "scan path calls nothing");
  assert.equal(m.mem.read8(0x8d75), 0x01, "wave flag untouched on the scan-exhaust exit");
});

test("loc_5b2c D: scan hit on record 2 (bit0=0 -> c=0x13) -> exx sweep clears flags", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d75, 0x01);
  m.mem.write8(0x8d79, 0x00);
  m.mem.write8(0x8d77, 0x00);
  m.mem.write8(0x8907, 0x00); // bit0 clear -> c = 0x13, jr z 0x5b4f taken
  m.mem.write8(0x8ae4, 0x00);        // record 0: no match
  m.mem.write8(0x8ae4 + 0x18, 0x13); // record 1: match

  loc_5b2c(m);

  assert.equal(m.tstates, 584);
  assert.deepEqual(m.pcSeq, [
    0x5b2f, 0x5b30, 0x5b31, 0x5b34, 0x5b35, 0x5b36, 0x5b39, 0x5b3a, 0x5b3c,
    0x5b3f, 0x5b42, 0x5b44, 0x5b46, 0x5b49, 0x5b4b, 0x5b4f,
    0x5b50, 0x5b51, 0x5b53, 0x5b54, 0x5b4f,
    0x5b50, 0x5b51, 0x5b57,
    0x5b5b, 0x5b5e, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b69,
    0x5b6a, 0x5b6d, 0x5b70, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x5b71, 0x5b71, 0x5b71, 0x5b71, 0x5b71, 0x5b71], "loc_5b71 x6");
  assert.equal(m.regs.ix, (0x8ae0 + 6 * 0x18) & 0xffff, "IX swept 6 objects");
  assert.equal(m.mem.read8(0x8d75), 0x00, "wave flag 0x8d75 cleared");
  assert.equal(m.mem.read8(0x8f20), 0x00, "0x8f20 cleared");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "every push16(0x5b64) matched a callee ret; ret 0x5b70 unwinds CALLER_RET");
});

test("loc_5b2c E: 0x8d77 set -> jr nz -> exx sweep", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d75, 0x01);
  m.mem.write8(0x8d79, 0x00);
  m.mem.write8(0x8d77, 0x01); // jr nz taken to 0x5b57

  loc_5b2c(m);

  assert.equal(m.tstates, 457);
  assert.deepEqual(m.pcSeq, [
    0x5b2f, 0x5b30, 0x5b31, 0x5b34, 0x5b35, 0x5b36, 0x5b39, 0x5b3a, 0x5b57,
    0x5b5b, 0x5b5e, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b60,
    0x5b61, 0x5b71, 0x5b65, 0x5b67, 0x5b69,
    0x5b6a, 0x5b6d, 0x5b70, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x5b71, 0x5b71, 0x5b71, 0x5b71, 0x5b71, 0x5b71]);
  assert.equal(m.regs.ix, (0x8ae0 + 6 * 0x18) & 0xffff);
  assert.equal(m.mem.read8(0x8d75), 0x00);
  assert.equal(m.mem.read8(0x8f20), 0x00);
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_5b2c MUTATION: `ld ix,nn` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5b5b ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d75, 0x01);
  m.mem.write8(0x8d79, 0x00);
  m.mem.write8(0x8d77, 0x01);

  loc_5b2c(m);

  assert.equal(m.tstates, 453, "mutation loses 4 T (14 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 457, "path E T-state total"),
    /457/,
    "the 457-T golden must fail on the mutant",
  );
});

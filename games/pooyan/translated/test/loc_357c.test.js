// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_357c (ROM 0x357c, Pooyan) -- target-tile resolver + state step.
 * (0x8d79)==0 picks a table row (loc_0c45) then a column (rst 0x20) to get the wanted tile; (0x8d79)!=0
 * revives an alternate lane where bit2 of (ix+7) chooses the direct re-entry (0x359e, skipping the
 * lookup) or a second table base re-entered at the rst 0x20. Common tail: compare (ix+6) with the tile
 * -> exact match tail-jumps loc_3617; below 0x14 rets; else latch (ix+8) and tail-jump loc_381e with a
 * script chosen by (ix+7) bit1.
 *
 * The mock's `call` POPS the pushed return (modelling each callee's `ret`): loc_0c45 sets DE=row word /
 * HL=base+2*idx+1 / A=2*idx; loc_0020 sets HL=HL+A / A=mem[HL]. A call site missing its push16 desyncs
 * SP and the pre-seat-baseline tooth fires.
 *
 * Paths: HIT (main lane, cp c equal -> tail loc_3617); RETC (main lane, cp c below -> ret c); REVIVE_Z
 * (nz lane, bit2 clear -> 0x359e re-entry, script 0x3838); REVIVE_NZ (nz lane, bit2 set -> rst-lookup,
 * cp c above, script 0x3856). TEETH: mis-charge `ld a,(ix+0x06)` (19 T) as 15 T -> the golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_357c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_357c } from "../loc_357c.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x357c, pcSeq: [],
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
    // Each callee's `ret` pops the return the call site pushed (a missing push16 then desyncs SP).
    // loc_0c45: DE=row word, HL=base+2*idx+1, A=2*idx. loc_0020: HL=HL+A, A=mem[HL]. loc_3617/loc_381e
    // are tail targets that return via their own ret -- just pop.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0c45) {
        const idx = regs.a;
        const ea = (regs.hl + 2 * idx) & 0xffff;
        regs.a = (2 * idx) & 0xff;
        regs.de = mem.read16(ea);
        regs.hl = (ea + 1) & 0xffff;
      } else if (addr === 0x0020) {
        const hl2 = (regs.hl + regs.a) & 0xffff;
        regs.hl = hl2;
        regs.a = mem.read8(hl2);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const IX = 0x9000;

// Main-lane setup: (0x8d79)==0 -> row via loc_0c45 (idx from (0x8907)&0x0f >>1), column via rst 0x20
// (idx from (0x8d41)&7). Row base word at 0x35cb = 0x3700; resolved tile at 0x3703.
function armMain(m, tile) {
  m.mem.write8(0x8d79, 0x00);
  m.mem.write8(0x8907, 0x04);   // &0x0f=4 -> srl -> idx 2
  m.mem.write16(0x35cb, 0x3700); // loc_0c45 row word (base 0x35c7 + 2*2 + 1 read here)
  m.mem.write8(0x8d41, 0x03);   // column idx 3
  m.mem.write8(0x3703, tile);   // rst 0x20 -> mem[0x3700 + 3]
  m.regs.ix = IX;
}

test("loc_357c Path HIT: main lane, (ix+6) equals the tile -> tail-jump loc_3617", () => {
  const m = makeMachine();
  seatCaller(m);
  armMain(m, 0x25);
  m.mem.write8(IX + 0x06, 0x25); // (ix+6) == resolved tile

  loc_357c(m);

  assert.equal(m.tstates, 151, "Path HIT T-state total");
  assert.deepEqual(m.pcSeq, [
    0x357f, 0x3580, 0x3582, 0x3585, 0x3588, 0x358a, 0x358c, 0x0c45,
    0x3590, 0x3593, 0x3595, 0x0020, 0x3597, 0x359a, 0x359b, 0x3617,
  ]);
  assert.equal(m.pc, 0x3617, "tail jp lands on loc_3617");
  assert.deepEqual(m.calls, [0x0c45, 0x0020, 0x3617]);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_357c Path RETC: main lane, (ix+6) below the tile and below 0x14 -> ret c", () => {
  const m = makeMachine();
  seatCaller(m);
  armMain(m, 0x25);
  m.mem.write8(IX + 0x06, 0x10); // (ix+6) < tile (cp c -> carry) and < 0x14 (cp 0x14 -> carry)

  loc_357c(m);

  assert.equal(m.tstates, 169, "Path RETC T-state total");
  assert.deepEqual(m.pcSeq, [
    0x357f, 0x3580, 0x3582, 0x3585, 0x3588, 0x358a, 0x358c, 0x0c45,
    0x3590, 0x3593, 0x3595, 0x0020, 0x3597, 0x359a, 0x359b, 0x359e, 0x35a0, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret c to the seated caller");
  assert.deepEqual(m.calls, [0x0c45, 0x0020]);
  assert.equal(m.mem.read8(IX + 0x08), 0x00, "(ix+8) latch untouched");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_357c Path REVIVE_Z: nz lane, (ix+7) bit2 clear -> 0x359e re-entry, script 0x3838", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d79, 0x01);   // nz lane
  m.regs.ix = IX;
  m.mem.write8(IX + 0x07, 0x00); // bit2 clear -> jr z,0x35c2; bit1 clear -> script 0x3838
  m.mem.write8(IX + 0x06, 0x30); // >= 0x14 -> no ret c

  loc_357c(m);

  assert.equal(m.tstates, 175, "Path REVIVE_Z T-state total");
  assert.deepEqual(m.pcSeq, [
    0x357f, 0x3580, 0x35b4, 0x35b8, 0x35c2, 0x35c5, 0x359e, 0x35a0,
    0x35a1, 0x35a5, 0x35a8, 0x35ac, 0x35b1, 0x381e,
  ]);
  assert.equal(m.pc, 0x381e, "tail jp lands on loc_381e");
  assert.deepEqual(m.calls, [0x381e], "no rst 0x20 -- the lookup was skipped");
  assert.equal(m.mem.read8(IX + 0x08), 0x01, "(ix+8) latch set");
  assert.equal(m.regs.de, 0x3838, "script 0x3838 (bit1 clear)");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_357c Path REVIVE_NZ: nz lane, (ix+7) bit2 set -> rst-lookup, cp above, script 0x3856", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d79, 0x01);   // nz lane
  m.regs.ix = IX;
  m.mem.write8(IX + 0x07, 0x06); // bit2 set -> 0x35ba; bit1 set -> script 0x3856
  m.mem.write16(0x8d6f, 0x3700); // second table base
  m.mem.write8(0x8d7b, 0x03);   // rst 0x20 index
  m.mem.write8(0x3703, 0x40);   // resolved tile
  m.mem.write8(IX + 0x06, 0x50); // > tile (cp c -> no carry, nz) and >= 0x14

  loc_357c(m);

  assert.equal(m.tstates, 233, "Path REVIVE_NZ T-state total");
  assert.deepEqual(m.pcSeq, [
    0x357f, 0x3580, 0x35b4, 0x35b8, 0x35ba, 0x35bd, 0x35c0, 0x3595, 0x0020,
    0x3597, 0x359a, 0x359b, 0x359e, 0x35a0, 0x35a1, 0x35a5, 0x35a8, 0x35ac, 0x35ae, 0x35b1, 0x381e,
  ]);
  assert.equal(m.pc, 0x381e);
  assert.deepEqual(m.calls, [0x0020, 0x381e]);
  assert.equal(m.mem.read8(IX + 0x08), 0x01, "(ix+8) latch set");
  assert.equal(m.regs.de, 0x3856, "script 0x3856 (bit1 set)");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_357c MUTATION: `ld a,(ix+0x06)` mis-charged 15T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x359a ? 15 : cycles);
  seatCaller(m);
  armMain(m, 0x25);
  m.mem.write8(IX + 0x06, 0x25);

  loc_357c(m);

  assert.equal(m.tstates, 147, "mutation loses 4 T (19 -> 15)");
  assert.throws(() => assert.equal(m.tstates, 151), /151/, "the 151-T golden must fail on the mutant");
});

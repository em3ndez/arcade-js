// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5ebd (ROM 0x5ebd, Pooyan) -- one iteration of the 0x5e98 actor
 * sweep. Skips empty/high-state slots, screens the actor via loc_5f53 (E,A + carry gate) and an
 * |dx|<0x0a / |dy|<0x09 window (each distance folded through a conditional `neg`); any miss
 * tail-jumps the loop tail 0x5f06. A hit clears (hl), writes 01/08 into hl+1/hl+2, reloads the
 * latched target from 0x8d65 and -- unless (ix+0x07) bit0 is set (jr nz -> loc_5f02) -- rst-0x10
 * memsets 0x17 bytes before falling through to loc_5f02.
 *
 * The mock's `call` POPS the pushed return address (modelling the callee's `ret`); loc_5f53 is
 * additionally modelled -- it fills E,A and leaves the `cp 0xe0` carry the caller's `jr nc` reads.
 * Because it pops, a call site missing its push16 desyncs SP (the positive control below deletes the
 * push16 before `call 0x5f53` and the HIT-RST SP tooth then fails).
 *
 * Paths cover both outcomes of every conditional: EMPTY (jr z), STATE>=4 (cp 0x04 jr nc),
 * 5F53-NC (off-screen jr nc), DX-FAR (dx-sign no-neg + dx jr nc), DY-FAR (dy-sign no-neg + dy jr nc),
 * HIT-RST (both distances via neg, bit0 clear -> rst + fall to loc_5f02) and HIT-NMI (bit0 set ->
 * jr nz to loc_5f02). TEETH: mis-charge `ld a,(iy+0)` (19 T) as 7 T -> the HIT golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5ebd.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5ebd } from "../loc_5ebd.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5ebd, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed -- model that pop (a missing
    // push16 then desyncs SP). loc_5f53's net effect: E=(ix+0)+off, A=(ix+2)+8, carry from `cp 0xe0`.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x5f53) {
        const off = (mem.read8(0x881f) !== 0) ? 0x06 : 0xfe;
        regs.e = (mem.read8((regs.ix + 0x00) & 0xffff) + off) & 0xff;
        regs.a = (mem.read8((regs.ix + 0x02) & 0xffff) + 0x08) & 0xff;
        regs.cp(0xe0);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// A slot that reaches the loc_5f53 screen: (hl)!=0 and state (hl+2) < 4. HL=0x8c30, IX=0x8888, IY=0x8840.
function seatSlot(m) {
  seatCaller(m);
  m.regs.hl = 0x8c30;
  m.regs.ix = 0x8888;
  m.regs.iy = 0x8840;
  m.mem.write8(0x8c30, 0x01); // (hl) != 0
  m.mem.write8(0x8c32, 0x02); // state < 4
  m.mem.write8(0x881f, 0x01); // loc_5f53 offset select -> 0x06
}

test("loc_5ebd Path EMPTY: (hl)==0 -> jr z 0x5f06", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8c30;
  m.mem.write8(0x8c30, 0x00);

  loc_5ebd(m);

  assert.equal(m.tstates, 7 + 4 + 12, "EMPTY total (=23)");
  assert.deepEqual(m.pcSeq, [0x5ebe, 0x5ebf, 0x5f06]);
  assert.equal(m.pc, 0x5f06);
  assert.deepEqual(m.calls, [0x5f06]);
  assert.equal(m.regs.sp, 0x8780, "tail loop-tail ret consumed CALLER_RET");
});

test("loc_5ebd Path STATE>=4: state byte >= 4 -> cp 0x04 jr nc 0x5f06", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8c30;
  m.mem.write8(0x8c30, 0x01);
  m.mem.write8(0x8c32, 0x04); // state == 4 -> no borrow -> NC

  loc_5ebd(m);

  assert.equal(m.tstates, 7 + 4 + 7 + 4 + 4 + 7 + 4 + 4 + 7 + 12, "STATE>=4 total (=60)");
  assert.deepEqual(m.pcSeq, [
    0x5ebe, 0x5ebf, 0x5ec1, 0x5ec2, 0x5ec3, 0x5ec4, 0x5ec5, 0x5ec6, 0x5ec8, 0x5f06,
  ]);
  assert.deepEqual(m.calls, [0x5f06]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5ebd Path 5F53-NC: loc_5f53 returns off-screen (NC) -> jr nc 0x5f06", () => {
  const m = makeMachine();
  seatSlot(m);
  m.mem.write8(0x888a, 0xd8); // (ix+2) -> A=0xe0 -> cp 0xe0 no borrow -> NC

  loc_5ebd(m);

  assert.equal(m.tstates, 60 - 12 + 7 + 17 + 12, "5F53-NC total (=84)");
  assert.deepEqual(m.pcSeq, [
    0x5ebe, 0x5ebf, 0x5ec1, 0x5ec2, 0x5ec3, 0x5ec4, 0x5ec5, 0x5ec6, 0x5ec8, 0x5eca, 0x5f53, 0x5f06,
  ]);
  assert.deepEqual(m.calls, [0x5f53, 0x5f06]);
  assert.equal(m.regs.sp, 0x8780, "push16(0x5ecd) matched loc_5f53's ret; tail then unwound CALLER_RET");
});

test("loc_5ebd Path DX-FAR: dx no-neg and |dx| >= 0x0a -> jr nc 0x5f06", () => {
  const m = makeMachine();
  seatSlot(m);
  m.mem.write8(0x8888, 0x10); // (ix+0) -> E = 0x16
  m.mem.write8(0x888a, 0x40); // (ix+2) -> A = 0x48 < 0xe0 -> carry set -> on-screen
  m.mem.write8(0x8840, 0x40); // (iy+0) 0x40 - E 0x16 = 0x2a (no borrow, no neg), >= 0x0a

  loc_5ebd(m);

  assert.equal(m.tstates, 137, "DX-FAR total");
  assert.deepEqual(m.pcSeq, [
    0x5ebe, 0x5ebf, 0x5ec1, 0x5ec2, 0x5ec3, 0x5ec4, 0x5ec5, 0x5ec6, 0x5ec8, 0x5eca, 0x5f53,
    0x5ecf, 0x5ed0, 0x5ed3, 0x5ed4, 0x5ed8, 0x5eda, 0x5f06,
  ]);
  assert.deepEqual(m.calls, [0x5f53, 0x5f06]);
  assert.equal(m.regs.d, 0x48, "D = loc_5f53's A");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5ebd Path DY-FAR: dx in range, dy no-neg and |dy| >= 0x09 -> jr nc 0x5f06", () => {
  const m = makeMachine();
  seatSlot(m);
  m.mem.write8(0x8888, 0x30); // (ix+0) -> E = 0x36
  m.mem.write8(0x888a, 0x40); // (ix+2) -> A = 0x48 -> on-screen, D = 0x48
  m.mem.write8(0x8840, 0x38); // (iy+0) 0x38 - 0x36 = 0x02 -> |dx| in range
  m.mem.write8(0x8842, 0x60); // (iy+2) 0x60+8=0x68 - D 0x48 = 0x20 (no neg), >= 0x09

  loc_5ebd(m);

  assert.equal(m.tstates, 193, "DY-FAR total");
  assert.deepEqual(m.pcSeq, [
    0x5ebe, 0x5ebf, 0x5ec1, 0x5ec2, 0x5ec3, 0x5ec4, 0x5ec5, 0x5ec6, 0x5ec8, 0x5eca, 0x5f53,
    0x5ecf, 0x5ed0, 0x5ed3, 0x5ed4, 0x5ed8, 0x5eda, 0x5edc, 0x5edf, 0x5ee1, 0x5ee2, 0x5ee6, 0x5ee8, 0x5f06,
  ]);
  assert.deepEqual(m.calls, [0x5f53, 0x5f06]);
  assert.equal(m.regs.sp, 0x8780);
});

// HIT setup: both distances fold through `neg`, actor inside the window. Target latched at 0x8d65.
function seatHit(m) {
  seatSlot(m);
  m.mem.write8(0x8888, 0x30); // (ix+0) -> E = 0x36
  m.mem.write8(0x888a, 0x40); // (ix+2) -> A = 0x48 -> on-screen, D = 0x48
  m.mem.write8(0x8840, 0x30); // (iy+0) 0x30 - 0x36 borrow -> neg -> |dx| = 0x06 (< 0x0a)
  m.mem.write8(0x8842, 0x38); // (iy+2) 0x38+8=0x40 - 0x48 borrow -> neg -> |dy| = 0x08 (< 0x09)
  m.mem.write16(0x8d65, 0x8c90); // latched target
}

test("loc_5ebd Path HIT-RST: window hit, (ix+7) bit0 clear -> rst 0x10 + fall to loc_5f02", () => {
  const m = makeMachine();
  seatHit(m);
  m.mem.write8(0x8c97, 0x00); // (ix+7) bit0 clear -> jr nz not taken -> rst path

  loc_5ebd(m);

  assert.equal(m.tstates, 318, "HIT-RST total");
  assert.deepEqual(m.pcSeq, [
    0x5ebe, 0x5ebf, 0x5ec1, 0x5ec2, 0x5ec3, 0x5ec4, 0x5ec5, 0x5ec6, 0x5ec8, 0x5eca, 0x5f53,
    0x5ecf, 0x5ed0, 0x5ed3, 0x5ed4, 0x5ed6, 0x5ed8, 0x5eda, 0x5edc, 0x5edf, 0x5ee1, 0x5ee2, 0x5ee4, 0x5ee6, 0x5ee8,
    0x5eea, 0x5eeb, 0x5eec, 0x5eed, 0x5eef, 0x5ef0, 0x5ef2, 0x5ef6, 0x5efa, 0x5efc, 0x5eff, 0x5f01, 0x0010,
  ]);
  assert.deepEqual(m.calls, [0x5f53, 0x0010, 0x5f02], "loc_5f53, then rst-0x10, then fall to loc_5f02");
  assert.equal(m.mem.read8(0x8c30), 0x00, "(hl) cleared on the hit");
  assert.equal(m.mem.read8(0x8c31), 0x01, "hl+1 <- 0x01");
  assert.equal(m.mem.read8(0x8c32), 0x08, "hl+2 <- 0x08");
  assert.equal(m.regs.ix, 0x8c90, "IX reloaded from the 0x8d65 latch");
  assert.equal(m.regs.hl, 0x8c90, "HL reloaded from the 0x8d65 latch for the memset");
  assert.equal(m.regs.b, 0x17, "memset count");
  assert.equal(m.regs.sp, 0x8780, "every push16 matched a callee ret; tail to loc_5f02 unwound CALLER_RET");
});

test("loc_5ebd Path HIT-NMI: window hit, (ix+7) bit0 set -> jr nz 0x5f02", () => {
  const m = makeMachine();
  seatHit(m);
  m.mem.write8(0x8c97, 0x01); // (ix+7) bit0 set -> jr nz taken -> skip the memset

  loc_5ebd(m);

  assert.equal(m.tstates, 289, "HIT-NMI total");
  assert.deepEqual(m.pcSeq, [
    0x5ebe, 0x5ebf, 0x5ec1, 0x5ec2, 0x5ec3, 0x5ec4, 0x5ec5, 0x5ec6, 0x5ec8, 0x5eca, 0x5f53,
    0x5ecf, 0x5ed0, 0x5ed3, 0x5ed4, 0x5ed6, 0x5ed8, 0x5eda, 0x5edc, 0x5edf, 0x5ee1, 0x5ee2, 0x5ee4, 0x5ee6, 0x5ee8,
    0x5eea, 0x5eeb, 0x5eec, 0x5eed, 0x5eef, 0x5ef0, 0x5ef2, 0x5ef6, 0x5efa, 0x5f02,
  ]);
  assert.deepEqual(m.calls, [0x5f53, 0x5f02], "no rst-0x10 on the NMI-armed path");
  assert.equal(m.pc, 0x5f02, "jr nz tail-jumps loc_5f02");
  assert.equal(m.mem.read8(0x8c32), 0x08, "hl+2 <- 0x08 on the hit");
  assert.equal(m.regs.ix, 0x8c90, "IX reloaded from the 0x8d65 latch");
  assert.equal(m.regs.sp, 0x8780, "push16(0x5ecd) balanced; tail to loc_5f02 unwound CALLER_RET");
});

test("loc_5ebd MUTATION: `ld a,(iy+0)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5ed3 ? 7 : cycles);
  seatHit(m);
  m.mem.write8(0x8c97, 0x00);

  loc_5ebd(m);

  assert.equal(m.tstates, 306, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 318, "HIT-RST total"),
    /318/,
    "the 318-T golden must fail on the mutant",
  );
});

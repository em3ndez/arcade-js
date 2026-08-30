// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1496 (ROM 0x1496-0x14db, Pooyan) -- a per-object worker.
 * IX = the object record. It calls 0x4006, advances the position field (ix+0x03) by the signed
 * step (ix+0x0a) (decrementing the lap counter (ix+0x04) when the pos rolled under -step), then
 * reloads B = (ix+0x04) and dispatches on the active flag (ix+0x07):
 *   active (07 != 0):  B>=4 -> return (ix+0x06); B<4 -> (ix+02)=0, (ix+11)=0x20; ret
 *   inactive (07 == 0): B>=2 -> ret nc; B<2 -> call 0x381e (DE=0x3bd1), (ix+02)=2, (ix+11)=0x28; ret
 *
 * The mock models a `call` as the callee running to its own ret (SP rebalanced) and seats a
 * caller return so a `ret` proves which exit fired. Golden T-states are hand-computed from the
 * standard Z80 timings (IX ops: ld/add=19, inc/dec (ix+d)=23, ld (ix+d),n=19).
 *
 * Pinned paths:
 *   P1 active, jr nc taken, B>=4 -> ret via (ix+06). T = 217.
 *   P2 active, jr nc NOT taken (dec lap), B<4 -> loc_14c0. T = 259.
 *   P3 inactive, ret nc taken (B>=2). T = 197.
 *   P4 inactive, B<2 -> call 0x381e path. T = 266.
 *
 * TEETH: mis-charge `dec (ix+0x04)` (23 T) as 11 T on P2 -- the golden must catch it.
 * Run: node --test games/pooyan/translated/test/loc_1496.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1496 } from "../loc_1496.js";

const CALLER_RET = 0xabcd;
const IX = 0x9000;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1496, pcSeq: [],
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
    // model the callee running to its own ret: pop the seated return so SP rebalances
    call(addr, site) { this.calls.push(addr); this.site = site; regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_1496 P1: active object, jr nc taken, B>=4 -> ret via (ix+0x06)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xff); // step -> neg = 0x01 = B for the cp
  m.mem.write8(IX + 0x03, 0x50); // pos 0x50 >= 0x01 -> jr nc taken, skip lap dec
  m.mem.write8(IX + 0x04, 0x05); // lap counter -> B = 5 for the dispatch
  m.mem.write8(IX + 0x07, 0x01); // active
  m.mem.write8(IX + 0x06, 0x77); // returned value

  loc_1496(m);

  assert.equal(m.tstates, 217, "T = 17+19+8+4+19+4 +12(jrnc) +19+19+19+19+4 +7(jrz nt) +4+7+7(jrc nt) +19 +10");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x149c, 0x149e, 0x149f, 0x14a2, 0x14a3, 0x14a8, 0x14ab, 0x14ae, 0x14b1,
    0x14b4, 0x14b5, 0x14b7, 0x14b8, 0x14ba, 0x14bc, 0x14bf, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x4006], "only the pre-update call fires on P1");
  assert.equal(m.pc, CALLER_RET, "returns to the seated caller");
  assert.equal(m.regs.a, 0x77, "A = (ix+0x06) at the ret");
  assert.equal(m.mem.read8(IX + 0x03), 0x4f, "pos advanced: 0x50 + 0xff = 0x4f");
  assert.equal(m.regs.sp, 0x8780, "SP balanced: push/call pair + ret cancel the seated caller");
});

test("loc_1496 P2: active, jr nc NOT taken (dec lap), B<4 -> loc_14c0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xf0); // step -> neg = 0x10 = B
  m.mem.write8(IX + 0x03, 0x08); // pos 0x08 < 0x10 -> carry -> jr nc NOT taken -> dec lap
  m.mem.write8(IX + 0x04, 0x03); // lap counter 3 -> dec -> 2 -> B = 2 for dispatch (< 4)
  m.mem.write8(IX + 0x07, 0x01); // active

  loc_1496(m);

  assert.equal(m.tstates, 259, "T = 71 +7(jrnc nt) +23(dec) +80 +7(jrz nt) +4+7 +12(jrc) +19+19 +10");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x149c, 0x149e, 0x149f, 0x14a2, 0x14a3, 0x14a5, 0x14a8, 0x14ab, 0x14ae,
    0x14b1, 0x14b4, 0x14b5, 0x14b7, 0x14b8, 0x14ba, 0x14c0, 0x14c4, 0x14c8, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(IX + 0x04), 0x02, "lap counter decremented 3 -> 2");
  assert.equal(m.mem.read8(IX + 0x03), 0xf8, "pos advanced: 0x08 + 0xf0 = 0xf8");
  assert.equal(m.mem.read8(IX + 0x02), 0x00, "sub-state zeroed");
  assert.equal(m.mem.read8(IX + 0x11), 0x20, "anim field set to 0x20");
});

test("loc_1496 P3: inactive object (ix+0x07)==0, B>=2 -> ret nc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xff); // step -> neg 0x01
  m.mem.write8(IX + 0x03, 0x50); // pos >= 1 -> jr nc taken
  m.mem.write8(IX + 0x04, 0x03); // B = 3 (>= 2)
  m.mem.write8(IX + 0x07, 0x00); // inactive

  loc_1496(m);

  assert.equal(m.tstates, 197, "T = 71 +12(jrnc) +80 +12(jrz) +4+7 +11(ret nc)");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x149c, 0x149e, 0x149f, 0x14a2, 0x14a3, 0x14a8, 0x14ab, 0x14ae, 0x14b1,
    0x14b4, 0x14b5, 0x14c9, 0x14ca, 0x14cc, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x4006], "0x381e is NOT reached when B >= 2");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.a, 0x03, "A = B at the ret nc");
});

test("loc_1496 P4: inactive, B<2 -> call 0x381e (DE=0x3bd1), (ix+02)=2, (ix+11)=0x28", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xff); // step -> neg 0x01
  m.mem.write8(IX + 0x03, 0x50); // jr nc taken
  m.mem.write8(IX + 0x04, 0x01); // B = 1 (< 2)
  m.mem.write8(IX + 0x07, 0x00); // inactive

  loc_1496(m);

  assert.equal(m.tstates, 266, "T = 71 +12 +80 +12 +4+7 +5(ret nc nt) +10(ld de) +17(call) +19+19 +10");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x149c, 0x149e, 0x149f, 0x14a2, 0x14a3, 0x14a8, 0x14ab, 0x14ae, 0x14b1,
    0x14b4, 0x14b5, 0x14c9, 0x14ca, 0x14cc, 0x14cd, 0x14d0, 0x381e, 0x14d7, 0x14db, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x4006, 0x381e], "both calls fire on P4");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.de, 0x3bd1, "DE = helper arg 0x3bd1");
  assert.equal(m.mem.read8(IX + 0x02), 0x02, "sub-state set to 2");
  assert.equal(m.mem.read8(IX + 0x11), 0x28, "anim field set to 0x28");
  assert.equal(m.regs.sp, 0x8780, "SP balanced across both call/ret and the final ret");
});

test("loc_1496 MUTATION: `dec (ix+0x04)` mis-charged 11T (not 23T) on P2 is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x14a8 && cycles === 23 ? 11 : cycles);
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xf0);
  m.mem.write8(IX + 0x03, 0x08); // jr nc NOT taken -> the dec runs
  m.mem.write8(IX + 0x04, 0x03);
  m.mem.write8(IX + 0x07, 0x01);

  loc_1496(m);

  assert.equal(m.tstates, 247, "mutation loses 12 T (23 -> 11): 259 - 12");
});

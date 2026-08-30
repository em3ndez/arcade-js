// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6ac5 (ROM 0x6ac5, Pooyan) -- one-shot tilemap checksum guard.
 *
 * Gated by two RAM flags: runs only when (0x892d)==2 AND (0x8f56)==0; the first pass latches
 * (0x8f56)=1. It then 16-bit-sums a strided walk of the tilemap from HL=0x8450 into DE (the walk
 * order is DATA-INDEPENDENT: 391 cells, stepping L by 1, skipping column 0x1b, and jumping +0x12
 * at column 0x1f until H reaches 0x88). Finally E must == 0xb8 and D must == 0x29 or it diverts to
 * a tamper trap (`jp 0x0929` on low mismatch, `jp 0x3829` on high mismatch); a match `ret`s.
 *
 * Loop T-states / register outcomes are cross-checked against an INDEPENDENT reference simulator
 * (scratch/sim6ac5.mjs, not the module):
 *   entry-through-`ld de,0` = 13+7+5+13+4+5+4+13+10+10 = 84 T.
 *   all-zero walk  -> E=0, D=0 -> jp 0x0929, total 31895 T, 391 cells.
 *   0xb8 @ 0x8450  -> E=0xb8, D=0 -> jp 0x3829, total 31911 T.
 *   crafted sum 0x29b8 -> E=0xb8, D=0x29 -> ret,       total 31880 T.
 *
 * Pinned paths:
 *   A  (0x892d != 2)            -> ret nz @ 6aca. T = 13+7+11 = 31.
 *   B  (0x892d==2, 0x8f56 != 0) -> ret nz @ 6acf. T = 13+7+5+13+4+11 = 53; flag NOT latched.
 *   C  all-zero walk            -> jp 0x0929.
 *   D  E=0xb8 only              -> jp 0x3829.
 *   E  crafted E=0xb8 D=0x29    -> ret.
 *
 * TEETH: mis-charge `ld a,(0x892d)` (13 T) as 7 T on path A -- the golden T-state must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_6ac5.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6ac5 } from "../loc_6ac5.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6ac5, pcSeq: [],
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
    call(addr, site) { this.calls.push(addr); this.site = site; return undefined; },
  };
}

function seatCaller(m) {
  // Keep the stack ABOVE the walked tilemap region (0x8450-0x87ff) so the seated return
  // bytes are never summed into the checksum.
  m.regs.sp = 0x8c00;
  m.push16(CALLER_RET);
}

// The data-independent processed-cell walk order, recomputed independently (mirrors sim6ac5.mjs).
// Used only to place bytes for the crafted-sum path.
function processedOrder() {
  const order = [];
  let H = 0x84, L = 0x50;
  for (;;) {
    order.push((H << 8) | L);
    L = (L + 1) & 0xff;
    let col = L & 0x1f;
    if (col === 0x1b) { L = (L + 1) & 0xff; continue; }
    if (col !== 0x1f) { continue; }
    const sum = 0x12 + L; L = sum & 0xff;
    if (sum <= 0xff) { continue; }        // no page carry
    H = (H + 1) & 0xff;
    if (H < 0x88) { continue; }
    break;
  }
  return order;
}

test("loc_6ac5 path A: (0x892d) != 2 -> immediate ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892d, 0x01); // != 2
  loc_6ac5(m);

  assert.equal(m.tstates, 31, "T = 13(ld a) + 7(cp) + 11(ret nz taken)");
  assert.deepEqual(m.pcSeq, [0x6ac8, 0x6aca, CALLER_RET], "cp then ret nz to the seated caller");
  assert.deepEqual(m.calls, [], "no tail jp taken");
  assert.equal(m.mem.read8(0x8f56), 0x00, "run flag untouched on the early bail");
});

test("loc_6ac5 path B: (0x892d)==2 but (0x8f56) != 0 -> ret nz, flag not latched", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892d, 0x02);
  m.mem.write8(0x8f56, 0x05); // already ran
  loc_6ac5(m);

  assert.equal(m.tstates, 53, "T = 13+7+5(ret nz nt)+13+4(and a)+11(ret nz taken)");
  assert.deepEqual(m.pcSeq, [0x6ac8, 0x6aca, 0x6acb, 0x6ace, 0x6acf, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8f56), 0x05, "flag preserved (routine did not re-latch)");
});

test("loc_6ac5 path C: all-zero tilemap -> E=0,D=0 -> jp 0x0929 (low mismatch trap)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892d, 0x02);
  m.mem.write8(0x8f56, 0x00);
  loc_6ac5(m);

  assert.equal(m.tstates, 31895, "84 entry + 31811 loop/tail (ref sim, all-zero)");
  assert.equal(m.regs.e, 0x00, "sum low byte");
  assert.equal(m.regs.d, 0x00, "sum high byte");
  assert.deepEqual(m.calls, [0x0929], "E != 0xb8 -> low-byte tamper trap");
  assert.equal(m.mem.read8(0x8f56), 0x01, "run flag latched to 1 on the first pass");
  // hand-derivable head of the walk
  assert.deepEqual(m.pcSeq.slice(0, 21), [
    0x6ac8, 0x6aca, 0x6acb, 0x6ace, 0x6acf, 0x6ad0, 0x6ad1, 0x6ad4, 0x6ad7, 0x6ada,
    0x6adb, 0x6adc, 0x6add, 0x6ae0, 0x6ae1, 0x6ae2, 0x6ae4, 0x6ae6, 0x6aeb, 0x6aed, 0x6ada,
  ], "entry guards then the first loop iteration (col 0x11: mid-row, jr nz back to 6ada)");
  assert.deepEqual(m.pcSeq.slice(-5), [0x6afb, 0x6afc, 0x6afe, 0x6b00, 0x0929],
    "walk complete -> ld a,e / cp 0xb8 / jr z nt / jp 0x0929");
});

test("loc_6ac5 path D: only 0xb8 at 0x8450 -> E=0xb8,D=0 -> jp 0x3829 (high mismatch trap)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892d, 0x02);
  m.mem.write8(0x8f56, 0x00);
  m.mem.write8(0x8450, 0xb8);
  loc_6ac5(m);

  assert.equal(m.tstates, 31911, "84 entry + loop; tail takes jr z + jp nz (ref sim)");
  assert.equal(m.regs.e, 0xb8);
  assert.equal(m.regs.d, 0x00);
  assert.deepEqual(m.calls, [0x3829], "E==0xb8 but D != 0x29 -> high-byte tamper trap");
  assert.deepEqual(m.pcSeq.slice(-7),
    [0x6afb, 0x6afc, 0x6afe, 0x6b03, 0x6b04, 0x6b06, 0x3829],
    "cp 0xb8 z -> 6b03 -> cp 0x29 nz -> jp 0x3829");
});

test("loc_6ac5 path E: crafted checksum 0x29b8 -> ret (no trap)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892d, 0x02);
  m.mem.write8(0x8f56, 0x00);
  // Place bytes so the 16-bit sum is 0x29b8: cell0 = 0xb8 (E=0xb8), then 0x29 pairs of
  // (0xff, 0x01) each of which bumps D by one carry while leaving E unchanged.
  const order = processedOrder();
  m.mem.write8(order[0], 0xb8);
  let idx = 1;
  for (let k = 0; k < 0x29; k++) {
    m.mem.write8(order[idx++], 0xff);
    m.mem.write8(order[idx++], 0x01);
  }
  loc_6ac5(m);

  assert.equal(m.regs.e, 0xb8, "low byte matches");
  assert.equal(m.regs.d, 0x29, "high byte matches");
  assert.equal(m.tstates, 31880, "ref sim: 41 carries (jr nc nt+inc d) + ret tail");
  assert.deepEqual(m.calls, [], "checksum OK -> no tamper trap");
  assert.deepEqual(m.pcSeq.slice(-8),
    [0x6afb, 0x6afc, 0x6afe, 0x6b03, 0x6b04, 0x6b06, 0x6b09, CALLER_RET],
    "jp nz not taken -> ret to the seated caller");
});

test("loc_6ac5 MUTATION: `ld a,(0x892d)` mis-charged 7T (not 13T) is caught (path A)", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6ac8 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x892d, 0x01);
  loc_6ac5(m);

  assert.equal(m.tstates, 25, "mutation loses 6 T (13 -> 7): golden 31 must reject this");
});

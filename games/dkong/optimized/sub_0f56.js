// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0f56 — hand-optimized rewrite of the translated routine at ROM 0x0F56,
 * proven equal to its oracle by the equivalence harness. Only 0x6227 has a settled
 * name (BOARD); the timer/work-RAM operands it seeds are left hex with descriptive
 * comments until they are confirmed.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { BOARD } from "./ram.js";

/**
 * sub_0f56 -- per-board work-RAM setup, then dispatch to the board's own setup.
 * [ROM 0x0F56-0x0FCC, inlining the rst 0x28 dispatcher at 0x0028-0x0037]
 *
 * Called once from loc_0d5f (`call 0x0f56`). It:
 *   1. zeroes 0x6200-0x6226 (0x27 bytes) and 0x6280-0x6AFF (17 blocks of 0x80),
 *   2. copies 0x40 bytes of board-layout ROM data 0x3D9C-0x3DDB into 0x6280,
 *   3. computes the BONUS TIMER = min((0x6229)*10 + 0x28, 0x50) and stores it at
 *      0x62B0/B1/B2 (the *10 is three `and a`/`rla` doublings summed twice, all mod 256),
 *   4. computes a paired value max(0xDC - 2*timer, 0x28) at 0x62B3/B4,
 *   5. sets 0x6209 = 4, 0x620A = 8,
 *   6. unless bit 2 of BOARD is set, seeds three 4-byte sprite records at 0x6A00,
 *   7. loads C = BOARD and DISPATCHES through an inline jump table at 0x0FCD to the
 *      per-board setup routine (1->loc_0fd7, 2->0x101f, 3->0x1087, 4->0x1131).
 *
 * This routine has NO `ret`: it exits through `rst 0x28`, whose `pop hl` takes back the
 * 0x0FCD the `rst` pushed (the TABLE BASE) -- the caller's 0x0D62 stays one slot deeper
 * and is what the dispatched target's own `ret` eventually pops. The dispatcher is
 * inlined (not m.call(0x0028)) precisely because its table is inline ROM after the rst.
 *
 * CYCLES -- COLLAPSED to one m.step per basic-block PASS (a loop's body gets one
 * step per ITERATION -- matching the djnz's own natural periodicity -- not one
 * step for the whole loop; see below). Reached via the board-build chain
 * (loc_0d5f), whose atomicity is not pinned to the mask-cleared NMI, so a
 * mistimed NMI's only observable effect is the coarse PC pushed into the dead
 * stack or a healing pixel tear -- never a persistent divergence, since every
 * fold here is between pure register ops and/or WORK-RAM writes (0x6200-0x6AFF,
 * never a 0x7Dxx hardware latch). Licensed by the CONVERGENT gate (same
 * reasoning as sub_0350). Every block total is the oracle's EXACTLY:
 *   clear-A prologue (b=0x27[7]+hl=0x6200[10]+xor a[4])         = 21 t, exit 0x0f5c
 *   clear-A body/iter (write[7]+inc l[4]+djnz[13/8])            = 24/19 t, exit 0x0f5c/0x0f60
 *   clear-B prologue (c=0x11[7]+d=0x80[7]+hl=0x6280[10])        = 24 t, exit 0x0f67
 *   clear-B inner/iter (write[7]+inc hl[6]+djnz[13/8])          = 26/21 t, exit 0x0f68/0x0f6c
 *   clear-B outer tail (dec c[4]+outer djnz[12/7])              = 16/11 t, exit 0x0f67/0x0f6f
 *   ldir prep (hl=0x3d9c[10]+de=0x6280[10]+bc=0x40[10])         = 30 t, exit 0x0f78
 *   bonus-timer compute (read[13]+b=a[4]+3x(and+rla)[24]+add b
 *     [4]+add b[4]+add 0x28[7]+cp 0x51[7])                     = 63 t, exit 0x0f8a
 *   (fC: 12 t; else: cp-not-taken[7]+clamp a=0x50[--]+[7])      = 12 / 14 t, exit 0x0f8e
 *   store-loop prologue (hl=0x62b0[10]+b=3[7])                  = 17 t, exit 0x0f93
 *   store-loop body/iter (write[7]+inc l[4]+djnz[13/8])         = 24/19 t, exit 0x0f93/0x0f97
 *   max-compute (add a,a[4]+b=a[4]+a=0xdc[7]+sub b[4]+cp 0x28[7])= 26 t, exit 0x0f9e
 *   (fNC: 12 t; else: [7]+clamp a=0x28[--]+[7])                 = 12 / 14 t, exit 0x0fa2
 *   store 62B3/B4 (write[7]+inc l[4]+write[7])                  = 18 t, exit 0x0fa5
 *   0x6209/0x620A (hl load[10]+write[10]+inc l[4]+write[10])    = 34 t, exit 0x0fad
 *   BOARD read+bit2 (read[13]+c=a[4]+bit test[8])                = 25 t, exit 0x0fb3
 *   (bit2 set: 12 t straight to dispatcher; else prologue: jr-not
 *     -taken[7]+hl=0x6a00[10]+a=0x4f[7]+b=3[7])                 = 12 / 31 t
 *   seed-loop body/iter (4x(write+inc l)[52]+add 0x10[7]+djnz[13/8]) = 73/68 t
 *   inline rst-0x28 dispatcher, FULLY folded (no branch, no hardware write,
 *     ld a,c through jp (hl), 13 instructions)                  = 89 t, exit target
 */
export function sub_0f56(m) {
  const { regs, mem } = m;

  // ---- clear 0x6200-0x6226, 0x27 bytes ----
  regs.b = 0x27;
  regs.hl = 0x6200;
  regs.xor(regs.a); // A = 0 -- the fill value for BOTH clear loops
  m.step(0x0f5c, 21); // folded prologue: 7+10+4
  do {
    mem.write8(regs.hl, regs.a);
    regs.l = regs.inc8(regs.l); // `inc l`, NOT `inc hl` -- no carry into H
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0f5c : 0x0f60, regs.b !== 0 ? 24 : 19); // folded write+inc+djnz
  } while (regs.b !== 0);

  // ---- clear 17 blocks of 0x80 from 0x6280 -> 0x6280-0x6AFF ----
  regs.c = 0x11;
  regs.d = 0x80;
  regs.hl = 0x6280;
  m.step(0x0f67, 24); // folded prologue: 7+7+10
  do {
    regs.b = regs.d;
    m.step(0x0f68, 4); // single instruction -- nothing to fold with
    do {
      mem.write8(regs.hl, regs.a);
      regs.hl = (regs.hl + 1) & 0xffff; // `inc hl` here, full 16-bit
      regs.djnz();
      m.step(regs.b !== 0 ? 0x0f68 : 0x0f6c, regs.b !== 0 ? 26 : 21); // folded write+inc+djnz
    } while (regs.b !== 0);
    regs.c = regs.dec8(regs.c);
    m.step(regs.fNZ ? 0x0f67 : 0x0f6f, regs.fNZ ? 16 : 11); // folded dec c + outer djnz
  } while (regs.fNZ);

  // ---- copy 0x40 bytes of board-layout ROM 0x3D9C-0x3DDB to 0x6280 ----
  regs.hl = 0x3d9c;
  regs.de = 0x6280;
  regs.bc = 0x0040;
  m.step(0x0f78, 30); // folded prologue: 10+10+10
  m.ldirAt(0x0f78, 0x0f7a); // NOT the 0x01CF-hardcoded ldir()

  // ---- A = min( (0x6229)*10 + 0x28 , 0x50 ) -- ALL MOD 256 ----
  // `and a` clears carry so the following `rla` shifts a 0 into bit 0 and the bit
  // shifted OUT of bit 7 is discarded. Three pairs = A = (A*8) & 0xFF.
  regs.a = mem.read8(0x6229);
  regs.b = regs.a;
  regs.and(regs.a); regs.rla();
  regs.and(regs.a); regs.rla();
  regs.and(regs.a); regs.rla();
  regs.add(regs.b); // A = A*8 + A0
  regs.add(regs.b); // A = A*8 + 2*A0  == A0*10 mod 256
  regs.add(0x28);
  regs.cp(0x51);
  m.step(0x0f8a, 63); // folded: 13+4+(4+4)*3+4+4+7+7
  if (regs.fC) {
    m.step(0x0f8e, 12);
  } else {
    regs.a = 0x50; // clamp -- bounds the RESULT, does NOT detect wrap
    m.step(0x0f8e, 14); // folded: 7+7
  }

  // ---- store that bonus-timer value at 0x62B0,B1,B2 ----
  regs.hl = 0x62b0;
  regs.b = 0x03;
  m.step(0x0f93, 17); // folded prologue: 10+7
  do {
    mem.write8(regs.hl, regs.a);
    regs.l = regs.inc8(regs.l);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0f93 : 0x0f97, regs.b !== 0 ? 24 : 19); // folded write+inc+djnz
  } while (regs.b !== 0);
  // HL is NOT reloaded below -- it carries out of this loop as 0x62B3

  // ---- A = max( 0xDC - 2*A , 0x28 ) ----
  regs.add(regs.a); // add a,a -- A = 2A
  regs.b = regs.a;
  regs.a = 0xdc;
  regs.sub(regs.b);
  regs.cp(0x28);
  m.step(0x0f9e, 26); // folded: 4+4+7+4+7
  if (regs.fNC) {
    m.step(0x0fa2, 12);
  } else {
    regs.a = 0x28; // clamp
    m.step(0x0fa2, 14); // folded: 7+7
  }

  // ---- store at 0x62B3, 0x62B4 (HL carried from the 0x0F93 loop) ----
  mem.write8(regs.hl, regs.a);
  regs.l = regs.inc8(regs.l);
  mem.write8(regs.hl, regs.a);
  m.step(0x0fa5, 18); // folded: 7+4+7

  // ---- 0x6209 = 4, 0x620A = 8 ----
  regs.hl = 0x6209;
  mem.write8(regs.hl, 0x04);
  regs.l = regs.inc8(regs.l);
  mem.write8(regs.hl, 0x08);
  m.step(0x0fad, 34); // folded: 10+10+4+10

  // ---- C = BOARD. C IS THE DISPATCHER INDEX -- live to 0x0FCB ----
  regs.a = mem.read8(BOARD);
  regs.c = regs.a;
  const bit2 = regs.bit(2, regs.a); // does not modify A; preserves carry
  m.step(0x0fb3, 25); // folded: 13+4+8
  if (bit2) {
    m.step(0x0fcb, 12); // straight to the dispatcher
  } else {
    // ---- seed 3 x 4 bytes at 0x6A00-0x6A0B ----
    regs.hl = 0x6a00;
    regs.a = 0x4f;
    regs.b = 0x03;
    m.step(0x0fbc, 31); // folded prologue: 7(jr not taken)+10+7+7
    do {
      mem.write8(regs.hl, regs.a);
      regs.l = regs.inc8(regs.l);
      mem.write8(regs.hl, 0x3a);
      regs.l = regs.inc8(regs.l);
      mem.write8(regs.hl, 0x0f);
      regs.l = regs.inc8(regs.l);
      mem.write8(regs.hl, 0x18);
      regs.l = regs.inc8(regs.l);
      regs.add(0x10);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x0fbc : 0x0fcb, regs.b !== 0 ? 73 : 68); // folded whole iteration
    } while (regs.b !== 0);
  }

  // ---- 0x0FCB: ld a,c / rst 0x28 -- the inline jump-table dispatcher, FULLY
  // folded (no branch, no hardware write anywhere in this straight-line run).
  // Table at 0x0FCD, C=BOARD: 0 -> 0x0000 (unused)  1 -> 0x0FD7  2 -> 0x101F
  // 3 -> 0x1087  4 -> 0x1131.
  regs.a = regs.c;
  m.push16(0x0fcd); // rst 0x28 pushes the address AFTER it -- the TABLE BASE
  regs.add(regs.a); // add a,a -- A = 2*index
  regs.hl = m.pop16(); // pop hl -- the table base, balancing the push
  regs.e = regs.a;
  regs.d = 0x00;
  regs.addHl(regs.de); // sets H, N, C -- dead into loc_0fd7, not in general
  regs.e = mem.read8(regs.hl);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.d = mem.read8(regs.hl);
  const target = regs.de; // ex de,hl: HL becomes the target, DE the pointer
  regs.de = regs.hl;
  regs.hl = target;
  // folded: ld a,c[4]+rst28[11]+add a,a[4]+pop hl[10]+ld e,a[4]+ld d,0[7]+
  //         jp 0x0032[10]+add hl,de[11]+ld e,(hl)[7]+inc hl[6]+ld d,(hl)[7]+
  //         ex de,hl[4]+jp (hl)[4] = 89 t
  m.step(target, 89);

  if (target === 0x0fd7) return m.call(0x0fd7);
  if (target === 0x101f) return m.call(0x101f); // board 2
  if (target === 0x1087) return m.call(0x1087); // board 3
  if (target === 0x1131) return m.call(0x1131); // board 4
  throw new NotImplemented(
    `sub_0f56 dispatches via rst 0x28 to ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(table at 0x0FCD, index C=${regs.c}), which is not translated.`,
  );
}

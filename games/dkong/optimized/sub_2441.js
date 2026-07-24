// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_2441 — hand-optimized rewrite of the translated routine at ROM 0x2441,
 * proven equal to its oracle by the equivalence harness. Only 0x6227 (BOARD) is settled;
 * the object-block bases 0x6300/0x6310 and ROM record tables stay hex.
 */

import { BOARD } from "./ram.js";

/**
 * sub_2441 -- seed the object-position blocks from a board-selected ROM record table.
 * [ROM 0x2441-0x24B1]
 *
 * The second board-setup helper loc_0d5f calls (after sub_0f56's board dispatch has run).
 *   head A: sum six ROM bytes at 0x3F0C mod 256; IY = 0x6310, bumped to 0x6311 iff the
 *           sum is non-zero (a checksum-parity nudge of the type-1 block base).
 *   head B: pick the record table by BOARD -- 1->0x3AE4, 2->0x3B5D, 3->0x3BE5, else
 *           0x3C8B. IX = 0x6300 (type-0 block base), DE = 5 (record stride).
 *   walk:   for each record, the lead byte is the type. Type 0 copies three payload bytes
 *           into the IX block at +0x00/+0x15/+0x2A and steps IX; type 1 does the same into
 *           the IY block; 0xA9 (tested against the decremented type) TERMINATES with `ret`;
 *           anything else steps HL by DE (5) to the next record.
 *
 * The record byte at +3 is stepped over and never read (two `inc hl` with no load between).
 * The walk is a JUMP cycle -- no call/push/rst in its 115 bytes, stack-flat -- so it is one
 * for(;;) loop. `inc ix`/`inc iy` are 16-bit INCs (no flags); NOT the flag-setting add-helpers.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (each JP cc costs the oracle's 10 t
 * whichever way it goes, so the straight-line prefix that ends in one is folded into EACH
 * successor's own single charge rather than split at the branch; DJNZ and RET cc differ by
 * direction, so their charge stays split per arm, mirroring sub_0350). Every totalled path
 * below is the oracle's EXACT per-instruction sum, cross-checked instruction-by-instruction
 * against this file's own prior per-instruction charges (all previously proven equal):
 *   prologue 24 t; loop iter 26 t (taken) / 21 t (last, not taken); head-A-tail 28 t (sum
 *   was 0) / 38 t (bumped IY); ld a,(BOARD) 13 t; each of the three BOARD checks 24 t
 *   (taken -> table found) or 24 t (not taken -> next check), the last check's not-taken
 *   arm folding in the default `ld hl,0x3c8b` for 34 t; ld ix/de 24 t; walk iteration:
 *   type-0 149 t, type-1 163 t, terminator 42+11=53 t (the ONLY exit), advance-record 68 t.
 *   Total-preservation keeps the caller's cycle clock exact; only the mid-block PC snapshot
 *   an NMI would observe is coarsened, same as any collapse.
 *
 * Reached through the board-build chain (loc_0d5f), a one-shot per-board setup path, not a
 * per-frame main-loop call like sub_0350 -- so the interruptibility risk profile differs;
 * see the equivalence test for which gate (strict vs convergent) it actually needs.
 */
export function sub_2441(m) {
  const { regs, mem } = m;

  // -- head A: sum six ROM bytes mod 256 ---------------------------------
  // ld hl,0x3f0c[10] + ld a,0x5e[7] + ld b,0x06[7] = 24 t, straight to the loop top.
  regs.hl = 0x3f0c;
  regs.a = 0x5e;
  regs.b = 0x06;
  m.step(0x2448, 24);

  // loc_2448 -- regs.add() masks to 8 bits, which is the point: the carry out
  // of each step is DISCARDED and the sum is mod 256. An open-coded `+=` that
  // forgets the mask diverges on the first sum over 0xFF.
  do {
    regs.add(mem.read8(regs.hl));
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x244a, 13); // add a,(hl)[7] + inc hl[6]
    regs.djnz();
    // djnz taken (loop again) 13 t; not taken (falls to 0x244c) 8 t.
    m.step(regs.b !== 0 ? 0x2448 : 0x244c, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  // `ld rr,nn` affects no flags, and `and a` regenerates them from A anyway,
  // so this sits harmlessly between the loop and its test. By contrast, an
  // identically flag-neutral `ld hl,nn` elsewhere is NOT harmless.
  regs.iy = 0x6310;
  regs.and(regs.a);
  if (regs.fZ) {
    // ld iy,0x6310[14] + and a[4] + jp z,0x2456 TAKEN[10] -- sum was 0, IY stays 0x6310.
    m.step(0x2456, 28);
  } else {
    regs.iy = (regs.iy + 1) & 0xffff; // 16-bit INC: no flags -- IY = 0x6311
    // ...+ jp z NOT taken[10] + inc iy[10] -- IY becomes 0x6311.
    m.step(0x2456, 38);
  }

  // -- head B ------------------------------------------------------------
  // Every `ld hl,nn` below is FLAG-NEUTRAL, so each `jp z` tests the `dec a`
  // TWO instructions earlier, across an intervening load -- the same
  // flag-neutral-load trap shape seen elsewhere in this file. `jp cc` costs
  // the oracle's 10 t whichever way it goes, so each check's prefix + branch
  // folds into one charge per successor.
  regs.a = mem.read8(BOARD);
  m.step(0x2459, 13); // ld a,(BOARD) -- discards the head-A sum

  selectTable: {
    regs.a = regs.dec8(regs.a);
    regs.hl = 0x3ae4;
    if (regs.fZ) {
      m.step(0x2471, 24); // dec a[4] + ld hl,0x3ae4[10] + jp z TAKEN[10] -- BOARD == 1
      break selectTable;
    }
    m.step(0x2460, 24); // dec a[4] + ld hl,0x3ae4[10] + jp z NOT taken[10]

    regs.a = regs.dec8(regs.a);
    regs.hl = 0x3b5d;
    if (regs.fZ) {
      m.step(0x2471, 24); // BOARD == 2
      break selectTable;
    }
    m.step(0x2467, 24);

    regs.a = regs.dec8(regs.a);
    regs.hl = 0x3be5;
    if (regs.fZ) {
      m.step(0x2471, 24); // BOARD == 3
      break selectTable;
    }
    // Default: everything else reaches here, including BOARD == 0 (wraps to
    // 0xFF on the `dec a`, never Z). dec a[4] + ld hl,0x3be5[10] +
    // jp z NOT taken[10] + ld hl,0x3c8b[10] = 34 t.
    regs.hl = 0x3c8b;
    m.step(0x2471, 34);
  }

  regs.ix = 0x6300;
  regs.de = 0x0005;
  m.step(0x2478, 24); // ld ix,0x6300[14] + ld de,0x0005[10]

  // -- the walk ------------------------------------------------------------
  // A still holds (BOARD - 1..3) here and HL past the checksum block is long
  // gone; both are dead -- `ld a,(hl)` below overwrites A immediately and HL
  // was reloaded in head B. Checked, not assumed.
  for (;;) {
    regs.a = mem.read8(regs.hl);
    regs.and(regs.a);
    // ld a,(hl)[7] + and a[4] = 11 t (common prefix, folded below per arm).

    if (regs.fZ) {
      // type 0 -> IX block. The whole fill run through the unconditional
      // `jp 0x2478` is ONE basic block -- no internal branch.
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = mem.read8(regs.hl);
      mem.write8((regs.ix + 0x00) & 0xffff, regs.a);

      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = mem.read8(regs.hl);
      mem.write8((regs.ix + 0x15) & 0xffff, regs.a);

      regs.hl = (regs.hl + 1) & 0xffff; // record byte +3 stepped over, never read
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = mem.read8(regs.hl);
      mem.write8((regs.ix + 0x2a) & 0xffff, regs.a);

      // `inc ix` is 16-bit INC and affects NO flags. Deliberately NOT
      // regs.addIx(1) -- that is `add ix,rr`, which writes H, N, C and F3/F5.
      regs.ix = (regs.ix + 1) & 0xffff;
      regs.hl = (regs.hl + 1) & 0xffff;
      // 11 (prefix) + jp z TAKEN[10] + inc hl[6] + ld a,(hl)[7] + ld (ix+0),a[19]
      // + inc hl[6] + ld a,(hl)[7] + ld (ix+0x15),a[19] + inc hl[6] + inc hl[6]
      // + ld a,(hl)[7] + ld (ix+0x2a),a[19] + inc ix[10] + inc hl[6] + jp 0x2478[10]
      // = 149 t.
      m.step(0x2478, 149);
      continue;
    }

    regs.a = regs.dec8(regs.a); // A is (type - 1) from here down

    if (regs.fZ) {
      // type 1 -> IY block. Same shape as the IX block above, into IY.
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = mem.read8(regs.hl);
      mem.write8((regs.iy + 0x00) & 0xffff, regs.a);

      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = mem.read8(regs.hl);
      mem.write8((regs.iy + 0x15) & 0xffff, regs.a);

      regs.hl = (regs.hl + 1) & 0xffff; // record byte +3 stepped over here too
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = mem.read8(regs.hl);
      mem.write8((regs.iy + 0x2a) & 0xffff, regs.a);

      regs.iy = (regs.iy + 1) & 0xffff; // 16-bit INC: no flags
      regs.hl = (regs.hl + 1) & 0xffff;
      // 11 (prefix) + jp z(type0) NOT taken[10] + dec a[4] + jp z(type1) TAKEN[10]
      // + inc hl[6] + ld a,(hl)[7] + ld (iy+0),a[19] + inc hl[6] + ld a,(hl)[7]
      // + ld (iy+0x15),a[19] + inc hl[6] + inc hl[6] + ld a,(hl)[7]
      // + ld (iy+0x2a),a[19] + inc iy[10] + inc hl[6] + jp 0x2478[10] = 163 t.
      m.step(0x2478, 163);
      continue;
    }

    // Neither type -- cp 0xa9 against the DECREMENTED A.
    regs.cp(0xa9);
    // 11 (prefix) + jp z(type0) NOT taken[10] + dec a[4] + jp z(type1) NOT taken[10]
    // + cp 0xa9[7] = 42 t, ending right before the ret z test.
    m.step(0x2483, 42);

    if (regs.fZ) {
      m.ret(11); // ret z TAKEN -- 11 t. THE ONLY EXIT (total 53 t on this path).
      return;
    }
    regs.addHl(regs.de);
    // ret z NOT taken[5] + add hl,de[11] + jp 0x2478[10] = 26 t.
    m.step(0x2478, 26);
  }
}

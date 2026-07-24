// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_11a6 — hand-optimized rewrite of the translated routine at ROM 0x11A6,
 * proven equal to its oracle by the equivalence harness. A coordinator over three fill
 * helpers plus two direct object-slot marks; it names no work RAM.
 */

/**
 * sub_11a6 -- build the object slots at 0x6680/0x6690 and their sprite mirrors.  [ROM 0x11A6-0x11D2]
 *
 * Three call sites (0x1003 here from loc_0fd7, plus 0x1073 and 0x1140), each supplying HL.
 * It chains three fill helpers and marks two slots live:
 *   - sub_11ec: interleaved copy of the caller's HL record into 0x6683 (BC = 0x020E),
 *   - sub_122a: strided fill of ROM 0x3E08 into 0x6687 (BC = 0x020C -- HL reloaded, so this
 *     one is NOT the caller's record; 0x3E08 sits 4 below loc_0fd7's 0x3E0C),
 *   - IX = 0x6680; mark IX+0 (0x6680) and IX+0x10 (0x6690) live (= 0x01),
 *   - sub_11d3: permuting gather into 0x6A18 (B = 2, DE = 0x0010 stride; C still holds
 *     sub_122a's restored 0x0C -- the preservation sub_122a guarantees),
 *   - ret.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. sub_11a6 is straight-line apart from
 * its three `call`s, so each block is "the register loads before a call, PLUS that call's own
 * 17 t charge", folded into one charge at the call target. Block totals are the exact sum of
 * the oracle's per-instruction charges: 37 t (10+10+17), 47 t (10+10+10+17), 96 t
 * (14+19+19+10+7+10+17) -- 180 t of own charges, the oracle's total exactly. Callees are
 * still reached through m.call (the registry), never inlined, and each push16 keeps its
 * original sequence position.
 *
 * NOTE, because this cost a revert once: the `call`'s OWN 17 t must be folded IN. Folding
 * only the loads (20/30/79) silently drops 51 t, and a short total shifts the main loop's
 * spin count (0x6019, the PRNG entropy) -- which reads as a "persistent divergence" that
 * looks like the routine is NMI-timing-sensitive when it is really just arithmetic.
 *
 * Reached from the board setups, whose atomicity is not pinned to the mask-cleared NMI, so
 * the whole-machine gate is the CONVERGENT one (see equivalence-11a6.test.js).
 */
export function sub_11a6(m) {
  const { regs, mem } = m;

  // Block 1: ld de,0x6683[10] + ld bc,0x020e[10] + the `call 0x11ec` charge[17] = 37 t.
  // HL is this routine's live-in, passed through to sub_11ec.
  regs.de = 0x6683;
  regs.bc = 0x020e;
  m.push16(0x11af);
  m.step(0x11ec, 37);
  m.call(0x11ec);

  // Block 2: ld hl,0x3e08[10] + ld de,0x6687[10] + ld bc,0x020c[10] + `call 0x122a`[17] = 47 t.
  regs.hl = 0x3e08; // ROM table pointer, 4 below the caller's 0x3E0C
  regs.de = 0x6687;
  regs.bc = 0x020c;
  m.push16(0x11bb);
  m.step(0x122a, 47);
  m.call(0x122a);

  // Block 3: ld ix,0x6680[14] + 2x ld (ix+d),0x01[19+19] + ld hl,0x6a18[10] + ld b,2[7]
  //          + ld de,0x0010[10] + the `call 0x11d3` charge[17] = 96 t.
  regs.ix = 0x6680;
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01); // -> 0x6680
  mem.write8((regs.ix + 0x10) & 0xffff, 0x01); // -> 0x6690, stride 0x10
  regs.hl = 0x6a18; // a DESTINATION here
  regs.b = 0x02; // B only -- C still holds sub_122a's restored 0x0C
  regs.de = 0x0010; // a STRIDE here
  m.push16(0x11d2);
  m.step(0x11d3, 96);
  m.call(0x11d3);

  m.ret(); // 0x11D2
}

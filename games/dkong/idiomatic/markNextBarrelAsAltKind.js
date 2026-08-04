// SPDX-License-Identifier: GPL-3.0-only
/**
 * markNextBarrelAsAltKind — set bit 7 of BARREL_CLAIM_MODE, preserving the low bits.  ROM 0x2C72.
 *
 * ★ NAME WITHDRAWN. This was promoted as markNextBarrelAsDroppingKind, which attributed the
 * barrel's DROPPING behaviour to the bit this routine sets. The ROM refutes that: the drop path —
 * the one-waypoint table at 0x39CC that pins the spawn X at 59 — is selected by BIT 0 (ROM 0x2D4A
 * `ld a,(0x6382) / rrca / jp c,0x2D83`), and the mover arm likewise comes from record +1, which
 * activateReleasedBarrel sets from bit 0. Bit 7 is independent of both: names.js records this byte
 * taking 0x80, bit 7 set with bit 0 CLEAR, so a bit-7 barrel can walk the four-waypoint table and
 * spawn at (89,78). The name now claims only what bit 7 selects.
 *
 * A one-line leaf: read the barrel slot-claim mode byte, turn its top bit on, and store it
 * back. The bits underneath are left alone — the mode value the slot-claim cluster writes to
 * this same byte survives untouched. The cluster writes it at TWO sites, not the three an
 * earlier note listed: ROM 0x2C4B `32 82 63` sets the mode, and ROM 0x2C86 `af / 32 82 63`
 * clears it to 0 (that second one is the target of the `c2 86 2c` branch at 0x2C46). Of the
 * three the old note named, 0x2C41 is `cd 57 00 / e6 0f / c2 86 2c`, a call-mask-branch
 * preamble that stores nothing, and 0x2C4F is `32 8f 63`, a write to the NEIGHBOURING cell
 * 0x638F. (This routine's own store-back at 0x2C77 writes the cell too, by construction.)
 * So this
 * only raises bit 7 without disturbing the mode value beneath it (a mode-1 claim with bit 7
 * raised reads back as 0x81).
 *
 * WHAT BIT 7 DOES — it selects the barrel's KIND: a sprite family AND the behaviour arms keyed
 * off it. A first attempt at this correction said "the SPRITE, not its behaviour", which
 * over-corrected in the opposite direction; the family index at +0x15 has three behaviour
 * consumers besides the sprite recompute:
 *   ROM 0x1FB9  `ld a,(ix+0x15) / rlca / rlca / add a,0x15`  -> the sprite code base
 *   ROM 0x20A2  `ld a,(ix+0x15) / and a / jp nz,0x20B5`      -> a non-zero index SKIPS the
 *               MARIO_Y compare at 0x20A9 that otherwise steers the object
 *   ROM 0x1ED3  `ld a,(ix+0x15) / and a / ld a,2 / jz / ld a,4 / ld (0x6342),a`
 *                                                            -> EFFECT_SELECT 2 vs 4
 *   ROM 0x24C3  `ld a,(ix+0x15) / and a / jz / ld a,3 / ld (0x62B9),a`
 * So "kind" is right and "sprite" alone is too narrow. Bit 7 CLEAR stamps
 * sprite code/attr 0x15 / 0x0B and family index 0x00; bit 7 SET stamps 0x19 / 0x0C and family
 * index 0x01 (ROM 0x2D02 `ld a,(0x6382) / rlca / jp nc,0x2D15`, then `ld (ix+0x07),0x19`,
 * `ld (ix+0x08),0x0c`). The family index at +0x15 is what the mover turns back into a code, at
 * ROM 0x1FB9: `ld a,(ix+0x15) / rlca / rlca / add a,0x15` — so index 1 yields base 0x19 and
 * index 0 yields 0x15, exactly the two stamped values. Observed live in MAME 0.288 with 46/46 agreement
 * over every dispatch captured (38 clear, 8 set) and no exceptions. This routine's writes are
 * what put bit 7 there: 0x2C72 fetched exactly 8 times in the long attract run, each one EXACTLY
 * ONE FRAME BEFORE a bit-7-set claim (f1462->1463, f2357->2358, f3078->3079, ...), with the byte
 * back to bit-7-clear by the following claim — one alternate-kind barrel per cycle.
 *
 * ★ THE OBSERVED "bit-7 DROPS / bit-7-clear ROLLS" NOTE IS REFUTED BY CODE, and is retained here
 * only so nobody re-derives it. An earlier grounding run recorded the attr-0x0C kind descending
 * with its X pinned at 59, and attributed that to bit 7. The X=59 pin comes from the ONE-waypoint
 * table at 0x39CC, and that table is selected by BIT 0 (ROM 0x2D4A `ld a,(0x6382) / rrca /
 * jp c,0x2D83`), not bit 7. The two bits are independent: ROM 0x2C86 `af / 32 82 63` leaves mode
 * 0 on 15 of 16 random nibbles, so this routine's OR yields exactly 0x80 — bit 7 set, bit 0 clear
 * — and such a barrel provably walks the FOUR-waypoint table 0x39C3 and spawns at (89,78).
 * MOST LIKELY RECONCILIATION, UNVERIFIED: the run did not record which value was live at each of
 * its 8 alt-kind stamps, so all 8 observed "droppers" may have been 0x81, both bits set. Pending
 * a re-grounding that logs 0x6382's VALUE per stamp, this header claims only that bit 7 selects
 * the kind's sprite family and behaviour arms — not that it makes anything drop.
 * The kinds do carry different attribute bytes, hence different palettes, and they coexist (372
 * in-board frames had one of each active). HONESTY BOUND: nothing here says which NAMED Donkey
 * Kong object either kind is.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c72.test.js.
 * GATE:     exhaustive — sweeps all 256 possible starting byte values (the routine's ENTIRE
 *           input space, so the sweep is a proof) + real captured 0x2C72 dispatches from attract.
 * LIVE-OUT: memory-only — BARREL_CLAIM_MODE. The oracle carries the value out through the
 *           accumulator, but no caller reads a register from it (its callers tail-jump or return
 *           and reload), so only the stored byte is live.
 * NAMES:    BARREL_CLAIM_MODE (0x6382) from names.js — the barrel slot-claim mode byte, work RAM,
 *           not video RAM. It is not a bare flag: its low bits carry the claim's mode value and
 *           its bit 7 is the kind select this routine raises.
 */

import { BARREL_CLAIM_MODE } from "./names.js"; // ROM 0x6382 — the barrel slot-claim mode byte

export function markNextBarrelAsAltKind(m) {
  const { mem } = m;

  // Raise bit 7 (the barrel-kind select) on the slot-claim mode byte, leaving the mode value
  // in the low bits as it is.
  mem.write8(BARREL_CLAIM_MODE, mem.read8(BARREL_CLAIM_MODE) | 0x80);
}

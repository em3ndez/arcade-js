// SPDX-License-Identifier: GPL-3.0-only
/**
 * markNextBarrelAsDroppingKind — set bit 7 of BARREL_CLAIM_MODE, preserving the low bits.  ROM 0x2C72.
 *
 * A one-line leaf: read the barrel slot-claim mode byte, turn its top bit on, and store it
 * back. The bits underneath are left alone — the small mode value (0/1/2/3) the slot-claim
 * cluster at 0x2C41 / 0x2C4B / 0x2C4F writes to this same byte survives untouched, so this
 * only raises bit 7 without disturbing the mode value beneath it (a mode-1 claim with bit 7
 * raised reads back as 0x81).
 *
 * WHAT BIT 7 DOES, GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding
 * pass 12, scratchpad/pass12-grounding.md): bit 7 of this byte selects which of two 25m barrel
 * KINDS the next barrel record gets stamped as, over in stampReleasedBarrelKind — bit 7 CLEAR stamps sprite
 * code/attr/mode 0x15 / 0x0B / 0x00, bit 7 SET stamps 0x19 / 0x0C / 0x01, with 46/46 agreement
 * over every dispatch captured (38 clear, 8 set) and no exceptions. This routine's writes are
 * what put bit 7 there: 0x2C72 fetched exactly 8 times in the long attract run, each one EXACTLY
 * ONE FRAME BEFORE a bit-7-set claim (f1462->1463, f2357->2358, f3078->3079, ...), with the byte
 * back to bit-7-clear by the following claim — one alternate-kind barrel per cycle.
 *
 * The two kinds are behaviourally distinct on the live playfield: the bit-7-SET (attr 0x0C) kind
 * DROPS, descending with its X PINNED at 59; the bit-7-CLEAR (attr 0x0B) kind ROLLS, its X
 * sweeping along the girders. They coexist (372 in-board frames had one of each active) and
 * carry different attribute bytes, hence different palettes. HONESTY BOUND: the grounding run
 * deliberately did NOT establish which NAMED Donkey Kong object either kind is, so this header
 * says only "the rolling kind" and "the dropping kind".
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c72.test.js.
 * GATE:     exhaustive — sweeps all 256 possible starting byte values (the routine's ENTIRE
 *           input space, so the sweep is a proof) + real captured 0x2C72 dispatches from attract.
 * LIVE-OUT: memory-only — BARREL_CLAIM_MODE. The oracle carries the value out through the
 *           accumulator, but no caller reads a register from it (its callers tail-jump or return
 *           and reload), so only the stored byte is live.
 * NAMES:    BARREL_CLAIM_MODE (0x6382) from ram.js — the barrel slot-claim mode byte, work RAM,
 *           not video RAM. It is not a bare flag: its low bits carry the claim's mode value and
 *           its bit 7 is the kind select this routine raises.
 */

import { BARREL_CLAIM_MODE } from "./ram.js"; // ROM 0x6382 — the barrel slot-claim mode byte

export function markNextBarrelAsDroppingKind(m) {
  const { mem } = m;

  // Raise bit 7 (the barrel-kind select) on the slot-claim mode byte, leaving the mode value
  // in the low bits as it is.
  mem.write8(BARREL_CLAIM_MODE, mem.read8(BARREL_CLAIM_MODE) | 0x80);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * foldTargetPresenceBits — fold the two enemy-target records' presence bits into a tally.
 *
 * ROM 0x22d0-0x22e5. Grounding: [seen].
 *
 * WHAT IT IS. A small leaf helper the animation-advance code calls to summarise the state of
 * the two I-parity enemy/target actor records in a single byte. Those two records live at
 * ENEMY_TARGET_REC0 (ROM 0x8c90) and one stride (0x18 bytes) beyond it; the low bit of each
 * record's byte 0 is a "present" bit. The routine walks both records and, for each one that is
 * present, rotates a running accumulator left by one position — building a compact code that
 * encodes which of the two targets are currently on screen.
 *
 * HOW THE FOLD WORKS. The accumulator starts at 0. For each of the two records, if its
 * presence bit is set the accumulator is rotated left circularly (bit 7 wraps back to bit 0);
 * if the bit is clear the accumulator is left as-is. The result is returned so the caller can
 * branch on it: the animation-advance code compares it against 3 and takes a full-reset path
 * when it matches, otherwise following an inline cursor.
 *
 * NOTE ON THE VALUE. Because the accumulator is seeded to 0 and the only operation is a rotate,
 * the fold can only ever resolve to 0 in practice (rotating 0 leaves 0). The rotate is still
 * reproduced exactly so that any nonzero seed would fold identically to the machine.
 *
 * LIVE-OUT: the folded accumulator, returned in A. A pure leaf otherwise — it reads two bytes
 * and writes nothing to memory.
 */
import { ENEMY_TARGET_REC0 } from "./names.js";

const RECORD_STRIDE = 0x18; // bytes between the two I-parity enemy/target records
const TARGET_COUNT = 2; // exactly two records are folded

export function foldTargetPresenceBits(m) {
  const { mem8 } = m;

  // Walk the two records, starting at ENEMY_TARGET_REC0 and stepping one 0x18-byte stride each
  // pass. Byte 0 bit 0 of each record is its presence bit; a set bit rotates the accumulator
  // left by one (circular, bit 7 wrapping into bit 0), a clear bit leaves it untouched.
  let acc = 0;
  let rec = ENEMY_TARGET_REC0;
  for (let i = 0; i < TARGET_COUNT; i++) {
    if (mem8[rec] & 0x01) acc = ((acc << 1) | (acc >> 7)) & 0xff; // rotate-left on a present target
    rec += RECORD_STRIDE;
  }

  // Return the fold in A. The caller reads A directly and compares it against 3 to choose its
  // path.
  return (m.regs.a = acc);
}

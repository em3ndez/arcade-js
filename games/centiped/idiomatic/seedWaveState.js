// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_ef, loc_f0, loc_40, loc_70, loc_60, loc_88, loc_ab, loc_80, HEAD_VELOCITY_SEED, loc_b8, POKEY_RANDOM } from "./names.js";

/**
 * seedWaveState -- round/wave-start initializer for the pacing and RNG working cells.
 *
 * ROLE IN THE MACHINE. Each new wave needs a fresh set of working values derived
 * from the current difficulty and from the hardware RNG: two folded difficulty
 * bytes, one rejection-sampled random byte, a small per-index count, and two cleared
 * cells. This routine plants all of them. It is called from the round-setup chain
 * (initRoundState) and touches only zero-page RAM plus one read of the POKEY RNG.
 *
 * THE FOUR STEPS.
 *  1. FOLD DIFFICULTY. $40 and $70 are seeded by XORing fixed constants (0x1c,0xf8)
 *     with the difficulty/seed bytes at $ef/$f0. The XOR is the ROM's cheap way to
 *     derive a per-wave working value that still varies with difficulty.
 *  2. REJECTION-SAMPLE THE RNG. $1006 (POKEY_RANDOM) is a free-running hardware RNG;
 *     any single read is a pseudo-random byte. We keep bits 7..3 (mask 0xf8) and
 *     REJECT any sample below 0x10, looping until a "large enough" value appears --
 *     this guarantees the stored count has usable magnitude. The stored value is
 *     the accepted sample minus 4 (a fixed bias the ROM applies).
 *  3. PICK A SMALL COUNT. $80 gets 3 or 2 depending on a per-index table byte:
 *     read $ab indexed by $88, and choose 3 when that byte is >= 6, else 2. This is
 *     a difficulty-scaled spawn/step count selected from a lookup row.
 *  4. CLEAR. $50 (HEAD_VELOCITY_SEED) and $b8 are reset to zero for the new wave.
 *
 * GROUNDING: [code]. LIVE-OUT: $40,$70,$60,$80,$50,$b8 (mem8). No return value.
 */
export function seedWaveState(m) {
  const { mem8 } = m;

  // STEP 1 -- Fold the two difficulty/seed params ($ef,$f0) into working cells
  // $40/$70 via fixed XOR constants, giving per-wave values that track difficulty.
  mem8[loc_40] = 0x1c ^ mem8[loc_ef];
  mem8[loc_70] = 0xf8 ^ mem8[loc_f0];

  // STEP 2 -- Rejection-sample the POKEY hardware RNG. Keep the high bits (mask
  // 0xf8) and require the result be at least 0x10, re-reading until it is. The
  // accepted byte (in [0x10,0xf8]) is stored biased down by 4.
  let masked;
  do {
    masked = m.mem8[POKEY_RANDOM] & 0xf8;
  } while (masked < 0x10);
  mem8[loc_60] = masked - 4; // masked is in [0x10,0xf8], so masked-4 is a valid byte

  // STEP 3 -- Pick a small count into $80 from a per-index lookup: index the $ab
  // table by $88, then choose 3 when that byte is >= 6, else 2 (difficulty-scaled).
  const sel = mem8[u8(loc_ab + mem8[loc_88])];
  mem8[loc_80] = sel >= 0x06 ? 0x03 : 0x02;

  // STEP 4 -- Clear the two remaining per-wave state cells: the head-velocity seed
  // ($50) and $b8, so the new wave starts from a defined baseline.
  mem8[HEAD_VELOCITY_SEED] = 0x00;
  mem8[loc_b8] = 0x00;
}

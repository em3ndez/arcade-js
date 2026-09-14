// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SPINNER_ACCUM, RIM_ROT_OFFSET } from "./names.js";

/**
 * foldStepIntoFraction -- fold a signed spinner sub-step into the fine fraction cell and carry it up. ROM 0xadce.
 *
 * Role in the machine: Tempest's player rotates the blaster around the tube with a spinner (rotary
 * encoder). The raw spinner delta lands in SPINNER_ACCUM ($50) as a signed sub-step; the coarse angle is
 * kept as a whole byte with a fine fractional remainder in RIM_ROT_OFFSET ($51). This routine is the
 * fixed-point add that merges one sub-step into that whole/fraction pair -- it is the arithmetic core
 * shared by the rim-position nudge (nudgeBlasterRimPosition) and the sound-slot value clamp
 * (tickActiveSoundSlot), so callers get a consistent signed 8.8-style accumulate.
 *
 * Behavior: read the signed step from SPINNER_ACCUM, scale it by 8 (<<3, low byte kept) and add it to the
 * fraction cell RIM_ROT_OFFSET, storing the low byte back. The high byte of that sum becomes a carry (1 if
 * the fraction overflowed past 0xff). Because the step is signed, its sign is spread across the high byte:
 * a step with bit 7 set sign-extends to 0xff (subtract one from the whole byte), otherwise 0x00. The whole
 * byte in A is then A + hi + carry (the 6502 ADC of the sign-extension plus the fraction's carry-out).
 * Finally SPINNER_ACCUM is cleared so the sub-step is consumed exactly once, and the updated whole byte is
 * returned (and stashed in A).
 *
 * Live-out: RIM_ROT_OFFSET ($51) holds the new fine fraction; SPINNER_ACCUM ($50) is zeroed; A / the
 * returned value carries the updated whole byte for the caller to clamp and store.
 *
 * Grounding: [seen].
 */
export function foldStepIntoFraction(m, a = m.regs.a) {
  const { mem8 } = m;
  const step = mem8[SPINNER_ACCUM];
  // Scale the signed sub-step by 8 (low byte) and add it into the fine fraction cell.
  const fold = ((step << 3) & 0xff) + mem8[RIM_ROT_OFFSET];
  mem8[RIM_ROT_OFFSET] = fold;
  // Carry-out of the fraction add propagates up into the whole byte.
  const carry = fold > 0xff ? 1 : 0;
  // A negative step sign-extends to 0xff as the high byte added into A.
  const hi = (step & 0x80) !== 0 ? 0xff : 0x00;
  // Consume the sub-step so it is folded exactly once.
  mem8[SPINNER_ACCUM] = 0;
  return (m.regs.a = u8(a + hi + carry));
}

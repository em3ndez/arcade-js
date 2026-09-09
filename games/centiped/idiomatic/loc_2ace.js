// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_43, loc_73, MOVE_SUBSTEP_ACCUM_A, loc_86, loc_8d, loc_b9, loc_fe } from "./names.js";
import { clampAndHalveSignedDelta } from "./clampAndHalveSignedDelta.js";
import { loc_2aeb } from "./loc_2aeb.js";

/**
 * loc_2ace — the gated axis-delta integrator for the $63 coordinate axis (ROM 0x2ace). This is the
 * front half of the sub-pixel movement integrator: it turns a signed per-frame delta into smooth,
 * clamped motion by halving the delta toward the playfield rails and folding the fractional remainder
 * into an accumulator, then falls straight through into its $73-axis companion (loc_2aeb).
 *
 * It runs only when the machine is in a live movement state: the master enable $86 must be
 * non-negative (bit 7 clear) and the $43 control/mode bits (masked & 0xaf) must all be clear. Either
 * guard failing returns immediately — on the 6502 that is a plain RTS, so the caller sees "did
 * nothing this frame".
 *
 * Role: path/coordinate integrator (movement spine, $63 axis).  Grounding: [code], with
 * MOVE_SUBSTEP_ACCUM_A ($84) [seen].  Live-out: $8d, $b9, $84, and the companion's result.
 */
export function loc_2ace(m) {
  const { mem8 } = m;
  // Enable gate: bit 7 of $86 set means audio/movement is disabled for this pass -> bail (RTS).
  if (mem8[loc_86] & 0x80) return;              // enable negative -> RTS
  // Mode gate: any of the $43 control bits (& 0xaf) set means this integrator is inhibited -> bail.
  if ((mem8[loc_43] & 0xaf) !== 0) return;      // control bits set -> RTS
  // Snapshot the $73 coordinate into $8d so a later stage can measure how far it moved this frame.
  mem8[loc_8d] = mem8[loc_73];
  // Swap the pending delta cell $b9 with $fe: the freshly-arrived $fe becomes the new $b9, while the
  // OLD $b9 (the delta we are about to integrate) is read out first.
  const swapped = mem8[loc_fe];
  const oldB9 = mem8[loc_b9];
  mem8[loc_b9] = swapped;
  // Halve the old delta toward the rails: clampAndHalveSignedDelta snaps it to 0x08/0xf8 if it is
  // inside the band, arithmetic-halves it (sign-preserving), and hands back the halved value plus the
  // low bit rotated out — the sub-pixel fraction carried forward.
  const [aClamp, halvedY] = clampAndHalveSignedDelta(m, oldB9);
  // Accumulate the clamped magnitude into $84, the $63-axis fractional accumulator; the >0xff carry
  // out of this add is the sub-pixel carry the companion needs.
  const sum = aClamp + mem8[MOVE_SUBSTEP_ACCUM_A];
  mem8[MOVE_SUBSTEP_ACCUM_A] = u8(sum);
  // Fall through into the companion integrator: A = halved delta, carry = the accumulate carry.
  return loc_2aeb(m, halvedY, sum > 0xff);
}

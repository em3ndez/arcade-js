// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { verifyTableChecksum } from "./verifyTableChecksum.js";
import { loc_57c6 } from "./loc_57c6.js";
import { SPECIAL_ACTOR_ACTIVE_FLAG, ANIM_TABLE_3847, CHECKSUM_ROM_BASE } from "./names.js";
/**
 * loc_5835 — spawn the singleton actor, or step it if it already exists.
 *
 * When the active flag is set the actor already lives, so it tail-delegates to the stepper.
 * Otherwise it marks the actor active, seeds its record fields, points it at its animation
 * sequence, and tail-runs the image-integrity checksum over a fixed data region.
 *
 * LIVE-OUT: none of its own — a tail hand-off; all effect is in the record, the active flag, and
 * (on a checksum mismatch) the tamper flag.
 */
export function loc_5835(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[SPECIAL_ACTOR_ACTIVE_FLAG]) return loc_57c6(m, rec); // already active -> step it

  mem8[SPECIAL_ACTOR_ACTIVE_FLAG] = 0x01;
  mem8[rec + 0x0b] = 0x01;
  mem8[rec + 0x13] = 0x03;
  mem8[rec + 0x16] = 0x01;
  mem8[rec + 0x07] = 0x02;
  setActorAnimation(m, rec, ANIM_TABLE_3847);
  return verifyTableChecksum(m, CHECKSUM_ROM_BASE, 0x52, 0x00, 0x00);
}

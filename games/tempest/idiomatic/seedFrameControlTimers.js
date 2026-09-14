// SPDX-License-Identifier: GPL-3.0-only
import { RIM_ROT_OFFSET, SPIKE_ACTIVE_FLAG, PLAYER_SEGMENT, PLAYER_FINE_ANGLE, PLAYER_SHOT_DEPTH } from "./names.js";

/**
 * seedFrameControlTimers -- init seeder for the player-Blaster + spike control cells. ROM 0x921b.
 *
 * Role in the machine: a state-entry seeder run once when a play state is set up. It plants the fixed
 * starting pose of the player's Blaster on the tube rim and clears the moving-spike state, so the first
 * frame of the state begins from a known position rather than leftover values. Takes no inputs and reads
 * nothing -- it only writes constants.
 *
 * Behavior: seats the Blaster at coarse rim segment PLAYER_SEGMENT (loc_200) = 0x0e with fine rotation
 * PLAYER_FINE_ANGLE (loc_201) = 0x0f; stores the rim fine-rotation offset RIM_ROT_OFFSET (loc_51) = 0xf0;
 * clears the moving-spike arm flag SPIKE_ACTIVE_FLAG (loc_106) = 0x00; and sets PLAYER_SHOT_DEPTH (loc_202)
 * = 0x10 (the near/rim end of the tube depth range). The frame-control byte loc_201 and depth counter
 * loc_202 are the two cells later driven by ageShotsAndAdvanceFrameClock.
 *
 * Live-out: PLAYER_SEGMENT, RIM_ROT_OFFSET, SPIKE_ACTIVE_FLAG, PLAYER_FINE_ANGLE, PLAYER_SHOT_DEPTH, all
 * set to their fixed startup constants. Grounding: [seen].
 */
export function seedFrameControlTimers(m) {
  const { mem8 } = m;
  mem8[PLAYER_SEGMENT] = 0x0e;      // coarse rim segment (starting lane)
  mem8[RIM_ROT_OFFSET] = 0xf0;      // stored fine rim-rotation offset/velocity
  mem8[SPIKE_ACTIVE_FLAG] = 0x00;   // moving spike disarmed
  mem8[PLAYER_FINE_ANGLE] = 0x0f;   // fine rotation offset (bit7 clear = no object pending)
  mem8[PLAYER_SHOT_DEPTH] = 0x10;   // shot depth at the near/rim end of the tube
  return;
}

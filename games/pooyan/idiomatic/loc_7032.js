// SPDX-License-Identifier: GPL-3.0-only
import { loc_7059 } from "./loc_7059.js";
import { loc_0038 } from "./loc_0038.js";
import {
  TARGET_GROUP_COUNT,
  INTRO_DELAY_CKSUM_WORD,
  INTRO_PHASE_INDEX,
  INTRO_PHASE5_TOGGLE,
  INTRO_PHASE5_DISPLAY_CMD_A,
  DISPLAY_CMD_0627,
} from "./names.js";
/**
 * loc_7032 — level-intro phase 5.
 *
 * While the target-group count is nonzero, tick it (a helper also queues its sound). Then
 * count the intro delay word down: when it is already zero the delay has elapsed, so reseed
 * it to 0x20 and advance to phase 6; otherwise decrement it and, only on a 16-frame boundary
 * (low nibble now zero), toggle a phase byte and queue one of two display commands chosen by
 * the new bit0.
 *
 * LIVE-OUT: none — the intro dispatcher tail-dispatches here and its caller, the level-intro
 * state machine, reads nothing back. Contract is memory only.
 */
export function loc_7032(m) {
  const { mem8 } = m;

  if (mem8[TARGET_GROUP_COUNT] !== 0) loc_7059(m, TARGET_GROUP_COUNT); // tick the group + queue sound

  if (mem8[INTRO_DELAY_CKSUM_WORD] === 0) {
    mem8[INTRO_DELAY_CKSUM_WORD] = 0x20; // reseed the delay
    mem8[INTRO_PHASE_INDEX] = mem8[INTRO_PHASE_INDEX] + 1; // advance to phase 6 (byte write wraps)
    return;
  }

  const delay = (mem8[INTRO_DELAY_CKSUM_WORD] - 1) & 0xff;
  mem8[INTRO_DELAY_CKSUM_WORD] = delay;
  if ((delay & 0x0f) !== 0) return; // not a 16-frame boundary

  const toggled = (mem8[INTRO_PHASE5_TOGGLE] + 1) & 0xff;
  mem8[INTRO_PHASE5_TOGGLE] = toggled;
  const cmd = (toggled & 0x01) ? DISPLAY_CMD_0627 : INTRO_PHASE5_DISPLAY_CMD_A;
  loc_0038(m, cmd); // enqueue the chosen display command
}

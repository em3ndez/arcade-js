// SPDX-License-Identifier: GPL-3.0-only
/**
 * armFormationAdvanceTrigger -- arm the delayed one-shot that advances the stage once the board is clear.
 *
 * WHAT IT IS
 *   The trigger that begins a stage transition. When the alien block has been emptied, Galaxian advances
 *   to a harder stage; this routine arms the delayed one-shot that advanceStageAndReseedFormation (0x1637)
 *   later consumes to actually rebuild the formation. It only sets the flag -- the rebuild happens frames
 *   later when the paired countdown expires.
 *
 * ROLE IN THE MACHINE
 *   A gated one-shot (mechanisms.md "Advancing the stage and rebuilding the formation"). It fires only
 *   when both region-clear status gates loc_4220 and loc_4225 show bit0 set (the board has emptied) and
 *   the pending word loc_4222 is not already armed (bit0 clear). Meeting all three, it writes the 16-bit
 *   word at loc_4222 to 1: the low byte (loc_4222) becomes the enable flag, and the high byte (the
 *   countdown loc_4223) is zeroed. Any gate failing returns without a write, so re-arming is idempotent.
 *
 * ROM 0x1621.  Grounding: [seen].
 *
 * LIVE-OUT: memory only -- the delayed-one-shot word at loc_4222 (enable + countdown). No register result.
 */
import { loc_4220, loc_4222, loc_4225 } from "./names.js";

export function armFormationAdvanceTrigger(m) {
  const { mem8, mem16 } = m;

  // Both status gates must have bit 0 set...
  // loc_4220 and loc_4225 are the two region-clear flags; both must report the board emptied.
  if (!(mem8[loc_4220] & 0x01)) return;
  if (!(mem8[loc_4225] & 0x01)) return;

  // ...and the pending word must not already be armed (bit 0 clear).
  // This keeps the arm a one-shot: if a previous transition is still pending we leave it alone.
  if (mem8[loc_4222] & 0x01) return;

  // Arm it: low byte becomes the enable flag (1), high byte a zeroed countdown.
  // Writing the whole 16-bit word sets loc_4222=1 (enable) and loc_4223=0 (countdown) in one store, which
  // is exactly the armed state advanceStageAndReseedFormation waits to see before rebuilding the board.
  mem16[loc_4222] = 1;
}

// SPDX-License-Identifier: GPL-3.0-only
import { tickColumnCountdown } from "./tickColumnCountdown.js";
import { negateA } from "./negateA.js";
import { steerObjectRowTarget } from "./steerObjectRowTarget.js";
import {
  loc_43, loc_41, loc_00, loc_f2, loc_a1, loc_51, OBJECT_X_DRIFT_STASH, loc_61,
  OBJECT_Y_STEER, loc_8b, loc_71, loc_ef, POKEY_RANDOM, CONFIG_DIP_BYTE,
} from "./names.js";

/**
 * advanceColumnHeadingState — per-frame step of a secondary object's column heading + dwell state,
 * then hand off to the row-target steerer.
 *
 * ROM 0x2202. Grounding: [code] (behaviour-read). Load-bearing MAME-confirmed [seen] cells it touches:
 * the horizontal-drift stash OBJECT_X_DRIFT_STASH (0xbe), the vertical steer OBJECT_Y_STEER (0x81),
 * the POKEY hardware RNG POKEY_RANDOM (0x100a), and the config/DIP byte CONFIG_DIP_BYTE (0xfd). The
 * remaining `loc_*` cells (state flag 0x43, heading 0x41, dwell 0xa1, drift 0x51, row 0x61, ...) are
 * behavioural placeholders.
 *
 * ROLE IN THE MACHINE. Centipede's secondary objects (the spider/flea family) drift vertically toward a
 * row target while wobbling horizontally. This routine is the small state machine that (a) sweeps the
 * object's "heading" phase, (b) runs a dwell timer that periodically re-rolls the horizontal drift and
 * flips the vertical steer, and (c) folds the drift out of the object's row position before steering it.
 * It is a per-frame stage that always tail-transfers into `steerObjectRowTarget`, which commits the new
 * row target and decides the actual drift direction.
 *
 * LIVE-OUT. heading `loc_41`, dwell `loc_a1`, drift `loc_51` and its stash OBJECT_X_DRIFT_STASH, the
 * steer OBJECT_Y_STEER, and the row cells `loc_61`/`loc_8b`. Returns `steerObjectRowTarget`'s value.
 */
export function advanceColumnHeadingState(m) {
  const { mem8 } = m;

  // Gate: the object is only steered while the state flag `loc_43` has none of its 0xaf selector bits
  // set (i.e. the object is in the plain "drifting" state, not mid-spawn/mid-death). Otherwise bail —
  // the frame's other machinery owns the object right now.
  if ((mem8[loc_43] & 0xaf) !== 0) return;

  const heading = mem8[loc_41];
  if ((heading & 0x20) !== 0) {
    // High-heading branch: bit 5 set means the heading has swung into its upper arc. Do nothing until
    // it climbs to the far edge (>= 0xf8); once there, re-arm the shared tick countdown that paces the
    // next heading swing. This is the "hold at the top of the arc, then restart the clock" case.
    if (heading < 0xf8) return;
    return tickColumnCountdown(m);
  }

  // Low-heading branch. Advance the heading only every 4th frame (loc_00's low 2 bits == 0) so the
  // sweep is slow. The step is +1, but folded through `loc_f2`: if the stepped value diverges from the
  // fold reference by >= 0x1c it has run off the end of the arc, so it snaps back to 0x14 (folded),
  // wrapping the heading to the start of the sweep rather than overshooting.
  if ((mem8[loc_00] & 0x03) === 0) {
    const stepped = (mem8[loc_41] + 1) & 0xff;
    mem8[loc_41] = stepped;
    if ((stepped ^ mem8[loc_f2]) >= 0x1c) mem8[loc_41] = 0x14 ^ mem8[loc_f2];
  }

  // Dwell timer: count `loc_a1` down one per frame. It paces how long the object holds a heading before
  // the periodic re-roll below fires. On wrap-through-zero, retarget the drift and re-arm the timer.
  const dwell = (mem8[loc_a1] - 1) & 0xff;
  mem8[loc_a1] = dwell;
  if (dwell === 0) {
    // Half the time (RNG bit 7), toggle the horizontal drift between paused and running by swapping the
    // drift delta `loc_51` in and out of its stash cell. This is what makes the object stutter its
    // sideways motion unpredictably.
    if ((mem8[POKEY_RANDOM] & 0x80) !== 0) {
      const delta = mem8[loc_51];
      if (delta === 0) {
        // Drift currently paused (delta zeroed) -> resume by restoring the stashed delta.
        mem8[loc_51] = mem8[OBJECT_X_DRIFT_STASH]; // resume: restore the stashed delta
      } else if (mem8[loc_61] >= 0x05 && mem8[loc_61] < 0xfb) {
        // Drift currently running AND the object sits away from both row edges (0x05..0xfa) -> pause it:
        // stash the live delta and zero the drift so the object stops drifting sideways for a while.
        mem8[OBJECT_X_DRIFT_STASH] = delta; // pause: stash the delta and zero it
        mem8[loc_51] = 0x00;
      }
    }
    // Occasionally flip the vertical steer sign. The gate ANDs the RNG with (DIP bit6 | 0x20): bit 5 is
    // always in play, and the operator DIP at bit 6 can widen the chance — so how erratically the object
    // reverses its vertical drift is partly an operator setting. negateA is the 6502 two's-complement.
    if (((((mem8[CONFIG_DIP_BYTE] & 0x40) | 0x20) & mem8[POKEY_RANDOM])) !== 0) {
      mem8[OBJECT_Y_STEER] = negateA(m, mem8[OBJECT_Y_STEER]);
    }
    // Re-arm the dwell timer to a fixed 0x30 for the next hold interval.
    mem8[loc_a1] = 0x30;
  }

  // Apply the horizontal drift: subtract the drift delta `loc_51` out of the row/column cell `loc_61`
  // and mirror the result into the scratch `loc_8b` (so a downstream consumer sees the same value).
  const row = (mem8[loc_61] - mem8[loc_51]) & 0xff;
  mem8[loc_61] = row;
  mem8[loc_8b] = row;
  // Build the heading to steer with: take the base heading `loc_71` and add or subtract the vertical
  // steer OBJECT_Y_STEER, the sign chosen by the per-wave direction selector `loc_ef` (0 == subtract).
  let heading2 = mem8[loc_71];
  if (mem8[loc_ef] === 0) heading2 = (heading2 - mem8[OBJECT_Y_STEER]) & 0xff;
  else heading2 = (heading2 + mem8[OBJECT_Y_STEER]) & 0xff;
  // Tail-transfer to the steerer with the summed heading; it commits the new row target and drift.
  return steerObjectRowTarget(m, heading2);
}

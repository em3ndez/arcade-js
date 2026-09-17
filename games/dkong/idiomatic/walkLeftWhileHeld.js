// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkLeftWhileHeld — the LEFT arm of Mario's ground-movement direction dispatch. Handed the cooked
 * control word (bit 1 = Left) and the position gate's LEFT verdict (1 = blocked against a leftward
 * playfield limit). Walks Mario one frame left only when Left is held AND leftward motion is not
 * blocked; otherwise it falls THROUGH to the ladder/climb collision handler (which services Up and
 * Down), keeping a refused frame available to the climb path rather than discarding it.
 *
 * LIVE-OUT: memory-only, plus the return value — which must stay undefined on both arms, because a
 * truthy value would read as a caller-skip up the movement cascade.
 */

import { walkMarioLeft } from "./walkMarioLeft.js";
import { armMarioClimbAtLadderEnd } from "./armMarioClimbAtLadderEnd.js";

const LEFT_HELD = 0x02;
// The left verdict blocks only on exactly 1; every other value leaves the walk open.
const LEFT_BLOCKED = 1;

export function walkLeftWhileHeld(m, leftLimit = m.regs.d, control = m.regs.a) {
  if (leftLimit !== LEFT_BLOCKED && (control & LEFT_HELD) !== 0) {
    return walkMarioLeft(m);
  }

  return armMarioClimbAtLadderEnd(m);
}

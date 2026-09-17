// SPDX-License-Identifier: GPL-3.0-only
/**
 * latchHammerTouch — latch whether Mario is touching one of the two hammer objects, select the
 * one he touched, and pulse the pickup sound. Gated to the boards a hammer appears on.
 *
 * LIVE-OUT: memory-only.
 */

import { MARIO_HAMMER_PENDING, SND_TRIGGER, OBJ_PAIR_6680, HAMMER_IN_PLAY } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";
import { findHammerOverlappingMario } from "./findHammerOverlappingMario.js";

// Board applicability mask: 25m, 50m, 100m (75m excluded).
const HAMMER_BOARDS = 0x0b;

const PICKUP_SOUND = SND_TRIGGER + 5;
const PICKUP_SOUND_FRAMES = 64;

// Stride between the two records of the hammer pair.
const PAIR_STRIDE = 0x10;

export function latchHammerTouch(m) {
  const { regs, mem8 } = m;

  regs.a = HAMMER_BOARDS;
  if (!boardBitGate(m)) return;

  findHammerOverlappingMario(m);
  const touching = regs.a; // 1 = overlapping a hammer, 0 = neither
  const matched = regs.b;  // 2 = first record, 1 = second, 0 = no overlap

  // Both writes are unconditional, so a miss clears whatever a touch set.
  mem8[MARIO_HAMMER_PENDING] = touching;
  mem8[PICKUP_SOUND] = touching ? PICKUP_SOUND_FRAMES : 0;

  if (matched === 0) return;

  const touched = matched === 1 ? OBJ_PAIR_6680 + PAIR_STRIDE : OBJ_PAIR_6680;
  mem8[touched + HAMMER_IN_PLAY] = 0x01;
}

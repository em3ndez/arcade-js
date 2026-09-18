// SPDX-License-Identifier: GPL-3.0-only
/**
 * windUpObjectMove — settle the object's animation phase toward a move command, then run its handler.
 *
 * One arm of the at-rest object dispatcher, reached when the per-frame move command carries a
 * direction bit. It runs the command through the animation-phase byte — a short wind-up counter
 * packed in the high bits with the command in the low bits. A settled phase dispatches now, a clear
 * phase arms the wind-up high and dispatches, and a mid-wind-up phase steps down and defers, snapping
 * to the settled command once it no longer reads out of the low bits. So a fresh command fires once,
 * holds for the wind-up, then fires every frame.
 */

import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { stampFixedFrameAndResolveTile } from "./stampFixedFrameAndResolveTile.js";
import { stepObjectAndResolveTile } from "./stepObjectAndResolveTile.js";
import { PLAYER_ANIM_PHASE } from "./names.js";

const WIND_UP_START = 0xc0; // high bits armed when the wind-up begins; the command sits in the low bits
const WIND_STEP = 32; // one wind-up notch subtracted per frame (0x20 — one step of the top-bit counter)
const DIR_BITS = 0x0c; // the two move-command direction bits that route into this routine
const STAMP_HANDLER_BIT = 0x04; // bit 2 of the command: set -> frame-stamp handler, clear -> step-and-resolve

export function windUpObjectMove(m, moveCommand = m.regs.l) {
  const { mem8 } = m;
  const phase = mem8[PLAYER_ANIM_PHASE];

  // Already settled: run the object's move handler this frame.
  if (phase === moveCommand) return dispatchMove(m, moveCommand);

  // Mid wind-up: step the counter down one notch and defer the frame (no move).
  if (phase !== 0) {
    const nextPhase = phase - WIND_STEP;
    mem8[PLAYER_ANIM_PHASE] = nextPhase;
    // Once the command no longer reads out of the low bits, snap to the settled command.
    if ((nextPhase & DIR_BITS) !== moveCommand) mem8[PLAYER_ANIM_PHASE] = moveCommand;
    return stageObjectSpriteRecord(m);
  }

  // Nothing armed yet: start the wind-up high, then run the handler this frame.
  mem8[PLAYER_ANIM_PHASE] = moveCommand | WIND_UP_START;
  return dispatchMove(m, moveCommand);
}

/** Dispatch the object's move handler on the command's bit 2 — set runs the frame-stamp handler,
 *  clear runs the step-and-resolve handler. Each handler's return unwinds to windUpObjectMove's caller. */
function dispatchMove(m, moveCommand) {
  if (moveCommand & STAMP_HANDLER_BIT) return stampFixedFrameAndResolveTile(m);
  return stepObjectAndResolveTile(m);
}

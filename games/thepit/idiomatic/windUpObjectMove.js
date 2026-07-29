// SPDX-License-Identifier: GPL-3.0-only
/**
 * windUpObjectMove — settle the object's animation phase toward a move command, then run its handler.  ROM 0x1468.
 *
 * One arm of the at-rest object dispatcher (routeIdleObjectByMoveCommand): reached when the object's per-frame move
 * command carries one of the two direction bits (bit 2 or bit 3). Instead of acting on the command
 * immediately, it runs the command through the object's animation-phase byte, which behaves as a
 * short wind-up counter packed into the byte's high bits with the command preserved in the low bits:
 *
 *   - Phase already equal to the command  -> settled: dispatch the object's move handler this frame.
 *   - Phase clear (nothing armed yet)      -> arm the wind-up high, then dispatch the handler.
 *   - Phase mid-wind-up (anything else)    -> step the counter down one notch and DEFER the frame
 *     (no move); once the counter has run far enough that the command no longer reads out of the low
 *     bits, snap the phase straight to the settled command so the next frame dispatches.
 *
 * So a fresh command dispatches once, then the object is held/deferred for the length of the wind-up
 * (six notches for the down command attract uses), then dispatches every frame once settled.
 *
 * The dispatch splits on the command's bit 2: set -> the frame-stamp handler stampFixedFrameAndResolveTile, clear -> the
 * step-and-resolve handler stepObjectAndResolveTile. Each handler's return unwinds straight to this routine's caller,
 * so dispatching is this routine's own return; the deferral likewise ends by building the object's
 * record, whose return unwinds the same way.
 *
 * The name stays neutral: the mechanism (phase settle + dispatch) is clear, but the two handlers it
 * feeds are themselves left neutral because the object-mover axis is an unresolved question, so the
 * game-visible purpose of the wind-up is not yet grounded — a specific name would over-assert it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1468.test.js.
 * GATE:     RAM-only over real captured attract dispatches (the settled-dispatch, wind-down, and
 *           arm arms all occur — the demo's command is always bit 2) + crafted entries for the
 *           bit-3 dispatch (-> stepObjectAndResolveTile) and the snap-to-command wind-down sub-branch attract never
 *           reaches. Excludes the dead stack scratch the still-oracle comparison run parks below the
 *           entry stack pointer (the idiomatic handlers are stack-free). Teeth: a wrong wind-down
 *           phase, and a skipped handler dispatch.
 * LIVE-OUT: memory-only — the animation-phase byte plus whatever the dispatched handler (or the
 *           deferral record) writes. No live registers of its own: the residual accumulator is dead
 *           ABI, and neither the caller nor any callee reads a register back from here (the move
 *           command is read, never written, so it stays intact for the handlers).
 * NAMES:    none from ram.js — the animation-phase byte 0x801a has no ram.js name yet, so it stays a
 *           local constant, matching routeIdleObjectByMoveCommand which resets the same byte. The callees
 *           stageObjectSpriteRecord, stampFixedFrameAndResolveTile and stepObjectAndResolveTile are decompiled and called directly.
 */

import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { stampFixedFrameAndResolveTile } from "./stampFixedFrameAndResolveTile.js";
import { stepObjectAndResolveTile } from "./stepObjectAndResolveTile.js";

const PLAYER_ANIM_PHASE = 0x801a; // the object's animation-phase byte (also reset by routeIdleObjectByMoveCommand)
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
    // Once the command no longer reads out of the low bits, the wind-up has run far enough:
    // snap the phase to the settled command so the next frame dispatches.
    if ((nextPhase & DIR_BITS) !== moveCommand) mem8[PLAYER_ANIM_PHASE] = moveCommand;
    return stageObjectSpriteRecord(m); // defer this frame
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

// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampFixedFrameAndResolveTile — stamp the actor's fixed animation frame, then run the shared cell/tile tail.
 *
 * One of a family of thin prologues the movement/state dispatcher jumps to: each writes a
 * different animation frame code into the actor's sprite-frame byte and hands off to the same
 * position/tile tail. This one picks frame 52 — a DEFAULT the shared tail's classifier usually
 * recomputes from tile and direction, so it survives only on the rare tile that routes past it.
 */

import { PLAYER_FACING } from "./names.js";
import { resolveObjectTile } from "./resolveObjectTile.js";

export function stampFixedFrameAndResolveTile(m, columnBias = m.regs.d) {
  const { mem8 } = m;

  // Choose this prologue's fixed animation frame; the draw code renders the actor with it.
  mem8[PLAYER_FACING] = 52;

  // Hand off to the shared tail — rebuild the screen cell, read the under-tile, dispatch;
  // its return unwinds to our caller, so this is our return too.
  return resolveObjectTile(m, columnBias);
}

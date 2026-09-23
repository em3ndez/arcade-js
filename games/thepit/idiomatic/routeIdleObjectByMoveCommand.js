// SPDX-License-Identifier: GPL-3.0-only
/** routeIdleObjectByMoveCommand — route an at-rest object to its per-frame handler on its
 * move-command bits, first-match-wins in fixed priority: a first direction bit positions the
 * object and tests the boundary; a second derives its tile row and dispatches; either of two
 * more reconciles its animation phase. With no direction bit the object stands still — reset
 * its animation phase, then run the goal handler if it has reached the goal tile, else build
 * its deferral record. The move command and the object's position deltas ride through registers
 * to the handlers untouched. LIVE-OUT: memory only. */

import { GOAL_TILE_LATCH, PLAYER_ANIM_PHASE } from "./names.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { resolveObjectTile } from "./resolveObjectTile.js";
import { windUpObjectMove } from "./windUpObjectMove.js";
import { stepObjectRowUnflipped } from "./stepObjectRowUnflipped.js";
import { stepObjectRowFlipped } from "./stepObjectRowFlipped.js";

export function routeIdleObjectByMoveCommand(m, moveCommand = m.regs.l, columnBias = m.regs.d, stepY = m.regs.e) {
  const { mem8 } = m;

  if (moveCommand & 0x01) return stepObjectRowFlipped(m, stepY);
  if (moveCommand & 0x02) return stepObjectRowUnflipped(m, stepY);
  if (moveCommand & 0x0c) return windUpObjectMove(m, moveCommand, columnBias);

  mem8[PLAYER_ANIM_PHASE] = 0;
  if (mem8[GOAL_TILE_LATCH] !== 0) return resolveObjectTile(m, columnBias);
  return stageObjectSpriteRecord(m);
}

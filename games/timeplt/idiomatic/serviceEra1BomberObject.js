// SPDX-License-Identifier: GPL-3.0-only
/** serviceEra1BomberObject — in era one, advance the game's single era-one object by its record head byte: an empty
 * head arms its fire timer, a live head runs the two-tile move, else it soaks hits toward death. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { armBomberSlotWhenTimerFires } from "./armBomberSlotWhenTimerFires.js";
import { advanceHitSoakingObjectThenAnimateDeath } from "./advanceHitSoakingObjectThenAnimateDeath.js";
import { advanceTwoTileObjectThenTryAimedSpawn } from "./advanceTwoTileObjectThenTryAimedSpawn.js";
import { ERA_INDEX, ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0 } from "./names.js";

export function serviceEra1BomberObject(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== 1) return;

  regs.ix = ERA_OBJECT_RECORD_SLOT0;
  regs.iy = ERA_OBJECT_ENTRY_SLOT0;
  const head = mem8[ERA_OBJECT_RECORD_SLOT0];
  if (head === 0) return armBomberSlotWhenTimerFires(m);

  regs.a = u8(head + 1);
  if (head !== 0xff) return advanceHitSoakingObjectThenAnimateDeath(m);
  return advanceTwoTileObjectThenTryAimedSpawn(m);
}

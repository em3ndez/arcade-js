// SPDX-License-Identifier: GPL-3.0-only
/**
 * runIntroClimbStep — stage one climb phase of the opening Kong-climb cutscene. A one-shot timer
 * gate: every frame it ticks the cutscene countdown and does nothing else until it expires, then
 * copies the phase's ten-record sprite block, nudges it into position, seeds two bytes, queues the
 * intro tune, and advances the cutscene step.
 *
 * LIVE-OUT: memory-only.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { loc_0038 } from "../translated/loc_0038.js";
import { SPRITE_OBJ_BLOCK, SND_PRIORITY, SND_PRIORITY_FRAMES, INTRO_STEP, INTRO_SCROLL_INDEX } from "./names.js";

const CLIMB_RECORDS_SRC = 0x388c;

export function runIntroClimbStep(m) {
  const { regs, mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  loadSpriteObjectBlock(m, CLIMB_RECORDS_SRC);

  // Two strided add-passes (stride 4, ten records): field 0 takes one constant, field 3 another.
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = 0x30;
  loc_0038(m);
  regs.hl = SPRITE_OBJ_BLOCK + 3;
  regs.c = 0x99;
  loc_0038(m);

  // These seeds run AFTER the add-passes: record 1's first field overwrites what pass 1 wrote.
  mem8[INTRO_SCROLL_INDEX] = 0x1f;
  mem8[SPRITE_OBJ_BLOCK + 4] = 0x00;

  mem8[SND_PRIORITY] = 0x01;
  mem8[SND_PRIORITY_FRAMES] = 0x03;

  mem8[INTRO_STEP] = (mem8[INTRO_STEP] + 1) & 0xff;
}

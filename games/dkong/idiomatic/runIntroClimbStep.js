// SPDX-License-Identifier: GPL-3.0-only
/**
 * runIntroClimbStep — stage one climb phase of the opening Kong-climb cutscene.
 *
 * One step of the short animation that plays at the head of every board. The cutscene runs
 * as a numbered sequence and a step selector says which phase this frame belongs to; this
 * handler owns the climb-advance phase and is reached once per frame while that phase is
 * selected.
 *
 * It is a one-shot TIMER GATE. An earlier phase armed the cutscene's frame countdown; every
 * frame this routine ticks that countdown and does nothing else until it expires. On the
 * single expiry frame it stages the next climb pose and hands the cutscene to the following
 * phase:
 *   - Copy this phase's ten-record sprite-object block — forty bytes, four per record —
 *     from its fixed template over SPRITE_OBJ_BLOCK.
 *   - Nudge the freshly-copied records into scene position with two strided add-passes over
 *     all ten records: one adds a constant into each record's first field, the other adds a
 *     different constant into each record's fourth.
 *   - Seed two bytes: INTRO_SCROLL_INDEX, and record 1's first field. That second seed
 *     overwrites what the first add-pass just wrote there, so the WRITE ORDER matters — the
 *     copy and both add-passes must run BEFORE these seeds.
 *   - Queue the intro tune: a three-frame priority-sound pulse.
 *   - Advance the cutscene step, so the next frame dispatches the following phase instead
 *     of re-running this one.
 *
 * Every store is work RAM; no hardware latch is touched. Nothing downstream reads a value
 * back from this handler.
 *
 * LIVE-OUT: memory-only.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { loc_0038 } from "../translated/loc_0038.js";
import { SPRITE_OBJ_BLOCK, SND_PRIORITY, SND_PRIORITY_FRAMES, INTRO_STEP, INTRO_SCROLL_INDEX } from "./names.js";

const CLIMB_RECORDS_SRC = 0x388c; // template of ten sprite-object records for this phase

export function runIntroClimbStep(m) {
  const { regs, mem } = m;

  // Tick the phase countdown. Until it expires this routine does nothing — the false
  // result aborts back to the dispatcher.
  if (!tickSubstateTimer(m)) return;

  // The timer just hit 0 — stage the next climb pose. Copy this phase's forty-byte
  // ten-record block from its template over SPRITE_OBJ_BLOCK; the copy reads its source
  // out of the register image.
  regs.hl = CLIMB_RECORDS_SRC;
  loadSpriteObjectBlock(m);

  // Two strided add-passes over the copied records (stride 4, ten records): each record's
  // first field takes one constant, then each record's fourth takes another.
  regs.hl = SPRITE_OBJ_BLOCK; // first field of record 0
  regs.c = 0x30;
  loc_0038(m);
  regs.hl = SPRITE_OBJ_BLOCK + 3; // fourth field of record 0
  regs.c = 0x99;
  loc_0038(m);

  // Seed the two fixed bytes. These run AFTER the add-passes on purpose: record 1's first
  // field is one of the first pass's targets, and this zero overwrites what it wrote.
  mem.write8(INTRO_SCROLL_INDEX, 0x1f); // intro Kong-climb scroll index
  mem.write8(SPRITE_OBJ_BLOCK + 4, 0x00); // record 1, first field

  // Queue the intro tune: a 3-frame priority-sound pulse.
  mem.write8(SND_PRIORITY, 0x01);
  mem.write8(SND_PRIORITY_FRAMES, 0x03);

  // Advance the cutscene step so the next frame runs the following phase.
  mem.write8(INTRO_STEP, (mem.read8(INTRO_STEP) + 1) & 0xff);
}

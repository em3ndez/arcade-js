// SPDX-License-Identifier: GPL-3.0-only
/**
 * runIntroClimbStep — stage one climb phase of the opening Kong-climb cutscene.  ROM 0x0abf.
 *
 * Step 1 of the opening Kong-climb cutscene (the short animation at the head of every
 * board). dispatchIntroCutsceneStep (0x0A76) reaches this handler once per frame, via
 * `ld a,(INTRO_STEP) / rst 0x28` through the 8-entry table at 0x0A7A, while GAME_SUBSTATE
 * (0x600A) == 7 and INTRO_STEP (0x6385) == 1 — the dispatcher labels this entry "advance
 * Kong's climb". Its sibling runIntroRoarStep (0x0BB3) is the last step of the same table.
 *
 * The handler is a one-shot TIMER GATE. Step 0 (0x0A8A) armed SUBSTATE_TIMER (0x6009);
 * every frame this routine ticks that countdown (tickSubstateTimer, the rst-0x18 helper)
 * and does nothing else until it expires. On the single expiry frame it stages the next
 * climb pose and hands the cutscene to the following step:
 *   - Load the 40-byte (10-record x 4) sprite-object block for this climb phase from the
 *     ROM template at 0x388C into SPRITE_OBJ_BLOCK (loadSpriteObjectBlock; HL = source).
 *   - Nudge the freshly-copied records into scene position with two strided add-passes
 *     (rst 0x38 = loc_0038: add C to 10 bytes, stride 4): +0x30 into field 0 of every
 *     record (from 0x6908) and +0x99 into field 3 of every record (from 0x690B).
 *   - Seed two bytes: an unnamed cutscene byte 0x638E <- 0x1F, and record-1 field 0
 *     (SPRITE_OBJ_BLOCK+4) <- 0 (this overwrites what add-pass 1 just wrote there, so the
 *     WRITE ORDER matters — the copy and both add-passes must run BEFORE these seeds).
 *   - Queue the intro tune: SND_PRIORITY <- 1 for SND_PRIORITY_FRAMES = 3 frames.
 *   - `inc (INTRO_STEP)` — advance to step 2 so the next frame dispatches the following
 *     phase instead of re-running this one.
 *
 * CALLEES: tickSubstateTimer (0x0018) and loadSpriteObjectBlock (0x004E) are the landed
 * idiomatic leaves, called directly. loc_0038 (the rst-0x38 add-pass) is NOT decompiled
 * yet, so it is the frozen oracle, called directly with HL/C set as the rst convention
 * expects (it fixes stride 4, count 10, and runs sub_003d). That raw callee still models
 * a `ret`, so each add-pass pops one word off the Z80 stack that this routine never pushed
 * — a bottom-up leak (loc_0038 is the next target). It touches only STACK_SCRATCH, so it
 * is invisible to the memory contract; this routine's SP/pc are not modelled and not
 * compared. No hardware (0x7Dxx) writes — every store is work RAM.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0abf.test.js.
 * GATE:     crafted-entry — attract (6000 frames) dispatches 0x0abf ZERO times (the intro
 *           cutscene is a credited game's per-board head), so it is validated on real
 *           booted-attract states with surgical pokes: an EXHAUSTIVE sweep of SUBSTATE_TIMER
 *           0..255 (only 1 expires -> full work; all others just decrement the timer) and
 *           an EXHAUSTIVE sweep of INTRO_STEP 0..255 at expiry (pins the +1 wrap). The block
 *           copy overwrites its own targets from ROM, so the work branch is otherwise a
 *           constant. Teeth: write-order corruption of 0x690C, and a dropped INTRO_STEP inc.
 * LIVE-OUT: memory-only. The caller (dispatchIntroCutsceneStep's rst-0x28 tail) discards
 *           this handler's return and reads no register/flag it leaves — the oracle's
 *           residual A/HL/flags are dead ABI, and its SP/pc are the Z80 caller-skip
 *           mechanism the boolean gate replaces (not part of the contract).
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908), SND_PRIORITY (0x608A), SND_PRIORITY_FRAMES (0x608B),
 *           INTRO_STEP (0x6385) from ram.js. Hex-kept: ROM source 0x388C (an immediate) and
 *           0x638E (an unnamed cutscene byte).
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018 (rst 0x18)
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { loc_0038 } from "../translated/loc_0038.js"; // rst 0x38 add-pass — not yet idiomatic
import { SPRITE_OBJ_BLOCK, SND_PRIORITY, SND_PRIORITY_FRAMES, INTRO_STEP } from "./ram.js";

const CLIMB_RECORDS_SRC = 0x388c; // ROM template of 10 sprite-object records for this phase
const CUTSCENE_BYTE_638E = 0x638e; // unnamed cutscene byte, seeded to 0x1F here

export function runIntroClimbStep(m) {
  const { regs, mem } = m;

  // rst 0x18 — tick the phase countdown. Until it expires this routine does nothing:
  // the false return is the oracle's inc-sp caller-skip (abort to the dispatcher).
  if (!tickSubstateTimer(m)) return;

  // The timer just hit 0 — stage the next climb pose. Copy this phase's 40-byte sprite
  // record block from the ROM template into SPRITE_OBJ_BLOCK (HL is the copy source).
  regs.hl = CLIMB_RECORDS_SRC;
  loadSpriteObjectBlock(m);

  // Two strided add-passes over the copied records (rst 0x38 fixes stride 4, count 10):
  // field 0 of every record += 0x30, then field 3 of every record += 0x99.
  regs.hl = SPRITE_OBJ_BLOCK; // 0x6908 — field 0 of record 0
  regs.c = 0x30;
  loc_0038(m);
  regs.hl = SPRITE_OBJ_BLOCK + 3; // 0x690b — field 3 of record 0
  regs.c = 0x99;
  loc_0038(m);

  // Seed the two fixed bytes. These run AFTER the add-passes on purpose: 0x690C is one of
  // add-pass 1's targets (record 1, field 0), and this zero overwrites what it wrote.
  mem.write8(CUTSCENE_BYTE_638E, 0x1f);
  mem.write8(SPRITE_OBJ_BLOCK + 4, 0x00); // 0x690c — record 1, field 0

  // Queue the intro tune: a 3-frame priority-sound pulse.
  mem.write8(SND_PRIORITY, 0x01);
  mem.write8(SND_PRIORITY_FRAMES, 0x03);

  // inc (INTRO_STEP) — advance to step 2 so the next frame runs the following phase.
  mem.write8(INTRO_STEP, (mem.read8(INTRO_STEP) + 1) & 0xff);
}

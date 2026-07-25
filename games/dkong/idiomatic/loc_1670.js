// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1670 — one timer-gated step of the board-advance render sequence.  ROM 0x1670.
 *
 * A step handler in the board-cleared / advance interlude (GAME_SUBSTATE 0x600A == 0x16).
 * loc_1615 dispatches this family through the 0x6388 step selector: for the odd boards
 * (BOARD bit0 set → 25m / 75m) the table at 0x1623 is [1654, 1670, 168a, 1732, 1757, 178e],
 * so this is step index 1. Every sibling has the same shape — hold a pose for a fixed number
 * of frames, then on expiry swap in the next sprite-object animation frame and advance the
 * step — and its tail (the `inc (0x6388)` + per-board rst-0x30 gate + rst-0x38 Y nudge) is
 * the same one factored out as tail_1662 for the sub_1654 / sub_168a steps.
 *
 * On each frame:
 *   - rst 0x18 (tickSubstateTimer) ticks SUBSTATE_TIMER (0x6009). Until it expires the
 *     routine only decrements and returns — the pose is held. On the single expiry frame:
 *   - Copy this step's 40-byte (10-record × 4) sprite-object animation frame from the ROM
 *     table at 0x3932 into SPRITE_OBJ_BLOCK (loadSpriteObjectBlock; HL = source). 0x3932 is
 *     the base of a c*40-strided animation table (see loc_2d15).
 *   - Re-arm SUBSTATE_TIMER to 0x20 (hold the new pose 32 frames) and advance the step
 *     selector 0x6388 (`inc (hl)`).
 *   - rst 0x30 (boardBitGate) with A = 0x04 = board mask bit2 (75m only): the gate is open
 *     only on 75m. On every other board it closes and the routine returns here.
 *   - rst 0x38 (addToSpriteObjectColumn) — 75m only: HL = 0x690b (field 3 = the Y column),
 *     C = +4, so all ten sprite-object records shift down 4 px.
 *
 * Reached via dispatchGameState's rst-0x28 tail, which discards this handler's return.
 * NAME: kept as loc_1670 — the mechanics are understood but the exact visual the animation
 * depicts is not independently confirmed, and the whole sibling family stayed address-named.
 *
 * CALLEES (all landed idiomatic leaves, called directly — no stack modelling):
 * tickSubstateTimer (0x0018), loadSpriteObjectBlock (0x004e), boardBitGate (0x0030),
 * addToSpriteObjectColumn (0x0038, → addStrided 0x003d).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1670.test.js.
 * GATE:     crafted-entry — attract never reaches GAME_SUBSTATE 0x16 (it does not complete a
 *           board), so 0x1670 dispatches 0 times; validated on real booted-attract state with
 *           surgical pokes: EXHAUSTIVE sweep of SUBSTATE_TIMER 0..255 (only 1 expires; the copy
 *           overwrites its own targets from ROM so the work branch is otherwise constant),
 *           EXHAUSTIVE sweep of the 0x6388 step byte at expiry (the `inc` incl. 0xFF→0x00 wrap),
 *           and BOTH rst-0x30 arms (BOARD = 3 opens the Y nudge; 1/2/4 close it). Teeth: a
 *           wrong-board gate (opens on 25m) and a dropped step `inc`.
 * LIVE-OUT: memory-only. The rst-0x28 dispatch tail reads no register/flag this leaves; the
 *           oracle's residual A/HL/DE/BC/flags are dead ABI, and its SP/pc are the Z80
 *           caller-skip mechanism the boolean gates replace (not part of the contract).
 * NAMES:    SUBSTATE_TIMER (0x6009), SPRITE_OBJ_BLOCK (0x6908) from ram.js. Hex-kept: ROM
 *           animation-table base 0x3932 (an immediate) and the step selector 0x6388 (unnamed
 *           in ram.js — a shared 0x63xx render-sequence counter).
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018 (rst 0x18)
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { boardBitGate } from "./boardBitGate.js"; // ROM 0x0030 (rst 0x30)
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)
import { SUBSTATE_TIMER, SPRITE_OBJ_BLOCK } from "../optimized/ram.js";

const ANIM_FRAME_SRC = 0x3932; // ROM base of the board-advance sprite-object animation table
const STEP_SELECTOR = 0x6388; // 0x6388 — the board-advance render-sequence step index
const POSE_HOLD_FRAMES = 0x20; // frames to hold the newly-staged pose before the next step
const BOARD_MASK_75M = 0x04; // rst-0x30 applicability mask: bit2 = 75m only
const Y_COLUMN = SPRITE_OBJ_BLOCK + 3; // 0x690b — field 3 (Y) of sprite-object record 0
const Y_NUDGE = 0x04; // +4 into every record's Y column (75m only)

export function loc_1670(m) {
  const { regs, mem } = m;

  // rst 0x18 — hold this pose until the frame timer expires. While it counts down,
  // decrement and abort to the dispatcher (the oracle's inc-sp caller-skip).
  if (!tickSubstateTimer(m)) return;

  // Timer expired — swap in this step's sprite-object animation frame: copy the 40-byte
  // (10-record × 4) template from ROM 0x3932 into SPRITE_OBJ_BLOCK (HL = the copy source).
  regs.hl = ANIM_FRAME_SRC;
  loadSpriteObjectBlock(m);

  // Re-arm the pose-hold timer and advance the render-sequence step selector.
  mem.write8(SUBSTATE_TIMER, POSE_HOLD_FRAMES);
  mem.write8(STEP_SELECTOR, (mem.read8(STEP_SELECTOR) + 1) & 0xff);

  // rst 0x30 — per-board gate: only 75m (mask bit2) applies the Y nudge below. Closed on
  // every other board → return here (the oracle's pop-hl caller-skip).
  regs.a = BOARD_MASK_75M;
  if (!boardBitGate(m)) return;

  // rst 0x38 — 75m only: add +4 to field 3 (the Y column) of all ten sprite-object records,
  // nudging the whole row of props down 4 px. HL/C are the caller's; the leaf fixes stride 4,
  // count 10.
  regs.hl = Y_COLUMN;
  regs.c = Y_NUDGE;
  addToSpriteObjectColumn(m);
}

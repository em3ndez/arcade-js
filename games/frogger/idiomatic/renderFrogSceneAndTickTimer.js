// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogSceneAndTickTimer  —  ROM 0x0942  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-frame render core of the frog scene. Each frame it counts down the active player's game
 *   timer, redraws the frog sprite and its surrounding banner/furniture, keeps the countdown-enable
 *   mirror in step, stamps the home bays the player has already filled, and finally re-arms the frog
 *   object for the next frame. A single "demo/frame gate" (FROG_STATE_DEMO_FLAG, 0x83cd) suppresses the
 *   parts that must not run during the attract demo — the timer tick and the status/home-marker column.
 *
 * WHERE IT SITS
 *   Called once per board-setup frame from setUpBoardOrContinueLife (the per-frame board-start / life-loss
 *   dispatcher). That caller stores this routine's return value into BOARD_LAYOUT_GATE (0x83ea), so the
 *   gate latches "board drawn" once the scene has been laid. It in turn drives the heavy furniture pass
 *   renderFrogAndArmObjects (ROM 0x1952) and the frog-animation dispatcher, and delegates its own exit to
 *   the shared frog-object reset (resetFrogObject, ROM 0x09aa), which every non-attract path tail-calls.
 *
 * LIVE-OUT
 *   Memory + the A register. On the attract bare return A is 0. On every other path A is whatever the
 *   shared reset delegate resetFrogObject leaves in A. setUpBoardOrContinueLife reads that A and writes it
 *   into BOARD_LAYOUT_GATE (0x83ea). The RAM side-effects are the per-frame timer byte, the timer-expiry
 *   flag, the countdown-enable mirror, and (via the render/blit callees) the frog-scene VRAM.
 */
import {
  FROG_STATE_DEMO_FLAG, loc_83cf, PLAY_FLAG, ACTIVE_PLAYER, TIME_REMAINING_P1, TIME_REMAINING_P2, GATED_COUNTDOWN_ENABLE_FLAG,
  HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY1_OCCUPANCY_ALT, PLAYER_START_DEMO_FLAG, STATUS_ROW_VRAM_BASE, LIFE_RESTART_FLAG,
  GATED_COUNTDOWN_ENABLE_MIRROR,
} from "./names.js";
import { renderFrogAndArmObjects } from "./renderFrogAndArmObjects.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { renderFilledHomeSlots } from "./renderFilledHomeSlots.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { resetFrogObject } from "./resetFrogObject.js";
import { dispatchFrogAnimationArm } from "./dispatchFrogAnimationArm.js";

export function renderFrogSceneAndTickTimer(m) {
  const { mem8 } = m;

  // ── Clear the life-restart gate for this frame (ROM 0x0942) ──────────────────────────────
  // LIFE_RESTART_FLAG (0x83ce) is the "restart the life" hand-off that driveFrogDeathAnimation raises and
  // beginNextLifeOrIntro reads (0 = resume play). The render core clears it unconditionally at the top of
  // every frame, so the flag only ever survives from the frame that sets it to the frame that consumes it.
  mem8[LIFE_RESTART_FLAG] = 0;

  // ── Clear the timer-expiry flag, unless the demo gate is set (ROM 0x0946) ─────────────────
  // loc_83cf (0x83cf) is the shared scratch byte this routine uses as the "timer elapsed" flag — it is
  // raised below when the countdown hits 0. It is reset here so expiry is detected fresh each frame, but
  // ONLY when the demo/frame gate FROG_STATE_DEMO_FLAG (0x83cd) is clear: during the attract demo the ROM
  // jumps past this clear so the flag is left untouched.
  if (mem8[FROG_STATE_DEMO_FLAG] === 0) mem8[loc_83cf] = 0;

  // ── Not in play → attract or demo exit (ROM 0x0950 / block_09ca) ──────────────────────────
  // PLAY_FLAG (0x83fe) is both the in-play flag and the player count: 0 = attract, 1/2 = a game with that
  // many players. When it is 0 there is no timer to tick and no live frog to arm, so the routine bails via
  // one of two exits: pure attract (demo gate clear) returns A=0 for the caller's continue flag; a demo
  // frame (demo gate set) still hands off to the shared frog-object reset so the demo frog keeps animating.
  if (mem8[PLAY_FLAG] === 0) {
    if (mem8[FROG_STATE_DEMO_FLAG] === 0) return (m.regs.a = 0);
    return resetFrogObject(m);
  }

  // ── Select the active player's timer cell (ROM 0x0956 / block_0961) ───────────────────────
  // ACTIVE_PLAYER (0x83fd) holds the current player number (1 or 2). Player 1 counts down in
  // TIME_REMAINING_P1 (0x83e5); everyone else (player 2) uses TIME_REMAINING_P2 (0x83e6). The ROM picks
  // the cell by decrementing the player number and branching on zero.
  const timerCell = mem8[ACTIVE_PLAYER] === 1 ? TIME_REMAINING_P1 : TIME_REMAINING_P2;

  // ── Tick the game timer, flag expiry (ROM 0x0964 / block_0964) ────────────────────────────
  // Outside the demo gate, decrement the selected timer byte (wrapping in 8 bits, matching the Z80 DEC
  // (HL)). When it reaches 0 the clock has run out, so raise the timer-expiry flag loc_83cf (0x83cf) = 1;
  // the death/expiry logic elsewhere consumes it. During the demo the timer must not move, so the ROM
  // skips this whole block when FROG_STATE_DEMO_FLAG (0x83cd) is set.
  if (mem8[FROG_STATE_DEMO_FLAG] === 0) {
    const remaining = (mem8[timerCell] - 1) & 0xff;
    mem8[timerCell] = remaining;
    if (remaining === 0) mem8[loc_83cf] = 1;
  }

  // ── Render the frog sprite + object banner (ROM 0x0972 / call 0x1952) ─────────────────────
  // renderFrogAndArmObjects (ROM 0x1952) paints the fixed frog-scene furniture and re-seeds the object
  // animation state. This runs every in-play frame, demo or not.
  renderFrogAndArmObjects(m);

  // ── Lay the status / home-marker column, outside the demo gate (ROM 0x0978) ───────────────
  // Only when the demo gate is clear: first set the countdown-enable MIRROR (GATED_COUNTDOWN_ENABLE_MIRROR,
  // 0x83b5) to 1 — the ROM does this by inc'ing the freshly-read demo flag (which is 0 here) — then blit
  // the four-tile status/home-marker column into VRAM at STATUS_ROW_VRAM_BASE (0xa850). Note the mirror is
  // rewritten unconditionally just below, so this 1 is a transient value seen only across the blit call;
  // it is preserved to match the ROM's write sequence exactly.
  if (mem8[FROG_STATE_DEMO_FLAG] === 0) {
    mem8[GATED_COUNTDOWN_ENABLE_MIRROR] = 1;
    blitFourTileGroupColumn(m, STATUS_ROW_VRAM_BASE);
  }

  // ── Refresh the countdown-enable mirror (ROM 0x0985 / block_0985) ─────────────────────────
  // GATED_COUNTDOWN_ENABLE_MIRROR (0x83b5) is kept as the bit-complement of the real countdown-enable flag
  // GATED_COUNTDOWN_ENABLE_FLAG (0x826c): when the countdown is enabled (flag=1) the mirror reads 0, and
  // vice-versa. This unconditional write is the one that survives the frame (it overwrites the transient 1
  // set above during the not-demo path).
  mem8[GATED_COUNTDOWN_ENABLE_MIRROR] = mem8[GATED_COUNTDOWN_ENABLE_FLAG] ^ 1;

  // ── Stamp the player's already-filled home bays (ROM 0x098e / call 0x09db) ────────────────
  // renderFilledHomeSlots redraws the home bays the active player has already reached this board. The
  // occupancy bitmask lives in a per-player bank: player 1 uses HOME_BAY1_OCCUPANCY_PRIMARY (0x825e),
  // player 2 the alternate bank HOME_BAY1_OCCUPANCY_ALT (0x8263). The ROM selects the bank the same way it
  // selected the timer cell — by testing the active player number.
  renderFilledHomeSlots(m, mem8[ACTIVE_PLAYER] === 1 ? HOME_BAY1_OCCUPANCY_PRIMARY : HOME_BAY1_OCCUPANCY_ALT);

  // ── Exit: reset the frog object, optionally after arming the animation (ROM 0x099a) ───────
  // PLAYER_START_DEMO_FLAG (0x825a) is the per-player start/demo flag, raised at player start and on the
  // two-player hand-off. When it is clear there is nothing to arm, so we tail-hand straight to the shared
  // frog-object reset. When it is set this is the player's first live frame: load the active player's lane
  // parameters, run the frog-animation dispatcher to arm the frog's animation, clear the start flag so the
  // arming happens exactly once, and then fall through to the same reset delegate. Either way the routine
  // exits by returning resetFrogObject's value (the caller's continue flag).
  if (mem8[PLAYER_START_DEMO_FLAG] === 0) return resetFrogObject(m);
  loadActivePlayerLaneParams(m);
  dispatchFrogAnimationArm(m);

  mem8[PLAYER_START_DEMO_FLAG] = 0;
  return resetFrogObject(m);
}

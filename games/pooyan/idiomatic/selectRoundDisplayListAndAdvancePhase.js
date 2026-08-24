// SPDX-License-Identifier: GPL-3.0-only
import {
  PHASE_TIMER,
  PLAY_MODE_LATCH,
  PLAY_STATE_INDEX,
  SUBPHASE_TICK,
  ROUND_IN_PROGRESS,
  GAME_ACTIVE_FLAG,
  ROUND_COUNTER,
  DISPLAY_LIST_SRC_PTR,
  DISPLAY_LIST_SRC_PTR_ALT,
  DISPLAY_LIST_DST_PTR_ALT,
  DISPLAY_LIST_DST_PTR,
  ENEMY_SPAWN_TIMER,
  PLAYFIELD_PAINT_START,
  ATTRACT_LIST_DST_SEED,
  DLIST_GFX_ROUND_ODD,
  DLIST_LAYOUT_ROUND_ODD,
  DLIST_GFX_ROUND0,
  DLIST_LAYOUT_ROUND0,
  DLIST_GFX_LATCH_B1,
  DLIST_LAYOUT_LATCH_B1,
  DLIST_GFX_LATCH,
  DLIST_LAYOUT_LATCH,
  DLIST_GFX_ALT_EVEN,
  DLIST_LAYOUT_ALT_EVEN,
  DLIST_GFX_ALT_ODD,
  DLIST_LAYOUT_ALT_ODD,
  PHASE_SETUP_DISPLAY_CMD,
} from "./names.js";
import { loc_02e3 } from "./loc_02e3.js";
import { loc_1dd3 } from "./loc_1dd3.js";
import { renderPhaseGauge } from "./renderPhaseGauge.js";
import { loc_0038 } from "./loc_0038.js";
import { clearDisplayMsgBufOnRoundInitMatch } from "./clearDisplayMsgBufOnRoundInitMatch.js";
/**
 * selectRoundDisplayListAndAdvancePhase — idx1 state handler. Decrements the phase timer and returns until it expires; then
 * runs the per-phase setup, and selects a (graphic, layout) pointer pair from a decision tree
 * keyed on the play-mode latch, round-in-progress flag, game-active flag and round counter. The
 * chosen pair is committed to the display-list pointers, the fixed pointers are seeded, the play
 * sub-state is bumped, a display command is enqueued, and the message-buffer compare is invoked.
 *
 * LIVE-OUT: memory only — no register survives for a caller.
 */

const SPAWN_TIMER_SEED = 0x20;

export function selectRoundDisplayListAndAdvancePhase(m) {
  const { mem8, mem16 } = m;

  const t = (mem8[PHASE_TIMER] - 1) & 0xff;
  mem8[PHASE_TIMER] = t;
  if (t !== 0) return; // timer still running

  loc_02e3(m);
  loc_1dd3(m);

  if (mem8[PLAY_MODE_LATCH] & 0x01) {
    mem8[PLAY_STATE_INDEX] = 0x10; // attract/other: force sub-state 0x10
    return;
  }

  mem8[SUBPHASE_TICK] = 0x00;
  renderPhaseGauge(m);

  const latch = mem8[PLAY_MODE_LATCH];
  const round = mem8[ROUND_COUNTER];

  let gfx, layout;
  let useAlt = false;

  if (latch === 0) {
    if (mem8[ROUND_IN_PROGRESS] !== 0) {
      useAlt = true;
    } else if (mem8[GAME_ACTIVE_FLAG] === 0) {
      useAlt = true;
    } else if (round & 0x01) {
      gfx = DLIST_GFX_ROUND_ODD;
      layout = DLIST_LAYOUT_ROUND_ODD;
    } else if (round === 0) {
      gfx = DLIST_GFX_ROUND0;
      layout = DLIST_LAYOUT_ROUND0;
    } else {
      useAlt = true;
    }
  } else if (round & 0x02) {
    gfx = DLIST_GFX_LATCH_B1;
    layout = DLIST_LAYOUT_LATCH_B1;
  } else {
    gfx = DLIST_GFX_LATCH;
    layout = DLIST_LAYOUT_LATCH;
  }

  if (useAlt) {
    if ((round & 0x01) === 0) {
      gfx = DLIST_GFX_ALT_EVEN;
      layout = DLIST_LAYOUT_ALT_EVEN;
    } else {
      gfx = DLIST_GFX_ALT_ODD;
      layout = DLIST_LAYOUT_ALT_ODD;
    }
  }

  mem16[DISPLAY_LIST_SRC_PTR] = layout;
  mem16[DISPLAY_LIST_SRC_PTR_ALT] = gfx;
  mem16[DISPLAY_LIST_DST_PTR_ALT] = PLAYFIELD_PAINT_START;
  mem16[DISPLAY_LIST_DST_PTR] = ATTRACT_LIST_DST_SEED;
  mem8[ENEMY_SPAWN_TIMER] = SPAWN_TIMER_SEED;
  mem8[PLAY_STATE_INDEX] = mem8[PLAY_STATE_INDEX] + 1; // next sub-state

  loc_0038(m, PHASE_SETUP_DISPLAY_CMD);
  clearDisplayMsgBufOnRoundInitMatch(m);
}

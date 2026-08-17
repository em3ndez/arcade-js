// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveFrogDeathAnimation — frog death / hop-complete animation driver. Gated by the hold flag: an idle
 * frog returns at once. Otherwise it mirrors a couple of anim latches, runs the home-bay stamp and the
 * collision reset, then ticks the hop-frame counter. Only when the counter reaches 0x10 does it advance
 * the death phase and dispatch on it: the board-advance / reset arm (activate the frog + clear state), or
 * one of the per-phase death-sprite pokes. The bank-select flag chooses the second poke set.
 * LIVE-OUT: memory-only.
 */
import {
  HOLD_FLAG, FIGURE_ANIM_STEP_GATE, FROG_ANIM_BLIT_TRIGGER, HOME_BAY_SLOT_CURSOR_MIRROR, PENDING_HOME_BAY_SLOT, FROG_SPRITE_CODE,
  FROG_FURTHEST_ROW, FROG_HOP_DOWN_ACTIVE, FROG_HOP_LEFT_ANIM_COUNTER, GAME_MODE, PLAY_FLAG,
  TWO_PLAYER_START_FLAG, IN_PLAY_BOARD_STATE_BYTE, COUNTDOWN_EXPIRY_FLAG, SCROLL_STAMP_PHASE, SCROLL_EDGE_FLAG, SCROLL_STAMP_ROWCOUNT,
  SCROLL_BAND_ROWSPAN,
  HOP_FRAME_COUNTER,
} from "./names.js";
import { stampHomeBaySlot } from "./stampHomeBaySlot.js";
import { activateFrogObject } from "./activateFrogObject.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearTwoPlayerFrameCells } from "./clearTwoPlayerFrameCells.js";
import { clearLatchedCollision } from "./clearLatchedCollision.js";

const loc_8046 = 0x8046;             // frog object sub-byte set to 7 as the death phase advances
const DEATH_PHASE = 0x81b2;          // death-phase index, bumped each time the counter reaches 0x10
const SECOND_BANK = 0x829c;          // second-bank select for the death-sprite poke set
const loc_8299 = 0x8299;             // board-state byte cleared on board advance
const DEATH_WORD = 0x8382;           // death-anim word poke operand
const loc_83ce = 0x83ce;             // board-advance ready flag set by the reset arm

const COUNTER_TARGET = 0x10;

export function driveFrogDeathAnimation(m) {
  const { mem8 } = m;
  if (mem8[HOLD_FLAG] === 0) return;

  if (mem8[FIGURE_ANIM_STEP_GATE] & 0x01) mem8[FROG_ANIM_BLIT_TRIGGER] = 1;
  if (mem8[HOME_BAY_SLOT_CURSOR_MIRROR] !== 0) mem8[PENDING_HOME_BAY_SLOT] = mem8[HOME_BAY_SLOT_CURSOR_MIRROR];

  stampHomeBaySlot(m);
  clearLatchedCollision(m);

  const cnt = (mem8[HOP_FRAME_COUNTER] + 1) & 0xff;
  mem8[HOP_FRAME_COUNTER] = cnt;
  if (cnt !== COUNTER_TARGET) return;

  mem8[HOP_FRAME_COUNTER] = 0;
  mem8[loc_8046] = 0x07;
  const phase = (mem8[DEATH_PHASE] + 1) & 0xff;
  mem8[DEATH_PHASE] = phase;

  if (mem8[SECOND_BANK] !== 0) {
    if (phase === 0x05) return advanceBoardAndReset(m);
    return stampDeathTile(m, phase);
  }
  if (phase === 0x06) return advanceBoardAndReset(m);
  return stampDeathTile(m, phase);
}

// Board-advance / reset arm: activate the frog, clear the death and hop state, and on game-mode 1 in a
// one-player game reset the board-state cells.
function advanceBoardAndReset(m) {
  const { mem8 } = m;
  activateFrogObject(m);
  mem8[DEATH_PHASE] = 0;
  mem8[HOLD_FLAG] = 0;
  mem8[HOP_FRAME_COUNTER] = 0;
  mem8[FROG_FURTHEST_ROW] = 0;
  mem8[SECOND_BANK] = 0;
  for (let a = FROG_HOP_DOWN_ACTIVE; a <= FROG_HOP_LEFT_ANIM_COUNTER; a++) mem8[a] = 0;
  mem8[loc_83ce] = 1;
  if (mem8[GAME_MODE] === 1 && mem8[PLAY_FLAG] === 0) {
    mem8[GAME_MODE] = 0;
    mem8[loc_8299] = 0;
    mem8[IN_PLAY_BOARD_STATE_BYTE] = 0;
    mem8[TWO_PLAYER_START_FLAG] = 0;
  }
}

// Stamp the phase's death sprite (bank chosen by the second-bank flag); two phases also queue sound and
// reset the scroll/frame cells.
function stampDeathTile(m, phase) {
  const { mem8, mem16 } = m;
  if (mem8[SECOND_BANK] !== 0) {
    if (phase === 1) {
      mem8[FROG_SPRITE_CODE] = 0x22;
      mem16[DEATH_WORD] = 0;
      enqueueSoundCommand(m, 0);
      enqueueSoundCommand(m, 0x02);
      return;
    }
    if (phase === 2) { mem8[FROG_SPRITE_CODE] = 0x23; return; }
    if (phase === 3) { mem8[FROG_SPRITE_CODE] = 0x24; return; }
    mem8[FROG_SPRITE_CODE] = 0x3c;
    mem8[COUNTDOWN_EXPIRY_FLAG] = 0;
    mem8[SCROLL_STAMP_PHASE] = 0;
    mem8[SCROLL_EDGE_FLAG] = 0;
    mem8[SCROLL_STAMP_ROWCOUNT] = 0;
    mem8[SCROLL_BAND_ROWSPAN] = 0;
    clearTwoPlayerFrameCells(m);
    mem16[DEATH_WORD] = 0x00d8;
    return;
  }
  if (phase === 1) {
    mem8[FROG_SPRITE_CODE] = 0x39;
    mem16[DEATH_WORD] = 0;
    enqueueSoundCommand(m, 0);
    enqueueSoundCommand(m, 0x03);
    return;
  }
  if (phase === 2) { mem8[FROG_SPRITE_CODE] = 0x39; return; }
  if (phase === 3) { mem8[FROG_SPRITE_CODE] = 0x3a; return; }
  if (phase === 4) { mem8[FROG_SPRITE_CODE] = 0x3b; return; }
  mem8[FROG_SPRITE_CODE] = 0x3c;
  mem8[COUNTDOWN_EXPIRY_FLAG] = 0;
  clearTwoPlayerFrameCells(m);
  mem16[DEATH_WORD] = 0x00d8;
}

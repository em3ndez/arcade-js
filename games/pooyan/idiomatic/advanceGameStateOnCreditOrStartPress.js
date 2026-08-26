// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import { u16 } from "../../../core/int.js";
import { loc_0020 } from "./loc_0020.js";
import { beginTwoPlayerStartOfLife } from "./beginTwoPlayerStartOfLife.js";
import { startNewGamePlay } from "./startNewGamePlay.js";
import {
  GAME_ACTIVE_FLAG,
  MAIN_GAME_STATE,
  ATTRACT_SUBSTATE,
  ATTRACT_EPILOGUE_TICK,
  HUD_INTEGRITY_STRIP_B,
  EPILOGUE_HUD_SCAN_REF_TABLE,
  EPILOGUE_SUBSTATE_LOOKUP_TABLE,
  BOARD_CLEAR_FLAG,
  COINAGE_CONFIG,
  CREDIT_COUNT,
  PLAY_STATE_INDEX,
  INPUT_PORT0,
} from "./names.js";
/**
 * advanceGameStateOnCreditOrStartPress — shared attract/board-handler epilogue.
 *
 * When the game is idle at build state 1 in sub-state 3/5/8, it bumps the epilogue tick and runs a
 * HUD integrity check: scan the reference list against the tile strip (stride -0x20), and on a
 * clean scan cross-check a sub-state lookup against the strip; any disagreement arms the
 * board-clear flag. Then the coin/credit gate: unless free play, a waiting credit advances the
 * top-level state; on free play the IN0 start bits route into the 1P/2P screen builders.
 *
 * LIVE-OUT: memory only — a void epilogue; the caller reads nothing back.
 */
const ROW_STRIDE = 0x20; // scan advances hl one tile row backward per match

export function advanceGameStateOnCreditOrStartPress(m) {
  const { mem8 } = m;

  integrity: {
    if (mem8[GAME_ACTIVE_FLAG] !== 0) break integrity; // in play -> skip the check
    if (mem8[MAIN_GAME_STATE] !== 1) break integrity; // not the build state -> skip
    const sub = mem8[ATTRACT_SUBSTATE];
    if (sub !== 3 && sub !== 5 && sub !== 8) break integrity; // wrong sub-state -> skip

    mem8[ATTRACT_EPILOGUE_TICK]++;
    let hl = HUD_INTEGRITY_STRIP_B; // tile strip walked backward
    let ref = EPILOGUE_HUD_SCAN_REF_TABLE; // 0xff-terminated reference list
    let mismatch = false;
    for (;;) {
      if (mem8[ref] !== mem8[hl]) { mismatch = true; break; } // strip diverged from the reference list
      hl = u16(hl - ROW_STRIDE);
      ref = u16(ref + 1);
      if (mem8[ref] === 0xff) break; // reached the list terminator
    }

    if (!mismatch) {
      const cmp = u16(hl - 0x440); // strip cell the lookup is checked against (0x440 back)
      const [fetched] = loc_0020(m, EPILOGUE_SUBSTATE_LOOKUP_TABLE, mem8[ATTRACT_SUBSTATE]);
      if (fetched === mem8[cmp]) break integrity; // lookup agrees -> no tamper
    }
    mem8[BOARD_CLEAR_FLAG] = 0x01; // scan or lookup disagreed -> arm board clear
  }

  // coin/credit gate
  if (mem8[COINAGE_CONFIG] !== 0x0f) { // not free play
    if (mem8[CREDIT_COUNT] === 0) return; // no waiting credit
    mem8[MAIN_GAME_STATE]++;
    mem8[PLAY_STATE_INDEX] = 0x00;
    return;
  }

  const in0 = mem8[INPUT_PORT0];
  if ((in0 & 0x08) === 0) { // 1P start not held
    if ((in0 & 0x10) === 0) return; // 2P start not held either
    queueSoundCommand00(m); // credit/coin bookkeeping (unlifted)
    return beginTwoPlayerStartOfLife(m); // 2P screen builder
  }
  queueSoundCommand00(m); // credit/coin bookkeeping (unlifted)
  return startNewGamePlay(m, 0); // 1P screen builder (player-bank word 0)
}

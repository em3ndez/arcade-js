// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import { u16 } from "../../../core/int.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
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
 * advanceGameStateOnCreditOrStartPress — the shared attract/idle epilogue (ROM 0x0bb5).
 *
 * WHAT IT IS
 *   While the machine is not in a live game it cycles through a set of attract/demo sub-states
 *   (the attract sequence and the board-build screens). Each of those sub-state handlers runs its
 *   own slice of work and then hands control here: this routine is the common tail every one of
 *   them finishes in. It does two unrelated jobs, in order:
 *     1. During the board-build screen it runs a HUD tamper tripwire, and
 *     2. it services the coin/credit gate that decides whether to leave attract and start a game.
 *
 * ROLE IN THE MACHINE
 *   This is the point where a coin sitting in CREDIT_COUNT, or a start button held on a free-play
 *   cabinet, actually turns into a game. It is the single spot on the attract/idle path where the
 *   top-level state advances off attract, so nothing starts a game without passing through here.
 *
 * ROM ADDRESS: 0x0bb5
 * Grounding: [seen]
 *
 * LIVE-OUT (memory only — nothing is returned to the caller):
 *   - ATTRACT_EPILOGUE_TICK (0x8efe) bumped once per pass through the HUD check.
 *   - BOARD_CLEAR_FLAG (0x89e5) armed to 1 if the HUD tamper check fails.
 *   - On a paid credit: MAIN_GAME_STATE (0x8805) advanced and PLAY_STATE_INDEX (0x880a) cleared,
 *     which is what pulls the machine off attract.
 *   - On a free-play start press: a sound command queued and the start-of-life setup entered,
 *     which seeds all the fresh-game state itself.
 */
const ROW_STRIDE = 0x20; // one tilemap row; the strip scan walks the VRAM column backward a row per match

export function advanceGameStateOnCreditOrStartPress(m) {
  const { mem8 } = m;

  // === HUD tamper tripwire ===
  // Only meaningful during the board-build screen. The three guards below fall straight out of the
  // block (leaving the coin/credit gate to run) whenever we are not there, so the check costs
  // nothing on the ordinary attract frames.
  integrity: {
    if (mem8[GAME_ACTIVE_FLAG] !== 0) break integrity; // GAME_ACTIVE_FLAG (0x8806) set -> a game is live, no attract HUD to check
    if (mem8[MAIN_GAME_STATE] !== 1) break integrity; // MAIN_GAME_STATE (0x8805) must be the board-build state (1)
    const sub = mem8[ATTRACT_SUBSTATE];
    if (sub !== 3 && sub !== 5 && sub !== 8) break integrity; // ATTRACT_SUBSTATE (0x8e51) only checks on the three built-screen sub-states

    // The board-build HUD is fully drawn on sub-states 3/5/8, so its tiles can now be verified.
    mem8[ATTRACT_EPILOGUE_TICK]++; // ATTRACT_EPILOGUE_TICK (0x8efe): heartbeat bumped every time the check runs

    // Pass 1: walk a column of the on-screen HUD tile strip against a fixed ROM reference list.
    // The strip is read one tilemap row at a time moving up the screen (hl -= 0x20), while the
    // reference list is read forward; the list ends at a 0xff terminator. A single tile that does
    // not match its reference byte means the displayed HUD has been corrupted.
    let hl = HUD_INTEGRITY_STRIP_B; // HUD_INTEGRITY_STRIP_B (0x86bc): base of the VRAM tile strip being verified
    let ref = EPILOGUE_HUD_SCAN_REF_TABLE; // EPILOGUE_HUD_SCAN_REF_TABLE (0x20c2): 0xff-terminated ROM reference bytes
    let mismatch = false;
    for (;;) {
      if (mem8[ref] !== mem8[hl]) { mismatch = true; break; } // this HUD cell diverged from its reference -> tamper
      hl = u16(hl - ROW_STRIDE); // step up one tilemap row in the strip
      ref = u16(ref + 1); // advance to the next reference byte
      if (mem8[ref] === 0xff) break; // reached the list terminator -> whole strip matched
    }

    // Pass 2 (only if the strip scanned clean): a second, cross-check. Index the sub-state lookup
    // table by the current ATTRACT_SUBSTATE and compare that expected byte against a strip cell a
    // fixed 0x440 further back. If it agrees the HUD is trusted and we leave the check untouched.
    if (!mismatch) {
      const cmp = u16(hl - 0x440); // the strip cell the expected byte is checked against
      const [fetched] = fetchByteFromTableIndex(m, EPILOGUE_SUBSTATE_LOOKUP_TABLE, mem8[ATTRACT_SUBSTATE]); // EPILOGUE_SUBSTATE_LOOKUP_TABLE (0x20cb) indexed by the sub-state
      if (fetched === mem8[cmp]) break integrity; // lookup agrees -> HUD intact, nothing to arm
    }
    // Either the strip scan or the lookup cross-check disagreed: treat the screen as tampered and
    // arm the board-clear diversion, which freezes per-frame object updates and reroutes handlers
    // into the board-clear / level-intro path.
    mem8[BOARD_CLEAR_FLAG] = 0x01; // BOARD_CLEAR_FLAG (0x89e5): arm the divert
  }

  // === coin/credit gate ===
  // Coinage is configured at boot; the sentinel 0x0f means the cabinet is set to free play.
  if (mem8[COINAGE_CONFIG] !== 0x0f) { // COINAGE_CONFIG (0x882c) != 0x0f -> a paying cabinet
    // Paying cabinet: a game starts only when a coin has been banked as a credit.
    if (mem8[CREDIT_COUNT] === 0) return; // CREDIT_COUNT (0x8802) empty -> stay in attract
    mem8[MAIN_GAME_STATE]++; // advance MAIN_GAME_STATE (0x8805) off attract toward the game
    mem8[PLAY_STATE_INDEX] = 0x00; // reset PLAY_STATE_INDEX (0x880a) so the next state starts at its first sub-step
    return;
  }

  // Free-play cabinet: there are no credits to spend, so watch the start buttons directly.
  const in0 = mem8[INPUT_PORT0]; // INPUT_PORT0 (0x8810): inverted IN0 sample; bit3 = 1P start, bit4 = 2P start
  if ((in0 & 0x08) === 0) { // 1P start (bit 3) not held
    if ((in0 & 0x10) === 0) return; // 2P start (bit 4) not held either -> nothing pressed, stay in attract
    queueSoundCommand00(m); // enqueue the game-start sound (sound command 0x00) into the sound ring
    return beginTwoPlayerStartOfLife(m); // enter two-player start-of-life setup
  }
  queueSoundCommand00(m); // 1P start held: enqueue the game-start sound (sound command 0x00)
  return startNewGamePlay(m, 0); // enter single-player start-of-life setup (player-bank selector 0)
}

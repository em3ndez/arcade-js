// SPDX-License-Identifier: GPL-3.0-only
import { ATTRACT_SUBSTATE } from "./names.js";
import { resetToAttractScreenStart } from "./resetToAttractScreenStart.js";
import { blankRowThenFloodColorsAndAdvanceAttract } from "./blankRowThenFloodColorsAndAdvanceAttract.js";
import { paintAttractColorsAndQueueDraws } from "./paintAttractColorsAndQueueDraws.js";
import { tickAttractDelayThenReseedAndAdvance } from "./tickAttractDelayThenReseedAndAdvance.js";
import { buildAttractSpritesAndPrimeTextScript } from "./buildAttractSpritesAndPrimeTextScript.js";
import { typeAttractTextColumn } from "./typeAttractTextColumn.js";
import { advanceAttractSequenceToPlay } from "./advanceAttractSequenceToPlay.js";
import { dispatchSelfTestState } from "./dispatchSelfTestState.js";
import { runObjectAndEnemyActorUpdate } from "./runObjectAndEnemyActorUpdate.js";
import { advanceGameStateOnCreditOrStartPress } from "./advanceGameStateOnCreditOrStartPress.js";

/**
 * dispatchAttractSubstate — the attract / demo-sequence driver.
 *
 * WHAT IT IS
 *   The whole "coin-drop screen": everything the machine shows while nobody is playing — the
 *   colour-flood boot animation, the scrolling title/instruction text that types itself in a
 *   column at a time, the high-score list, and the self-running demo game. All of it is one
 *   small state machine, and this routine is that machine's per-frame driver.
 *
 * ROLE IN THE MACHINE
 *   The cabinet has a two-level state hierarchy. The master selector MAIN_GAME_STATE (0x8805)
 *   picks the top-level mode: state 0 the attract/boot entry, state 1 (this) the attract
 *   sub-state machine, state 2 the board-build sequence, state 3 the live play frame. When the
 *   game is idle MAIN_GAME_STATE holds 1, so every frame the per-frame beat calls this routine.
 *   It is thus the second dispatch level: MAIN_GAME_STATE selects "attract", and this selects
 *   WHICH phase of the attract loop is currently running.
 *
 * HOW IT WORKS
 *   It reads the attract sub-state selector ATTRACT_SUBSTATE (0x8e51) — a value 0..8 — and
 *   vectors through the nine-entry ROM jump table at 0x08a1 to the one phase handler that
 *   matches. Each handler is a void per-frame step that advances its own phase and, when it is
 *   finished, bumps or reseats ATTRACT_SUBSTATE so a later frame lands on the next handler; that
 *   is how the attract loop walks itself around 0 -> 1 -> ... and cycles. After the handler
 *   returns, the shared epilogue (ROM 0x0bb5) always runs: it is the piece that watches for a
 *   coin / start press and, when one arrives, moves the whole machine out of attract into a game.
 *
 * ROM address 0x0899.  Grounding: [seen].
 * LIVE-OUT: none. The routine returns nothing; each handler mutates its own slice of game RAM
 *   (the tilemap fill, the colour/attribute map, the sprite display list, the text-script cursor,
 *   the demo actors) and the epilogue may advance MAIN_GAME_STATE (0x8805) / PLAY_STATE_INDEX
 *   (0x880a) to leave attract.
 */
export function dispatchAttractSubstate(m) {
  // Read the attract sub-state selector ATTRACT_SUBSTATE (0x8e51) and run the matching phase.
  // This mirrors the ROM jump table at 0x08a1 (states 0..8); each handler is one frame of one
  // attract phase and reseats the selector when it wants the loop to move to the next phase.
  switch (m.mem8[ATTRACT_SUBSTATE]) {
    // Phase 0 — reset to the attract screen's starting point: clears down state so the boot /
    // colour-flood build can begin again at the top of the attract cycle.
    case 0: resetToAttractScreenStart(m); break;
    // Phase 1 — blank one tick of the row-by-row tilemap fill; once the fill drains it runs two
    // ROM-table integrity guards around a colour/attribute-map flood, enqueues two display
    // commands, then jumps the selector straight to phase 7 (the self-test dispatcher).
    case 1: blankRowThenFloodColorsAndAdvanceAttract(m); break;
    // Phase 2 — paint the attract colours and queue the draw commands that lay down the screen.
    case 2: paintAttractColorsAndQueueDraws(m); break;
    // Phase 3 — a per-frame countdown gate: while it ticks nothing happens; on expiry it resets
    // the board-init RAM, re-arms the tile fill, advances the sub-state, and seeds the attract
    // text-script cursor word so phase 4/5 have somewhere to read from.
    case 3: tickAttractDelayThenReseedAndAdvance(m); break;
    // Phase 4 — build the demo sprites and prime the text script (loads the pointers phase 5
    // will walk to type the title/instruction text).
    case 4: buildAttractSpritesAndPrimeTextScript(m); break;
    // Phase 5 — type one column of attract text per pass, marching the script cursor across the
    // screen a column at a time until the message is fully drawn.
    case 5: typeAttractTextColumn(m); break;
    // Phase 6 — advance the attract sequence toward play: walks the attract cursor word through
    // its script and hands off toward the demo / play path when the script is exhausted.
    case 6: advanceAttractSequenceToPlay(m); break;
    // Phase 7 — the attract/self-test dispatcher: sub-dispatches on (0x8921)&3 via table 0x7448
    // (0 = init / ROM-check, 1 = HUD-checksum, 2 = the demo gameplay driver).
    case 7: dispatchSelfTestState(m); break;
    // Phase 8 — run the self-playing demo: a per-frame driver that steps the object and enemy
    // actor subsystems in order, so the attract screen actually plays the game to the viewer.
    case 8: runObjectAndEnemyActorUpdate(m); break;
  }
  // Shared attract epilogue (ROM 0x0bb5), run every frame after the phase handler. It reads the
  // coinage descriptor: when not free play, a waiting credit (CREDIT_COUNT) advances the master
  // state MAIN_GAME_STATE (0x8805) and resets PLAY_STATE_INDEX (0x880a), moving the machine off
  // attract into a game; under free play it instead watches the IN0 start bits directly and routes
  // a 1-player (bit 3) or 2-player (bit 4) start into the game builders.
  return advanceGameStateOnCreditOrStartPress(m);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginNextLifeOrIntro  —  ROM 0x0457  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The "continue / next-life" path — the code the machine runs at the start of a life once the board is
 *   already standing. It is the branch that decides, each time it is reached, between three outcomes:
 *   simply resuming play, tearing the old life down and rebuilding the next one, or dropping into the
 *   intro / game-over countdown. In Frogger terms: this is what happens in the beat after a frog has died
 *   (or a fresh game has just been armed) and before the next frog hops onto the road.
 *
 * WHERE IT SITS
 *   Reached from the per-frame board dispatcher setUpBoardOrContinueLife (0x040b): that routine reads the
 *   board-layout gate BOARD_LAYOUT_GATE (0x83ea) and, when the gate is SET (the board is already laid),
 *   tail-hands here instead of laying out a fresh board. So by the time we run, the playfield already
 *   exists — our job is only the per-life bookkeeping on top of it. Like the other top-level lifecycle
 *   dispatchers, every exit tail-returns into the foreground main loop at its pace-tail re-entry
 *   (endForegroundPassAtPaceTail, 0x0368), directly or via a sub-path that ends there.
 *
 * LIVE-OUT
 *   Memory only. It redraws the score header, writes a handful of per-life state cells and the 14-byte HUD
 *   block, and queues one sound command. It returns whatever its tail-called continuation returns (all of
 *   which are themselves memory-only), and leaves no register the caller reads.
 */
import { SCORE_DISPLAY_CURSOR_LO, SCORE_DISPLAY_CURSOR_HI, loc_83cc, BOARD_LAYOUT_GATE, loc_83cf, LIFE_RESTART_FLAG, PER_LIFE_HUD_BASE } from "./names.js";
import { endForegroundPassAtPaceTail } from "./endForegroundPassAtPaceTail.js";
import { renderScoreHeader } from "./renderScoreHeader.js";
import { activateFrogObject } from "./activateFrogObject.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { handOffToOtherPlayer } from "./handOffToOtherPlayer.js";
import { runIntroTimerThenInitGame } from "./runIntroTimerThenInitGame.js";

// The sound-command byte the ROM queues as the per-life restart jingle — the short tune that plays as a
// new frog is placed. It is handed to enqueueSoundCommand, which posts it to the audio latch.
const RESTART_SOUND = 0x80;

// Size of the per-life HUD block that gets wiped, in bytes: PER_LIFE_HUD_BASE (0x83a0) up to but not
// including 0x83ae. In the ROM this is a fixed-length block clear; naming the length keeps the loop honest.
const PER_LIFE_HUD_BYTES = 14;

export function beginNextLifeOrIntro(m) {
  const { mem8 } = m;

  // ── Always: repaint the score header ─────────────────────────────────────────────────
  // Runs on every entry, whichever branch we take below — the header (score digits + labels) is cheap to
  // re-stamp and must stay correct across a death or a player swap.
  renderScoreHeader(m);

  // ── Gate: is a life-restart actually pending? ────────────────────────────────────────
  // LIFE_RESTART_FLAG (0x83ce) is the life-restart gate. It is cleared every frame by
  // renderFrogSceneAndTickTimer (0x0942) during ordinary play, and raised ONLY by driveFrogDeathAnimation's
  // reset arm when a death animation reaches its terminal phase and re-activates the frog. So the gate
  // being CLEAR (0) means nothing has to be rebuilt this frame: short-circuit and just resume the play loop
  // at the pace tail. (mechanisms.md glosses this clear-gate case as "no life remains → resume play".) When
  // the gate is SET, a fresh life needs standing up, and we fall through to the full setup below.
  if (mem8[LIFE_RESTART_FLAG] === 0) return endForegroundPassAtPaceTail(m);

  // ── Rebuild the next life ────────────────────────────────────────────────────────────
  // Put a live frog object back on the board (position, sprite, state) for the incoming life.
  activateFrogObject(m);

  // Wipe the active player's work-RAM scratch so no state leaks in from the life that just ended.
  clearActivePlayerWorkRam(m);

  // Zero the score-display cursor pair SCORE_DISPLAY_CURSOR_LO/HI (0x839a/0x839b) — the 16-bit write
  // position the score renderer walks. Resetting it re-homes the cursor for the new life's score draw.
  mem8[SCORE_DISPLAY_CURSOR_LO] = 0;
  mem8[SCORE_DISPLAY_CURSOR_HI] = 0;

  // Clear loc_83cc (0x83cc), the score-field marker byte (the same cell clearAndSeedScoreField sets to 1
  // and awardExtraLife clears on an extra-life award); zeroing it here resets that per-life marker state.
  mem8[loc_83cc] = 0;

  // Clear the board-layout gate BOARD_LAYOUT_GATE (0x83ea) back to 0. Since the dispatcher upstream treats
  // a SET gate as "board already laid, come straight here", clearing it now REQUESTS a fresh board layout
  // on the next frame rather than another trip through this path.
  mem8[BOARD_LAYOUT_GATE] = 0;

  // Zero the 14-byte per-life HUD block starting at PER_LIFE_HUD_BASE (0x83a0) — the per-life HUD scratch
  // that must start blank for the new life.
  for (let i = 0; i < PER_LIFE_HUD_BYTES; i++) mem8[PER_LIFE_HUD_BASE + i] = 0;

  // Queue the restart jingle (0x80) that accompanies placing the new frog.
  enqueueSoundCommand(m, RESTART_SOUND);

  // ── Final branch: intro/game-over countdown, or hand off and resume ──────────────────
  // loc_83cf (0x83cf) is the timer-expiry / intro gate: renderFrogSceneAndTickTimer sets it when the play
  // timer runs out, and addScoreAndAwardExtraLife clears it on a bonus award. When it is non-zero here, the
  // life ended on a timeout / this is the intro beat, so run the intro (or game-over) countdown, which owns
  // its own resume.
  if (mem8[loc_83cf] !== 0) return runIntroTimerThenInitGame(m);

  // Otherwise this was an ordinary next-life within the same turn: pass the turn to the other player
  // (a no-op in a one-player game) and resume the play loop at the pace tail.
  handOffToOtherPlayer(m);
  return endForegroundPassAtPaceTail(m);
}

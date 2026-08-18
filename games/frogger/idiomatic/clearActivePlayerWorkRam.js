// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearActivePlayerWorkRam  —  ROM 0x07e6  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The guarded front door of the "wipe the active player's work RAM" primitive. It decides whether the
 *   current frog/home-bay state should be blanked before the machine reseeds a player, and — when it
 *   should — hands off to the unconditional clear. On a one-player game it does nothing; on a two-player
 *   game or in attract it wipes the 32-byte frog object block (FROG_X 0x8044 .. 0x8063) and the 12-byte
 *   home-bay gate block (HOME_BAY_GATE_BLOCK 0x8420 .. 0x842b).
 *
 * WHERE IT SITS
 *   This is the guarded half of a two-part primitive that is one contiguous piece of code in the frozen
 *   ROM: 0x07e6 guards, and its sibling forceClearPlayerWorkRam (ROM 0x07eb) clears. The `return` handoff
 *   below reproduces that fall-through: when the guard passes, control drops straight into the clear.
 *   It is reached on every occasion the machine reseeds a player and wants a blank slate underneath the
 *   frog-reseed code — cold start (new game), the once-per-board in-play layout (initInPlayBoardOnce runs
 *   it first), next-life (beginNextLifeOrIntro), the new-board score-field reset (clearAndSeedScoreField),
 *   and the fifth/last home-bay arrival (stampHomeGoalAndResetFrog).
 *
 * LIVE-OUT
 *   Memory only, and only via the tail — this routine writes nothing itself. It returns nothing and
 *   leaves no register the caller reads.
 */
import { PLAY_FLAG } from "./names.js";
import { forceClearPlayerWorkRam } from "./forceClearPlayerWorkRam.js";

export function clearActivePlayerWorkRam(m) {
  const { mem8 } = m;

  // ── Guard: one-player game keeps its state ───────────────────────────────────────────
  // PLAY_FLAG (0x83fe) doubles as the in-play flag AND the player count: 0 = attract, 1 or 2 = a game with
  // that many players. Exactly one player (== 1) means the wipe is skipped and the frog/gate block is left
  // intact — a single player carries its frog and home-bay progress straight across this reset. A
  // two-player game (== 2) instead banks each player's work RAM in and out per turn, so it MUST wipe
  // before it swaps; attract (== 0) has no live player state to preserve. Both of those fall through.
  if (mem8[PLAY_FLAG] === 1) return;

  // ── Fall into the unconditional clear ────────────────────────────────────────────────
  // Not a one-player game, so hand off to forceClearPlayerWorkRam (ROM 0x07eb) — the unguarded tail that
  // zeroes the 32-byte frog object block (FROG_X 0x8044 .. 0x8063) and the 12-byte home-bay gate block
  // (HOME_BAY_GATE_BLOCK 0x8420 .. 0x842b). In the frozen ROM the guard above simply falls into that code;
  // here it is an explicit tail-call. The `return` propagates the clear's (empty) result, mirroring the
  // shared `ret` the two halves reach in the ROM, so there is no observable difference to the caller.
  return forceClearPlayerWorkRam(m);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * handOffToOtherPlayer  —  ROM 0x0822  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The turn hand-off in Frogger's two-player lifecycle. When one player's turn ends, this routine
 *   swaps the "active player" from 1 to 2 (or 2 to 1), pulls the incoming player's saved life count to
 *   the front, and — on a cocktail cabinet, where the two players sit across a shared table-top screen —
 *   physically flips the display so the player now up sees the board right-side-up.
 *
 * WHERE IT SITS
 *   Called from the next-life / continue / intro-transition paths of the board dispatcher (e.g.
 *   beginNextLifeOrIntro and the intro-timer game-over entry): the points at which one player's turn is
 *   over and the machine needs to bring the OTHER player forward. It is a no-op in a one-player game —
 *   the second gate below returns before touching the player state — so the whole player-swap only runs
 *   when two players are sharing the cabinet.
 *
 * LIVE-OUT
 *   Memory only. It writes work-RAM player bookkeeping and, on a cocktail cabinet, the two flip IO
 *   latches. It returns nothing and leaves no register the caller reads.
 */
import {
  PER_TURN_SCRATCH, PLAY_FLAG, ACTIVE_PLAYER, PLAYER1_LIVES, PLAYER2_LIVES, LIVES_COUNT,
  PER_PLAYER_RESET_CELL, PLAYER_START_DEMO_FLAG, COCKTAIL_ENABLED_FLAG, SCREEN_FLIP_LATCH, FLIP_X_LATCH, FLIP_Y_LATCH,
} from "./names.js";

// ACTIVE_PLAYER (0x83fd) holds the player number 1 or 2. XOR-ing with 0b11 swaps the two: 1 (0b01) -> 2
// (0b10) and 2 (0b10) -> 1 (0b01). That is exactly the ROM's `xor 3` at 0x082e, and it is what makes the
// hand-off a toggle rather than a set-to-a-fixed-value.
const PLAYER_TOGGLE_MASK = 0x03;

// SCREEN_FLIP_LATCH (0x83cb) uses only bit 0 as the flip state. XOR-ing with 0b1 toggles that bit,
// matching the ROM's `xor 1` at 0x0850 — each hand-off inverts the current flip rather than forcing it.
const FLIP_BIT = 0x01;

export function handOffToOtherPlayer(m) {
  const { mem8 } = m;

  // ── Clear the per-turn scratch cell ──────────────────────────────────────────────────
  // PER_TURN_SCRATCH (0x8371) is wiped at the very top of every hand-off, unconditionally — before the
  // one-player early-out below — so it is reset even on a one-player game where nothing else changes.
  mem8[PER_TURN_SCRATCH] = 0;

  // ── Gate: one-player game does not swap ──────────────────────────────────────────────
  // PLAY_FLAG (0x83fe) holds the player count for the live game: 1 for a one-player game, 2 for two.
  // With a single player there is no "other player" to hand to, so the routine returns here and the
  // player state below is left completely untouched. (In the ROM this is `ld a,(0x83fe); dec a; ret z` —
  // zero after decrement means the flag was 1.)
  if (mem8[PLAY_FLAG] === 1) return;

  // ── Swap the active player ───────────────────────────────────────────────────────────
  // Toggle ACTIVE_PLAYER (0x83fd) between 1 and 2. `incomingPlayer` is the player now taking control.
  const incomingPlayer = mem8[ACTIVE_PLAYER] ^ PLAYER_TOGGLE_MASK;
  mem8[ACTIVE_PLAYER] = incomingPlayer;

  // ── Bring the incoming player's lives to the front ───────────────────────────────────
  // The two players keep independent life counters — PLAYER1_LIVES (0x83b8) and PLAYER2_LIVES (0x83b9).
  // LIVES_COUNT (0x83b7) is the single "live" count the rest of the game reads (the lives row, the
  // object-population level gate, the extra-life award all key off it), so on a swap the incoming
  // player's saved count is copied into it. (ROM: hl = 0x83b8, and for player 2 inc l -> 0x83b9.)
  mem8[LIVES_COUNT] = mem8[incomingPlayer === 1 ? PLAYER1_LIVES : PLAYER2_LIVES];

  // ── Re-arm the incoming player's start state ─────────────────────────────────────────
  // PER_PLAYER_RESET_CELL (0x83b6) is cleared and PLAYER_START_DEMO_FLAG (0x825a) is raised to 1 — the
  // same start/demo flag loc_05d3 sets on a board reveal. Together they tell the board dispatcher that
  // this player is (re)entering play, so it lays out a fresh start rather than resuming mid-frame.
  mem8[PER_PLAYER_RESET_CELL] = 0;
  mem8[PLAYER_START_DEMO_FLAG] = 1;

  // ── Gate: only cocktail cabinets flip the screen ─────────────────────────────────────
  // COCKTAIL_ENABLED_FLAG (0x83c2) is set only on a cocktail (table-top) cabinet, where the two players
  // face each other across the screen. On an upright cabinet the flag is 0 and the hand-off ends here —
  // there is nothing to physically flip. (ROM: `ld a,(0x83c2); or a; ret z`.)
  if (mem8[COCKTAIL_ENABLED_FLAG] === 0) return;

  // ── Flip the display for the player now up ───────────────────────────────────────────
  // Toggle bit 0 of the work-RAM flip shadow SCREEN_FLIP_LATCH (0x83cb), then mirror that new value out
  // to the two hardware flip latches FLIP_X_LATCH (0xb810) and FLIP_Y_LATCH (0xb80c). Writing both the
  // X and Y flip inverts the whole raster, turning the board 180° so the incoming player — seated on the
  // opposite side of the cocktail table — sees it right-side-up.
  const flip = mem8[SCREEN_FLIP_LATCH] ^ FLIP_BIT;
  mem8[SCREEN_FLIP_LATCH] = flip;
  mem8[FLIP_X_LATCH] = flip;
  mem8[FLIP_Y_LATCH] = flip;
}

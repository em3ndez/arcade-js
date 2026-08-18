// SPDX-License-Identifier: GPL-3.0-only
/**
 * runIntroTimerThenInitGame  —  ROM 0x048f  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The intro / game-over entry. When one game ends and the next is about to begin (or the attract
 *   intro plays), this routine repaints the GAME-OVER banner, plays the two-note jingle, holds the
 *   screen for a fixed beat, and then hands off to the correct new-game / continue setup for the
 *   machine's current configuration (one player, a player-2 turn, or a fresh player-1 board).
 *
 * WHERE IT SITS
 *   Reached from the continue / next-life path (beginNextLifeOrIntro, ROM 0x0457) once a life is
 *   spent and the intro sequence is due. It is a dispatcher: after the banner + jingle + delay it
 *   never returns to its caller — every branch tail-calls into another setup routine, and each of
 *   those ends by tail-returning to the foreground main loop's pace-tail re-entry
 *   (endForegroundPassAtPaceTail, ROM 0x0368).
 *
 * LIVE-OUT
 *   Memory only. It writes RAM flags, occupancy gates, and the two banked player pages, and repaints
 *   VRAM. It returns whatever coroutine handoff its tail-callee returns (the pace tail); it leaves no
 *   register the caller reads.
 */
import {
  PLAY_FLAG, ACTIVE_PLAYER, PLAYER1_SLOT, HOME_BAY1_OCCUPANCY_PRIMARY,
  OTHER_PLAYER_WORK_PAGE, OTHER_PLAYER_OBJECT_PAGE, LANE_OBJECT_INDEX, LIVE_OBJECT_PAGE,
  OBJRAM_COL3F_ATTR_SHADOW,
  INTRO_TIMER, CONTINUE_FLAG, CONTINUE_FLAG_2P,
} from "./names.js";
import { endForegroundPassAtPaceTail } from "./endForegroundPassAtPaceTail.js";
import { blitGameOverLine } from "./blitGameOverLine.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { handOffToOtherPlayer } from "./handOffToOtherPlayer.js";
import { clearPlayerOneHomeBayGates } from "./clearPlayerOneHomeBayGates.js";
import { coldStartClearSlotGates } from "./coldStartClearSlotGates.js";
import { setUpPlayerTwoContinue } from "./setUpPlayerTwoContinue.js";
import { u16 } from "../../../core/int.js";

// Each player owns two live RAM pages that persist across a turn. The work page is 0xb7 (183) bytes
// long, led by LANE_OBJECT_INDEX (0x80ff); the object page is 0x2b (43) bytes long, led by
// LIVE_OBJECT_PAGE (0x800c). On the fresh player-1 seed below these are the LDIR copy lengths that
// restore player 1's parked state from its save banks (matching ROM `ld bc,0x00b7` / `ld bc,0x002b`).
const WORK_PAGE_LEN = 0xb7;
const OBJECT_PAGE_LEN = 0x2b;

// The five home-bay occupancy gates sit contiguously from HOME_BAY1_OCCUPANCY_PRIMARY (0x825e), one
// per bay (0x825e..0x8262). Clearing all five re-opens every bay for the new board. In the ROM this
// is a `ld (hl),0` seed + `ld bc,0x0004` LDIR fan-out — one written byte plus four copied = 5 total.
const HOME_BAY_GATE_COUNT = 5;

export function runIntroTimerThenInitGame(m) {
  const { mem8, mem16 } = m;

  // ── Repaint the GAME-OVER banner ──────────────────────────────────────────────────────
  // blitGameOverLine (ROM 0x0f59) clears the status-row tile column and blits the fixed 9-tile
  // "GAME OVER" string up its VRAM column. This is the first thing the intro/game-over screen shows.
  blitGameOverLine(m);

  // ── Play the two-note game-over jingle ────────────────────────────────────────────────
  // Queue sound commands 0x0c then 0x0d onto the sound ring (enqueueSoundCommand, ROM 0x0018 / the Z80
  // `rst 0x18` sound primitive). Note enqueueSoundCommand itself drops the command when no game is in
  // play (PLAY_FLAG 0x83fe == 0), so on the pure attract intro these two are silently discarded.
  enqueueSoundCommand(m, 0x0c);
  enqueueSoundCommand(m, 0x0d);

  // ── Hold the screen: spin the 16-bit intro timer down to zero ─────────────────────────
  // INTRO_TIMER (0x83c5, 16-bit little-endian) is a busy-wait countdown that paces the intro/game-over
  // pause. Each pass decrements it and writes it back, so when the loop ends the cell reads 0. It is a
  // do-while (decrement-first, matching the ROM's `dec hl` before the zero test at 0x049b): if the
  // timer is seeded 0 it first wraps to 0xffff and drains a full 65536 steps, giving the maximum hold.
  let timer = mem16[INTRO_TIMER];
  do {
    timer = u16(timer - 1);
    mem16[INTRO_TIMER] = timer;
  } while (timer !== 0);

  // ── Dispatch 1: one-player game → full cold start ─────────────────────────────────────
  // PLAY_FLAG (0x83fe) doubles as the player count: exactly 1 means a one-player game, which re-enters
  // the entire cold-start init chain (coldStartClearSlotGates, ROM 0x0547) to build a brand-new board.
  if (mem8[PLAY_FLAG] === 1) return coldStartClearSlotGates(m);

  // ── Dispatch 2: a player-2 turn → the symmetric player-2 continue setup ───────────────
  // ACTIVE_PLAYER (0x83fd) is 1 or 2. Anything other than player 1 means it is player 2's turn, so
  // hand to the mirror-image player-2 continue path (setUpPlayerTwoContinue, ROM 0x04f3), which seeds
  // PLAYER2_SLOT and the alternate-bank gates instead of the primary ones handled below.
  if (mem8[ACTIVE_PLAYER] !== 1) return setUpPlayerTwoContinue(m);

  // ── Player-1 path: raise the continue flag; branch on player 2's board ────────────────
  // We are player 1 in a two-player game. Set CONTINUE_FLAG (0x83c9) = 1 to record that player 1 has
  // entered its continue path (setUpPlayerTwoContinue reads this to choose its own branch). If player
  // 2's board is already seeded — CONTINUE_FLAG_2P (0x83ca) non-zero — player 1's board only needs a
  // light re-init, so pre-clear just its home-bay gates (clearPlayerOneHomeBayGates, ROM 0x0534).
  mem8[CONTINUE_FLAG] = 1;
  if (mem8[CONTINUE_FLAG_2P] !== 0) return clearPlayerOneHomeBayGates(m);

  // ── Fresh player-1 seed: build player 1's board from its parked pages ─────────────────
  // Player 2 is not yet seeded, so player 1 needs a full fresh board. Wipe the tilemap
  // (clearTilemapToTile16, the ROM `rst 0x38` restart vector), then hand play to the other player
  // (handOffToOtherPlayer, ROM 0x0822 — toggles ACTIVE_PLAYER and loads that player's lives).
  clearTilemapToTile16(m);
  handOffToOtherPlayer(m);

  // Raise the play/slot flags: PLAY_FLAG (0x83fe) = 1 marks a live one-player-count board, and
  // PLAYER1_SLOT (0x825c) = 1 sets player 1's home tally to its starting slot value.
  mem8[PLAY_FLAG] = 1;
  mem8[PLAYER1_SLOT] = 1;

  // Re-open all five primary-bank home bays for the new board (HOME_BAY1_OCCUPANCY_PRIMARY 0x825e..).
  for (let i = 0; i < HOME_BAY_GATE_COUNT; i++) mem8[HOME_BAY1_OCCUPANCY_PRIMARY + i] = 0;

  // Restore player 1's parked board state into the live pages: copy the 0xb7-byte work page from its
  // save area OTHER_PLAYER_WORK_PAGE (0x8600) into the live work page at LANE_OBJECT_INDEX (0x80ff),
  // then the 0x2b-byte object page from OTHER_PLAYER_OBJECT_PAGE (0x85c0) into the live object page at
  // LIVE_OBJECT_PAGE (0x800c). These two LDIR copies rehydrate the lanes and sprite objects.
  for (let i = 0; i < WORK_PAGE_LEN; i++) mem8[LANE_OBJECT_INDEX + i] = mem8[OTHER_PLAYER_WORK_PAGE + i];
  for (let i = 0; i < OBJECT_PAGE_LEN; i++) mem8[LIVE_OBJECT_PAGE + i] = mem8[OTHER_PLAYER_OBJECT_PAGE + i];

  // Set the OBJRAM per-column attribute shadow (OBJRAM_COL3F_ATTR_SHADOW 0x803f) = 1. This work-RAM
  // byte is DMA'd to OBJRAM column 0x3f's attribute each frame; the page swap-in leaves it = 1.
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;

  // Resume the foreground main loop at its pace-tail re-entry (endForegroundPassAtPaceTail, ROM 0x0368).
  return endForegroundPassAtPaceTail(m);
}

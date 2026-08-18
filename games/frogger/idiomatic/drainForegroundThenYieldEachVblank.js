// SPDX-License-Identifier: GPL-3.0-only
/**
 * drainForegroundThenYieldEachVblank  —  ROM 0x0341  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   Frogger's foreground main loop, re-expressed as the per-frame vblank coroutine. On the real board this
 *   is the code the CPU spins in whenever it is NOT servicing the vblank interrupt: it renders the score
 *   header and credit line, scans the START buttons, starts games, and — once a game is live — drives one
 *   in-play foreground pass. Crucially it writes only constants and freshly re-derived render state; it
 *   accumulates nothing.
 *
 * WHERE IT SITS
 *   The machine advances one video frame at a time through two code streams that share one work RAM. This
 *   foreground loop free-runs continuously and is the "idle work". The vblank NMI (serviceVblankNmi, 0x0066)
 *   preempts it once per displayed frame and does ALL per-frame accumulation — the sprite copy-out, the coin
 *   scan, every timer tick, and exactly one step of the active sub-engine (attract sequencer / intro pacer /
 *   in-play collision-and-motion cascade). The NMI is therefore the frame clock and sole accumulator; the
 *   foreground is idle work spinning on a busy-delay between the NMI's firings.
 *
 * WHY A GENERATOR, AND WHY TWO PASSES PER YIELD
 *   Because the foreground never increments or decrements a value it keeps (every write is either a constant
 *   or a full re-render), spinning its body many times between two NMIs lands on byte-identical RAM — a
 *   per-frame FIXED POINT (verified full-RAM over 700+ frames). That property lets us collapse the ROM's
 *   unbounded state-free busy-spin into a bounded drain: this generator drops the busy-delay, drains the
 *   body to its fixed point, then `yield`s so the surrounding engine can fire the NMI at the pace tail. Two
 *   passes are run per yield: pass 1 reaches the steady-state fixed point, and pass 2 exists only to settle
 *   the once-per-life restart cascade (a board being re-laid the frame a life restarts) — on every other
 *   frame the second pass re-derives identical RAM and is a no-op. `entry` threads the head/tail re-entry
 *   point across the two passes, mirroring the ROM's two loop-body entry addresses.
 *
 * LIVE-OUT
 *   Memory only. It never returns a value the caller reads; the reachable NMI and leaf tree are entered via
 *   m.call. Its observable effect is the RAM that the render / start-scan / new-game steps write.
 */
import {
  GAME_MODE, PLAY_FLAG, START_LATCH, CREDIT_BCD, IN1_PORT, MAIN_LOOP_HEAD, PACE_TAIL,
  FROG_HOP_VERTICAL_DELTA, FROG_HOP_HORIZONTAL_DELTA, FROG_HOP_DOWN_ANIM_RELOAD,
  FROG_HOP_UP_ANIM_RELOAD, FROG_HOP_RIGHT_ANIM_RELOAD, FROG_HOP_LEFT_ANIM_RELOAD, NUM_PLAYERS,
  ACTIVE_PLAYER, LIVES_COUNT, PLAYER1_LIVES, INPLAY_COUNTDOWN_WORD, FROG_TIMER_A, HOME_COLUMN_STATE,
  loc_842d, PLAYER1_DIFFICULTY_INDEX, HOLD_FLAG, PLAYER_START_DEMO_FLAG, SOUND_SEQUENCE_COUNTDOWN,
  WORK_PAGE_SAVE_BANK, SPRITE_OBJECT_RECORD_A_P1, loc_803d, loc_8071,
} from "./names.js";
import { bcdSubByte } from "../../../core/bcd.js";
import { renderScoreHeader } from "./renderScoreHeader.js";
import { renderCreditLine } from "./renderCreditLine.js";
import { initNewGameScoreAndTimers } from "./initNewGameScoreAndTimers.js";
import { clearSoundQueue } from "./clearSoundQueue.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { dispatchGameModeFrame } from "./dispatchGameModeFrame.js";
import { setUpPlayStartOnce } from "./setUpPlayStartOnce.js";
import { setUpBoardOrContinueLife } from "./setUpBoardOrContinueLife.js";

export function* drainForegroundThenYieldEachVblank(m) {
  // `entry` is the re-entry point for the NEXT pass, mirroring the ROM's two loop-body entry addresses:
  // MAIN_LOOP_HEAD (0x0341) runs the head's full render + start setup, PACE_TAIL (0x0368) skips the head.
  // The in-play tree re-enters at the tail because it already did the head's render work itself. Every
  // yielded frame begins fresh from the head.
  let entry = MAIN_LOOP_HEAD;
  for (;;) {
    // Drain to the per-frame fixed point: pass 1 reaches steady state, pass 2 settles the once-per-life
    // restart cascade (a no-op on all other frames). Then yield so the engine can fire the vblank NMI.
    entry = runOneForegroundPass(m, entry);
    entry = runOneForegroundPass(m, entry);
    yield;
  }
}

/**
 * runOneForegroundPass  —  ROM loop body: head 0x0341 / pace tail 0x0368  ·  [seen]
 *
 * Runs ONE pass of the foreground loop body starting at `entry` and returns the entry the NEXT pass should
 * take (MAIN_LOOP_HEAD or PACE_TAIL). Exported so the go-live byte-exact harness can drive it from a golden
 * anchor, isolating the model from boot. Memory-only in effect; the return value is a re-entry selector,
 * not game state the caller consumes.
 */
export function runOneForegroundPass(m, entry) {
  const { mem8 } = m;

  if (entry === MAIN_LOOP_HEAD) {
    // ── Head work: render + once-per-life start setup (runs only on a head entry) ─────────────────────
    // GAME_MODE (0x83d6) is the top-level mode. >= 2 selects an intro / point-table / score-ranking mode,
    // so advance that mode's per-frame state machine dispatchGameModeFrame (0x0d11) toward attract/play.
    if (mem8[GAME_MODE] >= 0x02) dispatchGameModeFrame(m);
    // Redraw the score row from scratch every pass — a full re-render, never an accumulation.
    renderScoreHeader(m);
    // Draw the credit line except in GAME_MODE (0x83d6) == 1, the one mode that owns that region itself.
    if (mem8[GAME_MODE] !== 1) renderCreditLine(m);
    // Once-per-life play-start setup (idempotent on repeated passes).
    setUpPlayStartOnce(m);
    // Re-seed the six frog-hop step/reload constants to their fixed values on EVERY head pass. Writing a
    // constant is idempotent, which is exactly why these are fixed points rather than accumulators:
    //   FROG_HOP_VERTICAL_DELTA (0x8254) / FROG_HOP_HORIZONTAL_DELTA (0x8255) = 2  (per-frame hop step)
    //   FROG_HOP_{DOWN,UP,RIGHT,LEFT}_ANIM_RELOAD (0x8256..0x8259) = 9            (hop animation length)
    mem8[FROG_HOP_VERTICAL_DELTA] = 0x02; mem8[FROG_HOP_HORIZONTAL_DELTA] = 0x02;
    mem8[FROG_HOP_DOWN_ANIM_RELOAD] = 0x09; mem8[FROG_HOP_UP_ANIM_RELOAD] = 0x09;
    mem8[FROG_HOP_RIGHT_ANIM_RELOAD] = 0x09; mem8[FROG_HOP_LEFT_ANIM_RELOAD] = 0x09;
  }

  // ── Pace tail (0x0368): step the in-play game, else scan the START buttons ────────────────────────
  // The ROM's state-free busy-delay lives here and is dropped: it writes nothing. PLAY_FLAG (0x83fe) is 0
  // in attract and the player count (1/2) once a game is live. If a game is live, run one in-play
  // foreground pass through setUpBoardOrContinueLife (0x040b) and STAY at the tail — next frame the in-play
  // tree re-enters at the tail, so the head's render work is not repeated.
  if (mem8[PLAY_FLAG] !== 0) {
    setUpBoardOrContinueLife(m);
    return PACE_TAIL;
  }

  // Attract path: decide whether to start a game. START_LATCH (0x83b3) is raised the moment a game begins
  // this frame; while it is set, the tail simply returns to the head without re-reading the START buttons.
  if (mem8[START_LATCH] !== 0) return MAIN_LOOP_HEAD;

  // Read the START buttons from IN1_PORT (0xe002). Inputs are active-low, and the ROM rotates the two bits
  // out of A one at a time: bit 7 = START1, bit 6 = START2.
  //   bit7 clear             -> START1 pressed         -> 1-player start
  //   bit7 set, bit6 set     -> neither pressed         -> no start, back to the head
  //   bit7 set, bit6 clear   -> START2 pressed          -> 2-player start
  const in1 = mem8[IN1_PORT];
  let players;
  if ((in1 & 0x80) === 0) {
    players = 0x01;
  } else if ((in1 & 0x40) !== 0) {
    return MAIN_LOOP_HEAD;
  } else {
    players = 0x02;
  }

  // Require enough credits for the requested player count. CREDIT_BCD (0x83e1) is packed BCD, but the raw
  // byte compares monotonically over the small values in play, so a plain `<` matches the ROM's daa compare.
  if (mem8[CREDIT_BCD] < players) return MAIN_LOOP_HEAD;

  // Valid start: seed a fresh game, run its first in-play pass, and settle at the pace tail.
  startNewGame(m, players);
  setUpBoardOrContinueLife(m);
  return PACE_TAIL;
}

/**
 * startNewGame  —  the one-time new-game seed on the ROM's valid-start path  ·  [seen]
 *
 * Runs exactly once when a START press is honored: it charges the credit, wipes the play RAM, and seeds
 * every game-state, score, timer, and sound cell so the first in-play frame starts from a clean, known
 * state. Memory-only. `players` is the 1/2 player count chosen from the START buttons above.
 */
function startNewGame(m, players) {
  const { mem8, mem16 } = m;

  // Charge the game: BCD-subtract the player count from the credit total CREDIT_BCD (0x83e1), and record
  // the chosen player count in NUM_PLAYERS (0x8370).
  mem8[CREDIT_BCD] = bcdSubByte(mem8[CREDIT_BCD], players).value;
  mem8[NUM_PLAYERS] = players;

  // Wipe the 0x200-byte play-RAM block at WORK_PAGE_SAVE_BANK (0x8500) before seeding fresh state into it.
  for (let i = 0; i < 0x200; i++) mem8[WORK_PAGE_SAVE_BANK + i] = 0;

  // Mark the game live and seed the core game-state cells:
  //   PLAY_FLAG (0x83fe)     = player count -> a game is now in progress. (Per oracle loc_0341:168/183; an
  //                            earlier port bug stored the stale credit byte here instead of the count.)
  //   ACTIVE_PLAYER (0x83fd) = 1            -> player 1 is up
  //   START_LATCH (0x83b3)   = 1            -> a game has begun this frame (halts the START re-scan)
  //   LIVES_COUNT (0x83b7)   = 1            -> current life/level count
  //   PLAYER1_LIVES (0x83b8) = 0x0101       -> P1 and P2 life bytes both = 1, via one 16-bit write (257)
  mem8[PLAY_FLAG] = players;
  mem8[ACTIVE_PLAYER] = 0x01;
  mem8[START_LATCH] = 0x01;
  mem8[LIVES_COUNT] = 0x01;
  mem16[PLAYER1_LIVES] = 257;

  // Seed the on-screen score and the game timers.
  initNewGameScoreAndTimers(m);
  mem8[loc_803d] = 0x03; // role ungrounded (loc_803d, 0x803d): write-only here, read only via the NMI HL pointer

  // Reset the sound queue and enqueue the start jingle: command 0 followed by the 0x09/0x0a/0x0b sequence.
  clearSoundQueue(m);
  mem8[loc_8071] = 0x00; // role ungrounded (loc_8071, 0x8071): write-only in the frogger layers
  enqueueSoundCommand(m, 0x00);
  enqueueSoundCommand(m, 0x09);
  enqueueSoundCommand(m, 0x0a);
  enqueueSoundCommand(m, 0x0b);

  // Seed the 16-bit countdown timers: the in-play countdown INPLAY_COUNTDOWN_WORD (0x829d) = 32, the
  // sound-sequence countdown SOUND_SEQUENCE_COUNTDOWN (0x8382) = 416, and frog timer A FROG_TIMER_A
  // (0x83d2) = 0. The NMI decrements these each frame.
  mem16[INPLAY_COUNTDOWN_WORD] = 32;
  mem16[SOUND_SEQUENCE_COUNTDOWN] = 416;
  mem16[FROG_TIMER_A] = 0;

  // Build the board: clear the active player's work RAM, clear the tilemap, and load the lane parameters
  // for the current difficulty (indexed via PLAYER1_DIFFICULTY_INDEX).
  clearActivePlayerWorkRam(m);
  clearTilemapToTile16(m);
  loadActivePlayerLaneParams(m);

  // Zero the remaining per-game state: the home-column state cell HOME_COLUMN_STATE (0x842f), the frog
  // state cell loc_842d (0x842d), and the PLAYER1_DIFFICULTY_INDEX word (0x8293, cleared as a 16-bit write
  // that also spans player 2's index directly above it).
  mem8[HOME_COLUMN_STATE] = 0x00;
  mem8[loc_842d] = 0x00;
  mem16[PLAYER1_DIFFICULTY_INDEX] = 0;

  // Wipe the 0x50-byte sprite-object record block at SPRITE_OBJECT_RECORD_A_P1 (0x8440).
  for (let i = 0; i < 0x50; i++) mem8[SPRITE_OBJECT_RECORD_A_P1 + i] = 0;

  // Final flags: clear the hold flag HOLD_FLAG (0x8004) and raise the per-player start/demo flag
  // PLAYER_START_DEMO_FLAG (0x825a).
  mem8[HOLD_FLAG] = 0x00;
  mem8[PLAYER_START_DEMO_FLAG] = 0x01;
}

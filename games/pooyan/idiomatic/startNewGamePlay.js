// SPDX-License-Identifier: GPL-3.0-only
import { queueCreditDisplayCommands } from "./queueCreditDisplayCommands.js";
import { resetActorStateForBoard } from "./resetActorStateForBoard.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { fillByteRun } from "./fillByteRun.js";
import {
  ACTIVE_PLAYER,
  TWO_PLAYER_FLAG,
  PLAY_STATE_INDEX,
  MAIN_GAME_STATE,
  GAME_ACTIVE_FLAG,
  FLIP_SCREEN_FLAG,
  WAVE_EVENT_LATCH,
  PERIODIC_EVENT_TIMER,
  ATTRACT_SETUP_DISPLAY_CMD_A,
  START_OF_LIFE_DISPLAY_CMD,
  START_OF_LIFE_DISPLAY_CMD_2P,
  ANIM_WORK_BLOCK_PTR,
} from "./names.js";
/**
 * startNewGamePlay — start-of-life setup for a new game.
 *
 * ROM 0x0dab.  Grounding: [seen].
 *
 * WHAT IT IS
 *   The one-shot hand-off from "a game is being started" to "the machine is playing". The
 *   attract/start-button logic decides that play should begin and how many players there are;
 *   this routine commits that decision into the live state cells, tells the display/sound engine
 *   to paint the pre-play screen and open the first life, and clears the working state a fresh
 *   board reads. After it runs, the master state selector holds the "in-play" value and the
 *   per-frame engine drives an actual round.
 *
 * ROLE IN THE MACHINE
 *   This is the single place the player configuration is written down. A game can run one or two
 *   players out of one shared round page: ACTIVE_PLAYER (0x880d) says whose turn it is and
 *   TWO_PLAYER_FLAG (0x880e) records whether a second player exists at all. Both are set here
 *   from one 16-bit configuration word handed in by the caller. The two-player entry seeds that
 *   word as 0x0100 (high byte 1 -> two-player flag set, low byte 0 -> start with player 0); a
 *   plain single-player start hands in 0x0000 (both bytes zero).
 *
 *   The caller passes that word in HL, so `player` defaults to HL: its LOW byte becomes the
 *   active-player index and its HIGH byte becomes the two-player flag.
 *
 * DISPLAY / SOUND COMMANDS
 *   The screen paints and the sounds fire through a command ring — a small circular buffer of
 *   two-byte hi:lo command words living in RAM page 0x88. Producers append a word; a consumer
 *   drains the ring every frame and dispatches each word's high-byte class to the handler that
 *   does the actual VRAM paint or sound trigger. This routine is a pure producer: it seeds RAM
 *   cells and posts a handful of command words, never touching VRAM or the sound chip directly.
 *
 * LIVE-OUT: memory only — callers read no register back.
 */
const MAIN_STATE_PLAY = 3; //     top-level state value for in-play
const PERIODIC_RELOAD = 0x20; //  periodic-event timer reload

export function startNewGamePlay(m, player = m.regs.hl) {
  const { mem8 } = m;

  // Commit the player configuration (ROM 0x0dab: ld (0x880d),hl stores the whole word).
  // The configuration word is a hi:lo pair: the LOW byte is the active-player index (0 or 1)
  // and the HIGH byte is the two-player flag. Splitting it across the two adjacent cells lets
  // the rest of the round logic address one fixed player index and one fixed "is 2P?" flag.
  mem8[ACTIVE_PLAYER] = player; //         low byte -> active-player index (0x880d)
  mem8[TWO_PLAYER_FLAG] = (player >> 8); // high byte -> two-player flag (0x880e)

  // Pre-play credit HUD (ROM 0x0e54). Posts the display commands that repaint the credit region
  // of the screen for the pre-play setup — one primary credit-display command, plus a second on
  // a free-play cabinet so the FREE PLAY legend replaces the numeric credit count.
  queueCreditDisplayCommands(m); //  pre-play display setup

  // Seed the top-level state cells that switch the machine into a live round.
  // PLAY_STATE_INDEX (0x880a) is the in-round sub-state selector, reset to 0 so the round
  // begins at its first phase. MAIN_GAME_STATE (0x8805) is the master selector the per-frame
  // service dispatches on; the value 3 is "in play". GAME_ACTIVE_FLAG (0x8806) is the in-play
  // gate other routines test. FLIP_SCREEN_FLAG (0x881f) is set to its normal (non-flipped)
  // orientation to open the game.
  mem8[PLAY_STATE_INDEX] = 0;
  mem8[MAIN_GAME_STATE] = MAIN_STATE_PLAY;
  mem8[GAME_ACTIVE_FLAG] = 1;
  mem8[FLIP_SCREEN_FLAG] = 1;
  // Post the pre-play / board-setup display command 0x0604 (ROM 0x0dc5: de=0x0604, rst 0x38)
  // — a 0x06-class display command that lays out the fresh playfield.
  enqueueDisplayCommand(m, ATTRACT_SETUP_DISPLAY_CMD_A); //  enqueue the pre-play start command

  // Wipe and re-seed the actor/sprite working state for a fresh board (ROM 0x0e00): blanks the
  // per-frame actor tables and plants the fixed opening values a new board expects, so no stale
  // sprite state survives from the attract screen or a previous life.
  resetActorStateForBoard(m); //  reset the actor/sprite tables

  // Prime the periodic-event scheduling pair (ROM 0x0dcc: hl=0x8d21, writes 0x8d21=0, 0x8d22=0x20).
  // WAVE_EVENT_LATCH (0x8d21) is cleared so no wave event is pending at the start of the life;
  // PERIODIC_EVENT_TIMER (0x8d22) is reloaded to 0x20, the countdown that paces the recurring
  // periodic event.
  mem8[WAVE_EVENT_LATCH] = 0;
  mem8[PERIODIC_EVENT_TIMER] = PERIODIC_RELOAD;
  // Fire the start-of-life display/sound command 0x0400 (ROM 0x0dd4: de=0x0400, rst 0x38) —
  // the cue that opens a new life.
  enqueueDisplayCommand(m, START_OF_LIFE_DISPLAY_CMD); //  enqueue the start-of-life sound

  // Single-player game: nothing more to do. (ROM 0x0dd8: read (0x880e), rrca, ret nc — test
  // bit 0 of the two-player flag; a one-player game clears carry and returns here.)
  if ((mem8[TWO_PLAYER_FLAG] & 1) === 0) return; //  one-player: done

  // Two-player game only.
  // Fire the two-player start-of-life variant 0x0401 (ROM 0x0ddb: inc e -> 0x0401, rst 0x38) —
  // the sibling cue that accounts for the second player.
  enqueueDisplayCommand(m, START_OF_LIFE_DISPLAY_CMD_2P); //  second-player variant
  // Clear the 12-byte panel work block at 0x8e1f (ROM 0x0ddd: a=0, hl=0x8e1f, b=0x0c, rst 0x10
  // fill) so the shared two-player status panel starts blank.
  fillByteRun(m, ANIM_WORK_BLOCK_PTR, 0, 12); //  clear the 12-byte panel block
}

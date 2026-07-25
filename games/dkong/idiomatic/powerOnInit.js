// SPDX-License-Identifier: GPL-3.0-only
/**
 * powerOnInit — game state 0: the one-time power-on initialization.  ROM 0x01C3.
 *
 * GAME_STATE (0x6005) is 0 only at reset, and the vblank NMI dispatches this
 * handler through the 4-entry state table (perFrame, ROM 0x00CA) exactly once —
 * its last act is to advance GAME_STATE to 1, so the next NMI dispatches attract
 * and this routine never runs again. It is dead-straight-line code (no branches,
 * only calls) that stands the machine up from cold, in order:
 *
 *   1. CLEAR the tilemap playfield and the sprite shadow buffer
 *      (clearPlayfieldAndSprites, ROM 0x0874).
 *   2. SEED the three score slots — P1 / P2 / HIGH — by copying the 9-byte ROM
 *      template at 0x01BA into P1_SCORE (0x60B2..0x60BA): P1 = 000000, P2 = the
 *      AAAAAA attract placeholder, HIGH = the 007650 default. (The oracle's `ldir`;
 *      this is why ROM 0x01BA-0x01C2 shows as "unreached" in the coverage map — it
 *      is data sitting just before this handler, not unexercised code.)
 *   3. Set the baseline ATTRACT = LEVEL = LIVES = 1, then redraw the reserve-lives
 *      and level HUD (drawLivesAndLevel, ROM 0x06B8) — passed A = 1 ("one Mario in
 *      play"); with ATTRACT now 1 its own attract-guard skips the paint this frame,
 *      exactly as the oracle does.
 *   4. Unpack the DSW0 dip-switch bank into the settings block (decodeDipSwitches,
 *      ROM 0x0207).
 *   5. Raise the flip-screen latch, advance GAME_STATE to 1 (attract), select the
 *      25m board (BOARD = 1), and clear the in-game sub-state selector
 *      (GAME_SUBSTATE = 0).
 *   6. Stamp player 1's static "1UP" score marker (draw1UpLabel, ROM 0x0A53).
 *   7. Post the three opening deferred-work messages onto the task ring
 *      (enqueueTask, ROM 0x309F): [0x03,0x04], [0x02,0x02], [0x02,0x00] as the
 *      Z80 (D = opcode, E = argument) pairs the oracle loads into DE.
 *
 * Memory-equivalent to the frozen oracle — equivalence-01c3.test.js.
 * GATE:     crafted-entry — the single real power-on dispatch (GAME_STATE 0, fires
 *           once at boot; a fresh clone per case), plus crafted task-ring states the
 *           boot never mints (a FULL ring that drops the posts, a near-wrap tail),
 *           poked identically on both sides. Straight-line with no branches, so the
 *           one real entry already covers the whole control path. Teeth twins caught.
 * LIVE-OUT: memory-only — the seeded work RAM (scores, ATTRACT, LEVEL, LIVES,
 *           GAME_STATE, BOARD, GAME_SUBSTATE), the task ring + TASK_TAIL (via
 *           enqueueTask), the HUD/marker video cells (via drawLivesAndLevel /
 *           draw1UpLabel), the settings block (via decodeDipSwitches), the cleared
 *           playfield + sprite buffer, and the FLIPSCREEN latch. No live
 *           registers/flags: this is an rst-0x28-dispatched state handler whose
 *           `ret` lands on the NMI epilogue (ROM 0x00D2), which pops iy/ix/hl/de/
 *           bc/af off the stack before reading any of them, so every residual
 *           register/flag is dead. SP/pc are the dropped stack model — the oracle's
 *           calls + final `ret` leave only push residue inside STACK_SCRATCH; the
 *           direct-call layer leaves SP/pc untouched.
 * NAMES:    ATTRACT (0x6007), LEVEL (0x6229), LIVES (0x6228), GAME_STATE (0x6005),
 *           BOARD (0x6227), GAME_SUBSTATE (0x600A), P1_SCORE (0x60B2) from ram.js.
 *           FLIPSCREEN (0x7D82) is a board control latch, not work RAM — kept hex.
 *           The score template source (ROM 0x01BA) and the three task [opcode,arg]
 *           payloads are ROM data / literal messages, kept literal.
 */

import {
  ATTRACT,
  LEVEL,
  LIVES,
  GAME_STATE,
  BOARD,
  GAME_SUBSTATE,
  P1_SCORE,
} from "../optimized/ram.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js"; // ROM 0x0874
import { drawLivesAndLevel } from "./drawLivesAndLevel.js"; // ROM 0x06B8
import { decodeDipSwitches } from "./decodeDipSwitches.js"; // ROM 0x0207
import { draw1UpLabel } from "./draw1UpLabel.js"; // ROM 0x0A53
import { enqueueTask } from "./enqueueTask.js"; // ROM 0x309F

// Flip-screen control latch — board hardware (0x7D80 bank), not work RAM, so it is
// not in ram.js. Write-only: readable back only by the board, never by the CPU.
const FLIPSCREEN = 0x7d82;

// The 9-byte score-slot template in ROM: P1 (3) + P2 (3) + HIGH (3), copied into
// the three little-endian BCD score slots at P1_SCORE.
const SCORE_TEMPLATE_ROM = 0x01ba;
const SCORE_TEMPLATE_LEN = 9;

// The three opening deferred-work messages, as [opcode, argument] pairs in post
// order — the oracle's `ld de,NNNN / call 0x309f` (D = high byte = opcode,
// E = low byte = argument).
const OPENING_TASKS = [
  [0x03, 0x04],
  [0x02, 0x02],
  [0x02, 0x00],
];

export function powerOnInit(m) {
  const { regs, mem } = m;

  // 1. Blank the playfield tilemap and the sprite shadow buffer.
  clearPlayfieldAndSprites(m);

  // 2. Seed the three score slots from the ROM template (the oracle's `ldir`).
  for (let i = 0; i < SCORE_TEMPLATE_LEN; i++) {
    mem.write8(P1_SCORE + i, mem.read8(SCORE_TEMPLATE_ROM + i));
  }

  // 3. Baseline: ATTRACT / LEVEL / LIVES = 1, then repaint the lives+level HUD.
  //    A = 1 is a live input to drawLivesAndLevel ("lives in play"); set it before
  //    the write group exactly as the ROM's `ld a,1` does. ATTRACT is 1 by the time
  //    of the call, so drawLivesAndLevel's attract-guard skips the paint this frame.
  regs.a = 1;
  mem.write8(ATTRACT, regs.a);
  mem.write8(LEVEL, regs.a);
  mem.write8(LIVES, regs.a);
  drawLivesAndLevel(m);

  // 4. Unpack the DSW0 dip-switch bank into the settings block.
  decodeDipSwitches(m);

  // 5. Screen up; advance the top-level state to attract; select the 25m board;
  //    clear the in-game sub-state selector. A is dead past this point.
  mem.write8(FLIPSCREEN, 1);
  mem.write8(GAME_STATE, 1); // next NMI dispatches attract
  mem.write8(BOARD, 1); // 25m
  mem.write8(GAME_SUBSTATE, 0);

  // 6. Stamp player 1's static "1UP" score marker.
  draw1UpLabel(m);

  // 7. Post the three opening task messages. enqueueTask reads the pair from D/E,
  //    so marshal each into regs.d / regs.e before the call (it never writes back).
  for (const [opcode, argument] of OPENING_TASKS) {
    regs.d = opcode;
    regs.e = argument;
    enqueueTask(m);
  }
}

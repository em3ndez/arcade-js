// SPDX-License-Identifier: GPL-3.0-only
/**
 * composeAttractTitleScreen — build the attract title/score screen (GAME_STATE 1,
 * sub-state 0) and hand off to the next attract step.  ROM 0x0779.
 *
 * The attract-state dispatcher (runAttractState, ROM 0x073C) routes here while
 * GAME_STATE (0x6005) == 1 and GAME_SUBSTATE (0x600A) == 0 — the first attract
 * sub-state, the title screen showing the "1UP / HIGH SCORE / 2UP" score row and the
 * coins-per-credit readout. It composes that screen once, then arms a 2-frame timer
 * and steps the sub-state so the next NMI moves attract along. In order:
 *
 *   1. Clear both palette-bank select latches (0x7D86/0x7D87) → palette bank 0.
 *   2. Post the two attract title strings directly onto the task ring (draw-string
 *      opcode 0x03, args 0x1B then 0x1C), then post the fixed title-screen task batch
 *      (enqueueTaskBatch: one #4/0 message + six #3 messages, args 0x14..0x19).
 *   3. Arm SUBSTATE_TIMER = 2 and advance GAME_SUBSTATE (++), the "wait 2 frames then
 *      proceed" idiom that walks attract to its next sub-state.
 *   4. Blank the playfield + sprite buffer (clearPlayfieldAndSprites), then draw the
 *      "1UP" score label — and the "2UP" label only in a two-player game.
 *   5. Draw the coins-per-credit digits from DIP_COINS_FOR_1P/2P (0x6022/0x6023).
 *
 * The digit writer runs TWICE. The oracle `call`s writeDigitPairWithCarry at 0x07AA and
 * then FALLS THROUGH into the very same bytes — a two-iteration loop with no counter —
 * and the routine hands the second pass its own inputs via its tail (DE=0x0201,
 * HL=0x768C). So this calls it twice: pass 1 stamps the coinage digits at HL=0x756C from
 * DE=(0x6022); pass 2 stamps the literal "1 2" at HL=0x768C.
 *
 * Direct function calls replace the oracle's m.call/push16/ret stack model; the Z80
 * stack becomes the JS call stack. The callee ABI is register-passed exactly as the
 * oracle marshals it (D/E for enqueueTask, DE/HL for the digit writer).
 *
 * Memory-equivalent to the frozen oracle — equivalence-0779.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (fires ~4×/9000 frames as
 *           the title screen is composed; fresh clone each, oracle run in full) prove
 *           the 1-player path; crafted entries poked IDENTICALLY on both sides force the
 *           arms attract never reaches — TWO-PLAYER (0x600F=1 → the 2UP label),
 *           TENS-CARRY (0x6023=10 → the digit writer's carry cell 0x758E), and a
 *           FULL-RING drop (all task posts dropped). Teeth = a twin that drops the second
 *           title-string post (caught on captured + a deterministic clean-ring entry).
 * LIVE-OUT: memory-only — the task ring (0x60C0-0x60FF) + TASK_TAIL (0x60B0),
 *           SUBSTATE_TIMER (0x6009), GAME_SUBSTATE (0x600A), the blanked playfield +
 *           sprite buffer, the 1UP/2UP label cells, and the coinage digit cells. No live
 *           registers/flags: the successor chain (runAttractState → the NMI game-state
 *           dispatch) reads none of the handler's residual A/DE/HL/F before overwriting
 *           them. SP/pc are the dropped stack model — the oracle's per-call push/ret
 *           residue lands in STACK_SCRATCH, excluded by the contract.
 * NAMES:    SUBSTATE_TIMER (0x6009), GAME_SUBSTATE (0x600A), TWO_PLAYER_GAME (0x600F),
 *           DIP_COINS_FOR_1P (0x6022; +1 = DIP_COINS_FOR_2P) from ram.js. The palette-bank
 *           latches (0x7D86/0x7D87) and the VRAM coinage cell (0x756C) stay hex — I/O and
 *           video RAM, not named in ram.js. The draw-string opcode/args are literal task
 *           payloads, not addresses.
 */

import {
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
  TWO_PLAYER_GAME,
  DIP_COINS_FOR_1P,
} from "./ram.js";
import { enqueueTask } from "./enqueueTask.js";
import { enqueueTaskBatch } from "./enqueueTaskBatch.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { draw1UpLabel } from "./draw1UpLabel.js";
import { draw2UpLabel } from "./draw2UpLabel.js";
import { writeDigitPairWithCarry } from "./writeDigitPairWithCarry.js";

// Write-only palette-bank select latches (i8259 outputs), cleared to select bank 0.
const PALETTE_BANK_LATCH_LO = 0x7d86;
const PALETTE_BANK_LATCH_HI = 0x7d87;

// Task-ring message payloads: opcode 0x03 = the draw-string handler; 0x1B/0x1C are the
// two attract title-string ids this handler posts before enqueueTaskBatch's #4/#3 batch.
const DRAW_STRING = 0x03;
const TITLE_STRING_A = 0x1b;
const TITLE_STRING_B = 0x1c;

// VRAM tilemap cell for the 1P coins-per-credit digit; the digit writer places the 2P
// digit two columns along (HL+2) and, on a value of 10, a tens digit in cell 0x758E.
const COINAGE_DIGIT_CELL = 0x756c;

export function composeAttractTitleScreen(m) {
  const { regs, mem } = m;

  // 1. Select palette bank 0 by clearing both bank-select latches.
  mem.write8(PALETTE_BANK_LATCH_LO, 0x00);
  mem.write8(PALETTE_BANK_LATCH_HI, 0x00);

  // 2. Post the two title strings directly, then the fixed title-screen task batch.
  //    enqueueTask reads D=opcode / E=argument and never writes them, so holding D
  //    while stepping E is safe.
  regs.d = DRAW_STRING;
  regs.e = TITLE_STRING_A;
  enqueueTask(m);
  regs.e = TITLE_STRING_B;
  enqueueTask(m);
  enqueueTaskBatch(m);

  // 3. Wait 2 frames, then advance to the next attract sub-state.
  mem.write8(SUBSTATE_TIMER, 0x02);
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);

  // 4. Blank the screen, then draw the score labels (2UP only in a 2-player game).
  clearPlayfieldAndSprites(m);
  draw1UpLabel(m);
  if (mem.read8(TWO_PLAYER_GAME) === 0x01) draw2UpLabel(m);

  // 5. Draw the coins-per-credit readout. Pass 1: the coinage digits from
  //    DIP_COINS_FOR_1P/2P at HL=0x756C. The writer's tail reloads DE=0x0201, HL=0x768C,
  //    which the SECOND pass consumes to stamp the literal "1 2".
  regs.de = mem.read16(DIP_COINS_FOR_1P); // E = 1P coins (0x6022), D = 2P coins (0x6023)
  regs.hl = COINAGE_DIGIT_CELL;
  writeDigitPairWithCarry(m);
  writeDigitPairWithCarry(m);
}

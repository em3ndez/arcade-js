// SPDX-License-Identifier: GPL-3.0-only
/** loc_18c3 — one frame of high-score initials entry. On even frames the facing panel's four
 * controls are rolled into their press histories; a fresh commit locks the shown letter into the
 * next slot (and, on the last slot, finishes the entry), a fresh forward/back press steps the
 * shown letter round its 27-value ring, and a history that has saturated is emptied so a held
 * control repeats. On odd frames the cursor cell's colour flashes. Every eighth frame the entry
 * clock ticks, and running out finishes the entry too. Finishing re-arms the clock, queues the
 * transition sounds and steps the sequence on. After the scan, once neither player has lives
 * left, a held start button with a credit (or on free play) starts the next game.
 * LIVE-OUT: memory only; the accumulator and flags left behind are dead at the one caller. */

import { u8 } from "../../../core/int.js";
import { readPlayerControls } from "./readPlayerControls.js";
import { rearmHeldControlRepeat } from "./rearmHeldControlRepeat.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { advanceCharCursor } from "./advanceCharCursor.js";
import { enqueueTransitionSoundBurst } from "./enqueueTransitionSoundBurst.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { hideAllSprites } from "./hideAllSprites.js";
import { startOnePlayerGame } from "./startOnePlayerGame.js";
import { startTwoPlayerGame } from "./startTwoPlayerGame.js";
import { startGameOnFreePlay } from "./startGameOnFreePlay.js";
import {
  CREDIT_COUNT, FRAME_TICK, FREE_PLAY, IN0_MIRROR, PLAYER_ONE_LIVES, PLAYER_TWO_LIVES,
  SCRATCH_PTR_A, SCRATCH_PTR_B, SEQUENCE_DELAY,
} from "./names.js";

// Initials-entry work cells and the letter-glyph table.
const LOCKED_LETTER_COLOUR = 0xa990;
const BACK_HISTORY = 0xa995;
const FORWARD_HISTORY = 0xa996;
const COMMIT_HISTORY = 0xa997;
const OTHER_COMMIT_HISTORY = 0xa998;
const LETTER_INDEX = 0xa999;
const SLOTS_LEFT = 0xa99a;
const FLASH_PHASE = 0xa99c;
const LETTER_GLYPHS = 0x12c7;

const BACK_BIT = 0x01;
const FORWARD_BIT = 0x02;
const COMMIT_BIT = 0x10;
const OTHER_COMMIT_BIT = 0x20;
const FORWARD_SATURATED = 0xff;
const BACK_SATURATED = 0x7f;
const LAST_THREE_SAMPLES = 0x07;
const FRESH_PRESS = 0x01;

const LETTER_COUNT = 27;
const LAST_LETTER = LETTER_COUNT - 1;
const WRAPPED_BELOW = 0x80;

const COLOUR_PLANE_BIT = 0x400;
const CURSOR_COLOUR = 0x10;
const CURSOR_FLASH_COLOUR = 0x14;
const FLASH_BIT = 0x10;
const BLANK = 0xf1;

const EVERY_OTHER_FRAME = 0x01;
const EVERY_EIGHTH_FRAME = 0x07;
const ENTRY_CLOCK_RELOAD = 60;

const START_BUTTONS = 0x18;
const ONE_PLAYER_START = 0x08;

const isFreshPress = (history) => (history & LAST_THREE_SAMPLES) === FRESH_PRESS;

function rollHistory(mem8, cell, pressed) {
  mem8[cell] = (mem8[cell] << 1) | (pressed ? 1 : 0);
}

/** Look the shown letter's glyph up; the lookup leaves its entry pointer behind. */
const letterGlyph = (m) => fetchTableByte(m, LETTER_GLYPHS, m.mem8[LETTER_INDEX]);

/** Stamp the shown letter at the cursor, colour its cell as the cursor, and stop the flash. */
function redrawCursorLetter(m) {
  const { mem8, mem16 } = m;
  const cursor = mem16[SCRATCH_PTR_B];
  mem8[cursor] = letterGlyph(m);
  mem8[cursor & ~COLOUR_PLANE_BIT] = CURSOR_COLOUR;
  mem8[FLASH_PHASE] = 0;
}

/** Lock the shown letter into both copies and step both on; true once no slot is left. */
function commitLetter(m) {
  const { mem8, mem16 } = m;
  const glyph = letterGlyph(m);
  const copy = mem16[SCRATCH_PTR_A];
  const cursor = mem16[SCRATCH_PTR_B];
  mem8[cursor] = glyph;
  mem8[copy] = glyph;
  mem8[cursor & ~COLOUR_PLANE_BIT] = mem8[LOCKED_LETTER_COLOUR];
  mem16[SCRATCH_PTR_A] = copy + 1;
  mem16[SCRATCH_PTR_B] = advanceCharCursor(m, cursor | COLOUR_PLANE_BIT);
  mem8[SLOTS_LEFT] = u8(mem8[SLOTS_LEFT] - 1);
  if (mem8[SLOTS_LEFT] === 0) return true;
  mem8[LETTER_INDEX] = 0;
  return false;
}

/** The even-frame scan; true when it finished the entry. */
function scanControls(m) {
  const { mem8 } = m;
  const controls = readPlayerControls(m);
  rollHistory(mem8, BACK_HISTORY, controls & BACK_BIT);
  rollHistory(mem8, FORWARD_HISTORY, controls & FORWARD_BIT);
  rollHistory(mem8, COMMIT_HISTORY, controls & COMMIT_BIT);
  rollHistory(mem8, OTHER_COMMIT_HISTORY, controls & OTHER_COMMIT_BIT);

  if (isFreshPress(mem8[OTHER_COMMIT_HISTORY]) || isFreshPress(mem8[COMMIT_HISTORY])) {
    if (commitLetter(m)) return true;
    redrawCursorLetter(m);
    return false;
  }

  if (mem8[FORWARD_HISTORY] === FORWARD_SATURATED) {
    rearmHeldControlRepeat(m, FORWARD_HISTORY);
  } else if (isFreshPress(mem8[FORWARD_HISTORY])) {
    const next = u8(mem8[LETTER_INDEX] + 1);
    mem8[LETTER_INDEX] = next > LAST_LETTER ? 0 : next;
    redrawCursorLetter(m);
    return false;
  }

  if (mem8[BACK_HISTORY] === BACK_SATURATED) {
    rearmHeldControlRepeat(m, BACK_HISTORY);
  } else if (isFreshPress(mem8[BACK_HISTORY])) {
    const next = u8(mem8[LETTER_INDEX] - 1);
    mem8[LETTER_INDEX] = next < WRAPPED_BELOW ? next : LAST_LETTER;
    redrawCursorLetter(m);
  }
  return false;
}

/** Tick the entry clock on every eighth frame; true when it ran out, blanking the cursor cell. */
function entryClockRanOut(m) {
  const { mem8, mem16 } = m;
  if ((mem8[FRAME_TICK] & EVERY_EIGHTH_FRAME) !== 0) return false;
  mem8[SEQUENCE_DELAY] = u8(mem8[SEQUENCE_DELAY] - 1);
  if (mem8[SEQUENCE_DELAY] !== 0) return false;
  mem8[mem16[SCRATCH_PTR_B]] = BLANK;
  return true;
}

function finishEntry(m) {
  m.mem8[SEQUENCE_DELAY] = ENTRY_CLOCK_RELOAD;
  enqueueTransitionSoundBurst(m);
  advanceSequenceSubStep(m);
}

function flashCursor(m) {
  const { mem8, mem16 } = m;
  const phase = u8(mem8[FLASH_PHASE] + 1);
  mem8[FLASH_PHASE] = phase;
  mem8[mem16[SCRATCH_PTR_B] & ~COLOUR_PLANE_BIT] = phase & FLASH_BIT ? CURSOR_FLASH_COLOUR : CURSOR_COLOUR;
}

/** With both players out of lives, a held start button begins the next game when it may. */
function startNextGameIfAsked(m) {
  const { mem8 } = m;
  if ((mem8[PLAYER_ONE_LIVES] | mem8[PLAYER_TWO_LIVES]) !== 0) return;
  const start = mem8[IN0_MIRROR] & START_BUTTONS;

  if (mem8[FREE_PLAY] !== 0) {
    if (start === 0) return;
    hideAllSprites(m);
    startGameOnFreePlay(m);
    return;
  }

  const credits = mem8[CREDIT_COUNT];
  if (credits === 0) return;
  if (credits === 1 ? start !== ONE_PLAYER_START : start === 0) return;
  hideAllSprites(m);
  if (start === ONE_PLAYER_START) startOnePlayerGame(m);
  else startTwoPlayerGame(m);
}

export function loc_18c3(m) {
  const { mem8 } = m;
  if ((mem8[FRAME_TICK] & EVERY_OTHER_FRAME) !== 0) {
    flashCursor(m);
  } else if (scanControls(m) || entryClockRanOut(m)) {
    finishEntry(m);
    return;
  }
  startNextGameIfAsked(m);
}

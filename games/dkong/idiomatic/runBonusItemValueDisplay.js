// SPDX-License-Identifier: GPL-3.0-only
/**
 * runBonusItemValueDisplay — one in-game sub-state's per-frame handler: repaints the credit line,
 * walks the bonus item's grid position and animates its sprite, and paints a decrementing point
 * value into two digit cells and a six-digit column. When the value hits zero or the column walk
 * reaches its end it tears the item down and steps the phase machine back one, ending the sub-state.
 *
 * SUBSTATE_TIMER is a three-way mode latch here, not a countdown: 0 = one-shot INIT that falls
 * through into the per-frame body, non-zero = RUNNING, 0x80 = done.
 *
 * LIVE-OUT: memory-only.
 */
import { SUBSTATE_TIMER, P1_INPUT, GAME_SUBSTATE, PLAYER_SLOT_RECORDS, ACTIVE_PLAYER_INDEX } from "./names.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";
import { positionBonusItemSprite } from "./positionBonusItemSprite.js";
import { renderBcdColumn } from "./renderBcdColumn.js";
import { enqueueTask } from "./enqueueTask.js";

const POS_RELOAD = 0x6030;    // frame divider between position steps
const SPRITE_TOGGLE = 0x6031;
const ANIM_TIMER = 0x6032;
const VALUE = 0x6033;         // point value, counts down from 0x1E
const DISPLAY_TIMER = 0x6034;
const POS_INDEX = 0x6035;     // grid position index, 0..0x1D
const VIDEO_PTR = 0x6036;
const SLOT_PTR = 0x6038;
const SLOT_COL_PTR = 0x603a;

const PALETTE_BANK_LO = 0x7d86; // palette-bank latch (a hardware output)
const PALETTE_BANK_HI = 0x7d87; // palette-bank latch (a hardware output)
const VALUE_ONES_CELL = 0x7552;
const VALUE_TENS_CELL = 0x7572;
const VIDEO_BASE = 0x75e8;      // top of the value's video column
const COL_LOW_SENTINEL = 0x7588; // column-walk floor: no stamp when the ptr is already here
const COL_HIGH_SENTINEL = 0x7608; // column-walk ceiling: advancing to here wraps to VIDEO_BASE

function rotl8(v) {
  return ((v << 1) | (v >> 7)) & 0xff;
}

export function runBonusItemValueDisplay(m) {
  const { regs, mem, mem8, mem16 } = m;

  drawCreditDisplay(m);

  if (mem8[SUBSTATE_TIMER] === 0) {
    mem.write8(PALETTE_BANK_LO, 0x00); // palette bank %00
    mem.write8(PALETTE_BANK_HI, 0x00);
    mem8[SUBSTATE_TIMER] = 0x01;
    mem8[POS_RELOAD] = 0x0a;
    mem8[SPRITE_TOGGLE] = 0x00;
    mem8[ANIM_TIMER] = 0x10;
    mem8[VALUE] = 0x1e;
    mem8[DISPLAY_TIMER] = 0x3e;
    mem8[POS_INDEX] = 0x00;
    mem16[VIDEO_PTR] = VIDEO_BASE;

    // No match leaves the pointer at the 4th row — the scan is not guarded.
    const key = (rotl8(mem8[ACTIVE_PLAYER_INDEX]) + 1) & 0xff;
    let slot = PLAYER_SLOT_RECORDS;
    for (let i = 0; i < 4; i++) {
      if (mem8[slot] === key) break;
      slot = (slot + 0x22) & 0xffff;
    }
    mem16[SLOT_PTR] = slot;
    mem16[SLOT_COL_PTR] = (slot - 0x0d) & 0xffff;

    positionBonusItemSprite(m, 0x00, mem8[POS_INDEX]);
  }

  const displayTimer = (mem8[DISPLAY_TIMER] - 1) & 0xff;
  mem8[DISPLAY_TIMER] = displayTimer;
  if (displayTimer === 0) {
    mem8[DISPLAY_TIMER] = 0x3e;
    const value = (mem8[VALUE] - 1) & 0xff;
    mem8[VALUE] = value;
    if (value === 0) {
      exitBonusItemDisplay(m);
      return;
    }
    let ones = value;
    let tens = 0;
    while (ones >= 0x0a) {
      ones -= 0x0a;
      tens = (tens + 1) & 0xff;
    }
    mem8[VALUE_ONES_CELL] = ones;
    mem8[VALUE_TENS_CELL] = tens;
  }

  const savedDivider = mem8[POS_RELOAD];
  mem8[POS_RELOAD] = 0x0a;
  const input = mem8[P1_INPUT];

  if (input & 0x80) {
    const pos = mem8[POS_INDEX];
    if (pos === 0x1d) {
      exitBonusItemDisplay(m);
      return;
    }
    if (pos === 0x1c) {
      const cur = mem16[VIDEO_PTR];
      const next = (cur + 0x20) & 0xffff;
      if (next === COL_HIGH_SENTINEL) {
        mem8[VIDEO_BASE] = 0x10;
        mem16[VIDEO_PTR] = VIDEO_BASE;
      } else {
        mem8[next] = 0x10;
        mem16[VIDEO_PTR] = next;
      }
    } else {
      // Skip the stamp when the pointer is already at the floor sentinel.
      const cur = mem16[VIDEO_PTR];
      if (cur !== COL_LOW_SENTINEL) {
        mem8[cur] = (pos + 0x11) & 0xff;
        mem16[VIDEO_PTR] = (cur - 0x20) & 0xffff;
      }
    }
  } else if (input & 0x03) {
    const divider = (savedDivider - 1) & 0xff;
    if (divider !== 0) {
      mem8[POS_RELOAD] = divider;
    } else {
      let pos;
      if (input & 0x02) {
        const dec = (mem8[POS_INDEX] - 1) & 0xff;
        pos = (dec & 0x80) ? 0x1d : dec;
      } else {
        const inc = (mem8[POS_INDEX] + 1) & 0xff;
        pos = inc === 0x1e ? 0x00 : inc;
      }
      mem8[POS_INDEX] = pos;
      positionBonusItemSprite(m, 0x00, pos);
    }
  } else {
    mem8[POS_RELOAD] = 0x01;
  }

  const animTimer = (mem8[ANIM_TIMER] - 1) & 0xff;
  mem8[ANIM_TIMER] = animTimer;
  if (animTimer !== 0) return;

  let source;
  if (mem8[SPRITE_TOGGLE] !== 0) {
    mem8[SPRITE_TOGGLE] = 0x00;
    source = (mem16[SLOT_PTR] + 3) & 0xffff;
  } else {
    mem8[SPRITE_TOGGLE] = 0x01;
    source = 0x01bf; // canned digit template
  }
  const iy = mem16[SLOT_PTR];
  const dest = mem8[(iy + 4) & 0xffff] | (mem8[(iy + 5) & 0xffff] << 8);
  regs.de = source;
  regs.ix = dest;
  renderBcdColumn(m);
  mem8[ANIM_TIMER] = 0x10;
}

/** Tear the item down, step the phase machine back, copy the video column into the slot record, and post the follow-up tasks. */
function exitBonusItemDisplay(m) {
  const { regs, mem8, mem16 } = m;

  mem8[mem16[SLOT_PTR]] = 0x00;
  mem8[SUBSTATE_TIMER] = 0x80;
  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] - 1) & 0xff;

  const dst = mem16[SLOT_COL_PTR];
  for (let i = 0; i < 0x0c; i++) {
    mem8[(dst + i) & 0xffff] = mem8[(VIDEO_BASE - 0x20 * i) & 0xffff];
  }

  for (let arg = 0x14; arg <= 0x18; arg++) {
    enqueueTask(m, 0x03, arg);
  }
  enqueueTask(m, 0x03, 0x1a);
}

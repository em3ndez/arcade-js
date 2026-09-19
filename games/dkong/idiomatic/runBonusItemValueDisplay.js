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
import { u16 } from "../../../core/int.js";
import {
  ACTIVE_PLAYER_INDEX,
  BONUS_ITEM_ANIM_TIMER,
  BONUS_ITEM_DISPLAY_TIMER,
  BONUS_ITEM_POS_DIVIDER,
  BONUS_ITEM_POS_INDEX,
  BONUS_ITEM_SLOT_COL_PTR,
  BONUS_ITEM_SLOT_PTR,
  BONUS_ITEM_SPRITE_TOGGLE,
  BONUS_ITEM_VALUE,
  BONUS_ITEM_VALUE_COLUMN_TOP,
  BONUS_ITEM_VALUE_COL_CEILING_SENTINEL,
  BONUS_ITEM_VALUE_COL_FLOOR_SENTINEL,
  BONUS_ITEM_VALUE_ONES_CELL,
  BONUS_ITEM_VALUE_TENS_CELL,
  BONUS_ITEM_VIDEO_PTR,
  GAME_SUBSTATE,
  P1_INPUT,
  PALETTE_BANK_BIT0,
  PALETTE_BANK_BIT1,
  PLAYER_SLOT_RECORDS,
  SUBSTATE_TIMER,
} from "./names.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";
import { positionBonusItemSprite } from "./positionBonusItemSprite.js";
import { renderBcdColumn } from "./renderBcdColumn.js";
import { enqueueTask } from "./enqueueTask.js";



function rotl8(v) {
  return ((v << 1) | (v >> 7)) & 0xff;
}

export function runBonusItemValueDisplay(m) {
  const { regs, mem, mem8, mem16 } = m;

  drawCreditDisplay(m);

  if (mem8[SUBSTATE_TIMER] === 0) {
    mem.write8(PALETTE_BANK_BIT0, 0x00); // palette bank %00
    mem.write8(PALETTE_BANK_BIT1, 0x00);
    mem8[SUBSTATE_TIMER] = 0x01;
    mem8[BONUS_ITEM_POS_DIVIDER] = 0x0a;
    mem8[BONUS_ITEM_SPRITE_TOGGLE] = 0x00;
    mem8[BONUS_ITEM_ANIM_TIMER] = 0x10;
    mem8[BONUS_ITEM_VALUE] = 0x1e;
    mem8[BONUS_ITEM_DISPLAY_TIMER] = 0x3e;
    mem8[BONUS_ITEM_POS_INDEX] = 0x00;
    mem16[BONUS_ITEM_VIDEO_PTR] = BONUS_ITEM_VALUE_COLUMN_TOP;

    // No match leaves the pointer at the 4th row — the scan is not guarded.
    const key = (rotl8(mem8[ACTIVE_PLAYER_INDEX]) + 1) & 0xff;
    let slot = PLAYER_SLOT_RECORDS;
    for (let i = 0; i < 4; i++) {
      if (mem8[slot] === key) break;
      slot = u16(slot + 0x22);
    }
    mem16[BONUS_ITEM_SLOT_PTR] = slot;
    mem16[BONUS_ITEM_SLOT_COL_PTR] = (slot - 0x0d);

    positionBonusItemSprite(m, 0x00, mem8[BONUS_ITEM_POS_INDEX]);
  }

  const displayTimer = (mem8[BONUS_ITEM_DISPLAY_TIMER] - 1) & 0xff;
  mem8[BONUS_ITEM_DISPLAY_TIMER] = displayTimer;
  if (displayTimer === 0) {
    mem8[BONUS_ITEM_DISPLAY_TIMER] = 0x3e;
    const value = (mem8[BONUS_ITEM_VALUE] - 1) & 0xff;
    mem8[BONUS_ITEM_VALUE] = value;
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
    mem8[BONUS_ITEM_VALUE_ONES_CELL] = ones;
    mem8[BONUS_ITEM_VALUE_TENS_CELL] = tens;
  }

  const savedDivider = mem8[BONUS_ITEM_POS_DIVIDER];
  mem8[BONUS_ITEM_POS_DIVIDER] = 0x0a;
  const input = mem8[P1_INPUT];

  if (input & 0x80) {
    const pos = mem8[BONUS_ITEM_POS_INDEX];
    if (pos === 0x1d) {
      exitBonusItemDisplay(m);
      return;
    }
    if (pos === 0x1c) {
      const cur = mem16[BONUS_ITEM_VIDEO_PTR];
      const next = u16(cur + 0x20);
      if (next === BONUS_ITEM_VALUE_COL_CEILING_SENTINEL) {
        mem8[BONUS_ITEM_VALUE_COLUMN_TOP] = 0x10;
        mem16[BONUS_ITEM_VIDEO_PTR] = BONUS_ITEM_VALUE_COLUMN_TOP;
      } else {
        mem8[next] = 0x10;
        mem16[BONUS_ITEM_VIDEO_PTR] = next;
      }
    } else {
      // Skip the stamp when the pointer is already at the floor sentinel.
      const cur = mem16[BONUS_ITEM_VIDEO_PTR];
      if (cur !== BONUS_ITEM_VALUE_COL_FLOOR_SENTINEL) {
        mem8[cur] = (pos + 0x11);
        mem16[BONUS_ITEM_VIDEO_PTR] = (cur - 0x20);
      }
    }
  } else if (input & 0x03) {
    const divider = (savedDivider - 1) & 0xff;
    if (divider !== 0) {
      mem8[BONUS_ITEM_POS_DIVIDER] = divider;
    } else {
      let pos;
      if (input & 0x02) {
        const dec = (mem8[BONUS_ITEM_POS_INDEX] - 1) & 0xff;
        pos = (dec & 0x80) ? 0x1d : dec;
      } else {
        const inc = (mem8[BONUS_ITEM_POS_INDEX] + 1) & 0xff;
        pos = inc === 0x1e ? 0x00 : inc;
      }
      mem8[BONUS_ITEM_POS_INDEX] = pos;
      positionBonusItemSprite(m, 0x00, pos);
    }
  } else {
    mem8[BONUS_ITEM_POS_DIVIDER] = 0x01;
  }

  const animTimer = (mem8[BONUS_ITEM_ANIM_TIMER] - 1) & 0xff;
  mem8[BONUS_ITEM_ANIM_TIMER] = animTimer;
  if (animTimer !== 0) return;

  let source;
  if (mem8[BONUS_ITEM_SPRITE_TOGGLE] !== 0) {
    mem8[BONUS_ITEM_SPRITE_TOGGLE] = 0x00;
    source = u16(mem16[BONUS_ITEM_SLOT_PTR] + 3);
  } else {
    mem8[BONUS_ITEM_SPRITE_TOGGLE] = 0x01;
    source = 0x01bf; // canned digit template
  }
  const iy = mem16[BONUS_ITEM_SLOT_PTR];
  const dest = mem8[u16(iy + 4)] | (mem8[u16(iy + 5)] << 8);
  regs.de = source;
  regs.ix = dest;
  renderBcdColumn(m);
  mem8[BONUS_ITEM_ANIM_TIMER] = 0x10;
}

/** Tear the item down, step the phase machine back, copy the video column into the slot record, and post the follow-up tasks. */
function exitBonusItemDisplay(m) {
  const { regs, mem8, mem16 } = m;

  mem8[mem16[BONUS_ITEM_SLOT_PTR]] = 0x00;
  mem8[SUBSTATE_TIMER] = 0x80;
  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] - 1);

  const dst = mem16[BONUS_ITEM_SLOT_COL_PTR];
  for (let i = 0; i < 0x0c; i++) {
    mem8[u16(dst + i)] = mem8[u16(BONUS_ITEM_VALUE_COLUMN_TOP - 0x20 * i)];
  }

  for (let arg = 0x14; arg <= 0x18; arg++) {
    enqueueTask(m, 0x03, arg);
  }
  enqueueTask(m, 0x03, 0x1a);
}

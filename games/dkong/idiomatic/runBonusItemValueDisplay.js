// SPDX-License-Identifier: GPL-3.0-only
/**
 * runBonusItemValueDisplay — drive the on-board bonus item: its position walk, its animated
 * sprite, and the countdown value shown beside it.
 *
 * One in-game sub-state's per-frame handler, run for as long as that sub-state is current. It
 * repaints the credit line, moves the item's grid position, animates its sprite, and paints a
 * decrementing point value into two on-screen digit cells and a six-digit column. When the
 * value runs out — or the column walk reaches its end — it tears the item down and steps the
 * phase machine back one, which is what ends the sub-state.
 *
 * SUBSTATE_TIMER is re-used here, and NOT as a countdown: this routine reads it as its own
 * three-way mode latch.
 *
 *   INIT (latch == 0) — one-shot setup, then FALL THROUGH into the per-frame body: clear both
 *     palette-bank latches, mark running (latch := 1), seed the item-state block (position
 *     divider, sprite toggle, anim timer, value = 30, display timer, position index), point
 *     the video cursor at the top of the value's column, locate the item's row in the
 *     player-slot table (four rows of stride 0x22, keyed on 2*ACTIVE_PLAYER_INDEX + 1), and
 *     render the item once. A key that matches no row leaves the pointer on the fourth row —
 *     the scan is not guarded.
 *
 *   RUNNING (latch != 0) — every frame, three stages:
 *     1. count the display timer down; on its wrap, tick the value. A value of 0 EXITs;
 *        otherwise the value is split into ones and tens and stamped into the two digit cells.
 *     2. step the position, driven by P1_INPUT. Bit 7 held runs the video-COLUMN walk, which
 *        stamps a glyph and retreats the cursor a column at a time and EXITs at position 0x1D;
 *        bit 7 clear runs a frame-divided step that moves the position index up or down
 *        through its 0..0x1D wrap and redraws the item at the new cell.
 *     3. animate the sprite; on the anim timer's expiry, toggle the digit source between the
 *        item's own slot record and a canned template, and repaint the six value digits.
 *
 *   EXIT — clear the item's slot, mark the latch done (0x80), decrement the sub-state (the
 *     phase step-back), copy a twelve-cell video column into the slot record, and post six
 *     follow-up tasks.
 *
 * WHAT THIS FILE DOES NOT SETTLE is whether the thing on display is the prize a player collects
 * by walking over it. The mechanics above are pinned, but an entire sub-state given over to a
 * value counting down, with the item's position driven by a player's input bits, is not
 * obviously that object; the name is inherited rather than derived here.
 *
 * The item-state cells carry LOCAL role names, valid only inside this file: those bytes are
 * scratch that other parts of the game use for unrelated purposes, so they get no shared name.
 * The palette-bank latches are hardware outputs rather than work RAM.
 *
 * LIVE-OUT: memory-only.
 */
import { SUBSTATE_TIMER, P1_INPUT, GAME_SUBSTATE, PLAYER_SLOT_RECORDS, ACTIVE_PLAYER_INDEX } from "./names.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";
import { positionBonusItemSprite } from "./positionBonusItemSprite.js";
import { renderBcdColumn } from "./renderBcdColumn.js";
import { enqueueTask } from "./enqueueTask.js";

// -- Item-state block: LOCAL role labels for cells that carry no shared name. --
const POS_RELOAD = 0x6030;    // frame divider between position steps (reload 0x0A)
const SPRITE_TOGGLE = 0x6031; // alternates the 6-digit sprite's source each anim tick
const ANIM_TIMER = 0x6032;    // frames until the next sprite animate (reload 0x10)
const VALUE = 0x6033;         // the item's point value, counts down from 0x1E (30)
const DISPLAY_TIMER = 0x6034; // frames between value ticks (reload 0x3E)
const POS_INDEX = 0x6035;     // grid position index, 0..0x1D
const VIDEO_PTR = 0x6036;     // 16-bit VRAM cursor for the value's column walk
const SLOT_PTR = 0x6038;      // 16-bit ptr to the item's row in the player-slot table
const SLOT_COL_PTR = 0x603a;  // 16-bit ptr = SLOT_PTR - 0x0D, the exit-copy destination

// -- Video and hardware cells, none of which are work RAM. --
const PALETTE_BANK_LO = 0x7d86; // palette-bank latch bit 0 (a hardware output)
const PALETTE_BANK_HI = 0x7d87; // palette-bank latch bit 1 (a hardware output)
const VALUE_ONES_CELL = 0x7552; // VRAM cell for the value's ones digit
const VALUE_TENS_CELL = 0x7572; // VRAM cell for the value's tens digit
const VIDEO_BASE = 0x75e8;      // top of the value's video column
const COL_LOW_SENTINEL = 0x7588; // column-walk floor: no stamp when the ptr is already here
const COL_HIGH_SENTINEL = 0x7608; // column-walk ceiling: advancing to here wraps to VIDEO_BASE

/** RLCA: rotate an 8-bit value left circularly (bit 7 -> bit 0). */
function rotl8(v) {
  return ((v << 1) | (v >> 7)) & 0xff;
}

export function runBonusItemValueDisplay(m) {
  const { regs, mem } = m;

  drawCreditDisplay(m); // repaint the credit line

  // ---- INIT (SUBSTATE_TIMER == 0): one-shot setup, then fall into the per-frame body. ----
  if (mem.read8(SUBSTATE_TIMER) === 0) {
    mem.write8(PALETTE_BANK_LO, 0x00); // clear both palette-bank latches (bank %00)
    mem.write8(PALETTE_BANK_HI, 0x00);
    mem.write8(SUBSTATE_TIMER, 0x01);  // mark running
    mem.write8(POS_RELOAD, 0x0a);
    mem.write8(SPRITE_TOGGLE, 0x00);
    mem.write8(ANIM_TIMER, 0x10);
    mem.write8(VALUE, 0x1e);           // value = 30
    mem.write8(DISPLAY_TIMER, 0x3e);
    mem.write8(POS_INDEX, 0x00);
    mem.write16(VIDEO_PTR, VIDEO_BASE);

    // Locate the item's slot row: scan 4 rows of stride 0x22 for key = 2*ACTIVE_PLAYER_INDEX+1.
    // No match leaves the pointer at the 4th row — the scan is not guarded.
    const key = (rotl8(mem.read8(ACTIVE_PLAYER_INDEX)) + 1) & 0xff;
    let slot = PLAYER_SLOT_RECORDS;
    for (let i = 0; i < 4; i++) {
      if (mem.read8(slot) === key) break;
      slot = (slot + 0x22) & 0xffff;
    }
    mem.write16(SLOT_PTR, slot);
    mem.write16(SLOT_COL_PTR, (slot - 0x0d) & 0xffff);

    regs.b = 0x00;
    regs.c = mem.read8(POS_INDEX); // C = position index (0)
    positionBonusItemSprite(m);    // draw the item at its cell
  }

  // ---- Stage 1: display-timer countdown; on wrap tick the value; value 0 -> EXIT. ----
  const displayTimer = (mem.read8(DISPLAY_TIMER) - 1) & 0xff;
  mem.write8(DISPLAY_TIMER, displayTimer);
  if (displayTimer === 0) {
    mem.write8(DISPLAY_TIMER, 0x3e); // reload
    const value = (mem.read8(VALUE) - 1) & 0xff;
    mem.write8(VALUE, value);
    if (value === 0) {
      exitBonusItemDisplay(m);
      return;
    }
    // BCD-split the value into its ones and tens digit cells.
    let ones = value;
    let tens = 0;
    while (ones >= 0x0a) {
      ones -= 0x0a;
      tens = (tens + 1) & 0xff;
    }
    mem.write8(VALUE_ONES_CELL, ones);
    mem.write8(VALUE_TENS_CELL, tens);
  }

  // ---- Stage 2: position step, driven by P1_INPUT. ----
  const savedDivider = mem.read8(POS_RELOAD);
  mem.write8(POS_RELOAD, 0x0a); // reload the frame divider
  const input = mem.read8(P1_INPUT);

  if (input & 0x80) {
    // Video-COLUMN walk. Position 0x1D ends the item; 0x1C advances the column; anything
    // else stamps this frame's value glyph and retreats the column pointer.
    const pos = mem.read8(POS_INDEX);
    if (pos === 0x1d) {
      exitBonusItemDisplay(m);
      return;
    }
    if (pos === 0x1c) {
      // Advance the video pointer one column (0x20); at the ceiling wrap to the base.
      const cur = mem.read16(VIDEO_PTR);
      const next = (cur + 0x20) & 0xffff;
      if (next === COL_HIGH_SENTINEL) {
        mem.write8(VIDEO_BASE, 0x10);
        mem.write16(VIDEO_PTR, VIDEO_BASE);
      } else {
        mem.write8(next, 0x10);
        mem.write16(VIDEO_PTR, next);
      }
    } else {
      // Unless the pointer is already at the floor, stamp (pos + 0x11) and retreat 0x20.
      const cur = mem.read16(VIDEO_PTR);
      if (cur !== COL_LOW_SENTINEL) {
        mem.write8(cur, (pos + 0x11) & 0xff);
        mem.write16(VIDEO_PTR, (cur - 0x20) & 0xffff);
      }
    }
  } else if (input & 0x03) {
    // Low-2-bit step: count the frame divider down; only on its expiry move the item.
    const divider = (savedDivider - 1) & 0xff;
    if (divider !== 0) {
      mem.write8(POS_RELOAD, divider); // still counting down — no move this frame
    } else {
      let pos;
      if (input & 0x02) {
        // Move down: position - 1; underflow (below 0) wraps to 0x1D.
        const dec = (mem.read8(POS_INDEX) - 1) & 0xff;
        pos = (dec & 0x80) ? 0x1d : dec;
      } else {
        // Move up: position + 1; reaching 0x1E wraps to 0.
        const inc = (mem.read8(POS_INDEX) + 1) & 0xff;
        pos = inc === 0x1e ? 0x00 : inc;
      }
      mem.write8(POS_INDEX, pos);
      regs.b = 0x00;
      regs.c = pos;
      positionBonusItemSprite(m); // redraw at the new cell
    }
  } else {
    // No direction held: reset the frame divider to 1.
    mem.write8(POS_RELOAD, 0x01);
  }

  // ---- Stage 3: sprite animate. On timer expiry, toggle the source and redraw 6 digits. ----
  const animTimer = (mem.read8(ANIM_TIMER) - 1) & 0xff;
  mem.write8(ANIM_TIMER, animTimer);
  if (animTimer !== 0) return;

  let source;
  if (mem.read8(SPRITE_TOGGLE) !== 0) {
    mem.write8(SPRITE_TOGGLE, 0x00);
    source = (mem.read16(SLOT_PTR) + 3) & 0xffff; // digit source = slot record + 3
  } else {
    mem.write8(SPRITE_TOGGLE, 0x01);
    source = 0x01bf; // the canned digit template
  }
  const iy = mem.read16(SLOT_PTR);
  const dest = mem.read8((iy + 4) & 0xffff) | (mem.read8((iy + 5) & 0xffff) << 8);
  regs.de = source; // renderBcdColumn: DE = source pointer, IX = destination cell
  regs.ix = dest;
  renderBcdColumn(m); // paint the 6 value digits up the column
  mem.write8(ANIM_TIMER, 0x10); // reload the anim timer
}

/**
 * EXIT / cleanup: tear the item down, step the phase machine back one, copy
 * a 12-cell video column into the item's slot record, and post the follow-up tasks.
 */
function exitBonusItemDisplay(m) {
  const { regs, mem } = m;

  mem.write8(mem.read16(SLOT_PTR), 0x00);                          // clear the item slot
  mem.write8(SUBSTATE_TIMER, 0x80);                                // mark done
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) - 1) & 0xff); // phase step-back

  // Copy 12 cells from the video column (the base, walking UP by 0x20) into the slot record.
  const dst = mem.read16(SLOT_COL_PTR);
  for (let i = 0; i < 0x0c; i++) {
    mem.write8((dst + i) & 0xffff, mem.read8((VIDEO_BASE - 0x20 * i) & 0xffff));
  }

  // Post the follow-up tasks: opcode 3 with args 0x14..0x18, then the same opcode with 0x1A.
  for (let arg = 0x14; arg <= 0x18; arg++) {
    regs.de = 0x0300 | arg;
    enqueueTask(m);
  }
  regs.de = 0x031a;
  enqueueTask(m);
}

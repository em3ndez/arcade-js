// SPDX-License-Identifier: GPL-3.0-only
/**
 * runBonusItemValueDisplay — drive the on-board bonus item: its position walk, its
 * animated sprite, and the countdown value shown beside it.  ROM 0x1486.
 *
 * The GAME_SUBSTATE (0x600A) phase-21 handler — entry 21 (0x15) of loc_06fe's rst-0x28
 * sub-state table, dispatched while GAME_STATE == 3 and GAME_SUBSTATE == 21. It runs the
 * collectible bonus item (parasol / hat / bag) that rides a board: it advances the item's
 * grid position (via positionBonusItemSprite), animates its sprite, and paints the
 * decrementing point value in the on-screen digit cells and the 6-digit sprite. When the
 * value runs out (or the column walk reaches its end) it tears the item down and steps the
 * phase machine back.
 *
 * It re-uses SUBSTATE_TIMER(0x6009) — NOT here as the rst-0x18 countdown, but as its own
 * three-way mode latch:
 *
 *   INIT (0x6009 == 0), one-shot setup, then FALL INTO the per-frame body:
 *     clear both palette-bank latches, mark running (0x6009:=1), seed the item-state block
 *     (position reload / sprite toggle / anim timer / value=30 / display timer / position
 *     index), set the video pointer to 0x75E8, locate the item's slot row in
 *     PLAYER_SLOT_RECORDS (0x611C, stride 0x22; key = 2*ACTIVE_PLAYER_INDEX (0x600E)+1;
 *     this routine scans 4 rows), and render the item once.
 *
 *   RUNNING (0x6009 != 0), every frame, three stages:
 *     1. display-timer countdown (0x6034); on wrap, tick the value (0x6033) — value 0 EXITs
 *        — else BCD-split it into the ones/tens digit cells 0x7552 / 0x7572.
 *     2. position step driven by P1_INPUT(0x6010): bit 7 -> the video-column walk (walks the
 *        video pointer 0x6036, EXITs at position 0x1D); bit 7 clear -> a frame-divider step
 *        that inc/decrements the position index (0..0x1D wrap) and re-renders the item.
 *     3. sprite animate (0x6032); on expiry toggle 0x6031 and redraw the 6 value digits.
 *
 *   EXIT / cleanup: clear the item slot, mark done (0x6009:=0x80), decrement GAME_SUBSTATE
 *     (the phase step-back), copy a 12-cell video column into the slot record, and enqueue
 *     follow-up tasks 0x0314..0x0318 + 0x031A.
 *
 * The ROM's main loop is an irreducible CFG (backward cross-jumps 0x1543->0x152D,
 * 0x1587->0x1580, 0x15C3->0x15A0); each of those is just two branches converging on a
 * shared tail, so it reads as ordinary structured JS here rather than a label switch.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1486.test.js.
 * GATE:     crafted-entry. Attract NEVER dispatches 0x1486 (0 over 2000 frames — the bonus
 *           item is gameplay-only), so every case is a real booted+attract machine with a
 *           surgical poke: the INIT arm, each RUNNING arm (both value-tick branches, the
 *           bit-7 column walk incl. wrap + no-op-at-0x7588, the low-bit up/down step with
 *           its 0/0x1D wraps, the no-direction reset, and the sprite-animate toggle both
 *           ways), and both EXIT triggers. Diffed oracle-vs-idiomatic on RAM (minus
 *           STACK_SCRATCH) + pc + SP, fresh clone per case. Teeth: a wrong phase-step twin
 *           (0x600A += 1 instead of -= 1) and a wrong-digit-cell twin, both caught.
 * LIVE-OUT: memory-only. The routine ends in a plain `ret` and its caller (loc_06fe's
 *           rst-0x28 `jp (hl)` tail) consumes no register or flag it leaves, so the oracle's
 *           residual A/F/BC/DE/HL/IX/IY are all dead ABI and are NOT compared. pc + SP ARE
 *           compared: the idiomatic routine models the Z80 `ret` as a plain JS return (the
 *           dropped stack becomes the JS call stack), so the harness applies one m.ret()
 *           after the call to line pc + SP up with the oracle's single net caller-return pop.
 * NAMES:    SUBSTATE_TIMER (0x6009, re-used as the mode latch), P1_INPUT (0x6010),
 *           GAME_SUBSTATE (0x600A), PLAYER_SLOT_RECORDS (0x611C, the item-slot table:
 *           stride-0x22 rows keyed by 2*ACTIVE_PLAYER_INDEX+1) and ACTIVE_PLAYER_INDEX
 *           (0x600E) from ram.js. The item-state block (0x6030-0x6036, 0x6038, 0x603A) is
 *           ram.js "board/animation scratch" — deliberately UNNAMED there because it is
 *           shared across the game — so it is labelled with LOCAL role constants (valid
 *           only inside this routine), not promoted to global names. The palette-bank latches
 *           0x7D86/0x7D87 are hardware outputs (ls259.6h), not work RAM. The digit cells
 *           0x7552/0x7572 and the video base 0x75E8 / sentinels 0x7588/0x7608 are ROM / VRAM
 *           literals kept hex.
 */
import { SUBSTATE_TIMER, P1_INPUT, GAME_SUBSTATE, PLAYER_SLOT_RECORDS, ACTIVE_PLAYER_INDEX } from "./ram.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";           // ROM 0x0616
import { positionBonusItemSprite } from "./positionBonusItemSprite.js"; // ROM 0x15fa
import { renderBcdColumn } from "./renderBcdColumn.js";               // ROM 0x057c
import { enqueueTask } from "./enqueueTask.js";                       // ROM 0x309f

// -- Item-state block: LOCAL role labels for ram.js-unnamed board/animation scratch. --
const POS_RELOAD = 0x6030;    // frame divider between position steps (reload 0x0A)
const SPRITE_TOGGLE = 0x6031; // alternates the 6-digit sprite's source each anim tick
const ANIM_TIMER = 0x6032;    // frames until the next sprite animate (reload 0x10)
const VALUE = 0x6033;         // the item's point value, counts down from 0x1E (30)
const DISPLAY_TIMER = 0x6034; // frames between value ticks (reload 0x3E)
const POS_INDEX = 0x6035;     // grid position index, 0..0x1D
const VIDEO_PTR = 0x6036;     // 16-bit VRAM cursor for the value's column walk
const SLOT_PTR = 0x6038;      // 16-bit ptr to the item's row in the 0x611C table
const SLOT_COL_PTR = 0x603a;  // 16-bit ptr = SLOT_PTR - 0x0D, the exit-copy destination

// -- ROM / VRAM / hardware literals (not work RAM, so none are ram.js names). --
const PALETTE_BANK_LO = 0x7d86; // ls259.6h palette-bank latch bit 0 (hardware output)
const PALETTE_BANK_HI = 0x7d87; // ls259.6h palette-bank latch bit 1 (hardware output)
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

  drawCreditDisplay(m); // ROM 0x0616 — repaint the credit line

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

    // Locate the item's slot row in PLAYER_SLOT_RECORDS: scan 4 rows of stride 0x22 for
    // key = 2*ACTIVE_PLAYER_INDEX+1. No match leaves the pointer at the 4th row (the ROM does not guard).
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
    positionBonusItemSprite(m);    // ROM 0x15fa — draw the item at its cell
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
    // BCD-split the value: ones digit -> 0x7552, tens digit -> 0x7572.
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
      positionBonusItemSprite(m); // ROM 0x15fa — redraw at the new cell
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
  renderBcdColumn(m); // ROM 0x057c — paint the 6 value digits up the column
  mem.write8(ANIM_TIMER, 0x10); // reload the anim timer
}

/**
 * EXIT / cleanup (ROM 0x15C6): tear the item down, step the phase machine back one, copy
 * a 12-cell video column into the item's slot record, and post the follow-up tasks.
 */
function exitBonusItemDisplay(m) {
  const { regs, mem } = m;

  mem.write8(mem.read16(SLOT_PTR), 0x00);                          // clear the item slot
  mem.write8(SUBSTATE_TIMER, 0x80);                                // mark done
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) - 1) & 0xff); // phase step-back

  // Copy 12 cells from the video column (0x75E8 walking UP by 0x20) into the slot record.
  const dst = mem.read16(SLOT_COL_PTR);
  for (let i = 0; i < 0x0c; i++) {
    mem.write8((dst + i) & 0xffff, mem.read8((VIDEO_BASE - 0x20 * i) & 0xffff));
  }

  // Enqueue follow-up tasks 0x0314..0x0318 (opcode 0x03, args 0x14..0x18), then 0x031A.
  for (let arg = 0x14; arg <= 0x18; arg++) {
    regs.de = 0x0300 | arg;
    enqueueTask(m); // ROM 0x309f
  }
  regs.de = 0x031a;
  enqueueTask(m); // ROM 0x309f
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepSpriteAnimationSequence — advance one step of the 0x6388-driven sprite
 * animation sequence: a throttled two-frame flap whose 256-tick sub-counter, on
 * wrap, restamps the base figure and hands off to the next sequence step.  ROM 0x1839.
 *
 * This is index 2 of the six-entry rst-0x28 sequence dispatched by loc_1644 (ROM
 * 0x1644: `ld a,(0x6388) / rst 0x28`, table 0x1648) — a small state machine keyed on
 * the selector byte at 0x6388, whose siblings each render one stage and then advance
 * 0x6388 to the next (loc_17b6 idx 0 seeds it, loc_186f idx 3 / loc_1880 idx 4 follow,
 * loc_18c6 idx 5 resets it and hands GAME_SUBSTATE = 8). This step is the animated
 * hold before that hand-off. Each call:
 *
 *   1. Bumps a per-call sub-counter at 0x6390 (8-bit wrap). Most of the time nothing
 *      more happens.
 *   2. On every EIGHTH call (low three bits zero) it stamps one animation frame: it
 *      block-copies a 40-byte / ten-record sprite-object template from ROM into
 *      SPRITE_OBJ_BLOCK (loadSpriteObjectBlock), then shifts the X column of all ten
 *      records right by 0x44 (addToSpriteObjectColumn). Bit 3 of the counter selects
 *      between two templates — 0x39CF and 0x39F7 — so the figure alternates between two
 *      frames every eight ticks: a two-frame flap at 1/8 rate.
 *   3. On the counter's WRAP (0xFF -> 0x00, once per 256 calls) it instead stamps the
 *      base figure (template 0x385C — the same figure sub_1654 stamps at sequence
 *      start), re-arms the sub-state hold timer (SUBSTATE_TIMER = 0x20), and advances
 *      the sequence selector (0x6388++) so the NEXT frame dispatches the next step.
 *
 * Both stamp paths share one idiom: load a fixed ROM template over the whole
 * sprite-object block, then bias its X column by 0x44. The template address is the
 * only thing that varies (frame A / frame B / base). The callees are the already-
 * decompiled idiomatic primitives; this routine marshals HL/C for them via the register
 * seam exactly as the oracle does (they still read the Z80 register ABI).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1839.test.js.
 * GATE:     exhaustive over the input surface — 0x1839 is UNREACHED in attract (0
 *           dispatches / 4000 frames; it is a post-board interlude step), so entries
 *           are crafted from a real attract RAM base. The only inputs are the 0x6390
 *           sub-counter and the 0x6388 selector, so the sweep is exhaustive: all 256
 *           0x6390 values (drives the early return, both frame arms, and the wrap) x a
 *           real base, plus all 256 0x6388 values on the wrap arm. Teeth: a twin that
 *           reads the wrong counter bit (bit 4, not bit 3) for the frame select.
 * LIVE-OUT: memory-only — 0x6390 (always), and on a stamp the ten SPRITE_OBJ_BLOCK
 *           records; on wrap also SUBSTATE_TIMER (0x6009) and the 0x6388 selector. The
 *           successor is the sequence dispatcher's return path, which reads none of the
 *           residual A/HL/DE/BC/flags the oracle leaves — dead ABI, backstopped by the
 *           whole-RAM gate. SP/PC are not compared (the idiomatic layer drops the
 *           `ret`'s stack/PC bookkeeping; the JS call stack replaces it).
 * NAMES:    SUBSTATE_TIMER (0x6009), SPRITE_OBJ_BLOCK (0x6908) — ram.js. 0x6390 (the
 *           sub-counter) and 0x6388 (the selector) stay hex: ram.js leaves both
 *           unnamed as shared engine-scratch bytes.
 */
import { SUBSTATE_TIMER, SPRITE_OBJ_BLOCK } from "../optimized/ram.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)

const ANIM_COUNTER = 0x6390; // per-call sub-counter; wraps 0xFF->0x00 every 256 calls
const SEQ_SELECTOR = 0x6388; // this sequence's rst-0x28 step index (dispatched by loc_1644)

// ROM sprite-object-block templates (each 40 bytes = ten 4-byte hardware sprite records).
const FRAME_A = 0x39cf; // animation frame A — counter bit 3 SET
const FRAME_B = 0x39f7; // animation frame B — counter bit 3 CLEAR
const BASE_FIGURE = 0x385c; // the sequence-start / wrap figure (also stamped by sub_1654)

const X_COLUMN_SHIFT = 0x44; // added into the X byte of all ten records after each stamp
const HOLD_FRAMES = 0x20; // sub-state hold timer re-armed on wrap

// Stamp one ten-record figure: copy the ROM template over SPRITE_OBJ_BLOCK, then bias
// the X column of all ten records right by 0x44. HL/C are marshalled for the callees.
function stampFigure(m, templateAddr) {
  const { regs } = m;
  regs.hl = templateAddr; // source for the block copy (HL is loadSpriteObjectBlock's input)
  loadSpriteObjectBlock(m); // ROM 0x004e — 40-byte template -> SPRITE_OBJ_BLOCK
  regs.hl = SPRITE_OBJ_BLOCK; // 0x6908 — X byte of record 0
  regs.c = X_COLUMN_SHIFT; // 0x44
  addToSpriteObjectColumn(m); // ROM 0x0038 (rst 0x38) — X column += 0x44, all ten records
}

export function stepSpriteAnimationSequence(m) {
  const { mem } = m;

  // Bump the per-call sub-counter (8-bit wrap). Wrap (0xFF -> 0x00) is the hand-off tick.
  const counter = (mem.read8(ANIM_COUNTER) + 1) & 0xff;
  mem.write8(ANIM_COUNTER, counter);

  if (counter === 0) {
    // WRAP: stamp the base figure, re-arm the hold timer, advance to the next step.
    stampFigure(m, BASE_FIGURE);
    mem.write8(SUBSTATE_TIMER, HOLD_FRAMES); // 0x6009 = 0x20
    mem.write8(SEQ_SELECTOR, (mem.read8(SEQ_SELECTOR) + 1) & 0xff); // 0x6388++ -> next step
    return;
  }

  // Not the eighth call -> nothing to draw this frame.
  if ((counter & 0x07) !== 0) return;

  // Every eighth call: stamp one of two alternating frames (counter bit 3 selects).
  stampFigure(m, (counter & 0x08) !== 0 ? FRAME_A : FRAME_B);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardScorePopup — award points and stage the floating score glyph over Mario.  ROM 0x1E28.
 *
 * The "you scored" effect. Reached from loc_3e70, which picks one of three tiers by
 * the low bits of an animation-state byte and hands this routine a matched pair:
 * an award index E (1 / 3 / 5) and a glyph tile B (0x7B / 0x7D / 0x7F). The three
 * tiers move together — a bigger award selects a bigger number sprite — which is
 * what makes this a score POPUP rather than a bare award. (Captured live: a
 * barrel-jump on 25m dispatches it with E=1, B=0x7B — the classic 100-point jump.)
 *
 * It does three things:
 *
 *   1. POST THE AWARD. Enqueue a task carrying the live-in D/E pair. D is the task
 *      opcode (0 = add-to-score) and E the award-table index, so the main loop later
 *      credits the player. This is the shared task-ring primitive (enqueueTask).
 *   2. STAGE THE GLYPH SPRITE. Write a 4-byte hardware sprite record at POPUP_SPRITE
 *      (0x6A30, a fixed slot inside SPRITE_BUFFER): X = Mario's X, code = the glyph
 *      tile B, attr = 7, Y = Mario's Y + 0x14 (0x14 px below him). The field order
 *      X/code/attr/Y is the standard sprite-record layout, so the number appears at
 *      Mario's column.
 *   3. PING THE SOUND, on some boards only. Load the per-board applicability mask
 *      0x05 (bit0 = 25m, bit2 = 75m) and consult the `rst 0x30` board gate
 *      (boardBitGate): on 25m/75m it fires the award sound SND_TRIGGER[5]; on
 *      50m/100m the gate is closed and the routine returns without the sound.
 *
 * Callees are called directly (bottom-up): enqueueTask (ROM 0x309F) reads the live-in
 * D/E and needs no marshalling; boardBitGate (ROM 0x0030) reads its mask from A, so A
 * is set to 0x05 just before the call (the only register hand-off). loc_1e28's own
 * `ret` at 0x1E49 IS the shared loc_1e49 byte — modelled here as the plain function
 * return, not a call.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e28.test.js.
 * GATE:     crafted-entry — the one real 25m attract dispatch (the continue/sound arm,
 *           BOARD==1) + crafted arms attract never reaches: the other two tiers
 *           (E=3/B=0x7D, E=5/B=0x7F) and every board (BOARD 2/4 close the gate → no
 *           sound; BOARD 3 opens it), each poked identically on both sides.
 * LIVE-OUT: memory-only — the task ring + tail, the four POPUP_SPRITE bytes, and
 *           (sound arm only) SND_TRIGGER[5]. The exit is a tail-jump chain
 *           (loc_3e70 → the rst-0x28 state dispatcher at sub_1dbd) that reloads its
 *           own state and reads none of this routine's residual A/B/C/HL/flags — all
 *           dead ABI; SP/PC are the dropped stack model (the oracle's push/call/ret),
 *           so idiomatic leaves them at their entry values.
 * NAMES:    MARIO_X (0x6203), MARIO_Y (0x6205), SPRITE_BUFFER (0x6900),
 *           SND_TRIGGER (0x6080) from ram.js. POPUP_SPRITE (0x6A30) kept as the
 *           fixed sprite slot = SPRITE_BUFFER + 0x130 (record 76). 0x14 = the
 *           below-Mario Y offset; 0x05 = the 25m|75m board mask; 0x07 = the sprite
 *           colour/attr byte; 3 = the SND_TRIGGER assert length in frames.
 */

import { MARIO_X, MARIO_Y, SPRITE_BUFFER, SND_TRIGGER } from "./ram.js";
import { enqueueTask } from "./enqueueTask.js";
import { boardBitGate } from "./boardBitGate.js";

const POPUP_SPRITE = SPRITE_BUFFER + 0x130; // 0x6A30 — the score-glyph sprite record (record 76)
const POPUP_Y_OFFSET = 0x14;                // glyph sits 0x14 px below Mario
const SOUND_BOARD_MASK = 0x05;              // bit0 = 25m, bit2 = 75m — boards that play the sound
const AWARD_SOUND = SND_TRIGGER + 5;        // 0x6085 — the score-award sound trigger
const SND_ASSERT_FRAMES = 3;                // a 3-frame assert
const SPRITE_ATTR = 0x07;                   // the glyph sprite's colour/attribute byte

export function awardScorePopup(m) {
  const { regs, mem } = m;

  // (1) Post the score-award task. D = opcode (0 = add-to-score), E = award index —
  // both live-in from loc_3e70; enqueueTask reads them, no marshalling needed.
  enqueueTask(m);

  // (2) Stage the floating score glyph as a sprite record at Mario's column.
  const popupY = (mem.read8(MARIO_Y) + POPUP_Y_OFFSET) & 0xff;
  mem.write8(POPUP_SPRITE + 0, mem.read8(MARIO_X)); // X = Mario's X
  mem.write8(POPUP_SPRITE + 1, regs.b);             // tile code = the points glyph (live-in)
  mem.write8(POPUP_SPRITE + 2, SPRITE_ATTR);        // colour/attr
  mem.write8(POPUP_SPRITE + 3, popupY);             // Y = Mario's Y + 0x14

  // (3) On boards whose bit is set in the mask (25m + 75m), ping the award sound.
  // boardBitGate reads the mask from A; set it, then let the gate select this board's
  // bit. Gate closed (50m/100m) -> return without the sound (the caller-skip idiom).
  regs.a = SOUND_BOARD_MASK;
  if (!boardBitGate(m)) return;
  mem.write8(AWARD_SOUND, SND_ASSERT_FRAMES);
}

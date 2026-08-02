// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d8c — the string renderer's 0x7F terminator: reinitialise the object record it
 * was building and reload the ten-record sprite-object block.  ROM 0x2D8C.
 *
 * The renderer (loc_2d15 -> loc_2d54) walks a character string, writing 4-byte sprite
 * records, until it meets the 0x7F terminator byte; that jump lands here to CLOSE OUT
 * the object. The caller leaves the object record's base in the index register and the
 * renderer's destination pointer (RENDER_DST_PTR) in the pair register. This routine:
 *   - Rewinds the string source pointer (RENDER_STR_PTR) back to the string's start.
 *   - Stamps the record's control fields: an enable/mode byte at +1 chosen from bit0 of
 *     BARREL_CLAIM_MODE — bit0 SET keeps mode 1, bit0 CLEAR selects mode 0 and marks +2
 *     with 2 — then a fixed 1 at +0 and +0x0F, a zeroed sub-block +0x10..+0x14, and clears
 *     two engine-scratch bytes (0x6392, 0x6393).
 *   - Copies two bytes out of the renderer's destination pointer into the record's +3
 *     and +5 fields (the byte there, then the byte three positions on).
 *   - Reloads the whole ten-record sprite-object block from the ROM template at 0x385C
 *     and adds -4 to every record's Y field.
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md): the record this routine closes out is a 25m BARREL record,
 * not a cutscene element. RENDER_OBJ_PTR — the pointer the caller hands in as this routine's
 * index register — held only OBJ_ARRAY_67 record bases (0x6700 / 0x6720 / 0x6740 / 0x6760 /
 * 0x6780 / 0x67A0 / 0x67C0, stride 0x20 = the 25m barrel array) across the run, matching the
 * index register at 46/46 dispatches of the chain's head loc_2cf6; every one of those 46 fell
 * at a gameplay substate (17 credited in-board 25m, 29 attract 25m demo) and ZERO at substate 7,
 * the opening Kong-climb cutscene, and each was paired 1:1 in the same frame with a slot claim
 * by the barrel-release routine (board 1, ROM 0x2CB8). An earlier version of this header framed
 * the chain as a cutscene renderer; that framing is REFUTED.
 *
 * NAME: kept loc_ — the field layout and the BARREL_CLAIM_MODE mode select are pinned to the
 * oracle, and grounding fixes the CONTEXT (it closes out an OBJ_ARRAY_67 barrel record on 25m).
 * What is still open is the NAMED identity of the two barrel kinds, which the grounding run
 * deliberately did not establish, so an English name would have to guess.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2d8c.test.js.
 * GATE:     crafted-entry; reached in attract (13 real dispatches / 3000 frames, both
 *           BARREL_CLAIM_MODE bit0 arms observed) + crafted entries forcing each mode arm and
 *           distinctive source bytes. The RAM diff excludes the dead STACK_SCRATCH the
 *           oracle's two dissolved call brackets (0x004E and rst 0x38) push into.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and its terminal `ret`
 *           are dead ABI — the caller (a render loop) reads none of them; the single
 *           terminal return is modelled in the gate, not here.
 * NAMES:    RENDER_STR_PTR (0x62A8); SPRITE_OBJ_BLOCK (0x6908) + SPRITE_Y (+3) for the
 *           Y column; BARREL_CLAIM_MODE (0x6382) — the barrel slot-claim mode byte, not a bare
 *           flag: its low bits carry the claim's mode value (observed 1, and 0x81 = mode 1 with
 *           bit 7 set), its bit 7 selects the barrel kind for loc_2cf6, and this routine reads
 *           its bit 0. All from ram.js. The object-record base comes from the caller (RENDER_OBJ_PTR), and the
 *           fields this routine writes per-field are the ram.js-named OBJ_ACTIVE (+0, set to 1 to
 *           activate the record), OBJ_X (+3) and OBJ_Y (+5), copied from the destination sprite
 *           record's SPRITE_X / SPRITE_Y — all imported from ram.js. The remaining fixed control
 *           bytes it stamps (+0x0F, +0x10) have no ram.js name and stay hex; the
 *           (0x6392/0x6393) scratch bytes are unnamed engine scratch, kept hex.
 */

import { RENDER_STR_PTR, SPRITE_OBJ_BLOCK, SPRITE_Y, BARREL_CLAIM_MODE,
         OBJ_ACTIVE, OBJ_X, OBJ_Y } from "./ram.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004E
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)

const STRING_RESTART = 0x39c3; // string source rewound to the first byte
const SCRATCH_A = 0x6393; // cleared each terminator (shared engine scratch, unnamed)
const SCRATCH_B = 0x6392; // cleared each terminator (shared engine scratch, unnamed)
const SPRITE_TEMPLATE = 0x385c; // ROM template reloaded into the sprite-object block
const Y_COLUMN_DELTA = 0xfc; // -4, added to every record's Y field

export function loc_2d8c(m) {
  const { regs, mem } = m;

  const obj = regs.ix; // barrel record base (caller's RENDER_OBJ_PTR, an OBJ_ARRAY_67 record)
  const renderPtr = regs.de; // renderer's destination pointer (caller's RENDER_DST_PTR)

  // Rewind the string source pointer to the start of the string.
  mem.write16(RENDER_STR_PTR, STRING_RESTART);

  // Record mode byte (+1), selected by bit0 of the slot-claim mode byte: SET keeps mode 1;
  // CLEAR selects mode 0 and additionally marks +2 with 2.
  if ((mem.read8(BARREL_CLAIM_MODE) & 0x01) !== 0) {
    mem.write8(obj + 0x01, 0x01);
  } else {
    mem.write8(obj + 0x01, 0x00);
    mem.write8(obj + 0x02, 0x02);
  }

  // Fixed control fields, a zeroed sub-block, and clear the two engine-scratch bytes.
  mem.write8(obj + OBJ_ACTIVE, 0x01);
  mem.write8(obj + 0x0f, 0x01);
  mem.write8(obj + 0x10, 0x00);
  mem.write8(obj + 0x11, 0x00);
  mem.write8(obj + 0x12, 0x00);
  mem.write8(obj + 0x13, 0x00);
  mem.write8(obj + 0x14, 0x00);
  mem.write8(SCRATCH_A, 0x00);
  mem.write8(SCRATCH_B, 0x00);

  // Copy the destination sprite record's position into the object record: SPRITE_X (+0, the
  // byte renderPtr points at) into OBJ_X, and SPRITE_Y into OBJ_Y.
  mem.write8(obj + OBJ_X, mem.read8(renderPtr));
  mem.write8(obj + OBJ_Y, mem.read8(renderPtr + SPRITE_Y));

  // Reload the ten-record sprite-object block from its ROM template, then add -4 to the
  // whole block's Y column. Both callees still take their inputs in registers, so load
  // exactly what the oracle's call sites do.
  regs.hl = SPRITE_TEMPLATE;
  loadSpriteObjectBlock(m); // ROM 0x004E — copies 40 bytes from HL into SPRITE_OBJ_BLOCK

  regs.hl = SPRITE_OBJ_BLOCK + SPRITE_Y; // 0x690B, the Y column
  regs.c = Y_COLUMN_DELTA; // -4
  addToSpriteObjectColumn(m); // ROM 0x0038 (rst 0x38) — adds C into all ten Y fields
}

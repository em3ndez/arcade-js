// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SLOT_LOOP_INDEX, SLOT_STATE, OBJ_DEPTH, loc_2f, TARGET_SEG, FRAME_COUNTER, ACTIVE_OBJECT_COUNT, COLOR_RAM_8 } from "./names.js";
import { seatShapeParamsAndEmit } from "./seatShapeParamsAndEmit.js";

/**
 * drawSlotShapeList — emit a shape vector for each of the twelve enemy slots. ROM 0xb75b.
 *
 * Role in the machine: the tube can hold up to twelve enemies at once, one per depth slot. Each
 * frame this routine walks all twelve slots and, for every occupied one, emits its shape into the
 * display list at that slot's target segment. Near slots (the eight closest) draw at a fixed size;
 * far slots (0x08..0x0b) get a size that pulses with the frame phase so distant enemies shimmer.
 * When the walk is done it latches the per-level rim colour into colour RAM.
 *
 * Behavior: seed the loop index SLOT_LOOP_INDEX (loc_37) = 0x0b and count high-to-low. Each pass
 * read entry SLOT_STATE+x (loc_2d3+x); a zero entry means the slot is empty and is skipped. For a
 * live entry, copy it into OBJ_DEPTH (loc_57) and loc_2f (the depth params the emitter reads), fetch
 * the slot's target segment TARGET_SEG+x (loc_2ad+x), pick the size byte — 0x08 for near slots
 * (x < 8), else ((FRAME_COUNTER<<1 & 0x06) + 0x20) derived from the phase counter for far slots —
 * and emit via seatShapeParamsAndEmit(a, target). Decrement the index (mod 256); the loop ends when
 * it goes negative (bit 7 set), i.e. it has passed 0. Finally read stage ACTIVE_OBJECT_COUNT (loc_135)
 * and latch a rim colour into COLOR_RAM_8 (0x808): 0x04 below stage 6, 0x0b below 8, else 0x0c.
 *
 * Live-out: OBJ_DEPTH/loc_2f and the display list grown per slot; SLOT_LOOP_INDEX left at its
 * terminal negative value; COLOR_RAM_8 holds the per-level segment colour. Grounding: [seen]
 */
export function drawSlotShapeList(m) {
  const { mem8 } = m;
  mem8[SLOT_LOOP_INDEX] = 0x0b;                       // walk slots 0x0b..0x00, high-to-low
  while (true) {
    const x = mem8[SLOT_LOOP_INDEX];
    const entry = mem8[u16(SLOT_STATE + x)];          // slot occupancy/depth byte (loc_2d3+x)
    if (entry !== 0) {                                // 0 = empty slot, skip
      mem8[OBJ_DEPTH] = entry;                        // depth params the emitter reads (loc_57)
      mem8[loc_2f] = entry;
      const y = mem8[u16(TARGET_SEG + x)];            // slot's target tube segment (loc_2ad+x)
      // Near slots use a fixed value; far slots derive one from the phase counter.
      const a = x >= 0x08 ? (((mem8[FRAME_COUNTER] << 1) & 0x06) + 0x20) & 0xff : 0x08;
      seatShapeParamsAndEmit(m, a, y);               // seat size/target and emit the shape
    }
    const next = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
    mem8[SLOT_LOOP_INDEX] = next;
    if (next & 0x80) break;                           // dropped below 0 → done
  }
  // Latch a level byte selected by the current stage value.
  const level = mem8[ACTIVE_OBJECT_COUNT];            // stage index (loc_135)
  mem8[COLOR_RAM_8] = level < 0x06 ? 0x04 : level < 0x08 ? 0x0b : 0x0c;
}

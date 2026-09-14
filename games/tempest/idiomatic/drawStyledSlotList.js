// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SPIKE_ACTIVE_FLAG, SLOT_LOOP_INDEX, ENEMY_DEPTH, OBJ_DEPTH, ENEMY_SLOT_FLAGS, DRAW_STYLE } from "./names.js";
import { dispatchSlotDrawHandler } from "./dispatchSlotDrawHandler.js";

/**
 * drawStyledSlotList — draw a per-slot vector record for the seven tube slots. ROM 0xb5ad.
 *
 * Role in the machine: Tempest's enemies (flippers, tankers, spikers) live in the seven
 * radial slots that ring the far end of the tube; each slot carries a control byte (its
 * enemy's depth/kind) and a paired flags byte (its draw style and shape selector). Once
 * per frame this routine turns the whole slot table into vector-generator records so the
 * monitor draws every occupied slot. A guard bit lets the spike/close-up pass suppress it.
 *
 * Behaviour: bail immediately if the spike guard SPIKE_ACTIVE_FLAG (0x106) has bit 7 set.
 * Otherwise seed the shared loop index SLOT_LOOP_INDEX at 6 and walk slots 6..0. For each
 * slot read its control byte ENEMY_DEPTH+x; skip empty slots (control 0). For a live slot
 * cache the control byte in OBJ_DEPTH (the depth the draw handler will project at), read the
 * paired flags byte ENEMY_SLOT_FLAGS+x, extract the style nibble (bits 4..3) into DRAW_STYLE,
 * and dispatch the handler chosen by the low three bits (doubled to a word index) — passing
 * the slot index x through so the handler can fetch that slot's geometry. Decrement the loop
 * index and stop when it rolls negative (past slot 0).
 *
 * Live-out: OBJ_DEPTH and DRAW_STYLE (consumed by the dispatched draw handler), SLOT_LOOP_INDEX
 * (left at its terminal 0xff), and the vector records the handlers append to the display list.
 *
 * Grounding: [seen].
 */
export function drawStyledSlotList(m) {
  const { mem8 } = m;
  if (mem8[SPIKE_ACTIVE_FLAG] & 0x80) return;       // spike/close-up pass suppresses the slot draw
  mem8[SLOT_LOOP_INDEX] = 0x06;                     // SLOT_LOOP_INDEX is the loop counter, seeded at 6
  while (true) {
    const x = mem8[SLOT_LOOP_INDEX];
    const ctrl = mem8[u16(ENEMY_DEPTH + x)];        // this slot's enemy control/depth byte
    if (ctrl !== 0) {                               // 0 == empty slot, nothing to draw
      mem8[OBJ_DEPTH] = ctrl;                       // hand the depth to the draw handler
      const paired = mem8[u16(ENEMY_SLOT_FLAGS + x)];
      mem8[DRAW_STYLE] = (paired & 0x18) >> 3;      // style nibble (bits 4..3) picks the colour/style
      dispatchSlotDrawHandler(m, (paired & 0x07) << 1, x); // low 3 bits -> doubled shape selector; x = slot
    }
    const dv = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;   // decrement and stop once it goes negative
    mem8[SLOT_LOOP_INDEX] = dv;
    if (dv & 0x80) break;
  }
}

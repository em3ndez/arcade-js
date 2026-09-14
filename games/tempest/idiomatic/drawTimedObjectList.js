// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, loc_40, loc_42, DRAW_STYLE, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, DEPTH_LO, DEPTH_HI,
  loc_9e, loc_9f, loc_a0, SPIKE_TABLE_GUARD, loc_11f, PLAYER_SEGMENT, loc_3fe,
} from "./names.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";
import { emitColoredShapeVector } from "./emitColoredShapeVector.js";

/**
 * drawTimedObjectList — draw the eight timed centre-of-tube objects, then age one counter. ROM 0xc54d.
 *
 * Role in the machine: at the far centre of the tube Tempest shows a rack of up to eight
 * transient objects (the spike/pulsar-style effects, gated by the spike table). They all draw
 * at a single forced far depth with a fixed screen point, so this routine temporarily pins the
 * projection cells, emits a coloured shape for every occupied slot, and restores the cells it
 * borrowed. A separate tail advances the player's segment animation when its timer is ripe.
 *
 * Behaviour: run the draw pass only while the guard SPIKE_TABLE_GUARD (0x115) is nonzero. Save
 * the three projection cells DEPTH_HI ($5f), DEPTH_LO ($5b) and loc_a0, then force them to the
 * fixed far-centre projection (DEPTH_HI=0xe8, DEPTH_LO=0xff, loc_a0=0x28). Seed the shared loop
 * index at 7 and walk slots 7..0. For each nonzero entry in the eight-byte table loc_3fe: seat
 * OBJ_DEPTH from the entry and place its point at the screen centre (PROJ_PT_Y=PROJ_PT_X=0x80).
 * Pick a colour mode into loc_9e — when loc_9f >= 5 use slot&7 (folding mode 7 to 4), otherwise
 * a flat 6 — and emit it as a tag-0x08 vector word. Set the style DRAW_STYLE = ((slot&3)<<1)+0x0a
 * and emit the coloured shape (emitColoredShapeVector). After the loop restore the three saved
 * cells. Tail (always evaluated): if loc_11f is 0 return; if the timer loc_42 < 0x15 return;
 * else bump the player-segment cell PLAYER_SEGMENT+loc_40 by one (advancing that animation).
 *
 * Live-out: the coloured shape records appended to the display list; the borrowed projection
 * cells DEPTH_HI/DEPTH_LO/loc_a0 restored to their prior values; and, when the tail fires,
 * PLAYER_SEGMENT+loc_40 incremented. OBJ_DEPTH, PROJ_PT_Y/PROJ_PT_X, loc_9e and DRAW_STYLE left as scratch.
 *
 * Grounding: [seen].
 */
export function drawTimedObjectList(m) {
  const { mem8 } = m;
  if (mem8[SPIKE_TABLE_GUARD] !== 0) {          // only draw while the spike table is active
    const save5f = mem8[DEPTH_HI];              // borrow the projection cells...
    const save5b = mem8[DEPTH_LO];
    const saveA0 = mem8[loc_a0];
    mem8[DEPTH_HI] = 0xe8;                       // ...and pin them to the fixed far-centre depth
    mem8[DEPTH_LO] = 0xff;
    mem8[loc_a0] = 0x28;
    // Walk the eight slots top-down; the shared index wraps past zero to end the pass.
    mem8[SLOT_LOOP_INDEX] = 0x07;
    for (;;) {
      const slot = mem8[SLOT_LOOP_INDEX];
      const entry = mem8[u16(loc_3fe + slot)];  // this timed object's control byte
      if (entry !== 0) {                        // 0 == empty slot
        mem8[OBJ_DEPTH] = entry;
        mem8[PROJ_PT_Y] = 0x80;                 // draw at the screen centre point
        mem8[PROJ_PT_X] = 0x80;
        let mode;
        if (mem8[loc_9f] >= 0x05) {             // late phase: per-slot colour, mode 7 folds to 4
          mode = slot & 0x07;
          if (mode === 0x07) mode = 0x04;
        } else {
          mode = 0x06;                          // early phase: flat colour 6
        }
        mem8[loc_9e] = mode;
        emitTaggedVectorWord(m, 0x08, mem8[loc_9e]);      // colour/mode vector word
        mem8[DRAW_STYLE] = u8(((slot & 0x03) << 1) + 0x0a); // style from the low slot bits
        emitColoredShapeVector(m);
      }
      mem8[SLOT_LOOP_INDEX] = u8(mem8[SLOT_LOOP_INDEX] - 1);
      if (mem8[SLOT_LOOP_INDEX] & 0x80) break;  // stop once the index rolls past 0
    }
    mem8[loc_a0] = saveA0;                       // restore the borrowed projection cells
    mem8[DEPTH_LO] = save5b;
    mem8[DEPTH_HI] = save5f;
  }
  // Tail: age the player-segment animation once its timer is ripe.
  if (mem8[loc_11f] === 0) return;
  if (mem8[loc_42] < 0x15) return;
  const k = mem8[loc_40];
  mem8[u16(PLAYER_SEGMENT + k)] = u8(mem8[u16(PLAYER_SEGMENT + k)] + 1);
}

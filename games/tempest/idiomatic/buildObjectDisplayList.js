// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, PLAYER_LEVEL_TBL, IRQ_HEARTBEAT, PROJ_PT_Y, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI,
  PROJ_OFS_X_LO, PROJ_OFS_X_HI, DRAW_CURSOR_LO, DRAW_CURSOR_HI, loc_9e, CHECKSUM_ACC,
  OBJECT_INDEX_TABLE, OBJECT_RECORD_TABLE, OBJ_DY_HI, OBJ_DY_LO, OBJ_DX_HI, OBJ_DX_LO,
} from "./names.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { layHeaderAndBuildRecord } from "./layHeaderAndBuildRecord.js";

/**
 * buildObjectDisplayList -- emit the vector display list for the moving objects. ROM 0xb498.
 *
 * Role in the machine: everything that flies in the tube -- enemies (flippers, tankers, spikers,
 * fuseballs), the player's shots, and their debris -- is drawn as vectors each frame. This routine
 * walks the object slot tables, converts each active object's world position into a screen-relative
 * coordinate word plus its two's-complement "shadow" (the beam return stroke that walks the vector
 * generator back to origin), and appends the whole run to the current display buffer through the draw
 * cursor DRAW_CURSOR_LO/HI. It caps the pass at 0x12 (18) drawn objects.
 *
 * Behavior: it primes the run count loc_9e, emits a leading tagged word (emitTaggedVectorWord 0x08/0x0c)
 * and a record header (layHeaderAndBuildRecord 0x66), sets the remaining-object budget PROJ_PT_Y to
 * 0x12, and points the slot scan SLOT_LOOP_INDEX at the top slot 0x3f. y is the byte cursor within the
 * current buffer page. Each iteration reads a slot's kind from OBJECT_RECORD_TABLE[idx]; a zero kind is
 * an empty slot (skipped). For a live object it captures the page base, then rotates the raw kind byte
 * left three times (feeding in a carry seeded from kind>=0x50, which also consumes an extra slot) to
 * lift the object's top bits into a 2-bit header code masked to 0x70 tag; the low 6 bits of kind become
 * the shape selector byte. It looks up the object record OBJECT_INDEX_TABLE[idx] and emits the X word
 * as OBJ_DX minus the camera offset PROJ_OFS_X (with borrow into the high byte, high byte masked to
 * 0x1f), then the Y word straight from OBJ_DY, stashing each into PROJ_X_LO/HI and PROJ_Y_LO/HI. Four
 * fixed bytes (0,0,0,0xa0) separate the forward stroke, after which it emits the negated (two's
 * complement) shadow of both coordinate words so the beam returns. When the cursor passes 0xf0 it backs
 * up one and flushes the page (advanceDisplayCursor), restarting y at 0. It stops when the 0x12 budget
 * PROJ_PT_Y underflows (bit7 set) or the slot scan SLOT_LOOP_INDEX underflows past 0.
 *
 * After the loop it flushes any partial page, and -- as a difficulty/anti-tamper poke -- if the display
 * checksum CHECKSUM_ACC is nonzero on level >= 0x0a it stamps 0x7a into IRQ_HEARTBEAT. It closes the
 * list with a trailing blank tagged word (emitBlankVectorWordTag70 0x01).
 *
 * Live-out: the object vectors appended to the display buffer via DRAW_CURSOR_LO/HI; PROJ_X_LO/HI and
 * PROJ_Y_LO/HI (last object's projected coords); SLOT_LOOP_INDEX / PROJ_PT_Y consumed to 0; possibly
 * IRQ_HEARTBEAT.
 *
 * Grounding: [seen].
 */
export function buildObjectDisplayList(m) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x0c;                    // run count for the record header
  emitTaggedVectorWord(m, 0x08, 0x0c);    // leading tagged word
  layHeaderAndBuildRecord(m, 0x66);       // open the object record
  mem8[PROJ_PT_Y] = 0x12;                 // draw budget: at most 0x12 objects
  mem8[SLOT_LOOP_INDEX] = 0x3f;           // scan slots from the top down
  let y = 0x00;                           // byte cursor within the current buffer page

  while (true) {
    const idx = mem8[SLOT_LOOP_INDEX];
    const kind = mem8[u16(OBJECT_RECORD_TABLE + idx)];
    if (kind !== 0) {                     // zero kind == empty slot
      const base = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);
      let carry = kind >= 0x50 ? 1 : 0;   // high kinds seed the rotate carry...
      if (kind >= 0x50) mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 1;  // ...and eat an extra slot
      mem8[u16(base + y)] = kind & 0x3f;  // low 6 bits = shape selector
      // Rotate the raw kind three times to lift its top bits into a small header code.
      let rot = kind;
      for (let i = 0; i < 3; i++) {
        const nextC = (rot >> 7) & 1;
        rot = ((rot << 1) | carry) & 0xff;
        carry = nextC;
      }
      const header = ((rot & 0x03) + 1) | 0x70;  // 2-bit code -> 0x70-tagged header
      y = (y + 1) & 0xff;
      mem8[u16(base + y)] = header;
      y = (y + 1) & 0xff;

      const obj = mem8[u16(OBJECT_INDEX_TABLE + idx)];  // slot -> object record index
      const dxLo = mem8[u16(OBJ_DX_LO + obj)] - mem8[PROJ_OFS_X_LO];  // X minus camera offset (lo)
      mem8[PROJ_X_LO] = dxLo;
      mem8[u16(base + y)] = dxLo;
      y = (y + 1) & 0xff;
      const dxHi = mem8[u16(OBJ_DX_HI + obj)] - mem8[PROJ_OFS_X_HI] - (dxLo < 0 ? 1 : 0);  // borrow in
      mem8[PROJ_X_HI] = dxHi;
      mem8[u16(base + y)] = dxHi & 0x1f;   // vector word high byte is 5 bits
      y = (y + 1) & 0xff;

      const dyLo = mem8[u16(OBJ_DY_LO + obj)];   // Y straight from the object record
      mem8[PROJ_Y_LO] = dyLo;
      mem8[u16(base + y)] = dyLo;
      y = (y + 1) & 0xff;
      const dyHi = mem8[u16(OBJ_DY_HI + obj)];
      mem8[PROJ_Y_HI] = dyHi;
      mem8[u16(base + y)] = dyHi & 0x1f;
      y = (y + 1) & 0xff;

      mem8[u16(base + y)] = 0x00; y = (y + 1) & 0xff;   // fixed separator word...
      mem8[u16(base + y)] = 0x00; y = (y + 1) & 0xff;
      mem8[u16(base + y)] = 0x00; y = (y + 1) & 0xff;
      mem8[u16(base + y)] = 0xa0; y = (y + 1) & 0xff;   // ...ending in the 0xa0 tag

      // Emit the negated shadow of each coordinate word (beam return stroke to origin).
      const nx = (mem8[PROJ_X_LO] ^ 0xff) + 1;          // -X (lo) two's complement
      mem8[u16(base + y)] = nx; y = (y + 1) & 0xff;
      const nxHi = (mem8[PROJ_X_HI] ^ 0xff) + (nx > 0xff ? 1 : 0);  // -X (hi) with carry
      mem8[u16(base + y)] = nxHi & 0x1f; y = (y + 1) & 0xff;
      const ny = (mem8[PROJ_Y_LO] ^ 0xff) + 1;          // -Y (lo)
      mem8[u16(base + y)] = ny; y = (y + 1) & 0xff;
      const nyHi = (mem8[PROJ_Y_HI] ^ 0xff) + (ny > 0xff ? 1 : 0);  // -Y (hi) with carry
      mem8[u16(base + y)] = nyHi & 0x1f; y = (y + 1) & 0xff;

      if (y >= 0xf0) {                     // page nearly full -> flush and restart the cursor
        y = (y - 1) & 0xff;
        advanceDisplayCursor(m, y);
        y = 0x00;
      }
      const left = (mem8[PROJ_PT_Y] - 1) & 0xff;   // spend one from the draw budget
      mem8[PROJ_PT_Y] = left;
      if (left & 0x80) break;              // budget underflowed -> done
    }
    const rem = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff; // step to the next slot down
    mem8[SLOT_LOOP_INDEX] = rem;
    if (rem & 0x80) break;                 // scanned past slot 0 -> done
  }

  if (y !== 0) {                           // flush the last partial page
    y = (y - 1) & 0xff;
    advanceDisplayCursor(m, y);
  }
  // Anti-tamper / difficulty poke: a nonzero display checksum on level >= 0x0a stamps the heartbeat.
  if (mem8[CHECKSUM_ACC] !== 0 && mem8[PLAYER_LEVEL_TBL] >= 0x0a) mem8[IRQ_HEARTBEAT] = 0x7a;
  return emitBlankVectorWordTag70(m, 0x01);  // trailing blank word closes the list
}

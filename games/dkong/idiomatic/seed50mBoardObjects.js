// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed50mBoardObjects — build the 50m board's object + hardware-sprite records.  ROM 0x101f.
 *
 * The board-2 (50m) arm of the board-object setup dispatch: sub_0f56 (ROM 0x0F56)
 * reads BOARD (0x6227) and, for BOARD == 2, tail-jumps here — the same table whose
 * BOARD == 4 arm loc_0d5f documents as "the 100m RIVETS board setup", which fixes
 * the 25m/50m/75m/100m = 1/2/3/4 mapping. A one-shot initialiser with NO inputs of
 * its own: every pointer, count and stride below is a fixed immediate, so it always
 * seeds the same board. It is straight-line — no branches — a sequence of calls to
 * the five already-idiomatic setup helpers plus four ROM->RAM block copies, closing
 * by writing the board-object-bookkeeping byte 0x62B9 = 1 (its "this board is set
 * up" marker). It reads back the object records the earlier steps seed (the gathers
 * at step 2/4 permute +3/+5 X/Y out of the object blocks), so the record contents
 * are an implicit input the gate must exercise.
 *
 * The steps, in ROM order (each callee reads its inputs from the register file the
 * way its Z80 ABI does, so the registers are set immediately before each call,
 * exactly as the oracle's `ld` immediates do):
 *
 *   1. replicateGroupStrided (0x122a): stamp the 4-byte ROM group at 0x3DEC into 5
 *      records at OBJ_ARRAY_64+7 (0x6407), record stride C+4 = 0x20.
 *   2. seedObjectBlockSprites (0x1186): seed the OBJ_ARRAY_65 (0x6500) object block's
 *      shared sprite field from a ROM template, then gather its 10 hardware sprite
 *      records to ACTOR_SPRITES (0x6980).
 *   3. replicateGroupStrided (0x122a): stamp the 4-byte ROM group at 0x3E18 into 6
 *      records at OBJ_ARRAY_65A0+7 (0x65A7), record stride C+4 = 0x10.
 *   4. gatherSpriteRecords (0x11d3): gather 6 sprite records (fields +3/+7/+8/+5) from
 *      OBJ_ARRAY_65A0 (0x65A0, stride 0x10) into SPRITE_BUFFER 0x69B8.  C = 0x0C carries
 *      over from step 3 (the gather ignores it), matching the oracle's `ld b,0x06`.
 *   5. loc_11fa (0x11fa): scatter the 6-byte ROM record at 0x3DFA into the OBJ_RECORD_66A0
 *      (0x66A0) field record + the 0x6A28 4-byte array (in SPRITE_BUFFER).
 *   6-8. Three ldir block copies of ROM tables into the sprite shadow buffer:
 *      0x3E04->0x69FC (4), 0x3E1C->0x6944 (8), 0x3E24->0x69E4 (0x18).
 *   9. seedSpriteObjectPair (0x11a6): seed the OBJ_PAIR_6680 pair at 0x6680/0x6690 from
 *      the ROM position table at 0x3E10 and emit their two sprite records at 0x6A18.
 *   10. ldir 0x3E3C->OBJECT_COLLISION_SPRITES (0x6A0C, 0x0C), then set the 0x62B9 marker.
 *
 * All five callees are already decompiled, so they are called directly (no m.call /
 * stack); the four ldir runs become plain forward byte copies (16-bit inc, like the
 * real `ldir`). What the individual object records ARE is not claimed — the callee
 * headers establish only the MECHANISM (seed records, permute into sprite mirrors) —
 * so the name asserts the confident part: this seeds the 50m board's objects.
 *
 * Memory-equivalent to the frozen oracle — equivalence-101f.test.js.
 * GATE:     crafted-entry — real captured dispatches forced by an identical-both-sides
 *           board poke (BOARD=2 reaches this arm; attract only plays 25m so it never
 *           dispatches unforced) + a distinctive-record-content craft that gives the two
 *           gathers non-trivial +3/+5 X/Y inputs. Not exhaustive — the input is the
 *           0x6500/0x65A0 record contents. Teeth: a missing-0x62B9-marker twin and a
 *           dropped-seedSpriteObjectPair twin, both caught.
 * LIVE-OUT: memory-only — the object/sprite records written across 0x6407..0x6A2B and
 *           the 0x62B9 marker. The dispatch returns (via sub_0f56/loc_0d5f) straight into
 *           sub_2441, whose entry reloads HL/A/B/DE/IX/IY before reading any of them, and
 *           loc_0d5f then reloads HL — so every register and flag left here is DEAD ABI
 *           (the dropped terminal ldir register-advance and the `ld a,1` are not
 *           reproduced). The oracle's own terminal `ret` (pc/SP) is the dropped
 *           control-flow model; the JS call stack replaces it and the test performs one
 *           modelled `ret` to line pc + SP up.
 * NAMES:    OBJ_ARRAY_64 (0x6400), OBJ_ARRAY_65A0 (0x65A0) and OBJECT_COLLISION_SPRITES
 *           (0x6A0C) from ram.js — the object-array bases this arm seeds ([code]
 *           confidence). Other object-array bases named in ram.js are cited in the step
 *           comments: OBJ_ARRAY_65 (0x6500), OBJ_RECORD_66A0 (0x66A0), OBJ_PAIR_6680
 *           (0x6680/0x6690), ACTOR_SPRITES (0x6980). 0x62B9 is board-object bookkeeping
 *           (ram.js groups but does not name it individually), kept hex. The remaining
 *           operands stay hex as faithful ROM immediates matching the callees: the
 *           base+field stamp destinations (0x6407 = OBJ_ARRAY_64+7, 0x65A7 =
 *           OBJ_ARRAY_65A0+7), the SPRITE_BUFFER-interior gather/copy destinations
 *           (0x6900-0x6A7F), and the ROM template pointers.
 */

import { OBJ_ARRAY_64, OBJ_ARRAY_65A0, OBJECT_COLLISION_SPRITES } from "./ram.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { seedObjectBlockSprites } from "./seedObjectBlockSprites.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { loc_11fa } from "./loc_11fa.js";
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js";

/** Forward byte-for-byte block copy (a faithful `ldir`: 16-bit inc on both pointers). */
function copyBlock(mem, src, dst, n) {
  for (let i = 0; i < n; i++) {
    mem.write8((dst + i) & 0xffff, mem.read8((src + i) & 0xffff));
  }
}

export function seed50mBoardObjects(m) {
  const { regs, mem } = m;

  // 1. Stamp the 4-byte ROM group at 0x3DEC into 5 records at OBJ_ARRAY_64+7 (0x6407, stride C+4 = 0x20).
  regs.hl = 0x3dec;
  regs.de = OBJ_ARRAY_64 + 0x07; // 0x6407 — field +7 of the first of 5 stride-0x20 records
  regs.bc = 0x051c; // B = 5 records, C = 0x1c
  replicateGroupStrided(m);

  // 2. Seed the 0x6500 object block + build its 10 sprite records (sets its own regs).
  seedObjectBlockSprites(m);

  // 3. Stamp the 4-byte ROM group at 0x3E18 into 6 records at OBJ_ARRAY_65A0+7 (0x65A7, stride C+4 = 0x10).
  regs.hl = 0x3e18;
  regs.de = OBJ_ARRAY_65A0 + 0x07; // 0x65a7 — field +7 of the first of 6 stride-0x10 records
  regs.bc = 0x060c; // B = 6 records, C = 0x0c
  replicateGroupStrided(m);

  // 4. Gather 6 sprite records from OBJ_ARRAY_65A0 (0x65A0, stride 0x10) into SPRITE_BUFFER
  //    0x69B8. Only B is reloaded; C = 0x0c survives step 3 (the gather ignores it).
  regs.ix = OBJ_ARRAY_65A0;
  regs.hl = 0x69b8;
  regs.de = 0x0010;
  regs.b = 0x06;
  gatherSpriteRecords(m);

  // 5. Scatter the 6-byte ROM record at 0x3DFA into the 0x66A0 record + 0x6A28 array.
  regs.hl = 0x3dfa;
  loc_11fa(m);

  // 6-8. Copy three ROM tables into the sprite shadow buffer.
  copyBlock(mem, 0x3e04, 0x69fc, 0x0004);
  copyBlock(mem, 0x3e1c, 0x6944, 0x0008);
  copyBlock(mem, 0x3e24, 0x69e4, 0x0018);

  // 9. Seed the object pair at 0x6680/0x6690 from the ROM table at 0x3E10 and emit
  //    their two sprite records at 0x6A18.
  regs.hl = 0x3e10;
  seedSpriteObjectPair(m);

  // 10. Copy the last ROM table into the collision-sprite records, then mark the board set up.
  copyBlock(mem, 0x3e3c, OBJECT_COLLISION_SPRITES, 0x000c); // 0x6A0C — 3 collision records (stride 4)
  mem.write8(0x62b9, 0x01); // board-object bookkeeping (unnamed in ram.js): this board is set up
}

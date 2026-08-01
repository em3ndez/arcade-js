// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed75mBoardObjects — build the 75m board's object records and their hardware
 * sprite mirror from ROM templates.  ROM 0x1087.
 *
 * The board-3 (75m, the elevator board) arm of the per-board setup dispatcher
 * sub_0f56, reached through its rst-0x28 jump table at 0x0FCD indexed by BOARD
 * (0x6227 == 3); it is tail-dispatched via `jp (hl)`, so its `ret` returns to the
 * board-setup caller, not to sub_0f56. It takes NO inputs: every pointer, count and
 * constant below is a fixed immediate baked into this board's setup, so it always
 * lays down the same 75m object/sprite state. It seeds three object-record blocks in
 * work RAM (OBJ_ARRAY_64 / OBJ_ARRAY_65 / OBJ_ARRAY_66 = 0x6400 / 0x6500 / 0x6600),
 * builds their hardware sprite records inside SPRITE_BUFFER, and copies two fixed
 * sprite/data templates from ROM. All work is memory writes; nothing it computes is
 * read back as a register.
 *
 * Steps, in ROM order, over the four already-decompiled setup helpers (called
 * directly) plus in-line fills and ROM->RAM block copies:
 *
 *   1. replicateGroupStrided (0x122a): broadcast the 4-byte ROM group at 0x3DEC into
 *      the +7 field of 5 records in the OBJ_ARRAY_64 block (dest 0x6407, B=5, C=0x1C so the
 *      record stride is C+4 = 0x20): 0x6407/0x6427/0x6447/0x6467/0x6487.
 *   2. seedObjectBlockSprites (0x1186): seed the OBJ_ARRAY_65 (0x6500) block's shared sprite
 *      field from the ROM template at 0x11A2 and build its 10 sprite records at ACTOR_SPRITES (0x6980).
 *   3. Fill 6 cells of the OBJ_ARRAY_66 (0x6600) block, stride 0x10, with 0x01
 *      (0x6600/0x6610/.../0x6650) — an object-active/flag column.
 *   4. Fill 3 cells at OBJ_ARRAY_66 + 0x0D (0x660D), stride 0x10, with 0x08 (0x660D/0x661D/0x662D).
 *      The ROM runs this inner fill twice (outer C=2) over the SAME three cells with HL reset
 *      each pass, so the second pass is a redundant re-write; the result is identical
 *      to writing the three cells once.
 *   5. copyBytePairsStrided (0x11ec): scatter 6 source byte-pairs from the contiguous
 *      ROM table at 0x3E64 into records at OBJ_ARRAY_66 + 0x03 (0x6603), stride C+2 = 0x10 (offsets +0/+2).
 *   6. replicateGroupStrided (0x122a): broadcast the 4-byte ROM group at 0x3E60 into 6
 *      records at OBJ_ARRAY_66 + 0x07 (0x6607), stride C+4 = 0x10.
 *   7. gatherSpriteRecords (0x11d3): build 6 hardware sprite records at 0x6958 (an unnamed slot
 *      inside SPRITE_BUFFER) by gathering fields +3/+7/+8/+5 from the OBJ_ARRAY_66 block (stride 0x10).
 *   8. Block-copy 12 bytes of the ROM sprite template at 0x3E48 to OBJECT_COLLISION_SPRITES
 *      (0x6A0C, inside SPRITE_BUFFER) — a fixed sprite record.
 *   9. Write the OBJ_ARRAY_64 block's two lead records (base 0x6400 and 0x6420, stride 0x20)
 *      field-by-field: +0=0x01 (active), +3/+0E = X pair, +5/+0F = Y pair
 *      (rec0: 0x58/0x58/0x80/0x80; rec1: 0xEB/0xEB/0x60/0x60).
 *  10. Block-copy the 16-byte inline ROM data table at 0x1121 (immediately after this
 *      routine's code) to 0x6970 (an unnamed slot inside SPRITE_BUFFER).
 *
 * The precise identity of the three object blocks (which 75m actors they are —
 * elevators/springs/fireballs) is not independently established; OBJ_ARRAY_64 / OBJ_ARRAY_65 /
 * OBJ_ARRAY_66 (0x6400/0x6500/0x6600) are address-keyed structural names in ram.js, NOT actor
 * identities. The name describes the MECHANISM and the board, exactly at the
 * evidence bar of its callee seedObjectBlockSprites — object-record blocks (they feed
 * the same gather/seed helpers with the same +3/+7/+8/+5 field layout) plus their
 * sprite mirror in SPRITE_BUFFER. 75m == board 3 is corroborated by the sibling board
 * arms seed25mBoardObjects (0x0FD7, idx 1) / seed50mBoardObjects (0x101f, idx 2 — its
 * header fixes the 1/2/3/4 = 25/50/75/100m mapping and names 0x1087 the 75m arm),
 * seedObjectBlockSprites ("75m (loc_1087)"), and stamp75mBoardTiles.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1087.test.js.
 * GATE:     crafted-entry — real dispatches forced by an identical-both-sides board
 *           poke (BOARD=3 -> sub_0f56 table idx 3 -> loc_1087), the same poke the
 *           sibling 0x1186 gate uses; attract only plays 25m so it never dispatches in
 *           a plain run. Not exhaustive — the routine has no input variety of its own
 *           (all immediates), so the real captured entries plus a distinctive-content
 *           craft (poked identically both sides so the gather/copy operate on non-zero
 *           inputs) fully exercise it. Teeth: a skipped fill and a wrong sprite
 *           destination, both caught on RAM.
 * LIVE-OUT: memory-only — the object-record blocks OBJ_ARRAY_64/OBJ_ARRAY_65/OBJ_ARRAY_66
 *           (0x6400/0x6500/0x6600) and their sprite records / template copies inside
 *           SPRITE_BUFFER (0x6958.., ACTOR_SPRITES 0x6980.., 0x69A0.., 0x6970..,
 *           OBJECT_COLLISION_SPRITES 0x6A0C..). The board-setup caller reads game RAM next
 *           frame, not registers, and the terminal `ret` returns into a caller that
 *           reads no register/flag this routine leaves. Registers are DEAD and, unlike
 *           the 0x1186 sibling, are NOT byte-faithful here (the helpers and block
 *           copies leave HL/DE/BC/IX/A in helper-specific states, never re-loaded), so
 *           the gate compares RAM (minus STACK_SCRATCH) + pc + SP only — never the
 *           register file, never cycles.
 * NAMES:    OBJ_ARRAY_64 (0x6400), OBJ_ARRAY_66 (0x6600) and OBJECT_COLLISION_SPRITES (0x6A0C)
 *           imported from ram.js and used in code; OBJ_ARRAY_65 (0x6500) and ACTOR_SPRITES
 *           (0x6980) are named in ram.js too but appear only in this file's prose (their writes
 *           happen inside the callees). SPRITE_BUFFER (0x6900) is the parent every sprite
 *           destination lands in. The per-record field offsets and the intra-SPRITE_BUFFER
 *           slots 0x6958 / 0x69A0 / 0x6970 stay hex (unnamed in ram.js).
 */

import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { seedObjectBlockSprites } from "./seedObjectBlockSprites.js";
import { copyBytePairsStrided } from "./copyBytePairsStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { OBJ_ARRAY_64, OBJ_ARRAY_66, OBJECT_COLLISION_SPRITES } from "./ram.js";

/** Forward block-copy `count` bytes ROM/RAM[src..] -> RAM[dst..] — an `ldir`, cycle-free. */
function blockCopy(mem, dst, src, count) {
  for (let i = 0; i < count; i++) {
    mem.write8((dst + i) & 0xffff, mem.read8((src + i) & 0xffff));
  }
}

export function seed75mBoardObjects(m) {
  const { regs, mem } = m;

  // 1. Seed field +7 of the 5 records in the OBJ_ARRAY_64 block from the ROM group at 0x3DEC.
  regs.hl = 0x3dec; // 4-byte source group (re-read every record — a broadcast)
  regs.de = OBJ_ARRAY_64 + 0x07; // dest: +7 of the first OBJ_ARRAY_64 record (0x6407)
  regs.bc = 0x051c; // B=5 records, C=0x1C -> record stride C+4 = 0x20
  replicateGroupStrided(m);

  // 2. Seed the OBJ_ARRAY_65 (0x6500) object block's sprite field and build its 10 sprite
  //    records at ACTOR_SPRITES (0x6980) (fixed immediates — this coordinator takes no register inputs).
  seedObjectBlockSprites(m);

  // 3. Fill 6 cells of the OBJ_ARRAY_66 block, stride 0x10, with 0x01.
  for (let i = 0; i < 6; i++) mem.write8((OBJ_ARRAY_66 + i * 0x10) & 0xffff, 0x01);

  // 4. Fill the 3 cells at OBJ_ARRAY_66 + 0x0D, stride 0x10, with 0x08. The ROM's outer C=2 loop
  //    re-runs this over the SAME cells with HL reset, so one pass is memory-identical.
  for (let i = 0; i < 3; i++) mem.write8((OBJ_ARRAY_66 + 0x0d + i * 0x10) & 0xffff, 0x08);

  // 5. Scatter 6 source byte-pairs from the ROM table at 0x3E64 into OBJ_ARRAY_66 + 0x03, stride 0x10.
  regs.hl = 0x3e64; // contiguous source (walks 2*B = 12 bytes)
  regs.de = OBJ_ARRAY_66 + 0x03; // dest base (offsets +0/+2 of each record) = 0x6603
  regs.bc = 0x060e; // B=6 pairs, C=0x0E -> record stride C+2 = 0x10
  copyBytePairsStrided(m);

  // 6. Broadcast the 4-byte ROM group at 0x3E60 into 6 records at OBJ_ARRAY_66 + 0x07, stride 0x10.
  regs.hl = 0x3e60;
  regs.de = OBJ_ARRAY_66 + 0x07; // = 0x6607
  regs.bc = 0x060c; // B=6 records, C=0x0C -> record stride C+4 = 0x10
  replicateGroupStrided(m);

  // 7. Build 6 hardware sprite records at 0x6958 (an unnamed slot in SPRITE_BUFFER) from the
  //    OBJ_ARRAY_66 block, gathering fields +3/+7/+8/+5 (X<-+3, code<-+7, attr<-+8, Y<-+5).
  regs.ix = OBJ_ARRAY_66; // object-record base
  regs.hl = 0x6958; // dest inside SPRITE_BUFFER (unnamed slot)
  regs.b = 0x06; // record count
  regs.de = 0x0010; // per-record source stride
  gatherSpriteRecords(m);

  // 8. Copy the fixed 12-byte ROM sprite template at 0x3E48 to OBJECT_COLLISION_SPRITES
  //    (0x6A0C, in SPRITE_BUFFER).
  blockCopy(mem, OBJECT_COLLISION_SPRITES, 0x3e48, 0x0c);

  // 9. Write the OBJ_ARRAY_64 block's two lead records field-by-field (base 0x6400, stride 0x20).
  //    +0 = active; +3/+0E = the X pair; +5/+0F = the Y pair.
  const IX = OBJ_ARRAY_64;
  mem.write8((IX + 0x00) & 0xffff, 0x01);
  mem.write8((IX + 0x03) & 0xffff, 0x58);
  mem.write8((IX + 0x0e) & 0xffff, 0x58);
  mem.write8((IX + 0x05) & 0xffff, 0x80);
  mem.write8((IX + 0x0f) & 0xffff, 0x80);
  mem.write8((IX + 0x20) & 0xffff, 0x01);
  mem.write8((IX + 0x23) & 0xffff, 0xeb);
  mem.write8((IX + 0x2e) & 0xffff, 0xeb);
  mem.write8((IX + 0x25) & 0xffff, 0x60);
  mem.write8((IX + 0x2f) & 0xffff, 0x60);

  // 10. Copy the 16-byte inline ROM data table at 0x1121 (right after this code) to 0x6970.
  blockCopy(mem, 0x6970, 0x1121, 0x10);
}

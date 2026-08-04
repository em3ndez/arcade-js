// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed100mBoardObjects — build the 100m (rivet) board's sprite-object records and their
 * hardware sprite mirror from ROM templates.  ROM 0x1131.
 *
 * The board-4 (100m, the rivet board) arm of the per-board setup dispatcher sub_0f56,
 * reached through its rst-0x28 jump table at 0x0FCD indexed by BOARD (0x6227 == 4); it is
 * tail-dispatched via `jp (hl)`, so its terminal `ret` returns to the board-setup caller
 * (0x0D62 = `call 0x2441`), not to sub_0f56. Like its siblings seed25m/50m/75mBoardObjects
 * (the other three arms of the SAME table, idx 1/2/3) it takes NO inputs: every pointer,
 * count and stride below is a fixed immediate baked into this board's setup, so it always
 * lays down the same 100m object/sprite state, reading only ROM — never pre-existing work
 * RAM. All work is memory writes; nothing it computes is read back as a register.
 *
 * Six steps, in ROM order, over the shared setup helpers (all already decompiled, so each
 * is a direct JS call) plus a ROM->RAM block copy and two activation marks:
 *
 *   1. replicateGroupStrided (0x122a): broadcast the 4-byte ROM group at 0x3DF0 into 5
 *      object records at 0x6407, record stride C+4 = 0x20.
 *   2. seedSpriteObjectPair (0x11a6) with the live-in position table HL = 0x3E14: seed
 *      OBJ_PAIR_6680 (the pair of objects at 0x6680/0x6690) and emit their two sprite
 *      records at 0x6A18.
 *   3. Block-copy the 0x0C-byte ROM table at 0x3E54 into OBJECT_COLLISION_SPRITES (0x6A0C,
 *      inside SPRITE_BUFFER) — an `ldir`, cycle-free.
 *   4. copyBytePairsStrided (0x11ec): scatter the ROM table at 0x1182 (the 2nd inline data
 *      unit after the routine body, used first) into offsets +3/+5 of two records at
 *      0x64A3, record stride C+2 = 0x20 — the objects' X (+3) and Y (+5) position fields.
 *   5. replicateGroupStrided (0x122a): broadcast the 4-byte ROM group at 0x117E (the 1st
 *      inline data unit, used second) into offsets +7..+a of the SAME two records at
 *      0x64A7, record stride C+4 = 0x20 — the shared appearance fields (+7 code, +8 attr).
 *   6. mark both records active (offset +0 = 1 at 0x64A0 and 0x64C0), then
 *      gatherSpriteRecords (0x11d3) reads the permuted (+3,+7,+8,+5) fields of each record
 *      (base IX = 0x64A0, stride 0x20, count 2) into two 4-byte hardware sprite records at
 *      0x6950 — X <- +3, code <- +7, attr <- +8, Y <- +5.
 *
 * ★ CORRECTION: an earlier version of this header said the seeded objects' identity was "not
 * independently established". For the OBJ_ARRAY_64 half that is no longer true. **OBJ_ARRAY_64
 * (0x6400) IS the FIRES**, grounded on the real ROM under MAME 0.288 (scratchpad/
 * grounding-object-arrays.md): zeroing the records' +0 erases the fireball entirely while the
 * barrels are untouched, and on 100m every box drawn at a logged record position lands on a
 * fireball. So step 6 above marks TWO FIRES active at board build (0x64A0 = record 5 and
 * 0x64C0 = record 6), which is why 100m's collision arm sweeps SEVEN records and not five.
 * What is still NOT established is per-record identity within the array, and 0x6680/0x6690 is
 * OBJ_PAIR_6680 in names.js whose "hammers" reading remains [code]. The name
 * describes the MECHANISM and the board, exactly at the evidence
 * bar of its callee seedObjectBlockSprites — object-record blocks (they feed the same
 * gather/seed helpers with the same +3/+7/+8/+5 field layout) plus their sprite mirror in
 * SPRITE_BUFFER. 100m == board 4 is airtight from the dispatch table (sub_0f56's 0x0FCD
 * table entry 4, index C = BOARD) and corroborated by the sibling arms seed25m/50m/75m and
 * by names.js (BOARD 4 = 100m rivets).
 *
 * Callees: replicateGroupStrided / seedSpriteObjectPair / copyBytePairsStrided /
 * gatherSpriteRecords — the idiomatic versions, called directly. Each reads its inputs from
 * the register file the way its Z80 ABI does, so this routine sets HL/DE/BC/IX before each
 * call exactly as the oracle's `ld` immediates do (the register-marshalling that survives
 * bottom-up decompile because the callees expose a register ABI, not a JS signature).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1131.test.js.
 * GATE:     crafted-entry — the board-4 setup is NOT reached in attract (attract only plays
 *           25m), so the real dispatch is forced with an identical-both-sides board poke
 *           (BOARD=4, GAME_SUBSTATE=board-setup; Karl-sanctioned "poke the board state to
 *           validate"), plus a distinctive-prefill craft that pins the exact write
 *           footprint. Not exhaustive — the routine is a fixed function of the ROM, so the
 *           forced dispatch already exercises its whole behaviour. Teeth: a skip-position
 *           twin (drops step 4, so the gather's X/Y go stale) and a wrong-destination twin.
 * LIVE-OUT: memory-only — the seeded object records (0x6407, 0x6680/0x6690, 0x64A0/0x64C0),
 *           the ldir bytes (0x6A0C..) and the hardware sprite records (0x6A18.., 0x6950..).
 *           The routine returns into a fresh `call 0x2441` (0x0D62) that reloads every
 *           register, so the whole register file and all flags are DEAD ABI here. UNLIKE the
 *           trailing-block-copy sibling seed75m, this routine's LAST op is the gather, so its
 *           main registers (a/b/c/d/e/h/l/ix) DO land byte-faithful to the oracle; the test
 *           verifies them as a free safety margin. The oracle's terminal `ret` (pc/SP) is the
 *           dropped control-flow model — the JS call stack replaces it; the test models one
 *           `ret` on the candidate to line pc + SP up.
 * NAMES:    OBJECT_COLLISION_SPRITES (0x6A0C) from names.js — the step-3 ldir destination,
 *           the exact named base of the 3 collision sprite records (0x0C bytes = 3 records).
 *           Everything else is a fixed immediate the callee ABIs consume: 0x6680/0x6690 is
 *           OBJ_PAIR_6680 but appears only inside seedSpriteObjectPair (not this file's code);
 *           the object records 0x6407 / 0x64A0 / 0x64A3 / 0x64A7 are fields/records of
 *           OBJ_ARRAY_64 (0x6400) with no per-cell names, so they stay hex register loads; and
 *           the other sprite destinations 0x6950 / 0x6A18 sit inside SPRITE_BUFFER
 *           (0x6900–0x6A7F) at no named sub-base, so they stay hex too.
 */

import { OBJECT_COLLISION_SPRITES } from "./names.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js";
import { copyBytePairsStrided } from "./copyBytePairsStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";

const LDIR_BYTES = 0x0c; // step 3: 0x0C bytes ROM 0x3E54 -> 0x6A0C

export function seed100mBoardObjects(m) {
  const { regs, mem } = m;

  // Step 1 — broadcast the 4-byte ROM group at 0x3DF0 into 5 records at 0x6407 (stride 0x20).
  regs.hl = 0x3df0; // 4-byte source group, re-read every pass
  regs.de = 0x6407; // dest base (D = page 0x64, E = 0x07)
  regs.bc = 0x051c; // B = 5 records, C = 0x1c -> record stride C+4 = 0x20
  replicateGroupStrided(m);

  // Step 2 — seed a sprite-object pair from the ROM position table at 0x3E14. HL is
  // seedSpriteObjectPair's live-in; it sets its own DE/BC/IX internally.
  regs.hl = 0x3e14;
  seedSpriteObjectPair(m);

  // Step 3 — copy the 0x0C-byte ROM table at 0x3E54 into OBJECT_COLLISION_SPRITES (0x6A0C,
  // the 3 collision sprite records) — a forward block copy faithful to the oracle's `ldir`.
  // The ldir's terminal HL/DE/BC are dead — step 4 reloads all three — so they are not reproduced.
  let src = 0x3e54;
  let dst = OBJECT_COLLISION_SPRITES;
  for (let i = 0; i < LDIR_BYTES; i++) {
    mem.write8(dst, mem.read8(src));
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }

  // Step 4 — scatter the ROM table at 0x1182 into offsets +3/+5 of two records at 0x64A3
  // (net record stride C+2 = 0x20): the objects' X (+3) and Y (+5) position fields.
  regs.hl = 0x1182; // 2nd inline data unit (after the routine body), used first
  regs.de = 0x64a3; // dest: record0.+3
  regs.bc = 0x021e; // B = 2 records, C = 0x1e
  copyBytePairsStrided(m);

  // Step 5 — broadcast the 4-byte ROM group at 0x117E into offsets +7..+a of the SAME two
  // records at 0x64A7 (record stride C+4 = 0x20): the shared +7 code / +8 attr fields.
  regs.hl = 0x117e; // 1st inline data unit, used second
  regs.de = 0x64a7; // dest: record0.+7
  regs.bc = 0x021c; // B = 2 groups, C = 0x1c
  replicateGroupStrided(m);

  // Step 6 — mark both records active (offset +0 = 1), then gather each record's permuted
  // (+3,+7,+8,+5) fields into a 4-byte hardware sprite record; the pair lands at 0x6950.
  regs.ix = 0x64a0;
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  mem.write8((regs.ix + 0x20) & 0xffff, 0x01); // second record, stride 0x20
  regs.hl = 0x6950; // sprite-record destination
  regs.b = 0x02; // 2 records
  regs.de = 0x0020; // per-record source stride (0x64A0 -> 0x64C0)
  gatherSpriteRecords(m);
}

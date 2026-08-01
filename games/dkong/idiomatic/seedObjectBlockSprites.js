// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedObjectBlockSprites — seed a 10-record object block's shared sprite field from a
 * ROM template, then build the block's 10 hardware sprite records.  ROM 0x1186.
 *
 * A board-setup coordinator with NO inputs of its own: every pointer and count below is
 * a fixed immediate baked into the routine, so it always drives the same block. Two
 * steps over the two shared helpers (both already decompiled, so this calls them
 * directly):
 *
 *   1. replicateGroupStrided (ROM 0x122a): stamp the 4-byte ROM template at 0x11A2 into
 *      the OBJ_SPRITE_CODE (+7) field of the 10 object records based at OBJ_ARRAY_65
 *      (0x6500) (dest OBJ_ARRAY_65+7 = 0x6507, B = 0x0A records, C = 0x0C so each record
 *      stride is C+4 = 0x10). This seeds bytes +7..+10 of every record with the common
 *      template — the sprite code/attr the gather then reads.
 *   2. gatherSpriteRecords (ROM 0x11d3): from the 10 object records at IX = OBJ_ARRAY_65
 *      (0x6500, stride DE = 0x10), gather the permuted fields +3/+7/+8/+5 into 10
 *      consecutive 4-byte hardware sprite records at HL = ACTOR_SPRITES (0x6980, inside
 *      SPRITE_BUFFER) — X <- +3, code <- +7, attr <- +8, Y <- +5.
 *
 * Between the two calls only B is reloaded (= 0x0A); C survives from step 1 (= 0x0C).
 * That carry-over is faithful to the oracle (`ld b,0x0a` writes B only), though the
 * gather does not actually read C. Reached from the 50m (loc_101f, ROM 0x101F) and 75m
 * (loc_1087, ROM 0x1087) board setups; attract only plays 25m, so it is validated under
 * a Karl-sanctioned board poke.
 *
 * The object identity of the OBJ_ARRAY_65 block is not independently established
 * (OBJ_ARRAY_65 (0x6500) is a structurally [code]-named array in ram.js, not a grounded
 * object identity); the name describes the MECHANISM — seed a common field, build the
 * sprite mirror — not what the ten objects are. Same evidence bar as gatherSpriteRecords.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1186.test.js.
 * GATE:     crafted-entry — real dispatches forced by a board poke (BOTH call sites:
 *           BOARD=2 loc_101f AND BOARD=3 loc_1087) + crafted distinctive-content entries
 *           poked identically on both sides (the real block is zero-filled at dispatch,
 *           so crafting gives the gather non-trivial inputs). Not exhaustive — the input
 *           is the OBJ_ARRAY_65 records' contents. Teeth: skip-the-fill (wrong sprite code) and
 *           a wrong gather destination, both caught.
 * LIVE-OUT: memory-only — the 40 template-seed bytes at 0x6507.. and the 40 sprite bytes
 *           at 0x6980.. . Both call sites (loc_101f @0x1031, loc_1087 @0x1099) reload HL
 *           immediately on return and read no other register or flag, so the whole
 *           register file and all flags are DEAD here. The two callees still leave the
 *           main registers byte-faithful to the oracle, so the test verifies them as a
 *           free safety margin (the routine's own terminal `ret` is modelled by the test).
 * NAMES:    OBJ_ARRAY_65 (0x6500, the object block), ACTOR_SPRITES (0x6980, its sprite
 *           mirror inside SPRITE_BUFFER) and the OBJ_SPRITE_CODE (+7) field offset from
 *           ram.js; every count/stride and the ROM template (0x11A2) stay fixed immediates.
 */

import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { OBJ_ARRAY_65, ACTOR_SPRITES, OBJ_SPRITE_CODE } from "./ram.js";

export function seedObjectBlockSprites(m) {
  const { regs } = m;

  // Step 1 — seed the shared template field across the 10-record object block.
  regs.hl = 0x11a2; // 4-byte ROM template (-> sprite code/attr), re-read for every record
  regs.de = OBJ_ARRAY_65 + OBJ_SPRITE_CODE; // dest: +7 field of the first OBJ_ARRAY_65 record (0x6507)
  regs.bc = 0x0a0c; // B = 0x0A records, C = 0x0C -> record stride C+4 = 0x10
  replicateGroupStrided(m);

  // Step 2 — build the block's 10 hardware sprite records (permuting gather).
  regs.ix = OBJ_ARRAY_65; // object-record base (0x6500)
  regs.hl = ACTOR_SPRITES; // dest: 10 consecutive 4-byte sprite records inside SPRITE_BUFFER (0x6980)
  regs.b = 0x0a; // record count; C still holds step 1's 0x0C (the gather ignores it)
  regs.de = 0x0010; // per-record source stride
  gatherSpriteRecords(m);
}

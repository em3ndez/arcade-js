// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedObjectBlockSprites — seed a 10-record object block's shared sprite field from a
 * fixed template, then build the block's 10 hardware sprite records.
 *
 * A board-setup coordinator with NO inputs of its own: every pointer and count below is
 * a fixed immediate baked into the routine, so it always drives the same block. Two
 * steps, over two shared helpers:
 *
 *   1. Stamp a 4-byte template into the OBJ_SPRITE_CODE (+7) field of the 10 object
 *      records based at OBJ_ARRAY_65, each record 0x10 apart. This seeds bytes +7..+10
 *      of every record with the common template — the sprite code and attribute the
 *      gather then reads back.
 *   2. From those same 10 object records (stride 0x10), gather the permuted fields
 *      +3/+7/+8/+5 into 10 consecutive 4-byte hardware sprite records at ACTOR_SPRITES:
 *      X <- +3, code <- +7, attribute <- +8, Y <- +5.
 *
 * Between the two calls only the record count is reloaded; the stride byte survives from
 * step 1, which is faithful even though the gather does not read it.
 *
 * The object identity of the block is NOT established here — the name describes the
 * MECHANISM (seed a common field, build the sprite mirror), not what the ten objects are.
 *
 * LIVE-OUT: memory-only — the 40 template-seed bytes and the 40 hardware sprite bytes.
 */

import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { OBJ_ARRAY_65, ACTOR_SPRITES, OBJ_SPRITE_CODE } from "./names.js";

export function seedObjectBlockSprites(m) {
  const { regs } = m;

  // Step 1 — seed the shared template field across the 10-record object block.
  regs.hl = 0x11a2; // 4-byte template (sprite code and attribute), re-read for every record
  regs.de = OBJ_ARRAY_65 + OBJ_SPRITE_CODE; // dest: the +7 field of the first record
  regs.bc = 0x0a0c; // 0x0A records; stride byte 0x0C (record stride = this + 4 = 0x10)
  replicateGroupStrided(m);

  // Step 2 — build the block's 10 hardware sprite records (permuting gather).
  regs.ix = OBJ_ARRAY_65; // object-record base
  regs.hl = ACTOR_SPRITES; // dest: 10 consecutive 4-byte sprite records in the shadow buffer
  regs.b = 0x0a; // record count; the stride byte still holds step 1's value (unread here)
  regs.de = 0x0010; // per-record source stride
  gatherSpriteRecords(m);
}

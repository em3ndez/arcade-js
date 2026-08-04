// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedSpriteObjectPair — place a pair of sprite objects at two caller-given positions and emit
 * their hardware sprite records.
 *
 * A board and cutscene setup step. It seeds TWO object records from fixed templates, marks
 * both active, and gathers each into a 4-byte hardware sprite record in the sprite buffer.
 * Every count is a fixed two; the ONE thing that varies per call site is a position table the
 * caller hands in through a pointer register, and the three call sites pass three adjacent
 * tables.
 *
 * Four steps, in order:
 *
 *   1. Scatter the caller's position table across the two records, filling each record's X and
 *      Y fields. The four table bytes are read as [record 0 X, record 0 Y, record 1 X,
 *      record 1 Y] — the same two fields the gather step later reads back as the sprite
 *      position.
 *   2. Stamp the SAME 4-byte appearance template into both records, filling their sprite-code
 *      and attribute fields. The two objects therefore always look alike.
 *   3. Mark both records active.
 *   4. Gather (X, code, attribute, Y) from each record and lay the pair down as two
 *      consecutive 4-byte hardware sprite records in the sprite buffer.
 *
 * Net effect: a pair of identically-styled sprite objects placed at the two positions the
 * caller's table names.
 *
 * NOT CLAIMED: what the two objects ARE. The position tables themselves were not decoded, so
 * what is established is the mechanism — seed two records, activate them, emit two sprites —
 * and nothing above it.
 *
 * Reads: the caller's position table and the shared appearance template. Writes: the two
 * object records and the two hardware sprite records.
 *
 * LIVE-OUT: memory-only. Every call site reloads its own registers straight after the call.
 */

import { copyBytePairsStrided } from "./copyBytePairsStrided.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { OBJ_PAIR_6680, OBJ_ACTIVE, OBJ_X, OBJ_SPRITE_CODE } from "./names.js";

export function seedSpriteObjectPair(m) {
  const { regs, mem } = m;

  // Step 1 — scatter the caller's position table into the X and Y fields of both records.
  // The table pointer is this routine's live-in; leave it untouched so it passes through
  // as the scatter's source.
  regs.de = OBJ_PAIR_6680 + OBJ_X; // destination: record 0's X field
  regs.bc = 0x020e; // 2 records, with a per-record advance of one record size
  copyBytePairsStrided(m);

  // Step 2 — stamp the shared 4-byte appearance template into the code/attribute fields of
  // both records.
  regs.hl = 0x3e08; // source template, one stride below the caller's own table
  regs.de = OBJ_PAIR_6680 + OBJ_SPRITE_CODE; // destination: record 0's sprite-code field
  regs.bc = 0x020c; // 2 groups, spaced one record apart
  replicateGroupStrided(m);

  // Step 3 — mark both records active.
  regs.ix = OBJ_PAIR_6680;
  mem.write8((regs.ix + OBJ_ACTIVE) & 0xffff, 0x01);
  mem.write8((regs.ix + 0x10 + OBJ_ACTIVE) & 0xffff, 0x01);

  // Step 4 — gather (X, code, attribute, Y) from each record into a 4-byte hardware sprite
  // record; the pair lands consecutively in the sprite buffer. Only the record count is
  // reloaded here — the gather ignores the byte step 2 left behind.
  regs.hl = 0x6a18; // sprite-record destination
  regs.b = 0x02; // 2 records
  regs.de = 0x0010; // per-record source stride, one whole object record
  gatherSpriteRecords(m);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedSpriteObjectPair — place a pair of sprite objects at two caller-given
 * positions and emit their hardware sprite records.  ROM 0x11a6.
 *
 * A board/cutscene setup step that seeds TWO object records — OBJ_PAIR_6680 (0x6680) and
 * its +0x10 sibling (0x6690), stride 0x10 — from ROM templates, marks both active, and gathers each
 * into a 4-byte hardware sprite record in SPRITE_BUFFER. Everything is a fixed count
 * of two; the ONE thing that varies per call site is a ROM position table handed in
 * by the caller as a live-in HL (there is no `ld hl,nn` in this routine). The three
 * call sites supply it adjacently: 0x1003 → 0x3E0C, 0x1073 → 0x3E10, 0x1140 → 0x3E14.
 *
 * Four steps, in order (each a direct call to the already-idiomatic callee):
 *
 *   1. copyBytePairsStrided (0x11ec): scatter the caller's ROM position table (HL)
 *      into the two records at 0x6683, stride 0x10 — filling offsets +3 and +5 of
 *      each record. The four table bytes are [rec0.+3, rec0.+5, rec1.+3, rec1.+5]:
 *      the two objects' position fields (the +3/+5 that gatherSpriteRecords reads as
 *      X and Y).
 *   2. replicateGroupStrided (0x122a): stamp the SAME 4-byte ROM template at 0x3E08
 *      into both records at 0x6687, record stride C+4 = 0x10 — filling offsets +7..+a.
 *      Both objects therefore share appearance fields (+7 code, +8 attr).
 *   3. Mark both records active: write 1 to offset +0 of each (0x6680 and 0x6690).
 *   4. gatherSpriteRecords (0x11d3): read (+3,+7,+8,+5) from each record and lay the
 *      pair down as two consecutive 4-byte hardware sprite records at 0x6A18 (inside
 *      SPRITE_BUFFER 0x6900–0x6A7F): X ← +3, code ← +7, attr ← +8, Y ← +5.
 *
 * Net effect: a pair of identically-styled sprite objects placed at the two positions
 * the caller's table names. What the objects ARE (the ROM tables were not read) is not
 * claimed; the mechanism — seed two records, activate, emit two sprites — is what the
 * name asserts, and it is fully grounded in this routine's own writes.
 *
 * Callees: copyBytePairsStrided / replicateGroupStrided / gatherSpriteRecords — all
 * the idiomatic versions, called directly. Each reads its inputs from the register
 * file the way its Z80 ABI does, so this routine sets HL/DE/BC/IX for each before the
 * call, exactly as the oracle's `ld` immediates do. The live-in HL is left untouched
 * before step 1 so it passes through to copyBytePairsStrided.
 *
 * Memory-equivalent to the frozen oracle — equivalence-11a6.test.js.
 * GATE:     crafted-entry — the one real attract dispatch (call site 0x1003, HL=0x3E0C,
 *           25m board build) + crafted entries for the two sites attract never reaches
 *           (HL=0x3E10 and HL=0x3E14), each poked identically on both sides, plus a
 *           destination-prefill craft. Not exhaustive (source ROM tables aren't varied
 *           — they are fixed per call site, and all three sites are covered). Teeth: a
 *           stride-transposition twin (swaps step 1/step 2's C) caught on the captures.
 * LIVE-OUT: memory-only — the object records (OBJ_PAIR_6680 0x6680–0x669a) and the two sprite records
 *           (0x6A18–0x6A1F). All three call sites reload HL, DE and BC immediately after
 *           the call and branch on no flag (verified at loc_0fd7 0x1009, loc_101f 0x1079,
 *           loc_1131 0x1146), so every register and flag left here is dead ABI. The
 *           oracle's terminal `ret` (SP/PC) is the dropped control-flow model — the JS
 *           call stack replaces it — so pc/SP carry no residue and are not compared.
 * NAMES:    OBJ_PAIR_6680 (0x6680, rec0) + its +0x10 sibling (0x6690, rec1), and the field
 *           offsets OBJ_X/OBJ_SPRITE_CODE/OBJ_ACTIVE — from names.js. The sprite destination
 *           0x6A18 falls inside SPRITE_BUFFER (0x6900–0x6A7F) but stays hex, matching
 *           gatherSpriteRecords.
 */

import { copyBytePairsStrided } from "./copyBytePairsStrided.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { OBJ_PAIR_6680, OBJ_ACTIVE, OBJ_X, OBJ_SPRITE_CODE } from "./names.js";

export function seedSpriteObjectPair(m) {
  const { regs, mem } = m;

  // Step 1 — scatter the caller's ROM position table into offsets +3/+5 of both
  // records. HL is this routine's live-in (the table pointer); leave it untouched so
  // it passes through as copyBytePairsStrided's source.
  regs.de = OBJ_PAIR_6680 + OBJ_X; // destination: record0.+3 (OBJ_X)
  regs.bc = 0x020e; // B = 2 records, C = 0x0e (net per-record advance C+2 = 0x10)
  copyBytePairsStrided(m);

  // Step 2 — stamp the shared 4-byte appearance template (ROM 0x3E08) into offsets
  // +7..+a of both records.
  regs.hl = 0x3e08; // source template (4 below the caller's 0x3E0C — one stride-4 run)
  regs.de = OBJ_PAIR_6680 + OBJ_SPRITE_CODE; // destination: record0.+7 (OBJ_SPRITE_CODE)
  regs.bc = 0x020c; // B = 2 groups, C = 0x0c (record size C+4 = 0x10)
  replicateGroupStrided(m);

  // Step 3 — mark both records active: OBJ_ACTIVE (+0) = 1 at rec0 (OBJ_PAIR_6680) and rec1 (+0x10).
  regs.ix = OBJ_PAIR_6680;
  mem.write8((regs.ix + OBJ_ACTIVE) & 0xffff, 0x01);
  mem.write8((regs.ix + 0x10 + OBJ_ACTIVE) & 0xffff, 0x01);

  // Step 4 — gather (+3,+7,+8,+5) from each record into a 4-byte hardware sprite
  // record; the pair lands at 0x6A18 in SPRITE_BUFFER. C is left at 0x0c from step 2
  // (gatherSpriteRecords ignores it); only B is reloaded, matching the oracle.
  regs.hl = 0x6a18; // sprite-record destination
  regs.b = 0x02; // 2 records
  regs.de = 0x0010; // per-record source stride (0x6680 → 0x6690)
  gatherSpriteRecords(m);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampReleasedBarrelKind — preset a freshly-claimed 25m barrel record's sprite fields, then fall into the
 * frame-gated string/sprite renderer.  ROM 0x2CF6.
 *
 * The setup head of the 0x2C-cluster renderer chain. It is entered with the object-record
 * base in the index register (the caller's RENDER_OBJ_PTR, 0x62AA — the same record loc_2d15
 * reloads and writes) and stamps three of that record's fields with one of two presets,
 * chosen by bit 7 of BARREL_CLAIM_MODE:
 *   - bit 7 CLEAR -> the default triple: sprite-code field (+0x07) = 0x15, sprite-attr
 *     field (+0x08) = 0x0B, mode field (+0x15) = 0x00.
 *   - bit 7 SET   -> the alternate triple: (+0x07) = 0x19, (+0x08) = 0x0C, (+0x15) = 0x01.
 * Then it falls straight through into loc_2d15, the frame-gated renderer tick.
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md), 46 dispatches captured with a fetch tap at 0x2CF6:
 *   - This is ORDINARY 25m BARREL PLAY, NOT a cutscene. All 46 dispatches landed at gameplay
 *     substates — 17 at (GAME_STATE=3, GAME_SUBSTATE=12), a credited in-board 25m game, and
 *     29 at (1,3), the attract 25m demo — and ZERO at substate 7, the opening Kong-climb
 *     cutscene, which ran for 769 + 512 frames in the same runs without firing this routine.
 *     An earlier version of this header called the chain "the 0x2C-cluster cutscene renderer";
 *     that framing is REFUTED by the run and has been removed.
 *   - Board 1 only: 0 dispatches across 6667 frames each of poked 50m and 75m.
 *   - The index register held an OBJ_ARRAY_67 record base at all 46 dispatches (0x6700 / 0x6720
 *     / 0x6740 / 0x6760 / 0x6780 / 0x67A0 / 0x67C0, stride 0x20 — the 25m barrel array), equal
 *     to RENDER_OBJ_PTR every time; and each dispatch was paired 1:1 in the SAME frame with a
 *     slot claim by the barrel-release routine (board 1, ROM 0x2CB8) — 46 claims / 46
 *     dispatches, none unmatched either way. So one entry here dresses one just-released barrel.
 *   - The bit-7 select agreed with the bytes actually stamped 46/46, no exceptions: bit 7 CLEAR
 *     -> 0x15 / 0x0B / 0x00 on 38 dispatches, bit 7 SET -> 0x19 / 0x0C / 0x01 on the other 8.
 *
 * THE TWO PRESETS ARE TWO BARREL KINDS, told apart on a live playfield (a full per-frame trace
 * of OBJ_ARRAY_67 in natural play, same run):
 *   - the DROPPING kind (bit 7 SET, sprite-attr 0x0C): its sprite code walks 0x19 -> 0x1A ->
 *     0x1B and it descends with its X PINNED at 59 while Y runs 77 -> 239 — a straight vertical
 *     fall down one column.
 *   - the ROLLING kind (bit 7 CLEAR, sprite-attr 0x0B): sprite code in the 0x15 / 0x16 / 0x17
 *     family, X sweeping along the girders (103 -> 107 -> 94 -> ... -> 165) while Y creeps down.
 *   The two KINDS COEXIST — 372 in-board frames had one of each active at once — and the
 *   differing attribute byte selects a different palette, so they are visually distinct too.
 *   HONESTY BOUND: the grounding run deliberately did NOT establish which NAMED Donkey Kong
 *   object either kind is. This header therefore says only "the rolling kind" and "the dropping
 *   kind", and asserts nothing beyond the observed behaviour.
 *
 * The oracle writes the default triple UNCONDITIONALLY and then, on the bit-7-set arm,
 * overwrites all three; the memory-observable result is exactly one preset per arm, so the
 * idiomatic form collapses to a single branch that writes the selected preset. (These are
 * plain work-RAM record fields, so writing a cell once versus writing-then-overwriting it
 * leaves the identical final byte.)
 *
 * The record base comes from the caller (RENDER_OBJ_PTR). Its sprite-code and sprite-attr fields
 * ARE named in ram.js (OBJ_SPRITE_CODE +0x07, OBJ_SPRITE_ATTR +0x08) and are imported from there;
 * only the mode field (+0x15) has no ram.js name and stays a raw offset — the same convention as the sibling closer
 * loc_2d8c, which stamps the same record.
 *
 * NAME (promoted from loc_2cf6, DK understanding pass 13 — independent proposer ≠ confirmer,
 * confidence HIGH). Corroboration from OUTSIDE this routine:
 *   - A named [seen] cell describes this routine's job in so many words: BARREL_CLAIM_MODE
 *     (0x6382) is registered as "the 25m barrel slot-claim mode byte, AND the selector for WHICH
 *     of two barrel kinds gets stamped", with the same 46/46 agreement and the same two triples
 *     (0x15/0x0B/0x00 and 0x19/0x0C/0x01) this routine writes.
 *   - A second named [seen] cell names this routine BY ADDRESS: RENDER_OBJ_PTR (0x62AA) records
 *     that the word "equalled the IX register at 46/46 observed loc_2cf6 dispatches", holding an
 *     OBJ_ARRAY_67 (25m barrel) record base every time.
 *   - The record fields it stamps are the named OBJ_SPRITE_CODE (+0x07) and OBJ_SPRITE_ATTR
 *     (+0x08), both [seen], the latter registered as what gatherSpriteRecords copies to sprite +2
 *     — i.e. what the player actually sees.
 *   - mechanisms.md §6 ("Two barrel kinds on 25m, and the byte that selects them") carries the
 *     same figures, and the caller in the frozen oracle (ROM 0x2CB8, the 25m barrel-release slot
 *     claim) sets RENDER_OBJ_PTR to the record it has just claimed and reaches here — one entry
 *     per released barrel.
 * WHAT THE NAME DOES NOT CLAIM — the honesty bound, kept deliberately: it says nothing about which
 * NAMED Donkey Kong object either kind is. "The rolling kind" and "the dropping kind (X pinned at
 * 59)" are behavioural descriptions from the trace; no lore term appears in the name or anywhere
 * below. The name also does not claim this routine RELEASES a barrel (the caller does the slot
 * claim) or renders it (that is the loc_2d15 tail it falls into) — only that it stamps the
 * appearance of one already released, and that which appearance comes from BARREL_CLAIM_MODE bit 7.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2cf6.test.js.
 * GATE:     real captured 0x2CF6 dispatches from attract (both preset arms occur naturally —
 *           12 bit-7-clear + 2 bit-7-set over 4000 frames; the pass-12 MAME run re-confirmed
 *           both arms occur naturally on the real ROM: 13 dispatches / 2 bit-7-set over 4243
 *           attract frames, 57 / 8 over 14546, 24 / 5 in a credited game) plus crafted entries,
 *           poked identically on both sides, that force each arm and drive the downstream renderer
 *           through its clean gate-return path and its deeper table-load path. The RAM diff
 *           excludes the dead STACK_SCRATCH the downstream loc_2d15 chain's dissolved
 *           `call 0x004e` bracket churns; pc + SP are compared after one modelled terminal
 *           return. Teeth: a twin that reads the wrong parity bit and a twin that drops the
 *           fall-through into loc_2d15.
 * LIVE-OUT: memory-only. stampReleasedBarrelKind falls into loc_2d15 whose chain nets exactly one terminal
 *           `ret`; the caller reads no register (the oracle's `rlca` residue in the
 *           accumulator is dead), so the single return is modelled in the gate, not here.
 * NAMES:    BARREL_CLAIM_MODE (0x6382) from ram.js — the barrel slot-claim mode byte the 0x2C41
 *           cluster writes. It is not a bare flag: its low bits carry the claim's mode value
 *           (observed 1, and 0x81 = mode 1 with bit 7 set) while its BIT 7 selects which of the
 *           two barrel kinds this routine stamps. loc_2d15 / loc_2d8c read bit 0 of the same
 *           byte. The object-record base comes from the caller (RENDER_OBJ_PTR); its sprite-code and
 *           sprite-attr fields are the ram.js-named OBJ_SPRITE_CODE (+0x07) / OBJ_SPRITE_ATTR
 *           (+0x08), imported from ram.js. Only the mode field (+0x15) is unnamed and stays hex.
 *           The base is an OBJ_ARRAY_67 (barrel) record — grounded, IX at 46/46 dispatches.
 */

import { BARREL_CLAIM_MODE, OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR } from "./ram.js"; // 0x6382 bit 7 selects the barrel kind; +7/+8 are the record's sprite fields
import { loc_2d15 } from "./loc_2d15.js"; // ROM 0x2D15 — the frame-gated string/sprite renderer

export function stampReleasedBarrelKind(m) {
  const { regs, mem } = m;

  const obj = regs.ix; // barrel record base (the caller's RENDER_OBJ_PTR, an OBJ_ARRAY_67 record)

  // Choose the barrel kind by bit 7 of the slot-claim mode byte and stamp the record's
  // sprite-code, sprite-attr and mode (+0x15, unnamed) fields.
  if ((mem.read8(BARREL_CLAIM_MODE) & 0x80) === 0) {
    // The ROLLING kind (grounded: attr 0x0B, X sweeps along the girders).
    mem.write8((obj + OBJ_SPRITE_CODE) & 0xffff, 0x15); // sprite-code field
    mem.write8((obj + OBJ_SPRITE_ATTR) & 0xffff, 0x0b); // sprite-attr field
    mem.write8((obj + 0x15) & 0xffff, 0x00); // mode field
  } else {
    // The DROPPING kind (grounded: attr 0x0C, descends with X pinned at 59).
    mem.write8((obj + OBJ_SPRITE_CODE) & 0xffff, 0x19); // sprite-code field
    mem.write8((obj + OBJ_SPRITE_ATTR) & 0xffff, 0x0c); // sprite-attr field
    mem.write8((obj + 0x15) & 0xffff, 0x01); // mode field
  }

  // Fall straight into the frame-gated renderer tick.
  return loc_2d15(m);
}

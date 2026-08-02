// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2ce6 — retire one record of the 25m four-record sprite group once the bonus counter drops
 * below four, then continue into the barrel-record preset head.  ROM 0x2CE6.
 *
 * The entry point of the 0x2C-cluster chain. Its only ROM caller is the 25m barrel-release slot
 * claim (ROM 0x2CB8), which reaches it on both of its arms and leaves the pointer register aimed
 * at BONUS — the byte it has just decremented — so the value read here is the bonus counter after
 * this release was charged for. (Confirmed in play: over 14 natural dispatches in a 4000-frame
 * attract run the pointer was BONUS every time, and the byte stepped 49, 48, 47 … 36, one notch
 * per dispatch.)
 *
 * While four or more remain, this routine does nothing. Below four it zeroes the X field of the
 * record whose index EQUALS the remaining count, in the four-record sprite group at 0x69A8 — so
 * the group loses one record per remaining step and is empty when the counter reaches 0. Zeroing
 * a sprite record's X takes it off the display: the raster row test can never be satisfied for a
 * record whose X byte is 0 on any visible scanline, and zeroing that field is the codebase's
 * established blank-a-sprite idiom (the same move that culls an OBJ_65A0_SPRITES record).
 *
 * The group is not addressed anywhere else in the game: exactly two ROM sites touch 0x69A8-0x69B7,
 * the 25m board build (seed25mBoardObjects step 1, a 16-byte block copy from the ROM template at
 * 0x3DDC) and this routine. The template is four records that share tile code 0x18 and attribute
 * 0x0B, positioned as a 2x2 block — X 30/20, Y 75/59 — so the four records this routine retires
 * are a fixed four-piece decoration built with the 25m board. WHAT those four sprites DEPICT was
 * not grounded and is not claimed here; the structure (four records, one retired per remaining
 * count, count limit 4 == the group's record count) is what the code and the template establish.
 *
 * Both arms then continue into loc_2cf6, which presets the freshly-claimed barrel record's sprite
 * fields and falls on into the frame-gated renderer tick.
 *
 * GROUNDED CONTEXT — this cluster is ORDINARY 25m BARREL PLAY, not a cutscene (live MAME 0.288 on
 * the real dkong ROM, understanding pass 12, scratchpad/pass12-grounding.md). An earlier version of
 * these headers called the 0x2C cluster "the cutscene renderer" and that is REFUTED: all 46 observed
 * dispatches of the next link, loc_2cf6, fell at gameplay substates (17 in a credited in-board 25m
 * game, 29 in the attract 25m demo) and ZERO at substate 7, the opening Kong-climb cutscene; board 1
 * only; the index register held an OBJ_ARRAY_67 barrel-record base at 46/46, each paired 1:1 in the
 * same frame with a slot claim by the barrel-release routine (ROM 0x2CB8) that also decremented the
 * bonus counter this routine reads. Grounding deliberately did NOT establish which NAMED Donkey Kong
 * object either barrel kind is, so no lore name appears here.
 *
 * NAME: kept loc_ — the mechanism is pinned to the oracle and the caller fixes the counter's
 * identity, but the meaning of the four-record group it empties has not been grounded, so an
 * English name would have to guess at what the player sees disappear.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2ce6.test.js.
 * GATE:     real captured 0x2CE6 dispatches from attract (14 in 4000 frames, all on the skip arm —
 *           the counter starts at 50 on 25m level 1 and only steps down one per barrel release, so
 *           attract never reaches 3) PLUS crafted entries built from a real capture by poking that
 *           one counter byte identically on both sides, which forces every clear index 0/1/2/3 and
 *           the 4 boundary, over a group pre-filled with sentinels so each write is unambiguous.
 *           The RAM diff excludes the dead STACK_SCRATCH the downstream chain's dissolved
 *           `call 0x004e` bracket churns; pc + SP are compared after one modelled terminal return.
 *           Teeth: a wrong-stride twin, an off-by-one boundary twin (which lands on the neighbouring
 *           OBJ_65A0_SPRITES group), and a twin that drops the continuation into loc_2cf6.
 * LIVE-OUT: memory-only. The chain loc_2ce6 -> loc_2cf6 -> loc_2d15 nets exactly one terminal
 *           return, modelled in the gate rather than here. The oracle's residue — the counter in
 *           the accumulator, the scaled index, the computed record pointer — is dead: loc_2cf6
 *           overwrites the accumulator from BARREL_CLAIM_MODE and neither it nor loc_2d15 reads an
 *           incoming pointer register.
 * NAMES:    BONUS (0x62B1) is named in ram.js but is reached through the CALLER's pointer register,
 *           which is this routine's live-in, so it is read indirectly and named in the comment
 *           rather than imported. SPRITE_X (+0) from ram.js is the field cleared — the group at
 *           0x69A8 lies inside SPRITE_BUFFER, so this is the SPRITE-record namespace, NOT the
 *           object-record OBJ_ACTIVE that shares the numeric offset 0. The group base 0x69A8 has no
 *           ram.js name (one of several unnamed sub-blocks of SPRITE_BUFFER, like the 0x69FC record
 *           its board-build sibling seeds) and stays a local hex const.
 */

import { SPRITE_X } from "./ram.js"; // sprite-record field offset (+0), NOT the object-record OBJ_ACTIVE
import { loc_2cf6 } from "./loc_2cf6.js"; // ROM 0x2CF6 — preset the freshly-claimed barrel record

const COUNTDOWN_SPRITES = 0x69a8; // four-record sprite group seeded at 25m board build (no ram.js name)
const COUNTDOWN_RECORDS = 4; // records in that group — and the count below which they start retiring
const SPRITE_RECORD_BYTES = 4; // stride of a sprite record

export function loc_2ce6(m) {
  const { regs, mem } = m;

  // The caller (the 25m barrel-release slot claim, ROM 0x2CB8) leaves the pointer register on the
  // bonus counter BONUS, which it has just decremented for this release.
  const remaining = mem.read8(regs.hl);

  // Below four remaining, retire the record whose index is the remaining count: one record goes
  // per step, and the group is empty at zero. Zeroing a sprite record's X blanks it.
  if (remaining < COUNTDOWN_RECORDS) {
    mem.write8(COUNTDOWN_SPRITES + remaining * SPRITE_RECORD_BYTES + SPRITE_X, 0);
  }

  // Both arms continue into the barrel-record preset head.
  return loc_2cf6(m);
}

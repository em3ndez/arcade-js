// SPDX-License-Identifier: GPL-3.0-only
/**
 * latchHammerTouch — latch whether Mario is touching one of the two hammer objects, select the one
 * he touched, and pulse the pickup sound.  ROM 0x2954.
 *
 * Reached from the movement machine's airborne tail (ROM 0x1C33) on the frames its counter
 * wraps, so it runs a handful of times per demo rather than every frame. Four steps:
 *
 *   1. A board gate first (boardBitGate with mask bit0/bit1/bit3 = 25m/50m/100m — exactly the
 *      boards a hammer can appear on, 75m excluded; the same mask driveHammerSprite uses).
 *      Closed and the whole latch is skipped, leaving every cell below untouched.
 *   2. findHammerOverlappingMario tests Mario's position against the two-record hammer pair at OBJ_PAIR_6680 and
 *      leaves its outcome in the register file: an overlap flag, plus the count-minus-index
 *      residue naming the matched record (2 = the pair's first record, 1 = its second, 0 = no
 *      overlap).
 *   3. The overlap flag is stored UNCONDITIONALLY into MARIO_HAMMER_PENDING and drives the
 *      item/score sound trigger (SND_TRIGGER+5) — asserted for 64 frames on a touch, silenced
 *      on a miss. Because both writes are unconditional, a run with no overlap CLEARS a latch
 *      and a sound a previous run set; that is the behaviour MARIO_HAMMER_PENDING's registry
 *      note records ("also clears it each time it runs"). Nothing here puts the hammer in
 *      Mario's hands: the movement machine transfers MARIO_HAMMER_PENDING into
 *      MARIO_HAMMER_ACTIVE once the post-landing freeze expires.
 *   4. On an overlap only, the touched record's HAMMER_IN_PLAY field (+0x01) is set to 1 — "this
 *      is the hammer Mario grabbed". Two independent readers corroborate that meaning:
 *      recordHammerHitOnObject scans the pair for the record whose HAMMER_IN_PLAY bit0 is set and
 *      tests THAT record's hitbox against the board's hazards (ROM 0x2826), and driveHammerSprite
 *      reads bit0 of the FIRST record's HAMMER_IN_PLAY to choose which of the pair it animates
 *      (ROM 0x2EDF: set -> record 0x6680, clear -> record 0x6690). Both readers therefore land on
 *      the record this routine marked.
 *
 * ★ THE FLAG'S LIFECYCLE IS COMPLETE — corrected. An earlier version of this header called the
 * flag "sticky until the board re-initialises". It is not: nothing here clears it, but
 * updateActiveHammer — driveHammerSprite's owner — clears it at ROM 0x2F61 (`ld (ix+0x01),a` with
 * A = 0) when the hammer's ~512-frame counter expires, in the same block that clears
 * MARIO_HAMMER_ACTIVE, clears the record's OBJ_ACTIVE, parks the sprite and restores the saved
 * background tune. So the flag is SET on the touch here and CLEARED at hammer expiry — a complete
 * lifecycle. (The per-board block clear inside initBoardState also zeroes it, but that is the
 * board build, not this flag's own end.)
 *
 * REGISTER-ABI MARSHALLING (dissolves once the callees take honest args): boardBitGate still
 * reads its board mask from the register file, and findHammerOverlappingMario still returns nothing — it leaves
 * the search result in the registers findCollidingObject wrote. So this routine loads the mask
 * the way the oracle's call site does and reads the two result registers straight back.
 *
 * NAME (promoted from loc_2954, DK understanding pass 13 — independent proposer ≠ confirmer,
 * confidence HIGH). Corroboration from OUTSIDE this routine:
 *   - MARIO_HAMMER_PENDING (0x6218, [seen]) — the cell this routine writes — describes ITSELF as
 *     "a touched-but-not-yet-held hammer" and names ROM 0x295A, inside this routine, as the site
 *     that latches it; it also records that this routine clears it each time it runs.
 *   - An independent real-MAME audio trace: audio/sounds.js latch bit 5 (0x6085, the trigger this
 *     routine pulses) is `item_or_jump_score` at confidence CONFIRMED, evidenced by
 *     test_hammer_25m_lower — the trigger rises once, 29 frames before the tune flips to the
 *     hammer music — and its ROM-site list cites 0x295F, inside this routine.
 *   - seedSpriteObjectPair, which activates the pair this routine searches, is called from
 *     seed25mBoardObjects / seed50mBoardObjects / seed100mBoardObjects and from NO other board
 *     setup — so the pair exists on exactly the boards with hammers and never on 75m, DK's one
 *     hammer-free board. The board mask this routine gates on (0x0B) is that same set, reached a
 *     completely different way.
 * WHAT THE NAME DOES NOT CLAIM: not that Mario ends up HOLDING a hammer — this only latches the
 * touch, and tickPostLandingFreeze transfers MARIO_HAMMER_PENDING into MARIO_HAMMER_ACTIVE once
 * the post-landing freeze expires; not HOW MANY hammers a board shows (the pair is always two
 * records, seeded from three different ROM position tables at 0x3E0C/0x3E10/0x3E14, and nobody has
 * read those bytes); and not that the touch is a pickup the player sees — the sound and the latch
 * are what is established, not the on-screen event.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2954.test.js.
 * GATE:     captured + crafted. 0x2954 IS naturally reachable — the 25m attract demo jumps at
 *           hammers, dispatching it 4x in 2000 frames (14x in 12000), and those real dispatches
 *           already span both the no-overlap arm and a genuine record-1 hammer touch. Because
 *           four dispatches is thin coverage, crafted entries (a real captured/attract state
 *           with the two records and Mario's X/Y poked identically on both sides) pin every
 *           arm: the closed board gate (BOARD = 75m), a miss that must CLEAR an already-set
 *           latch and sound, a hit on the pair's first record, and a hit on its second. Each
 *           case compares RAM − STACK_SCRATCH, pc, SP and the return value against the oracle,
 *           and the crafted cases additionally assert the four cells' ABSOLUTE expected values
 *           so a both-sides-wrong reading cannot pass. STACK_SCRATCH is excluded because the
 *           oracle's dissolved rst-0x30 / call-0x2974 brackets write only there (measured: the
 *           deepest push at a real dispatch reaches 0x6BE4, inside the region).
 *           Teeth: a twin that marks the wrong record of the pair, a twin that skips the
 *           unconditional latch/sound clear on a miss, and a twin that asserts the sound for
 *           the usual 3 frames instead of 64.
 * LIVE-OUT: memory-only. The routine returns nothing, and its caller chain (ROM 0x1C33 falls
 *           straight into the player-sprite copy at 0x1DA6, which reloads the accumulator and
 *           its pointer from memory as its first two actions) reads no register or flag this
 *           leaves behind. pc and SP net to a single caller-return on every arm — including the
 *           closed gate, where the oracle's rst-0x30 skip consumes this routine's own return
 *           address instead — so both are compared too.
 * NAMES:    MARIO_HAMMER_PENDING (0x6218), SND_TRIGGER (0x6080, the 8-trigger span — this
 *           routine drives entry 5, 0x6085, the item/score trigger that awardScorePopup also
 *           asserts for a score award), OBJ_PAIR_6680 (0x6680) and HAMMER_IN_PLAY (+0x01) from
 *           names.js. Only the pair's 16-byte record stride stays a local const; the board mask is
 *           an immediate bit-flag, not an address. NAMESPACE: the pointer here addresses an OBJECT
 *           record (the pair findHammerOverlappingMario just searched), so +0x01 belongs to the
 *           object-record field set — and it is NOT names.js's SPRITE_CODE (+1 of a SPRITE record, a
 *           different namespace that merely collides numerically). HAMMER_IN_PLAY is deliberately
 *           SCOPED to this pair rather than given a generic OBJ_* name, because +0x01 carries
 *           unrelated roles on other records (see names.js). boardBitGate (ROM 0x0030) and
 *           findHammerOverlappingMario (ROM 0x2974) are direct-called.
 */

import { MARIO_HAMMER_PENDING, SND_TRIGGER, OBJ_PAIR_6680, HAMMER_IN_PLAY } from "./names.js";
import { boardBitGate } from "./boardBitGate.js"; // ROM 0x0030 (rst 0x30) — per-board skip gate
import { findHammerOverlappingMario } from "./findHammerOverlappingMario.js";         // ROM 0x2974 — Mario vs. the hammer pair

// rst-0x30 board applicability mask: bit0 25m, bit1 50m, bit3 100m — the boards a hammer can
// appear on (75m, bit2, is excluded). The same mask driveHammerSprite gates on.
const HAMMER_BOARDS = 0x0b;

// The item/score sound trigger (0x6085), and how long this routine asserts it. Most callers of
// this trigger span store 3 (a 3-frame blip); a hammer pickup holds it for 64.
const PICKUP_SOUND = SND_TRIGGER + 5;
const PICKUP_SOUND_FRAMES = 64;

// Stride between the two records of the hammer pair (the one field with no names.js name).
const PAIR_STRIDE = 0x10; // 0x6680 -> 0x6690

export function latchHammerTouch(m) {
  const { regs, mem } = m;

  // Board gate — a hammer exists only on 25m/50m/100m. Closed, and nothing below happens.
  regs.a = HAMMER_BOARDS;
  if (!boardBitGate(m)) return;

  // Does Mario overlap either hammer this frame, and which one?
  findHammerOverlappingMario(m);
  const touching = regs.a; // 1 = overlapping a hammer, 0 = neither
  const matched = regs.b;  // 2 = the pair's first record, 1 = its second, 0 = no overlap

  // Latch the touch for the movement machine to consume after the landing freeze, and pulse
  // the pickup sound. Both writes are unconditional, so a miss clears whatever a touch set.
  mem.write8(MARIO_HAMMER_PENDING, touching);
  mem.write8(PICKUP_SOUND, touching ? PICKUP_SOUND_FRAMES : 0);

  // No overlap -> there is no record to select.
  if (matched === 0) return;

  // Mark the touched record as the hammer now in play, so the sprite driver animates that hammer
  // and the hammer-hit collision scan tests that record's hitbox.
  const touched = matched === 1 ? OBJ_PAIR_6680 + PAIR_STRIDE : OBJ_PAIR_6680;
  mem.write8(touched + HAMMER_IN_PLAY, 0x01);
}

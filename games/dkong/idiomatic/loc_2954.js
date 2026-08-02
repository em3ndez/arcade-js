// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2954 — latch whether Mario is touching one of the two hammer objects, select the one
 * he touched, and pulse the pickup sound.  ROM 0x2954.
 *
 * Reached from the movement machine's airborne tail (ROM 0x1C33) on the frames its counter
 * wraps, so it runs a handful of times per demo rather than every frame. Four steps:
 *
 *   1. A board gate first (boardBitGate with mask bit0/bit1/bit3 = 25m/50m/100m — exactly the
 *      boards a hammer can appear on, 75m excluded; the same mask driveHammerSprite uses).
 *      Closed and the whole latch is skipped, leaving every cell below untouched.
 *   2. loc_2974 tests Mario's position against the two-record hammer pair at OBJ_PAIR_6680 and
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
 *   4. On an overlap only, the touched record's +1 field is set to 1 — the pair's
 *      "this record is the selected/active one" flag. Two independent readers corroborate that
 *      meaning: loc_281d scans the pair for the first record whose +1 bit0 is set and treats
 *      that as the active special object, and driveHammerSprite reads bit0 of the FIRST
 *      record's +1 to choose which of the pair it animates (set -> record 0x6680, clear ->
 *      record 0x6690). Both readers therefore land on the record this routine marked. The
 *      flag is never cleared here, so a touch is sticky until the board re-initialises.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the callees take honest args): boardBitGate still
 * reads its board mask from the register file, and loc_2974 still returns nothing — it leaves
 * the search result in the registers findCollidingObject wrote. So this routine loads the mask
 * the way the oracle's call site does and reads the two result registers straight back.
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
 *           asserts for a score award) and OBJ_PAIR_6680 (0x6680) from ram.js. The pair's
 *           16-byte record stride and its +1 select flag have no ram.js name yet and stay local
 *           consts (the +1 name matches driveHammerSprite's local for the same field); the
 *           board mask is an immediate bit-flag, not an address. NAMESPACE: the pointer here
 *           addresses an OBJECT record (the pair loc_2974 just searched), so +1 belongs to the
 *           object-record field set — which has no 0x01 entry — and is NOT ram.js's
 *           SPRITE_CODE (+1 of a SPRITE record, a different namespace that merely collides
 *           numerically). boardBitGate (ROM 0x0030) and loc_2974 (ROM 0x2974) are direct-called.
 */

import { MARIO_HAMMER_PENDING, SND_TRIGGER, OBJ_PAIR_6680 } from "./ram.js";
import { boardBitGate } from "./boardBitGate.js"; // ROM 0x0030 (rst 0x30) — per-board skip gate
import { loc_2974 } from "./loc_2974.js";         // ROM 0x2974 — Mario vs. the hammer pair

// rst-0x30 board applicability mask: bit0 25m, bit1 50m, bit3 100m — the boards a hammer can
// appear on (75m, bit2, is excluded). The same mask driveHammerSprite gates on.
const HAMMER_BOARDS = 0x0b;

// The item/score sound trigger (0x6085), and how long this routine asserts it. Most callers of
// this trigger span store 3 (a 3-frame blip); a hammer pickup holds it for 64.
const PICKUP_SOUND = SND_TRIGGER + 5;
const PICKUP_SOUND_FRAMES = 64;

// Layout of the two-record hammer pair, for the fields with no ram.js name yet.
const PAIR_STRIDE = 0x10; // 0x6680 -> 0x6690
const OBJ_SELECT = 0x01;  // +1 bit0 = "this is the pair's selected/active record"

export function loc_2954(m) {
  const { regs, mem } = m;

  // Board gate — a hammer exists only on 25m/50m/100m. Closed, and nothing below happens.
  regs.a = HAMMER_BOARDS;
  if (!boardBitGate(m)) return;

  // Does Mario overlap either hammer this frame, and which one?
  loc_2974(m);
  const touching = regs.a; // 1 = overlapping a hammer, 0 = neither
  const matched = regs.b;  // 2 = the pair's first record, 1 = its second, 0 = no overlap

  // Latch the touch for the movement machine to consume after the landing freeze, and pulse
  // the pickup sound. Both writes are unconditional, so a miss clears whatever a touch set.
  mem.write8(MARIO_HAMMER_PENDING, touching);
  mem.write8(PICKUP_SOUND, touching ? PICKUP_SOUND_FRAMES : 0);

  // No overlap -> there is no record to select.
  if (matched === 0) return;

  // Mark the touched record as the pair's selected object, so the sprite driver animates that
  // hammer and the special-object collision scan reads that record.
  const touched = matched === 1 ? OBJ_PAIR_6680 + PAIR_STRIDE : OBJ_PAIR_6680;
  mem.write8(touched + OBJ_SELECT, 0x01);
}

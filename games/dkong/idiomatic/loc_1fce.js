// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1fce — step one object record's animation prescaler and, on the visit it runs out, swap the
 *            object's sprite to the other tile of an adjacent pair; then hand the frame on to the
 *            shared object-sprite tail.  ROM 0x1FCE.
 *
 * Reads and writes the record's animation prescaler (+0x0f). Reads and writes OBJ_SPRITE_CODE (+7),
 * but ONLY on the visit the prescaler expires on. Nothing else in the record is touched, and the
 * routine holds no address of its own — the record arrives in the caller's index register.
 *
 * The prescaler is stepped as a BYTE, so a prescaler of 0 goes to 255 rather than expiring; only a
 * result of exactly zero is expiry. On expiry the tile code's lowest bit is flipped and the
 * prescaler reloads to 4, so the object holds one tile for four visits and the other for the next
 * four. Exactly two ROM sites reach here, both by a jump, so control never returns to either:
 * ROM 0x1FAC, on the visits where the record's +0x17 does not equal the OBJ_Y it has just advanced,
 * and ROM 0x2104, when the record's OBJ_X plus 8 is 16 or more as a byte.
 *
 * WHAT THE ROLE LINE RESTS ON — measured on the real ROM, not read off this body. Over 604
 * dispatches in a 3000-frame attract run the prescaler arrives holding exactly 1, 2, 3 or 4
 * (151/149/153/151 times) and never anything else; per record the values step 4,3,2,1,4,… and the
 * tile code changes on the 1 and on no other visit. The three tile codes attract pairs up are
 * 22/23, 26/27 and 150/151 — pairs differing only in the lowest bit — and the flip is observed in
 * both directions, so it is a swap between two tiles and not a one-way set. OBJ_SPRITE_CODE is
 * itself grounded live in ram.js as the byte copied into the sprite record, and its bit 7 (not
 * bit 0) is the raster flip, so this changes which tile is drawn rather than how it is drawn —
 * corroborated by two of those three pairs being the SAME pair with bit 7 set (150/151 is 22/23
 * plus 128), which this routine never touches. The walk that reaches here visits an active record
 * once per frame — 305 of the 313 consecutive same-record gaps in a 1200-frame attract run are
 * exactly one frame — so four visits is four frames in practice.
 *
 * NOT CLAIMED: what the two tiles of a pair depict, and whether any reachable state delivers a
 * prescaler outside 1..4. The byte wrap at 0 is reproduced because the oracle has it and the gate
 * crafts it, not because it was observed. Record offset +0x0f is NOT a field with one meaning
 * across the object arrays — ram.js's ROUTINES entry for ROM 0x33A1 describes a record's +0x0f as a
 * height compared against 89 — so the prescaler reading is scoped to the records this walk drives
 * and the offset stays a file-local constant rather than a registry name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1fce.test.js.
 * GATE:     captured + crafted + live, ATTRACT ONLY. Every one of the 604 real dispatches in a
 *           3000-frame attract run is replayed inline at the dispatch — nothing sampled — covering
 *           all four prescaler values attract produces, all six record bases and all three tile
 *           pairs. One crafted arm forces the prescaler to 0 on a real capture, which attract never
 *           produces, to pin the byte wrap; it is proved non-vacuous by counting the dispatches on
 *           which the craft moves the ORACLE's own result. A live arm wires this routine at ROM
 *           0x1FCE for a 3000-frame cycle-free attract run and diffs every frame against the
 *           all-oracle baseline, asserting its own dispatch count so it cannot pass by never
 *           running. Credited gameplay, boards 2-4 and two-player are NOT covered — the walk this
 *           belongs to runs only while BOARD holds 1. Teeth: five broken twins.
 * LIVE-OUT: memory + pc + SP + the propagated return value, and NO register and NO flag.
 *           DERIVED: this routine's only exit is a jump into ROM 0x21BA, so its whole continuation
 *           is that chain. ROM 0x21BB overwrites the accumulator one instruction in, before anything
 *           reads it. The flags last a little longer — ROM 0x21BF rewrites all but the carry, ROM
 *           0x1F8E's index add rewrites the carry — and the first conditional anywhere on the path
 *           is the walk's slot counter at ROM 0x1F90, which reads a counter and not a flag. So
 *           neither is ever read, and both are dropped rather than modelled.
 *           MEASURED, because "dead" is a claim: the rewrite hands the frozen tail the accumulator
 *           and flags it found on ENTRY while the oracle hands it freshly computed ones, and the
 *           gate replays the ENTIRE remaining walk from that hand-off on both sides — a difference
 *           the tail chain read would surface as a state diff, and none does across all 604
 *           dispatches or the 3000-frame live run.
 *           The stack is COMPARED rather than excluded: this routine's own body pushes and pops
 *           nothing (its exit is a jump), and the tail chain that performs the single return runs
 *           identically on both sides, so STACK_SCRATCH, pc and SP legitimately agree and comparing
 *           them is free teeth.
 * NAMES:    OBJ_SPRITE_CODE (+7) is imported from ram.js. The prescaler at +0x0f has no ram.js name
 *           and is a file-local constant — see NOT CLAIMED above for why registering it would be a
 *           trap. ROM 0x21BA is still frozen and is reached through the registry; it belongs to the
 *           same mutually-recursive object-walk cluster as this routine and is being decompiled
 *           alongside it, so dissolving that call is a later coordinated step.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_SPRITE_CODE } from "./ram.js";

/** Object-record field: the animation prescaler (+0x0f) this routine steps. No ram.js name. */
const OBJ_ANIM_PRESCALER = 0x0f;
/** Visits per animation step — what the prescaler is reloaded with when it expires. */
const VISITS_PER_TILE = 4;

/**
 * @param {object} m  the machine. The object record arrives in the machine's index register and is
 *   deliberately NOT a parameter: the shared tail at ROM 0x21BA is still the frozen oracle and
 *   re-reads that register itself, so a caller passing a different record would be obeyed by the
 *   two writes here and ignored one call later. It becomes an honest parameter once that tail is
 *   decompiled.
 * @returns {*} whatever the shared tail's chain returns — undefined on every dispatch the gate
 *   observed; propagated rather than swallowed, so a skip further down the walk cannot be lost here.
 */
export function loc_1fce(m) {
  const { mem8 } = m;
  const record = m.regs.ix;

  // One visit off the prescaler, as a byte: 0 becomes 255 and is NOT expiry.
  let remaining = u8(mem8[record + OBJ_ANIM_PRESCALER] - 1);

  if (remaining === 0) {
    // Expired: show the other tile of the pair, and start the next step's countdown.
    mem8[record + OBJ_SPRITE_CODE] = mem8[record + OBJ_SPRITE_CODE] ^ 1;
    remaining = VISITS_PER_TILE;
  }
  mem8[record + OBJ_ANIM_PRESCALER] = remaining;

  // On into the shared object-sprite tail (still the frozen oracle).
  return m.call(0x21ba);
}

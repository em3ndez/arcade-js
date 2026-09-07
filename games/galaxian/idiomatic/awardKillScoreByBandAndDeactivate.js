// SPDX-License-Identifier: GPL-3.0-only

/**
 * awardKillScoreByBandAndDeactivate (ROM 0x125e) — the shared "an attacker just died" handler.
 *
 * WHAT IT IS
 *   Given the struck object record at IX, it retires the object and enqueues a score-add command whose
 *   parameter (the point value) is chosen by which of three score bands the object's packed
 *   formation-grid-cell field (record+7) falls into. It is a leaf of the collision code, not a state
 *   handler.
 *
 * ROLE IN THE MACHINE
 *   Both hit tests tail-call here: flagPlayerShotHitOnObject (0x123f, a player shot vs a diving alien) and
 *   flagObjectHitOnPlayer (0x12b6, a diver vs the ship) — see mechanisms.md "collision". Scoring and sound
 *   are never done inline; the routine appends a deferred word to the command ring via enqueueCommandWord
 *   (channel selector 3 = the BCD score-add handler at 0x21a6). The band scan reads record+7, byte 7 of
 *   the 8-byte object header (activity / dying-anim / AI-state / two position bytes / heading / direction / grid-cell),
 *   so different rows of the formation are worth different amounts.
 *
 * ROM 0x125e.  Grounding: [seen] (names.js cert for 0x125e).
 *
 * LIVE-OUT: the object record at IX (bytes 0/1/2 forced to 0/1/0 = inactive with the dying-anim flag set);
 *   the command ring (one channel-3 score-add word); and, on band-exhaust, the inhibit/request word
 *   loc_422b (0x422b) and the neighbour-bonus record loc_422d (0x422d). Returns enqueueCommandWord's value.
 */
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { bumpCountIfNeighborsInactive } from "./bumpCountIfNeighborsInactive.js";
import { loc_422b, ACTIVE_NEIGHBOR_COUNT, loc_422d } from "./names.js";

const REQUEST_HI = 3;       // high byte of the enqueued request word
const THRESHOLD = 0x50;     // band threshold
const BANDS = 3;
const BAND_STEP = 16;       // field drop per missed band
const NEIGHBOR_BONUS_AT = 2; // fold the neighbour bonus only at this active-neighbour count
const INHIBIT_REQUEST_WORD = (0xf0 << 8) | 1; // stored little-endian; also the restored ptr in HL

export function awardKillScoreByBandAndDeactivate(m, obj = m.regs.ix) {
  const { mem8, mem16 } = m;

  // Deactivate the struck object: byte 0 = 0 clears the activity flag (it is no longer a live attacker),
  // byte 1 = 1 raises the secondary/dying-animation flag so the death effect plays, and byte 2 = 0 resets
  // its AI state index. This is the header contract every object record uses (mechanisms.md object layout).
  mem8[obj + 0] = 0;
  mem8[obj + 1] = 1;
  mem8[obj + 2] = 0;

  // Band scan: the packed grid-cell field (record+7) is compared against THRESHOLD (0x50) up to three
  // times. The score request parameter is seeded at 4 and bumped once per missed band, and the field is
  // dropped by BAND_STEP (16) per miss — so the point value grows the further the field sits above 0x50.
  // The first band that falls under the threshold enqueues its channel-3 score-add word immediately.
  let param = 4;
  let field = mem8[obj + 7];
  for (let b = 0; b < BANDS; b++) {
    if (field < THRESHOLD) return enqueueCommandWord(m, (REQUEST_HI << 8) | param);
    param = (param + 1) & 0xff;
    field = (field - BAND_STEP) & 0xff;
  }

  // All three bands missed (top-value kill): raise the inhibit/request word loc_422b (0x422b = 0xf001,
  // little-endian). Then fold in a neighbour bonus, but only when exactly two neighbours are active
  // (ACTIVE_NEIGHBOR_COUNT == 2): bumpCountIfNeighborsInactive adds one when both look-ahead slots are
  // inactive — this is the "shot the last of a diving trio" bonus. Record the bonus at loc_422d (0x422d),
  // fold it into the request parameter, and enqueue the channel-3 score-add word (INHIBIT_REQUEST_WORD is
  // also passed as the restored HL pointer the ROM leaves live).
  mem16[loc_422b] = INHIBIT_REQUEST_WORD;
  let bonus = mem8[ACTIVE_NEIGHBOR_COUNT];
  if (bonus === NEIGHBOR_BONUS_AT) bonus = bumpCountIfNeighborsInactive(m, bonus, obj);
  mem8[loc_422d] = bonus;
  const folded = (bonus + param) & 0xff;
  return enqueueCommandWord(m, (REQUEST_HI << 8) | folded, INHIBIT_REQUEST_WORD);
}

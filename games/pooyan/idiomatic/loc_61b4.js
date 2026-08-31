// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_60f2 } from "./loc_60f2.js";
import { loc_6080 } from "./loc_6080.js";
import { loc_6287 } from "./loc_6287.js";
import { loc_630f } from "./loc_630f.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { fillByteRun } from "./fillByteRun.js";
import { queueSoundCommand05 } from "./queueSoundCommand05.js";
import {
  FLIP_SCREEN_FLAG,
  ROUND_COUNTER,
  ENEMY_ACTOR_TABLE,
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  POSITION_DELTA_TABLE_6358,
  ANIM_SCRIPT_6343,
} from "./names.js";
/**
 * loc_61b4 — the odd-round collision handler of the object-proximity collision scan.
 *
 * WHAT IT IS
 * ----------
 * One record's worth of the per-frame collision sweep, taken on ODD rounds. The scan head
 * (loc_6069) has already confirmed the current record at `hl` is live; because the round counter
 * (ROUND_COUNTER, 0x8907) has bit 0 set, it routes control here instead of to the even-round
 * distance gate (loc_6080). This handler decides, for one live record, whether a matching enemy has
 * been struck and — when it has — pays the hit out: it steps a round-indexed position/score delta
 * into both the record and the struck enemy slot, re-arms that slot, wipes the parity target
 * buffer, and fires the hit sound.
 *
 * The record's collision tag (the byte at record+0x14) is the KEY. The handler first walks the
 * enemy actor pool (ENEMY_ACTOR_TABLE, 0x8ae0, stride 0x18) for a slot whose own tag (+0x14) equals
 * that key:
 *   - No matching slot, or a slot that is BUSY (its +0x0b field non-zero) -> fall back to the
 *     even-round distance gate (loc_6080), which re-tests the pair purely by proximity.
 *   - A matching, free slot -> read its STATE byte (+0x16) and dispatch on its high nibble:
 *       nibble 0x00           -> the distance gate (loc_6080);
 *       nibble 0x50 or 0xd0   -> the boundary/bounce handler (loc_6287);
 *       nibble 0xf0           -> the tight bounding-box handler (loc_630f);
 *       nibble 0x40 / default -> the AWARD path below.
 *
 * The award path first re-checks that the actor and the struck object genuinely overlap (the same
 * flip-biased per-axis window the distance gate uses); an out-of-range pair is dropped to the scan
 * epilogue (loc_60f2) so the sweep continues to the next pair. On a real overlap it pays out.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * The odd-round branch of the per-record collision test inside the object-proximity collision scan
 * (see mechanisms.md "The object-proximity collision scan"). loc_6069 decides a record is worth
 * testing and picks the branch by round parity: the even round runs loc_6080, this odd round runs
 * loc_61b4. Where loc_6080 is a pure distance gate, this handler adds the tag-keyed enemy lookup and
 * the nibble dispatch, and owns the position/score award a scored hit produces.
 *
 * ROM: 0x61b4 (0x61b4-0x6286).
 * Grounding: [code].
 *
 * INPUTS
 *   hl    — the current record pointer; +0x14 is its collision tag (the scan key), +0x0a its
 *           position/score delta field.
 *   ix    — the moving actor's coordinate slot: screen X at +0, screen Y at +2 (read by the
 *           proximity re-check, and latched as the award's target record).
 *   iy    — the reference object's coordinate slot: screen X at +0, screen Y at +2.
 *   count — records still to sweep; forwarded to the gate/epilogue so the loop can continue.
 *   ireg  — the interrupt vector register; its zero/non-zero parity picks which of the two target
 *           buffers (ENEMY_TARGET_REC0 / ENEMY_TARGET_REC1) the award wipes.
 *
 * LIVE-OUT
 *   A boolean forwarded from whichever path is taken:
 *     - true  = normal completion (the sweep may continue; the frame is not unwound);
 *     - false = a caller-skip: the award fired, and the caller's frame must be unwound.
 */
// -- Record / enemy-slot field offsets and scan constants ------------------------------------
// A "record" is one entry of the actor array the scan walks (pointed to by `hl`); an enemy "slot"
// is one entry of the enemy actor pool at ENEMY_ACTOR_TABLE (0x8ae0), spaced SLOT_STRIDE apart.
//   TAG_OFFSET       +0x14 — the collision tag; compared record-vs-slot to find the struck enemy.
//   SLOT_STRIDE      0x18  — bytes between consecutive enemy slots (ROM `ld bc,0x0018` / `ld de,..`).
//   FIRST_SCAN_SLOTS 5     — slots walked by the initial tag search (ROM `ld l,0x05` at 0x61c6).
//   BUSY_FIELD       +0x0b — non-zero marks a slot already engaged this frame -> declines the match.
//   STATE_FIELD      +0x16 — the slot's state byte; its high nibble selects the dispatch branch.
//   DELTA_FIELD      +0x0a — the position/score delta accumulator the award steps.
//   REARM_BIT        0x10  — bit 4, set into STATE_FIELD to re-arm the struck slot (ROM `set 4`).
//   X_GAP_LIMIT/Y_GAP_LIMIT 9 / 8 — the per-axis overlap window of the award's proximity re-check.
//   REFIND_SLOTS     6     — slots walked when re-finding the struck slot for the award (`ld c,0x06`).
//   TARGET_WIPE_LEN  0x18  — bytes zero-filled from the parity target buffer on a scored hit.
const TAG_OFFSET = 0x14;
const SLOT_STRIDE = 0x18;
const FIRST_SCAN_SLOTS = 0x05;
const BUSY_FIELD = 0x0b;
const STATE_FIELD = 0x16;
const DELTA_FIELD = 0x0a;
const REARM_BIT = 0x10;
const X_GAP_LIMIT = 0x09;
const Y_GAP_LIMIT = 0x08;
const REFIND_SLOTS = 0x06;
const TARGET_WIPE_LEN = 0x18;

export function loc_61b4(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  // Read the record's collision tag (record+0x14) as the scan KEY. The address arithmetic keeps the
  // high byte fixed and wraps only the low byte (ROM 0x61b9-0x61bd: `ld a,l` / `add 0x14` / `ld l,a`
  // / `ld a,(hl)`), so the +0x14 field is fetched from within the record's own 256-byte page.
  const key = mem8[(hl & ~0xff) | ((hl + TAG_OFFSET) & 0xff)];

  // -- Tag search: locate the struck enemy slot ----------------------------------------------
  // Walk the enemy actor pool (ENEMY_ACTOR_TABLE, 0x8ae0) for a slot whose tag (+0x14) equals the
  // key. `stateByte` stays -1 until a usable match is found. A BUSY slot (+0x0b non-zero) is one
  // already engaged this frame: it matches the tag but declines to be re-hit, so the loop breaks
  // with stateByte still -1 and control falls to the distance gate. (ROM loop head 0x61c6.)
  let slot = ENEMY_ACTOR_TABLE;
  let stateByte = -1;
  for (let n = 0; n < FIRST_SCAN_SLOTS; n++, slot = u16(slot + SLOT_STRIDE)) {
    // Wrong tag: keep scanning the remaining slots.
    if (key !== mem8[u16(slot + TAG_OFFSET)]) continue;
    if (mem8[u16(slot + BUSY_FIELD)] !== 0) break; // busy -> proximity gate
    // Matched and free: capture the state byte and stop the search.
    stateByte = mem8[u16(slot + STATE_FIELD)];
    break;
  }
  // No usable match (no slot's tag equalled the key, or the only match was busy): hand the pair to
  // the even-round distance gate, which decides the hit purely by proximity. (ROM `jp 0x6080`.)
  if (stateByte < 0) return loc_6080(m, hl, ix, count, iy, ireg); // no usable match

  // -- Nibble dispatch on the matched slot's state byte --------------------------------------
  // The high nibble of the slot's STATE_FIELD (+0x16) names how this collision should resolve.
  const nibble = stateByte & 0xf0;
  // 0x00: treat as a plain proximity case -> the distance gate (ROM `jp z,0x6080`).
  if (nibble === 0x00) return loc_6080(m, hl, ix, count, iy, ireg);
  // 0x50 / 0xd0: the boundary/bounce handler resolves this kind (ROM `jp z,0x6287`).
  if (nibble === 0x50 || nibble === 0xd0) return loc_6287(m, nibble, hl, ix, count, iy, ireg);
  // 0xf0: the tight bounding-box handler resolves this kind (ROM `jp z,0x630f`).
  if (nibble === 0xf0) return loc_630f(m, hl, ix, count, iy, ireg);
  // 0x40 and every other nibble fall through to the proximity re-check + award below.

  // -- Proximity re-check guarding the award -------------------------------------------------
  // Before paying out, confirm the actor (ix) and the reference object (iy) actually overlap, using
  // the same flip-biased per-axis window as loc_6080. A sprite's horizontal hotspot shifts with
  // screen orientation, so the actor X picks up +6 upright / -2 mirrored (ROM 0x61fe-0x6206 read
  // FLIP_SCREEN_FLAG at 0x881f); both Y coordinates shift +8 to their sprite midpoints.
  const bias = mem8[FLIP_SCREEN_FLAG] !== 0 ? 6 : -2;
  const ax = (mem8[ix] + bias) & 0xff;
  const ay = (mem8[u16(ix + 2)] + 8) & 0xff;
  // X too far apart (|gap| >= 9, ROM `cp 0x09` at 0x621b) -> not a hit: drop to the scan epilogue
  // (loc_60f2), which advances to the next actor/record pair and continues the sweep.
  if (Math.abs(mem8[iy] - ax) >= X_GAP_LIMIT) return loc_60f2(m, hl, ix, count, iy, ireg);
  // Y too far apart (|gap| >= 8, ROM `cp 0x08` at 0x622a) -> likewise not a hit.
  if (Math.abs(((mem8[u16(iy + 2)] + 8) & 0xff) - ay) >= Y_GAP_LIMIT) return loc_60f2(m, hl, ix, count, iy, ireg);

  // -- Award path: a scored hit -------------------------------------------------------------
  // Install the hit animation on the record (ANIM_SCRIPT_6343, ROM 0x6233 `ld de,0x6343` then the
  // animation-restart at 0x381e); this repoints the record at that sequence and restarts it.
  setActorAnimation(m, hl, ANIM_SCRIPT_6343);
  // Pick the round-indexed position/score delta: index = (ROUND_COUNTER & 7) >> 1 selects one entry
  // of POSITION_DELTA_TABLE_6358 (ROM 0x623c-0x6240: mask, `rra`, rst 0x20 byte lookup).
  const index = (mem8[ROUND_COUNTER] & 0x07) >> 1;
  const [d1] = fetchByteFromTableIndex(m, POSITION_DELTA_TABLE_6358, index);
  // Step that delta into the record's own delta field (record+0x0a, ROM 0x6244-0x6248).
  mem8[u16(hl + DELTA_FIELD)] = mem8[u16(hl + DELTA_FIELD)] + d1;

  // Re-find the struck enemy slot so it can be awarded too. This second walk covers six slots (one
  // more than the initial search), starting again at ENEMY_ACTOR_TABLE and matching on the record's
  // tag (record+0x14, ROM 0x624c-0x625e). `remaining` counts 6..1 and stops on match or exhaustion.
  const tag = mem8[u16(hl + TAG_OFFSET)];
  let found = ENEMY_ACTOR_TABLE;
  for (let remaining = REFIND_SLOTS; ; ) {
    if (tag === mem8[u16(found + TAG_OFFSET)]) break;
    found = u16(found + SLOT_STRIDE);
    remaining = (remaining - 1) & 0xff;
    if (remaining === 0) break;
  }
  // Step the (freshly looked-up) delta into the struck slot's delta field (slot+0x0a) and re-arm the
  // slot by setting bit 4 of its state byte (slot+0x16, ROM 0x6261-0x6274 `set 4,(iy+0x16)`).
  const [d2] = fetchByteFromTableIndex(m, POSITION_DELTA_TABLE_6358, index);
  mem8[u16(found + DELTA_FIELD)] = mem8[u16(found + DELTA_FIELD)] + d2;
  mem8[u16(found + STATE_FIELD)] = mem8[u16(found + STATE_FIELD)] | REARM_BIT;

  // Clear the parity-selected target buffer: the interrupt register's parity picks ENEMY_TARGET_REC1
  // (0x8ca8) when non-zero, else ENEMY_TARGET_REC0 (0x8c90), and TARGET_WIPE_LEN (0x18) bytes are
  // zeroed there (ROM 0x6277-0x6282: `ld a,i` selects the buffer, rst 0x10 fills 0x18 zero bytes).
  fillByteRun(m, ireg !== 0 ? ENEMY_TARGET_REC1 : ENEMY_TARGET_REC0, 0x00, TARGET_WIPE_LEN);
  // Fire the hit sound (fixed sound command 0x05, ROM 0x6282 call 0x0ef1).
  queueSoundCommand05(m);
  // The award consumed the hit and unwinds one frame above the caller: report the caller-skip.
  return false; // caller-skip: unwind the caller's frame
}

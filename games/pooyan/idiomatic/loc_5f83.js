// SPDX-License-Identifier: GPL-3.0-only
import { testRecordOverlapRetireOrFlagHit } from "./testRecordOverlapRetireOrFlagHit.js";
import {
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  ACTIVE_OBJECT_TYPE,
  ENEMY_ACTOR_TABLE,
  ENEMY_SCAN_BOX_TABLE,
} from "./names.js";
/**
 * loc_5f83 — arm and enter the enemy-record overlap scan for one interrupt-parity slot.
 * ROM 0x5f83 (0x5f83-0x5fa1). Grounding: [seen].
 *
 * WHAT IT IS
 *   The setup half of one pass of the actor-record overlap collision test. Two presence blocks
 *   describe the two things this pass can be aiming at — ENEMY_TARGET_REC0 (0x8c90) and its
 *   partner ENEMY_TARGET_REC1 (0x8ca8), one 0x18-byte record on. Which of the two this pass owns
 *   is chosen by the interrupt vector register (the same even/odd parity the whole collision
 *   pipeline splits on): a zero selector picks the first block, a non-zero selector the second.
 *   The chosen block's lead byte carries both its liveness and its kind — zero means "nothing
 *   armed here", any non-zero value is the object kind that will drive the overlap thresholds.
 *
 * ITS ROLE IN THE MACHINE
 *   This is the arm-and-enter step that precedes the six-slot overlap pass (see mechanisms.md
 *   "The object-proximity collision scan"). When the selected block is live it publishes the kind
 *   as the machine-wide active hit type (ACTIVE_OBJECT_TYPE, 0x8d44) — that byte is the tighter-
 *   vs-wider threshold selector the overlap test reads back, and the value later handlers key on —
 *   then walks the six enemy actor records at ENEMY_ACTOR_TABLE (0x8ae0), measuring each against
 *   the caller's target box using the coordinate boxes at ENEMY_SCAN_BOX_TABLE (0x8850). A full
 *   overlap either retargets/retires the struck record (type 3) or flags the struck cells and
 *   enqueues the hit sound; either way it unwinds the frame. An inert block does nothing and lets
 *   the caller's sweep move on to its next slot.
 *
 * INPUTS
 *   slot   — the interrupt-parity selector (the interrupt vector register): 0 selects the first
 *            presence block, non-zero the second.
 *   target — the caller's target box (the coordinate record the enemy boxes are measured against).
 *
 * LIVE-OUT
 *   A boolean the caller's sweep reads as continue/abort, folding the two hardware exits into one:
 *     - true  — the slot completed normally: an inert block, or a scan that found no overlap. The
 *               caller continues to its remaining slot.
 *     - false — a hit inside the scan unwound the frame past the caller's loop; the caller stops.
 *   Memory effect: on a live block the latched kind is left in ACTIVE_OBJECT_TYPE (0x8d44); the
 *   overlap pass owns any further record/flag/sound writes. No register value is read back.
 */
// The overlap scan considers the first six enemy actor records (B = 6 in the ROM at 0x5f9d).
const SCAN_RECORD_COUNT = 6;

export function loc_5f83(m, slot = m.regs.i, target = m.regs.iy) {
  const { mem8 } = m;
  // --- Pick this pass's presence block by interrupt parity + read its lead byte ------------------
  // ROM 0x5f83-0x5f94: seed IX with the first block (0x8c90), sample the interrupt vector register
  // (`ld a,i`), and swap to the second block (0x8ca8 = 0x8c90 + 0x18) when that register is non-
  // zero. The block's lead byte (ix+0) is both its liveness flag and its object kind.
  const type = mem8[slot === 0 ? ENEMY_TARGET_REC0 : ENEMY_TARGET_REC1];
  // ROM 0x5f93-0x5f94 (`and a` / `ret z`): a zero lead byte is an inert block — nothing is armed
  // in this slot, so the pass completes without touching the scan and the caller's sweep moves on.
  if (type === 0) return true; // inert block -> normal completion
  // --- Live block: publish the kind as the active hit type ----------------------------------------
  // ROM 0x5f95 (`ld (0x8d44),a`): latch the kind into the machine-wide ACTIVE_OBJECT_TYPE so the
  // overlap test can pick its per-axis threshold window (wider for type 3, tighter otherwise) and
  // later handlers can branch on it. The same value is also handed straight into the scan below.
  mem8[ACTIVE_OBJECT_TYPE] = type;
  // --- Enter the six-slot overlap scan -----------------------------------------------------------
  // ROM 0x5f98-0x5fa2: seat the scan operands — the kind as its threshold selector (`ld c,a`), the
  // coordinate boxes at ENEMY_SCAN_BOX_TABLE (0x8850, `ld ix,0x8850`), the record count (`ld b,6`),
  // and the enemy actor records at ENEMY_ACTOR_TABLE (0x8ae0, `ld hl,0x8ae0`) — then fall through
  // into the scan against the caller's target box. Its boolean is this pass's result.
  return testRecordOverlapRetireOrFlagHit(m, ENEMY_ACTOR_TABLE, ENEMY_SCAN_BOX_TABLE, SCAN_RECORD_COUNT, type, target);
}

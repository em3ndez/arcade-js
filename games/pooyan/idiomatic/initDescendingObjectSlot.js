// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { storeActorAnimationPointer } from "./storeActorAnimationPointer.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  ROUND_COUNTER,
  SPAWN_ANIM_WORD_TABLE,
  SPAWN_ANIM_SEQ,
  SPAWN_SWEEP_TRIGGER,
} from "./names.js";
/**
 * initDescendingObjectSlot — birth a new descending object into one record of the spawn-object
 * table.  ROM 0x42da–0x432c.  [seen]
 *
 * WHAT IT IS.  Every on-screen actor — Pooyan, an enemy, a projectile, a falling object — lives in
 * a small fixed-layout record, and the spawn-object table is a short pool of such records (three
 * of them, one stride apart).  Something has to be created and dropped down the playfield; this is
 * the routine that takes a single empty pool record and turns it into a live, animated, falling
 * object.  The record to fill arrives as `slot`; the parent record that launched this spawn (and
 * whose position the new object inherits) arrives as `source`.
 *
 * ROLE IN THE MACHINE.  It is the per-slot body of the spawn sweep: the caller walks the three
 * pool records and hands each one here in turn, looking for the first empty one to populate.  The
 * routine reports back with a boolean so the caller knows whether to keep walking:
 *   - the slot is already occupied  -> return TRUE, and the caller advances to the next record;
 *   - the slot was empty and is now seeded -> return FALSE, which tells the caller to STOP the
 *     sweep immediately.  Exactly one object is born per eligible pass; the moment a slot is
 *     claimed the whole sweep unwinds and the frame moves on.
 *
 * LIVE-OUT.  Memory (the freshly seeded `slot` record, plus a few fields poked in the `source`
 * record and the cleared spawn-sweep trigger) and the boolean.  No register result.
 */
const LIVE_BIT = 0x01; // bit0 of (slot+0)|(slot+1): the slot is occupied

export function initDescendingObjectSlot(m, slot = m.regs.iy, source = m.regs.ix) {
  const { mem8 } = m;

  // -- Occupancy guard --------------------------------------------------------------------------
  // A record's two-byte header (slot+0, slot+1) doubles as its liveness flag: bit0 set in either
  // byte means the slot is already carrying an object.  OR the two header bytes and test bit0; if
  // it is set this slot is busy, so leave it untouched and report TRUE so the caller's sweep skips
  // past it to the next pool record.
  if (((mem8[slot] | mem8[slot + 1]) & LIVE_BIT) !== 0) return true; // slot busy -> normal return

  // -- Claim the record -------------------------------------------------------------------------
  // The slot was empty.  Stamp it live (header byte slot+0 = 1) and seed the state index at
  // slot+2 to 0x0d — the state-machine entry point for a freshly spawned descending object, the
  // handler slot the per-record dispatcher will route it to on the next frame.
  mem8[slot] = 0x01; // mark the slot active
  mem8[slot + 2] = 0x0d; // seed the state byte

  // -- Inherit the parent's position block ------------------------------------------------------
  // Copy the four coordinate/flag bytes at source+3..source+6 into slot+3..slot+6, so the new
  // object appears at the parent's location (the Y coordinate lives at record+4, inside this
  // block).  Both pointers step only their low byte — a record never straddles a 256-byte page,
  // so the copy walks forward within the page (u16 keeps the arithmetic 16-bit).
  let src = (source & ~0xff) | ((source + 3) & 0xff); // source+3 (low-byte inc, page-local)
  let dst = (slot & ~0xff) | ((slot + 3) & 0xff); // slot+3
  for (let i = 0; i < 4; i++) {
    mem8[dst] = mem8[src]; // copy the 4-byte position block
    src = u16(src + 1);
    dst = u16(dst + 1);
  }

  // -- Seed the descent velocity pair -----------------------------------------------------------
  // slot+0x09 and slot+0x0a are the movement magnitude and its two's-complement negation (the
  // same value in the opposite direction), the pair the motion handlers read to step the object.
  // Both are fixed here: 0x2a and -0x2a (0xd6), a constant descent for this object type rather
  // than the round-scaled facing pair the enemy spawner uses.
  mem8[slot + 0x09] = 0x2a;
  mem8[slot + 0x0a] = 0xd6; // -0x2a (negated)

  // -- Choose and install the falling animation -------------------------------------------------
  // The object's look changes with the round.  Derive a 4-entry table index from the round
  // counter (0x8907) as ((round >> 1) - 1) & 3, read the corresponding animation-script pointer
  // out of the word table at ROM 0x432d, and install it into the slot record — the installer
  // writes the pointer to slot+0x0c/0x0d and rewinds the frame index at slot+0x0e to step 0 so the
  // new object plays its animation from the top.
  const idx = ((mem8[ROUND_COUNTER] >> 1) - 1) & 0x03; // round-derived table index
  const animPtr = fetchWordFromTableIndex(m, idx, SPAWN_ANIM_WORD_TABLE); // word from the anim table
  storeActorAnimationPointer(m, slot, animPtr); // install into the slot record

  // -- Disarm the sweep trigger and re-animate the parent ---------------------------------------
  // A spawn was requested by arming the sweep trigger at 0x8d5b; now that it has been serviced,
  // clear it so it fires only once.  Then point the SOURCE (parent) record at its fixed
  // post-spawn animation sequence (ROM 0x4347) — the launcher switches to its own after-launch
  // look — again rewinding that record to the first frame.
  mem8[SPAWN_SWEEP_TRIGGER] = 0x00;
  setActorAnimation(m, source, SPAWN_ANIM_SEQ); // seat the fixed anim sequence in the source record

  // -- Pace both records and advance the parent -------------------------------------------------
  // Field +0x11 is the per-record frame-delay/pacing byte: give the parent a long 0x30 hold and
  // the new object a short 0x04.  Finally bump the parent's state index (source+2) by one so the
  // launcher steps to its next state now that it has produced this child (the byte write wraps to
  // 8 bits).
  mem8[source + 0x11] = 0x30;
  mem8[slot + 0x11] = 0x04;
  mem8[source + 2] = mem8[source + 2] + 1; // bump the source's state byte (mem8 write truncates)

  // The slot was seeded, so tell the caller to abort its spawn sweep — one object born this pass.
  return false; // slot initialized -> caller-skip (abort the spawn loop)
}

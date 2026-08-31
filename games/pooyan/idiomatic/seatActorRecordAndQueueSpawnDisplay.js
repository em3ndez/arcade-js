// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  SIGNATURE_MISMATCH_FLAG,
  SHARED_FRAME_DELAY_TIMER,
  ROUND_COUNTER,
  OBJECT_SPAWN_DISPLAY_CMD,
  OBJECT_SPAWN_DISPLAY_CMD_ALT,
} from "./names.js";
/**
 * seatActorRecordAndQueueSpawnDisplay — bring one on-screen object to life.
 *
 * WHAT IT IS: the seeder for a single object record. Every moving thing in the game
 * (enemies, the arrow, hanging objects, bonus-wave birds) is described by a fixed-layout
 * state block called an object record. This routine takes one such block, stamps the bytes
 * that mean "I am a brand-new, active object at this spot", and then asks the display system
 * to actually draw it. It is the moment a record goes from empty to live.
 *
 * ROLE IN THE MACHINE: it runs once per object at group-setup time. The actor-group setup
 * handler walks a short run of records and calls this on each, so a whole cluster of objects
 * comes on screen from one setup pass. To make the cluster appear staggered instead of stacked
 * on one row, the handler shares a single countdown across the group and this routine both reads
 * and steps that countdown (see step 3), so each successive record is seated two rows apart.
 *
 * THE RECORD LAYOUT touched here (the sprite display list is rebuilt from these same offsets,
 * reading +6 as the Y/row byte, +0x10 as the attribute byte, +4 as the X byte, +0x0f as the
 * sprite/tile code):
 *   +0      active flag (bit0 set = this slot is live); +0 and +1 together form the id word
 *   +3, +5  cleared to zero (sub-position / scratch fields start clean)
 *   +4      X coordinate  = 0x15
 *   +6      Y / row byte  = snapshot of the shared frame-delay countdown
 *   +8, +9  facing / motion bytes = 0x30, 0xf0
 *   +0x0f   sprite/tile code = 0x03
 *   +0x10   attribute byte  = 0xc0 (both hardware flip bits set, colour nibble 0)
 *
 * ROM address: 0x6523. Grounding: [seen].
 *
 * LIVE-OUT: none — the whole effect is in memory. What survives the call is the freshly stamped
 * record bytes, the shared frame-delay countdown lowered by two, and the one or two spawn
 * commands appended to the display-command ring.
 */

export function seatActorRecordAndQueueSpawnDisplay(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — eligibility gates. Two reasons to abandon this record untouched.
  // (a) The record's id word is the pair (rec+0, rec+1); OR-ing the two low bits and testing
  //     bit0 rejects any record whose id word is odd — an odd slot is not one this seeder owns.
  // (b) The signature-mismatch flag SIGNATURE_MISMATCH_FLAG (0x8ef0) is the machine's anti-tamper
  //     latch; while it is held nonzero, object spawning is frozen and we bail.
  if (((mem8[rec + 0] | mem8[rec + 1]) & 0x01) !== 0) return;
  if (mem8[SIGNATURE_MISMATCH_FLAG] !== 0) return;

  // Step 2 — stamp the opening state into the record. Mark it active (bit0 at +0), clear the two
  // scratch fields (+3, +5), and plant the fixed X coordinate (+4 = 0x15). These are the "born
  // here, alive now" bytes every fresh object starts from.
  mem8[rec + 0] = 0x01; // active
  mem8[rec + 3] = 0x00;
  mem8[rec + 5] = 0x00;
  mem8[rec + 4] = 0x15;

  // Step 3 — position this object on the shared cadence. The Y/row byte (+6) is taken from the
  // group's shared frame-delay countdown SHARED_FRAME_DELAY_TIMER (0x8929); then that countdown is
  // dropped by two so the next record seated in the same setup pass lands two rows further along.
  // This is what fans a seated group out into a staggered column rather than one stacked point.
  mem8[rec + 6] = mem8[SHARED_FRAME_DELAY_TIMER]; // snapshot the shared frame-delay counter
  mem8[SHARED_FRAME_DELAY_TIMER] = mem8[SHARED_FRAME_DELAY_TIMER] - 2; // step it down by two

  // Step 4 — plant the fixed appearance/motion bytes. +0x0f is the sprite/tile code (0x03) and
  // +0x10 the attribute byte (0xc0 = both flip bits set, colour nibble 0); +8/+9 (0x30, 0xf0) are
  // the object's facing/motion bytes. Together these decide what the object looks like and which
  // way it heads the frame it appears.
  mem8[rec + 0x0f] = 0x03;
  mem8[rec + 0x10] = 0xc0;
  mem8[rec + 0x08] = 0x30;
  mem8[rec + 0x09] = 0xf0;

  // Step 5 — announce the spawn to the display system. The object-spawn display command
  // OBJECT_SPAWN_DISPLAY_CMD (0x0611) is appended to the display-command ring so the per-frame
  // consumer actually brings the object on screen. On the very first round only — ROUND_COUNTER
  // (0x8907) still zero — a second command OBJECT_SPAWN_DISPLAY_CMD_ALT (0x0607) is queued too;
  // once past round zero this early return skips that extra command.
  enqueueDisplayCommand(m, OBJECT_SPAWN_DISPLAY_CMD);
  if (mem8[ROUND_COUNTER] !== 0) return;
  enqueueDisplayCommand(m, OBJECT_SPAWN_DISPLAY_CMD_ALT);
}

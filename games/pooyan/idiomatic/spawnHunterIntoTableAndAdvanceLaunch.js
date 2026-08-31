// SPDX-License-Identifier: GPL-3.0-only
import {
  PLAY_MODE_LATCH,
  HUNTER_TABLE_BASE,
  HUNTER_RECORD_PTR,
  LAUNCH_STATE,
  HUNTER_SPAWN_FLIP_FLAG,
  HUNTER_SPAWN_COUNTDOWN,
  HUNTER_SPAWN_SUBCOUNTER,
  HUNTER_SPAWN_DISPLAY_CMD,
} from "./names.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { u16 } from "../../../core/int.js";
/**
 * spawnHunterIntoTableAndAdvanceLaunch — launch-state-machine state 2: seed a new hunter, then advance the state.
 *
 * WHAT IT IS: state 2 of the arrow/launch state machine. The launch machine is a small
 * five-state sequence, selected by the low three bits of LAUNCH_STATE (0x8f30), that drives the
 * on-screen launch arrow and, off the back of it, spawns the "hunter" attackers. The earlier
 * states arm and animate the arrow and claim a target record; this state is where an actual
 * hunter is born into the world, after which the machine hands off to the state-3 post-spawn
 * hold. It runs once per frame while LAUNCH_STATE names state 2.
 *
 * ROLE IN THE MACHINE: the producer of new hunters. A hunter occupies one record in the
 * six-slot hunter table at HUNTER_TABLE_BASE (0x8c78) — a bank of 0x18-byte actor records laid
 * out DOWNWARD in memory (each successive record is one stride LOWER in address). This handler
 * finds the first free record, stamps in the fixed opening template for a fresh hunter, and
 * remembers where it put it so the following launch state can finish the birth.
 *
 * ROM 0x2856-0x28ac (launch-state dispatch slot 2). Grounding: [seen].
 *
 * LIVE-OUT: memory only. It leaves behind (1) a freshly seeded hunter record in the 0x8c78
 * table, (2) that record's address in HUNTER_RECORD_PTR (0x8f32) for state 3 to consume,
 * (3) LAUNCH_STATE (0x8f30) bumped from 2 to 3, and (4) either a seeded spawn countdown
 * HUNTER_SPAWN_COUNTDOWN (0x8f34) plus a queued display command, or a bumped
 * HUNTER_SPAWN_SUBCOUNTER (0x8f5d), depending on the flip flag. No caller reads its scratch.
 */

const HUNTER_SLOT_COUNT = 6; //      the hunter table holds six records
const HUNTER_RECORD_STRIDE = 0x18; // records step DOWNWARD by one 0x18-byte stride

export function spawnHunterIntoTableAndAdvanceLaunch(m) {
  const { mem8 } = m;

  // The whole seed step is skipped while the play-mode latch PLAY_MODE_LATCH (0x8f50) is set.
  // That latch (values 0/1/2) marks the alternate play-state paths where a hunter must not be
  // born here; in that case the machine still advances its state below but plants no record.
  if (mem8[PLAY_MODE_LATCH] === 0) {
    // Scan the six hunter records for the first FREE one. The table base HUNTER_TABLE_BASE
    // (0x8c78) is the TOP record; each step subtracts one 0x18 stride to walk DOWNWARD through
    // memory. A record is free when both of its two leading bytes (rec+0 and rec+1, the
    // record-active flags) are zero — an occupied hunter keeps at least one of them nonzero.
    let rec = HUNTER_TABLE_BASE;
    let free = false;
    for (let n = 0; n < HUNTER_SLOT_COUNT; n++) {
      if (mem8[rec] === 0 && mem8[rec + 0x01] === 0) { free = true; break; }
      rec = u16(rec - HUNTER_RECORD_STRIDE); // next record is one stride lower (16-bit wrap)
    }
    if (!free) return; // all six slots occupied: bail without touching anything

    // With a free slot in hand, stamp the fixed opening template for a new hunter into the record.
    // Byte +1 is the record's opening state/kind (0x05); bytes +2..+6 are its initial
    // coordinate/parameter bytes; bytes +0x0f and +0x10 are the two sprite tile codes the hunter
    // draws with. These constants are the same for every hunter — the spawn is a fixed birth,
    // with per-hunter motion supplied later by its movement script.
    mem8[rec + 0x01] = 0x05;
    mem8[rec + 0x02] = 0x10;
    mem8[rec + 0x03] = 0x00;
    mem8[rec + 0x04] = 0x08;
    mem8[rec + 0x05] = 0x00;
    mem8[rec + 0x06] = 0x1a;
    mem8[rec + 0x0f] = 0x37;
    mem8[rec + 0x10] = 0x42;
    // Record the address of the seeded hunter so the state-3 post-spawn hold can reach the same slot
    // (it drains a countdown and then clears this record). HUNTER_RECORD_PTR (0x8f32) is a 16-bit
    // work-RAM word stored little-endian: low byte first, then high byte.
    mem8[HUNTER_RECORD_PTR] = rec;
    mem8[HUNTER_RECORD_PTR + 0x01] = rec >> 8;
  }

  // Advance the launch state machine: LAUNCH_STATE (0x8f30) steps 2 -> 3, handing the next frame
  // to the state-3 post-spawn hold. This runs whether or not the branch above seeded a hunter.
  mem8[LAUNCH_STATE] = mem8[LAUNCH_STATE] + 1;

  // Fork on the spawn flip flag HUNTER_SPAWN_FLIP_FLAG (0x8f61). When it is clear this is a
  // normal hunter spawn: seed the post-spawn countdown and announce the spawn to the display
  // ring. When it is set the machine takes the quiet path and only advances a sub-counter,
  // suppressing the countdown and the display command.
  if (mem8[HUNTER_SPAWN_FLIP_FLAG] === 0) {
    // Normal path: seed HUNTER_SPAWN_COUNTDOWN (0x8f34) to 0x20. State 3 drains this toward 0 to
    // time the hold before clearing the seeded record.
    mem8[HUNTER_SPAWN_COUNTDOWN] = 0x20;
    // Announce the spawn by enqueuing display command HUNTER_SPAWN_DISPLAY_CMD (0x0315) into the
    // page-0x88 display-command ring; the ring's consumer acts on it on a later frame.
    enqueueDisplayCommand(m, HUNTER_SPAWN_DISPLAY_CMD);
  } else {
    // Flip path: instead of seeding the countdown / queuing a command, bump the sub-counter
    // HUNTER_SPAWN_SUBCOUNTER (0x8f5d), which is drawn elsewhere as a BCD digit field.
    mem8[HUNTER_SPAWN_SUBCOUNTER] = mem8[HUNTER_SPAWN_SUBCOUNTER] + 1;
  }
}

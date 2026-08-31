// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { launchProjectileIntoFreeSlot } from "./launchProjectileIntoFreeSlot.js";
import {
  INTRO_DELAY_CKSUM_WORD,
  LAUNCH_SEQ_COUNTER,
  LAUNCH_SCRIPT_PTR,
  ENEMY_ACTOR_TABLE,
  PROJECTILE_SLOT_STATE,
  SPAWN_ANIM_TABLE_396A,
} from "./names.js";
/**
 * launchNextScriptedObjectOnDelay — the scripted single-object launcher.
 *
 * WHAT IT IS
 *   One frame's step of the enemy-launch sequencer. Each time it is called it either burns down a
 *   short inter-launch delay, or — the frame that delay reaches zero — reads the next opcode from a
 *   compact byte script and, if the object pool has room, brings exactly ONE scripted object (an
 *   enemy/dive actor) to life in the play area. At most one object is launched per delay expiry, so a
 *   single 0xff-terminated script paces a whole run of enemies out over many frames.
 *
 * ROLE IN THE MACHINE
 *   This is the pacing valve for the scripted enemy launches. Three cells drive it, all in the launch
 *   scratch block near the top of work RAM:
 *     - INTRO_DELAY_CKSUM_WORD (0x8f48) is the countdown that spaces launches apart in time,
 *     - LAUNCH_SCRIPT_PTR (0x8f4a) is a 16-bit read cursor into the launch script, and
 *     - LAUNCH_SEQ_COUNTER (0x8f49) counts launches, alternating the delay length and stepping the run.
 *   The script byte chooses WHICH enemy-actor record wakes up; the free-slot scan throttles the run to
 *   the three available projectile/object slots so the sequencer never over-commits the record pool.
 *
 * ROM: 0x6e86-0x6eda.
 * Grounding: [seen].
 *
 * LIVE-OUT (what it leaves in memory; nothing is handed back in a register):
 *   - INTRO_DELAY_CKSUM_WORD (0x8f48): decremented on a waiting frame, or reloaded to 0x20/0x2c on the
 *     frame a launch fires.
 *   - LAUNCH_SCRIPT_PTR (0x8f4a): advanced one byte past a consumed opcode, or backed up one byte on a
 *     no-room retry (left untouched when the 0xff terminator is reached).
 *   - The chosen enemy-actor record: its state byte (+2) set to 0x06 (live) and its animation armed.
 *   - One projectile/object slot: filled by the shared spawner.
 *   - LAUNCH_SEQ_COUNTER (0x8f49): bumped by one per successful launch.
 */

const STRIDE = 0x18; // 24-byte record stride shared by the whole actor arena (enemy actors at 0x8ae0, projectiles at 0x8be8)
const SLOTS = 0x03; // the three projectile/object slots scanned for a free one before a launch

export function launchNextScriptedObjectOnDelay(m) {
  const { mem8, mem16 } = m;

  // Inter-launch delay (INTRO_DELAY_CKSUM_WORD, 0x8f48). While it is still counting, this frame does
  // nothing but tick it down one and bail — that is what spaces successive launches apart in time.
  if (mem8[INTRO_DELAY_CKSUM_WORD] !== 0) {
    mem8[INTRO_DELAY_CKSUM_WORD] = mem8[INTRO_DELAY_CKSUM_WORD] - 1;
    return;
  }

  // Delay has elapsed: seed the gap before the NEXT launch. Bit1 of the launch sequence counter
  // (LAUNCH_SEQ_COUNTER, 0x8f49) selects between two spacings — 0x2c when set, 0x20 when clear — so
  // launches breathe at a slightly alternating cadence as the counter climbs.
  mem8[INTRO_DELAY_CKSUM_WORD] = mem8[LAUNCH_SEQ_COUNTER] & 0x02 ? 0x2c : 0x20;

  // Read the next opcode from the launch script. LAUNCH_SCRIPT_PTR (0x8f4a) holds a 16-bit ROM/RAM
  // cursor; the byte at it is the opcode. 0xff is the script terminator — the run is finished for
  // this frame, so leave the cursor parked on the 0xff and return. Otherwise step the cursor past it.
  const scriptPtr = mem16[LAUNCH_SCRIPT_PTR];
  const entry = mem8[scriptPtr];
  if (entry === 0xff) return;
  mem16[LAUNCH_SCRIPT_PTR] = scriptPtr + 1;

  // The opcode is a 1-based index into the enemy-actor record array (ENEMY_ACTOR_TABLE, 0x8ae0, stride
  // 0x18). Start one record BELOW the base (0x8ae0 - 0x18 = 0x8ac8) and step forward one record per
  // count, so index 1 lands exactly on the first record, index 2 on the second, and so on.
  let rec = u16(ENEMY_ACTOR_TABLE - STRIDE);
  let n = entry;
  do {
    rec = u16(rec + STRIDE);
  } while ((n = u8(n - 1)) !== 0);

  // Throttle: launch only if the object pool has room. Walk the three projectile/object slots
  // (PROJECTILE_SLOT_STATE, 0x8bea — the +2 state byte of each slot in the 0x8be8 table, stride 0x18);
  // a slot is free when its state byte reads zero.
  let free = false;
  for (let i = 0; i < SLOTS; i++) {
    if (mem8[PROJECTILE_SLOT_STATE + i * STRIDE] === 0) {
      free = true;
      break;
    }
  }
  if (!free) {
    // No free slot: rewind LAUNCH_SCRIPT_PTR (0x8f4a) one byte so this same opcode is re-read next
    // frame, and bail without launching. The launch is deferred, not dropped — the run stalls in place
    // until a slot frees up.
    mem16[LAUNCH_SCRIPT_PTR] = mem16[LAUNCH_SCRIPT_PTR] - 1;
    return;
  }

  // Arm and launch the chosen record. Stamp state 0x06 into its +2 state byte to mark it live, point it
  // at the spawn animation sequence (SPAWN_ANIM_TABLE_396A, ROM 0x396a) and restart it, then hand the
  // record to the shared spawner, which seats it in the free projectile/object slot found above.
  mem8[rec + 0x02] = 0x06;
  setActorAnimation(m, rec, SPAWN_ANIM_TABLE_396A);
  launchProjectileIntoFreeSlot(m, rec);
  // Bump the launch sequence counter (LAUNCH_SEQ_COUNTER, 0x8f49): this advances the run and, via its
  // bit1, alternates the delay length chosen for the next launch above.
  mem8[LAUNCH_SEQ_COUNTER] = mem8[LAUNCH_SEQ_COUNTER] + 1;
}

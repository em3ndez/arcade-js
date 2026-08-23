// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_3a6c } from "./loc_3a6c.js";
import {
  INTRO_DELAY_CKSUM_WORD,
  LAUNCH_SEQ_COUNTER,
  LAUNCH_SCRIPT_PTR,
  ENEMY_ACTOR_TABLE,
  PROJECTILE_SLOT_STATE,
  SPAWN_ANIM_TABLE_396A,
} from "./names.js";
/**
 * loc_6e86 — scripted single-object launcher. A per-call delay ticks down; until it elapses the
 * routine only decrements and returns. On expiry it reloads the delay (bit1 of the sequence counter
 * picks the value), pulls the next script byte (0xff terminates), and treats that byte as a 1-based
 * index into the enemy-actor record array. If any of the three projectile slots is free it arms the
 * selected record, points it at its animation, launches through the shared spawner, and bumps the
 * sequence counter; if all slots are busy it backs the script pointer up one to retry next frame.
 *
 * LIVE-OUT: none — the caller reads no register back.
 */

const STRIDE = 0x18; // actor/projectile record stride
const SLOTS = 0x03; // projectile slots scanned for a free one

export function loc_6e86(m) {
  const { mem8, mem16 } = m;

  // per-call delay: tick down, and return until it elapses
  if (mem8[INTRO_DELAY_CKSUM_WORD] !== 0) {
    mem8[INTRO_DELAY_CKSUM_WORD] = mem8[INTRO_DELAY_CKSUM_WORD] - 1;
    return;
  }

  // reload the delay: 0x2c when the sequence counter's bit1 is set, else 0x20
  mem8[INTRO_DELAY_CKSUM_WORD] = mem8[LAUNCH_SEQ_COUNTER] & 0x02 ? 0x2c : 0x20;

  // next script byte; 0xff terminates the script for this frame
  const scriptPtr = mem16[LAUNCH_SCRIPT_PTR];
  const entry = mem8[scriptPtr];
  if (entry === 0xff) return;
  mem16[LAUNCH_SCRIPT_PTR] = scriptPtr + 1;

  // the byte is a 1-based index into the enemy-actor record array
  let rec = u16(ENEMY_ACTOR_TABLE - STRIDE);
  let n = entry;
  do {
    rec = u16(rec + STRIDE);
  } while ((n = u8(n - 1)) !== 0);

  // launch only if a projectile slot is free (its lead byte is zero)
  let free = false;
  for (let i = 0; i < SLOTS; i++) {
    if (mem8[PROJECTILE_SLOT_STATE + i * STRIDE] === 0) {
      free = true;
      break;
    }
  }
  if (!free) {
    // no room: back the script pointer up one and retry next frame
    mem16[LAUNCH_SCRIPT_PTR] = mem16[LAUNCH_SCRIPT_PTR] - 1;
    return;
  }

  // arm the selected record and launch it
  mem8[rec + 0x02] = 0x06;
  setActorAnimation(m, rec, SPAWN_ANIM_TABLE_396A);
  loc_3a6c(m, rec);
  mem8[LAUNCH_SEQ_COUNTER] = mem8[LAUNCH_SEQ_COUNTER] + 1;
}

// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommand05 } from "./queueSoundCommand05.js";
/**
 * queueHitSound — queue the "hit" sound effect, then return. [seen]
 *
 * ROM 0x5f02-0x5f05.
 *
 * WHAT IT IS
 * ----------
 * A thin trampoline. Its whole body is "queue one fixed sound-effect command, then
 * return" — it holds no logic of its own and forwards straight to the command-0x05
 * selector. The effect is fixed: this entry point always stands for the same sound,
 * the one the player hears when a shot connects with a target.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * The main CPU never drives the audio hardware directly. It accumulates sound requests
 * in a small circular queue in shared work RAM and pays out exactly one per frame to
 * the dedicated audio processor. To ask for a sound, game logic calls the selector for
 * the effect it wants rather than touching the queue itself; each distinct effect has
 * its own tiny selector routine.
 *
 * This selector is the collision "hit" request. It is reached from the proximity-
 * collision scan (scanActorSlotsMarkStruckAndFlash), which finds a shot overlapping a
 * target, marks that actor slot struck, and tails into here to sound the hit; and from
 * the single-slot overlap catch (testAndCatchActorSlotOnOverlap), likewise after the
 * strike is registered. All of the real work — choosing the command byte, storing it,
 * and advancing the ring — lives one level down, so both call sites read simply as
 * "…and play the hit sound" without repeating the queue mechanics.
 *
 * LIVE-OUT: memory only — the filled ring slot and the advanced write pointer left by
 * the enqueue path. No register is a consumed live-out; the enqueue path reloads A at
 * every use site.
 */
export function queueHitSound(m) {
  // Defer entirely to the command-0x05 selector (ROM 0x0ef1). It appends the fixed
  // command byte for this effect to the sound-command ring: it drops the byte into the
  // slot named by the write cursor SOUND_RING_WRITE_PTR (0x8a40), within the 28-slot
  // ring buffer at 0x8a43..0x8a5e, then bumps that cursor by one slot and wraps the
  // last slot back to the first. The append is unconditional, and the per-frame drain
  // later hands the queued byte across to the audio processor.
  return queueSoundCommand05(m);
}

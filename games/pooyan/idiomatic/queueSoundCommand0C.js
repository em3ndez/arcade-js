// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0C — one of the machine's sound triggers: enqueue command byte 0x0c.
 *
 * ==========================================================================
 * WHAT IT IS
 * --------------------------------------------------------------------------
 * A sound trigger. When some part of the game wants sound event 0x0c to play,
 * it calls here. This routine's whole job is to name the event it stands for —
 * the constant byte 0x0c — and drop that byte into the sound-command ring so
 * the audio side will pick it up and play it.
 *
 * ROLE IN THE MACHINE
 * --------------------------------------------------------------------------
 * The game logic never pokes the audio processor directly. Instead a single
 * small circular buffer — the sound-command ring in the 0x8a00 page — carries
 * one-byte "please play this" events from the game side to the audio side.
 * The producing end is a crowd of near-identical triggers, one per sound
 * event (0x01, 0x06, 0x0a, 0x0c, 0x0d, 0x0e, 0x0f, 0x11, ...); each loads its
 * own fixed command byte and funnels it into the ring. This routine is the
 * trigger for event 0x0c. Every trigger shares the exact same tail — the
 * ring-append helper appendSoundCommandGated — so the only thing that tells
 * one trigger apart from the next is the constant byte it carries. Downstream,
 * the main loop drains one ring entry per frame and forwards the queued byte
 * to the audio processor (unless the machine is meant to be silent), which is
 * where the byte finally becomes sound.
 *
 * ROM 0x0f11-0x0f14. [seen].
 *
 * HOW IT WORKS
 * --------------------------------------------------------------------------
 * The trigger loads the constant 0x0c into A and jumps into the shared
 * ring-append helper; the helper's return carries straight back to whoever
 * called this trigger, so the append — and the game-active / play-mode gate
 * that guards it — live entirely inside the helper. The helper stashes the
 * byte, checks the gate (enqueue only while play is live, otherwise drop it),
 * and on success writes the byte into the ring slot under the write cursor,
 * then advances and wraps that cursor.
 *
 * LIVE-OUT: A — the helper leaves the advanced ring cursor in A (or 0 when the
 * gate is closed and nothing was enqueued), and it rides back out to the
 * caller, which reads it straight from the register.
 * ==========================================================================
 */
// The fixed sound event this trigger stands for. 0x0c is this trigger's whole
// identity: the one byte it drops into the ring to request that effect. Kept
// as a named constant so the enqueue below reads as "queue event 0x0c".
const COMMAND_BYTE = 0x0c; // the fixed byte this trigger enqueues

export function queueSoundCommand0C(m) {
  // Hand the constant byte to the shared ring-append helper and let its result
  // ride back to our caller. The helper does all the work: it stashes the
  // byte, applies the game-active (GAME_ACTIVE_FLAG, 0x8806) / play-mode
  // (PLAY_MODE_LATCH, 0x8f50) gate, and — when the gate is open — writes the
  // byte into the sound-command ring at the write cursor (SOUND_RING_WRITE_PTR,
  // 0x8a40, walking slots 0x43..0x5e in the 0x8a00 page) and advances/wraps
  // that cursor. The advanced cursor comes back in A.
  return appendSoundCommandGated(m, COMMAND_BYTE);
}

// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand06 — request sound effect 0x06 from the audio processor.
 *
 * WHAT IT IS
 *   One of a crowd of tiny "sound emitter" stubs. Each such stub owns exactly one fixed
 *   sound-effect code and does one thing: drop that code into the sound-command ring buffer so
 *   the audio side eventually plays it. This one owns command byte 0x06. The stubs differ only
 *   in the constant they emit (0x01, 0x06, 0x0A, 0x0D, 0x0E, 0x0F, 0x11, ...); the actual work
 *   of enqueuing is shared and lives in appendSoundCommandGated.
 *
 * ROLE IN THE MACHINE
 *   The main processor never drives the sound hardware directly. Instead it hands work to a
 *   second processor dedicated to sound, through a small circular buffer (the sound-command
 *   ring) in the 0x8a00 work-RAM page. Game logic that wants a sound — a hit, a spawn, a UI
 *   beep — calls the emitter for that effect, which appends the effect's code to the ring. Once
 *   per frame the frame service drains one entry from the ring and forwards it to the audio
 *   processor. This stub is the "producer" end of that pipe for effect 0x06.
 *
 * ROM ADDRESS
 *   0x0ef5-0x0ef8. Loads the constant into the accumulator and falls straight through into the
 *   shared append routine at 0x0ea2, so the append's outcome IS this routine's outcome.
 *
 * GROUNDING
 *   [seen].
 *
 * LIVE-OUT
 *   A = the ring's advanced write cursor after the byte is enqueued (this is whatever the shared
 *   append leaves behind, and callers read it straight from A). When the append gate is closed —
 *   attract mode / between lives, with neither the in-play flag nor the play-state latch active —
 *   nothing is enqueued and A comes back 0.
 */
// The fixed sound-effect code this stub emits. Every call appends exactly this one byte; the
// choice of 0x06 is the sole thing that distinguishes this stub from its sibling emitters.
const COMMAND_BYTE = 0x06;

export function queueSoundCommand06(m) {
  // Hand the fixed effect code to the shared, gated append. That routine stashes the byte, checks
  // whether play is live, and — only if so — writes it into the ring slot under the write cursor
  // and advances/wraps the cursor. Its result (the advanced cursor, or 0 when the gate is closed)
  // is returned unchanged as this stub's own result.
  return appendSoundCommandGated(m, COMMAND_BYTE);
}

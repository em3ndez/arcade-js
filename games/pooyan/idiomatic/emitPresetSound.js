// SPDX-License-Identifier: GPL-3.0-only
import { sendSoundCommand } from "./sendSoundCommand.js";
/**
 * emitPresetSound — play the one fixed "preset" sound effect. [seen] (ROM 0x0f09)
 *
 * WHAT IT IS. A wafer-thin wrapper around the audio hand-off. It supplies a single, hard-coded
 * command number (0x0b) and hands it straight to the sound sender; it decides nothing else. The
 * choice of sound is baked into the code rather than passed in, so every caller of this routine
 * produces exactly the same effect.
 *
 * ROLE IN THE MACHINE. Pooyan splits its work across two processors: the main CPU runs the game
 * and a second, dedicated audio CPU drives the sound hardware. The two share no RAM — the main
 * CPU asks for a sound only by handing the audio CPU a one-byte command code across a hardware
 * mailbox plus an interrupt line. This routine is a caller's shorthand for "make THAT sound":
 * the coin / credit bookkeeping calls it as its coin-accept / credit-drip acknowledgement, so a
 * blip sounds the instant a coin is counted in.
 *
 * DIRECT, NOT QUEUED. Most in-game sounds are dropped into a command ring and forwarded one per
 * frame by the ring drain. This routine skips that queue entirely and drives the sender directly,
 * so the effect is latched immediately and unconditionally — without waiting for the next drain
 * and without the ring's demo-sounds / game-active gating. That suits an event like coin accept,
 * which must be acknowledged the instant it happens.
 *
 * GROUNDING: [seen] — the routine's role is confirmed at the machine level (ROM 0x0f09).
 *
 * LIVE-OUT: memory only — the sound-command mailbox is left holding 0x0b and the audio-IRQ line
 * is pulsed and returned to rest; no surviving register value is read by any caller.
 */
// The fixed command code this wrapper emits. It is a single entry from the small menu of sound
// numbers the audio CPU understands; here it is a constant, so this routine has exactly one voice.
const SOUND_CMD = 0x0b; // the preset sound-command code this wrapper emits

export function emitPresetSound(m) {
  // Hand the preset code to the audio hand-off. The sender drops the byte into the sound-command
  // mailbox (SOUND_COMMAND_LATCH, port 0xa100) and then strobes the audio-IRQ line (AUDIO_IRQ_LATCH,
  // bit 1 of the addressable output latch at 0xa181) high-then-low; that rising edge is what
  // interrupts the audio CPU into reading the mailbox and playing the matching sound. This wrapper
  // contributes only the command number — the two hardware writes are the sender's work.
  return sendSoundCommand(m, SOUND_CMD);
}

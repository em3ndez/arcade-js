// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_COMMAND_LATCH, AUDIO_IRQ_LATCH } from "./names.js";
/**
 * sendSoundCommand — hand one command byte to the audio CPU. [seen] (ROM 0x0e8f)
 *
 * Pooyan is a two-processor board: a main CPU runs the game and a second, dedicated audio
 * CPU drives the sound hardware. The two do not share the game's work RAM; they talk through
 * a single one-byte mailbox plus an interrupt line. This routine is that hand-off. Every
 * sound effect and every musical cue the game plays begins here — the caller loads a command
 * number and calls in, and the audio CPU wakes up, reads the number, and plays the matching
 * sound.
 *
 * The command NUMBERS are a fixed menu the audio CPU understands: the main CPU latches a small
 * code (values such as 0x01 / 0x04 / 0x09 / 0x15) during play, one per sound event.
 *
 * The hand-off is two moves. First the command byte is placed in the mailbox
 * (SOUND_COMMAND_LATCH, port 0xa100). The byte just SITS there; writing it does not by itself
 * tell the audio CPU anything. Second, the audio-IRQ line is pulsed: driving AUDIO_IRQ_LATCH
 * (bit 1 of the board's addressable output latch, port 0xa181) high and then back low raises
 * an interrupt on the audio CPU, and that interrupt is what makes it stop and read the
 * mailbox. High-then-low is a STROBE — a momentary edge, not a level the audio CPU polls.
 *
 * In the ROM the high and low writes are separated by six no-ops. Those no-ops only stretch
 * the pulse wide enough for the audio CPU to notice the edge; they carry no state and compute
 * nothing, so the idiomatic form drops them — the two latch writes below are the whole act.
 *
 * A PURE LEAF: it calls nothing, and reads no game state — the command arrives as an argument.
 *
 * LIVE-OUT: memory only — the sound mailbox holds the command, and the audio-IRQ line is left
 * back at rest (0) after its pulse. The ROM ends with A = 0 as a side effect of lowering the
 * line, but no caller reads that.
 */
export function sendSoundCommand(m, command = m.regs.a) {
  const { mem8 } = m;

  // Drop the command byte into the one-byte mailbox the audio CPU will read. On its own this
  // is inert: the byte waits here until the strobe below tells the audio CPU to come get it.
  mem8[SOUND_COMMAND_LATCH] = command;

  // Strobe the audio-IRQ line high then immediately low. The rising edge interrupts the audio
  // CPU, which is what drives it to read the mailbox; returning the line to rest arms the next
  // command. (The ROM's six no-ops between these two writes are pulse-width padding only.)
  mem8[AUDIO_IRQ_LATCH] = 1; // raise audio-IRQ (mainlatch bit 1)
  mem8[AUDIO_IRQ_LATCH] = 0; // lower it back to rest
}

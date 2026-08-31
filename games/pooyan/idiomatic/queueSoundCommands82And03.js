// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommands82And03 — queue the fixed two-command cue (0x82 then 0x03) into the
 * sound-command ring. [seen]
 *
 * ROM 0x0eda-0x0ee2.
 *
 * WHAT IT IS
 * A tiny sound selector. The main CPU never synthesizes audio itself; it hands one command
 * byte at a time to a separate sound processor. To avoid latching a sound the instant a game
 * event asks for it, producers instead append command bytes to a small circular queue in
 * shared work RAM — the 28-slot sound-command ring at SOUND_RING_BUFFER (0x8a43..0x8a5e),
 * whose next-free slot is named by SOUND_RING_WRITE_PTR (0x8a40). Once per frame the frame
 * service drains one slot and forwards its byte to the audio processor. This routine is one of
 * the family of selectors that sit on top of that ring: it names a specific pair of command
 * bytes and appends them in order.
 *
 * ROLE IN THE MACHINE
 * This is the "catch scored" cue. Its one use is when a caught enemy lands: the catch handler
 * calls here to voice the two-byte score sound. Because the two bytes go into the ring one
 * after the other, they land in adjacent slots and are paid out to the audio processor on
 * successive drains, so the sound side hears 0x82 first and 0x03 next.
 *
 * LIVE-OUT: memory only — the two filled ring slots plus the advanced write pointer. Nothing
 * useful is left in a register; the register that carries the command byte is reloaded by the
 * append helper on each call and callers do not read a result back.
 */

// The two fixed command bytes this cue queues, in the order the sound processor is meant to
// receive them. 0x82 is appended first, 0x03 second; the values are the codes the audio
// processor decodes, not addresses or counts.
const SOUND_CMD_FIRST = 0x82;
const SOUND_CMD_SECOND = 0x03;

export function queueSoundCommands82And03(m) {
  // Append the first command byte (0x82) into the slot named by SOUND_RING_WRITE_PTR (0x8a40)
  // and advance that write cursor one slot, wrapping the last slot back to the first. This is
  // the leading byte of the catch-score cue.
  enqueueSoundCommandRing(m, SOUND_CMD_FIRST);
  // Append the second command byte (0x03) into the now-current free slot and advance the write
  // cursor again. This is the final action of the routine, so control flows straight back out
  // once the second slot is filled and the pointer bumped.
  enqueueSoundCommandRing(m, SOUND_CMD_SECOND);
}

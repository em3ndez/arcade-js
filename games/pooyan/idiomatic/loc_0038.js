// SPDX-License-Identifier: GPL-3.0-only
import { DISPLAY_CMD_RING_WRITE_PTR } from "./names.js";
/**
 * loc_0038 — enqueue one two-byte display/sound command into the page-0x88 command ring.
 * ROM 0x0038 (the Z80 rst 0x38 restart vector). Grounding: [seen].
 *
 * WHAT IT IS: the machine's single producer for the display-command ring — a small circular
 * buffer of two-byte commands that live entirely inside RAM page 0x88. All over the game,
 * state handlers hand a 16-bit command word to this routine and it appends the word to the
 * ring; a separate consumer drains the ring each frame and acts on the commands (spawning
 * sprites, firing sounds, painting text). Callers reach it through the rst 0x38 restart, so it
 * is cheap to invoke — one byte at the call site.
 *
 * The command word is a hi:lo pair. Examples that flow through here (see names.js): 0x0600
 * and 0x0602/0x0603 from the object state handlers, 0x060b on attract, 0x0612/0x0692 for the
 * enemy flip animation, 0x0400/0x0401 at start-of-life. The high byte is a command class and
 * the low byte its argument; this routine does not interpret them, it only stores them.
 *
 * THE RING: cell DISPLAY_CMD_RING_WRITE_PTR (0x88a0) holds the LOW byte of the next slot to
 * write; the ring body itself lives higher in the same page, at low bytes >= RING_START
 * (0x88c0). A slot is FREE when its top bit (bit 7) is set — the consumer sets bit 7 back on
 * as it empties a slot. If the slot the pointer names is still occupied (bit 7 clear) the ring
 * is full and the command is DROPPED silently, exactly as the hardware does.
 *
 * LIVE-OUT: memory only — the two stored command bytes and the advanced write pointer. (On the
 * machine HL is saved and restored around the routine, so callers see no register disturbed.)
 */
const RING_START = 0xc0; //     low byte the ring begins at (pointer wraps back up to here)
const SLOT_FREE_BIT = 0x80; //  bit 7 set in a slot => free to write

export function loc_0038(m, cmd = m.regs.de) {
  const { mem8 } = m;

  // The ring and its write-pointer cell share RAM page 0x88, so the pointer stores only a low
  // byte; recover the page (0x8800) from the pointer cell's address and index it by that low
  // byte to reach the slot the ring is currently pointing at.
  const page = (DISPLAY_CMD_RING_WRITE_PTR >> 8) << 8; // the ring shares the pointer cell's page
  let low = mem8[DISPLAY_CMD_RING_WRITE_PTR];
  const slot = page + low;

  // Ring-full check: a slot advertises FREE by having bit 7 set (the consumer re-arms it after
  // draining). If bit 7 is clear the slot still holds an undrained command, so the ring is full
  // — drop this command and leave the pointer untouched.
  if ((mem8[slot] & SLOT_FREE_BIT) === 0) return;

  // Store the command high byte in the current slot and the low byte in the very next slot
  // (the two bytes occupy adjacent ring positions).
  mem8[slot] = cmd >> 8;
  low = (low + 1) & 0xff;
  mem8[page + low] = cmd;

  // Advance the write pointer past the pair (two bytes). Because only the low byte is tracked,
  // it is kept 8-bit.
  low = (low + 1) & 0xff;

  // Wrap: if advancing carried the pointer below the ring body (< RING_START) it has run off
  // the top of the buffer, so snap it back to the ring start.
  if (low < RING_START) low = RING_START;

  // Commit the new write position for the next producer.
  mem8[DISPLAY_CMD_RING_WRITE_PTR] = low;
}

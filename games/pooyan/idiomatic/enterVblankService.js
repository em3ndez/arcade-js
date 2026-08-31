// SPDX-License-Identifier: GPL-3.0-only
import { runVblankNmiService } from "./runVblankNmiService.js";

/**
 * enterVblankService -- the Z80 non-maskable-interrupt entry vector.
 *
 * WHAT IT IS: the fixed landing address the CPU jumps to when the video hardware raises the
 * non-maskable interrupt (NMI). At the end of every drawn frame the display circuitry pulses the
 * NMI line; the Z80 immediately suspends whatever the free-running foreground main loop was doing
 * and vectors here, roughly sixty times a second. This is the doorway of the machine's one and only
 * per-frame interrupt.
 *
 * ROLE IN THE MACHINE: it is the entry point to the per-frame heartbeat, and nothing more. Its body
 * is a single unconditional jump onward to the vblank service routine runVblankNmiService, which
 * performs the actual beat of work -- rebuild the hardware sprite banks, shift and sample the input
 * ports, tick the frame counters, service coins and the sound ring, dispatch on the top-level game
 * state, then latch flip-screen and re-arm the interrupt for next frame. Keeping the fixed vector
 * address separate from the service body lets that body sit anywhere in ROM while the interrupt
 * still lands at the hardware-mandated vector location.
 *
 * ROM address: 0x0066 -- the Z80 NMI vector. It jumps to the service routine at 0x066d. The bytes
 * between the jump and 0x066d (0x0069-0x0091) are an unreached data/table region: the boot path
 * goes 0x0066 -> 0x066d directly, so those bytes are never fetched as code and carry no behaviour.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: none of its own -- this vector writes no memory. Its entire effect is the transfer of
 * control into runVblankNmiService; that routine's per-frame memory writes are the observable result.
 */
export function enterVblankService(m) {
  // The vector's whole body: jump straight into the vblank service routine, the sole per-frame
  // worker. Control enters here on each vertical-blank interrupt and unwinds back out to the
  // interrupted foreground loop only after the full beat of frame work has completed.
  return runVblankNmiService(m);
}

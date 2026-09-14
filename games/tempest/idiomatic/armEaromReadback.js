// SPDX-License-Identifier: GPL-3.0-only
import { EAROM_REGION_PENDING, EAROM_REGION_DIR } from "./names.js";
import { stepEaromTransfer } from "./stepEaromTransfer.js";

/**
 * armEaromReadback — arm a read-back of every EAROM region. ROM 0xde11.
 *
 * Role in the machine: Tempest keeps its high-score table and bookkeeping in an EAROM (electrically
 * alterable ROM) that survives power-off. Reading it back is a multi-step serial transfer driven by a
 * little state machine; this routine primes that machine to pull ALL regions in, then kicks off the first
 * step. It is the entry the self-test (runSelfTestLoop) uses to load the saved settings for display.
 *
 * Behavior: seed the EAROM mode byte $1c7 (EAROM_REGION_PENDING) to 0x07 — the "read all regions" command
 * — clear the region/direction target $1c8 (EAROM_REGION_DIR) to 0, then call stepEaromTransfer to run the
 * first pass of the walk. Subsequent steps are pumped by the caller (every fourth self-test frame).
 *
 * Live-out: $1c7 = 0x07 and $1c8 = 0x00, leaving the transfer state machine armed for read-back.
 * Grounding: [seen].
 */
export function armEaromReadback(m) {
  const { mem8 } = m;
  mem8[EAROM_REGION_PENDING] = 0x07; // "read all regions" command
  mem8[EAROM_REGION_DIR] = 0x00;     // clear the region/direction target
  stepEaromTransfer(m);              // run the first pass of the serial walk
}

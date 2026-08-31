// SPDX-License-Identifier: GPL-3.0-only
import { ROUND_COUNTER, INTEGRITY_FLAG_SCAN_BASE } from "./names.js";
import { dispatchLevelIntroPhase } from "./dispatchLevelIntroPhase.js";
import { dispatchMainLoopSubstate } from "./dispatchMainLoopSubstate.js";

/**
 * dispatchLevelIntroElseMainLoop
 * ==============================
 *
 * WHAT IT IS
 *   The per-frame fork at the top of the game's frame update. Every frame the machine has to
 *   decide which of two worlds it is living in: the ordinary main game loop, or the "deep"
 *   round world in which a level is being introduced. This routine makes that decision by
 *   reading a single bit of the round counter, then dispatches accordingly.
 *
 * ITS ROLE IN THE MACHINE
 *   ROUND_COUNTER (0x8907) is the running round number. Its low bits double as mode switches:
 *   bit 0 picks the stage-type / facing variant, and bit 1 is the master switch for the deep
 *   round-intro world. This routine reads only bit 1:
 *     - bit 1 CLEAR (the common case): the frame belongs to the ordinary game. Hand it straight
 *       to the main-loop sub-state dispatcher and return -- nothing deep happens this frame.
 *     - bit 1 SET: the machine is in the round-intro / deep world. Run the level-intro phase
 *       dispatcher for the frame, then -- before returning -- run a code-window integrity probe
 *       that trips an anti-tamper strike flag if the ROM image has been altered.
 *   The integrity probe is a passive tripwire folded into the deep path: reaching the deep
 *   round world is exactly the moment this ROM chooses to re-verify a piece of itself. It never
 *   crashes on a bad result; it merely records a strike that downstream code notices.
 *
 * ROM ADDRESS
 *   0x1d9c-0x1dca.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT: memory only.
 *   - Whatever the delegated dispatcher wrote this frame (dispatchMainLoopSubstate on the
 *     common path, or dispatchLevelIntroPhase on the deep path).
 *   - On a tamper miss only: INTEGRITY_FLAG_SCAN_BASE (0x89e7) latched to 1. The probed cell is
 *     a fixed, intact ROM byte, so on an unmodified image the tally always matches and this
 *     write never happens. No register output.
 */

// ROUND_COUNTER (0x8907) bit 1: the master switch. Clear -> ordinary main loop; set -> the
// deep round-intro world that also carries the integrity probe.
const ROUND_BIT1 = 0x02;
// The probe re-reads one fixed ROM cell this many (0x20) times and tallies bits on each pass.
const PASSES = 0x20; //   the probe re-reads the same fixed cell this many times
// The two bits of the probed byte the tally inspects each pass.
const BIT0 = 0x01;
const BIT3 = 0x08;
// Fixed program cell scanned by the integrity probe (a constant, intact byte at ROM 0x5a28).
const PROBE_CELL = (0x5a << 8) | 0x28;

export function dispatchLevelIntroElseMainLoop(m) {
  const { mem8 } = m;

  // --- The fork: read ROUND_COUNTER (0x8907) bit 1 ---------------------------------------
  // When bit 1 is clear the machine is in the ordinary game. Hand the whole frame to the
  // main-loop sub-state dispatcher and return; none of the deep round-intro work below runs.
  if ((mem8[ROUND_COUNTER] & ROUND_BIT1) === 0) {
    dispatchMainLoopSubstate(m); // main-loop sub-state dispatcher
    return;
  }

  // --- Deep path: bit 1 is set -> run the level-intro phase for this frame ----------------
  // The round is being introduced (the "round-2 / deep" world). Advance whichever level-intro
  // phase is current before the integrity probe below guards the frame.
  dispatchLevelIntroPhase(m);

  // --- Code-window integrity probe (anti-tamper tripwire) ---------------------------------
  // Read one fixed ROM byte at PROBE_CELL (0x5a28), then make PASSES (0x20) passes over that
  // SAME byte -- the scan never advances the pointer, so every pass inspects the identical
  // value. Each pass adds 1 for bit 0 set and 1 for bit 3 clear, so a pass contributes exactly
  // one only when bit 0 and bit 3 agree (both set, or both clear). An intact ROM byte holds
  // that fixed pattern, so a clean image tallies exactly PASSES; any altered byte that breaks
  // the bit-0 == bit-3 agreement drives the total above or below PASSES.
  const cell = mem8[PROBE_CELL];
  let tally = 0;
  for (let i = 0; i < PASSES; i++) {
    if (cell & BIT0) tally++; //    bit 0 set
    if (!(cell & BIT3)) tally++; // bit 3 clear
  }
  // A tally that misses the pass count means the probed ROM cell no longer holds its intact
  // pattern: latch the anti-tamper strike flag INTEGRITY_FLAG_SCAN_BASE (0x89e7). That cell is
  // the base slot of the integrity-flag table the machine polls elsewhere to stall a tampered
  // image. A matching tally leaves the flag untouched and the routine returns having written
  // nothing.
  if (tally !== PASSES) mem8[INTEGRITY_FLAG_SCAN_BASE] = 1;
}

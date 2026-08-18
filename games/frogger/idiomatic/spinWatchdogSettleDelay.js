// SPDX-License-Identifier: GPL-3.0-only
/**
 * spinWatchdogSettleDelay  —  ROM 0x1048  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   A power-on busy-delay. It burns a fixed, calibrated number of loop passes so hardware has time to
 *   settle during cold boot — and on every single pass it READS the watchdog reset port. The read is not
 *   for its value (the byte is thrown away): the act of reading 0x8800 is what strobes the watchdog timer
 *   and keeps it from firing a reset. So the routine spends real time waiting while continuously "petting
 *   the dog", exactly the way the ROM's own delay loop does.
 *
 * WHERE IT SITS
 *   Called exactly once from the cold-boot chain (initColdBootAndEnterMainLoop, from the ROM path at
 *   0x02f0 `call 0x1048`) before the game arms its main loop. It never runs again once play begins. A
 *   naive empty delay loop would be wrong here: without the per-pass watchdog read, the watchdog would
 *   time out mid-wait and reset the machine, so the read is load-bearing, not decoration.
 *
 * WHY THE COUNTER LOOKS DIFFERENT FROM THE ROM
 *   In the ROM (0x1048-0x1057) the pass count lives in the 16-bit register BC: `ld bc,0xefff`, then each
 *   pass reads (0x8800), does `dec bc`, and loops while BC != 0. That BC is pure timing state — no state
 *   dump ever reads it — so the idiomatic form collapses it to a plain JS loop counter. Only the two
 *   OBSERVABLE facts are preserved, and they are exactly what the equivalence test pins: this routine
 *   writes NO RAM, and it reads the watchdog port EXACTLY 0xEFFF (61439) times.
 *
 * LIVE-OUT
 *   IO only — the watchdog read count. It writes no RAM, returns nothing, and leaves no register the
 *   caller reads.
 */
import { WATCHDOG_RESET_PORT } from "./names.js";

// The settle count, taken straight from the ROM immediate `ld bc,0xefff` at 0x1048. This is the number
// of watchdog reads the boot delay performs; the equivalence-1048 test asserts this exact count.
const SETTLE_PASSES = 61439; // 0xEFFF — the ROM's `ld bc, 0xefff` immediate at 0x1048

export function spinWatchdogSettleDelay(m) {
  const { mem8 } = m;

  // Spin the full settle count. Each pass performs a bare READ of WATCHDOG_RESET_PORT (0x8800) [seen] and
  // discards the byte: the read's side effect on the memory bus is what feeds the watchdog timer, so the
  // loop both burns settle time AND keeps the dog fed for the whole wait. The value is intentionally not
  // stored anywhere — reading it is the entire point.
  for (let pass = 0; pass < SETTLE_PASSES; pass++) mem8[WATCHDOG_RESET_PORT];
}

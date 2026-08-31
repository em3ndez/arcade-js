// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  WATCHDOG_KICK,
  loc_8819,
  ATTRACT_SUBSTATE,
  TAMPER_OBJECT_FREEZE_FLAG,
  GAME_ACTIVE_FLAG,
  CHECKSUM_SCAN_START,
} from "./names.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import { zeroSpriteListAndActorArena } from "./zeroSpriteListAndActorArena.js";
import { stampSecondScrollColumn } from "./stampSecondScrollColumn.js";
/**
 * resetToAttractScreenStart — attract sub-state 0 handler.  [ROM 0x08b3]  [grounding: seen]
 *
 * WHAT IT IS
 *   The first handler of the attract/demo sequence. The machine's top-level state selector
 *   picks the attract sub-state machine, which then dispatches on ATTRACT_SUBSTATE (0x8e51)
 *   through the attract dispatch table at 0x08a1; entry 0 of that table is this routine. It is
 *   the "cold start" of one attract cycle: it re-primes the tilemap fill, steps the attract
 *   sequence forward one phase, verifies the program image has not been tampered with, and
 *   scrubs the RAM that a fresh board build will re-seed.
 *
 * ROLE IN THE MACHINE
 *   Runs once each time the attract sequence returns to its idle/reset point. Its two lasting
 *   effects on the wider machine are (1) advancing the attract phase so the demo keeps cycling,
 *   and (2) latching the anti-tamper object-freeze flag if the embedded ROM checksum fails —
 *   the one place in the whole program that raises that flag.
 *
 * LIVE-OUT
 *   Writes only into memory (this is a void handler; it leaves nothing in a return value):
 *     - 0xa028 (watchdog) petted; 0x8819 scratch byte cleared.
 *     - ATTRACT_SUBSTATE (0x8e51) incremented by one.
 *     - TAMPER_OBJECT_FREEZE_FLAG (0x89fb) set to 1 iff the program-image checksum fails.
 *     - GAME_ACTIVE_FLAG (0x8806) cleared to 0 (machine marked "not in active play").
 *     - the sprite display list + actor/object arena zeroed, and the second scroll column stamped.
 */
// The backward checksum walks program bytes downward until it meets a byte whose *value* is the
// sentinel below; on an intact image the running carry count makes (sentinel - carries) equal the
// expected constant. The two magic numbers are baked for the shipped program image.
const CKSUM_SENTINEL = 0x96; // byte value that halts the scan
const CKSUM_EXPECTED = 0x8f; // (CKSUM_SENTINEL - carries) on an intact image

export function resetToAttractScreenStart(m) {
  const { mem8 } = m;

  // --- Pet the watchdog and clear a scratch cell ---------------------------------------------
  // The write side of 0xa028 (WATCHDOG_KICK) is the hardware watchdog: any store there resets
  // the watchdog timer that would otherwise reboot the board, and the data byte is ignored — a
  // plain zero suffices. The same zero then clears the scratch byte at 0x8819 that this entry
  // point (and the equivalent play-state-0 entry) always resets.
  mem8[WATCHDOG_KICK] = 0; // A = 0 written to each cell below
  mem8[loc_8819] = 0;

  // --- Arm the row-by-row tilemap fill ------------------------------------------------------
  // Re-primes the incremental tile fill so the attract screen is painted starting from the fixed
  // playfield tile base (VRAM 0x8402). The fill itself is advanced one row at a time by later
  // attract sub-states; here we only reset its cursor to the top.
  armTileFillFromPlayfieldBase(m); // arm the row-by-row tile fill

  // --- Advance the attract sequence ---------------------------------------------------------
  // ATTRACT_SUBSTATE (0x8e51) is the demo-sequence selector that indexes the attract dispatch
  // table. Bumping it by one moves the attract machine off sub-state 0 to the next phase, so the
  // demo keeps cycling rather than re-running this reset every frame.
  mem8[ATTRACT_SUBSTATE] = (mem8[ATTRACT_SUBSTATE] + 1); // advance sub-state

  // --- Anti-tamper: backward checksum of a program window -----------------------------------
  // Starting at CHECKSUM_SCAN_START (ROM 0x64d5) the loop walks *downward* through program bytes,
  // folding each into an 8-bit running sum and counting how many times that sum overflows past
  // 0xff (the carry count). It does not stop at a fixed address: it stops the moment it reads a
  // byte whose value is the sentinel 0x96, which sits somewhere below the start in the shipped
  // image. `sum` holds the wrapped total; `carries` holds the overflow tally.
  let sum = 0;
  let carries = 0;
  let ptr = CHECKSUM_SCAN_START;
  for (;;) {
    const b = mem8[ptr];
    if (b === CKSUM_SENTINEL) break;
    const raw = b + sum;
    if (raw > 0xff) carries = (carries + 1) & 0xff;
    sum = raw & 0xff;
    ptr = u16(ptr - 1);
  }

  // --- Anti-tamper: latch the object-freeze flag on a checksum miss --------------------------
  // On an intact program image the identity (CKSUM_SENTINEL - carries) == CKSUM_EXPECTED holds
  // exactly. Any deviation means the scanned code window has been altered, so we raise
  // TAMPER_OBJECT_FREEZE_FLAG (0x89fb). This is the sole write that sets that flag; once tripped
  // it stays set for the rest of the session. Elsewhere the flag is ORed with the board-clear
  // gate so the per-frame object/player update is frozen — a tampered board loses all input —
  // and it also arms an outright trap ahead of the tilemap integrity check.
  if (((CKSUM_SENTINEL - carries) & 0xff) !== CKSUM_EXPECTED) {
    mem8[TAMPER_OBJECT_FREEZE_FLAG] = 1; // checksum miss -> raise the tamper flag
  }

  // --- Clear the in-play gate ---------------------------------------------------------------
  // GAME_ACTIVE_FLAG (0x8806) marks whether a life is in progress. Clearing it to 0 puts the
  // machine in its not-playing state, so gameplay handlers that gate on this flag return early
  // while the attract/demo runs.
  mem8[GAME_ACTIVE_FLAG] = 0; // clear the in-play gate

  // --- Scrub the board-init RAM and stamp the scroll column ----------------------------------
  // Zeroes the sprite display list and the actor/object arena so no stale objects survive into
  // the next board build, then stamps the three tiles of the second scroll column (top to
  // bottom) that the attract/board scenery expects to be present.
  zeroSpriteListAndActorArena(m); // zero the board-init RAM regions
  stampSecondScrollColumn(m); // sprite-slot tail
}

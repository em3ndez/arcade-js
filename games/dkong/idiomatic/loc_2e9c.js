// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2e9c — animation-string terminator handler: rewind the walk pointer to the string
 * base and fire the wrap sound, then hand off to the object-update convergence point.
 * ROM 0x2E9C.
 *
 * Reached from the per-object scan (obj_2e12) the instant an object's animation-string walk
 * reads the 0x7F terminator byte. It rewinds the string pointer back to the base of the
 * animation string (0x39AA) so the walk loops, and fires a sound trigger (SND_TRIGGER+3 := 3).
 * It then falls straight into loc_2e4b, the object-update convergence point, which stores the
 * (now rewound) pointer back into the object record, runs the end-of-walk boundary test, and
 * mirrors the object's position to its sprite — advancing both scan cursors.
 *
 * Because the pointer is always rewound to the base, whatever value the walk left is dead: the
 * incoming pointer is overwritten here. loc_2e4b reads the pointer from registers (the scan
 * loop's register ABI is a genuine oracle boundary), so the rewind is expressed as a register
 * load before the direct loc_2e4b call.
 *
 * When loc_2e9c is reached the terminator (0x7F) was just read, so on the end-of-walk transition
 * path (object at/past the far X limit) loc_2e4b clears SND_TRIGGER+3 back to 0 — meaning this
 * routine's SND_TRIGGER+3 write only survives on the non-transition path. That is faithful to the
 * oracle, which does exactly the same via the shared loc_2e4b tail.
 *
 * NAME: kept as loc_2e9c, matching the sibling state handlers loc_2e4b / loc_2e84. The mechanism
 * (rewind the string pointer + fire a sound) is clear, but which object/animation this drives and
 * which sound the latch selects are not grounded here, so the effect-level name is left for a
 * clarify/grounding pass.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2e9c.test.js.
 * GATE:     crafted + captured. At a real (object, sprite) record pair the object X is swept over
 *           all 256 values with the terminator held (crossing the 0xB7 boundary, both transition
 *           arms via loc_2e4b); the last-read string byte is swept over all 256 (pins the terminator
 *           test with the pointer forced); the incoming pointer low/high are each swept over 256 to
 *           prove they are ignored (the stored pointer is ALWAYS 0x39AA); the exact in-game cursor
 *           sequence is grid-cross-producted; ignored registers/RAM are varied; and real captured
 *           0x2e9c dispatches from a steered entry_2e04 loop (objects aimed at a real 0x7F terminator)
 *           replay oracle vs candidate. Attract never reaches the loop. The oracle chain performs no
 *           push/pop, so SP is unchanged and there is no STACK_SCRATCH exclusion.
 * LIVE-OUT: memory — the rewound pointer stored at +0x0e/+0x0f (always 0x39AA) and SND_TRIGGER+3;
 *           and, on the transition path, the state byte +0x0d and the two sound latches, plus the
 *           two sprite-position writes the mirror tail makes; and the registers that tail leaves —
 *           object cursor +16, sprite cursor +4, remaining-object count preserved, step value 4. The
 *           scratch byte the oracle leaves in the accumulator is dead: the loop reloads it for the
 *           next object before any test.
 * NAMES:    SND_TRIGGER (0x6080) — from ram.js. The animation-string base 0x39AA is a ROM address
 *           (the object animation-string table), not work RAM, so it carries no ram.js name and stays
 *           a local const. The object-record field offsets (+0x0d/+0x0e) live inside loc_2e4b.
 */

import { SND_TRIGGER } from "./ram.js";
import { loc_2e4b } from "./loc_2e4b.js"; // ROM 0x2E4B — object-update convergence point

const ANIMATION_STRING_BASE = 0x39aa; // ROM base of the object animation string (walk rewind target)

/**
 * @param {object} m  the machine. The object/sprite cursors and the last-read string byte arrive
 *                    in registers; the rewound pointer is loaded into registers for loc_2e4b.
 * @returns {void}
 */
export function loc_2e9c(m) {
  const { regs, mem } = m;

  // Rewind the animation-string pointer to the base so the walk loops. loc_2e4b reads the pointer
  // from registers, so the reset is a register load handed straight to it.
  regs.hl = ANIMATION_STRING_BASE;

  // Fire the string-wrap sound trigger.
  mem.write8(SND_TRIGGER + 3, 0x03);

  // Fall into the object-update convergence point: store the rewound pointer back into the object
  // record, run the end-of-walk boundary test, and mirror the position to the sprite (advancing
  // both scan cursors).
  loc_2e4b(m);
}

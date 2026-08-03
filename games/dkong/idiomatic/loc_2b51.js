// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b51 — a reject exit of the player-vs-tilemap probe cascade; forces the
 * two-level caller-skip so control unwinds past entry_2b1c.  ROM 0x2B51.
 *
 * entry_2b29 (the collision probe that entry_2b1c calls) jumps or falls through
 * here on its "no hit / reject" outcomes. This routine carries no computation of
 * its own: its whole job is to abandon the probe and hand control back two levels
 * up — to whoever called entry_2b1c — WITHOUT running the sub_29af follow-up that a
 * normal (accepted) probe result would go on to reach.
 *
 * In the idiomatic layer that two-level return IS the caller-skip: return false,
 * and the callers propagate it as `if (!callee(m)) return;` — entry_2b29 returns
 * false, entry_2b1c early-returns, and control lands back at entry_2b1c's caller.
 * The boolean is always false here (an unconditional skip), so the machine handle
 * is taken only for calling-convention uniformity with the caller-skip family and
 * is otherwise unread.
 *
 * A LEAF — reads nothing, writes nothing, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2b51.test.js.
 * GATE:     captured + crafted. 0x2B51 is dispatched ~147× per 1500-frame attract
 *           run (via entry_1c05 -> entry_2b1c -> entry_2b29's reject arm), so real
 *           in-distribution states cover it; crafted entries then vary the stack,
 *           the registers, and work RAM to prove the skip is state-INDEPENDENT (the
 *           output never depends on any input). Teeth: a twin that returns true
 *           (fails to skip) and a twin that writes a live RAM cell ("writes nothing"
 *           has teeth).
 * LIVE-OUT: writes no memory — the control-flow boolean (always false) is the whole
 *           output. The stack pointer / program counter / registers the oracle's
 *           two-level return leaves behind are dead ABI: the Z80 stack unwind becomes
 *           JS control flow, and every caller consumes only the boolean. (The bytes
 *           the oracle pops sit in the dead STACK_SCRATCH region.)
 * NAMES:    none — the routine touches no memory.
 */

/**
 * @param {object} m  the machine handle (unread — the skip is unconditional).
 * @returns {boolean} always false: the caller-skip signal that unwinds the cascade.
 */
export function loc_2b51(m) {
  // Unconditional caller-skip: return the skip signal so entry_2b29 and entry_2b1c
  // unwind past the probe (see the header). No inputs, no side effects.
  return false;
}

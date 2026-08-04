// SPDX-License-Identifier: GPL-3.0-only
/**
 * effectStateIdle — the idle arm of the effect router: the frame's effect work is nothing.
 *
 * The effect subsystem runs a four-way router on a state byte. This is the arm taken while that
 * state is 0, and it does nothing at all: no inputs, no memory read or written, no branches. The
 * effect simply does not advance on such a frame.
 *
 * NOT CLAIMED: what the effect depicts on screen. The name places this arm in the router and stops
 * there; the sequence the other arms drive is not established here.
 *
 * LIVE-OUT: none — memory-only, and it writes no memory.
 */
export function effectStateIdle(_m) {
  // Deliberately empty: this arm's whole job is to do nothing. The machine argument is accepted so
  // the signature matches its siblings in the router, and is unused.
}

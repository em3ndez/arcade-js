// SPDX-License-Identifier: GPL-3.0-only
import { loc_00, loc_87, SFX_TIMER_CH2 } from "./names.js";
import { moveCentipedeSegment } from "./moveCentipedeSegment.js";

/**
 * beginCentipedeSegmentSweep — the per-frame entry point into the centipede's per-segment walk.
 *
 * Role in the machine: the centipede's body is a strip of up to twelve segment slots, each carrying
 * its own heading and coordinate. Once per frame the main-loop spine calls this routine to walk that
 * whole strip: it decides whether the sweep runs at all, arms the marching "footstep" sound on the
 * right frames, then seeds the walk at the last slot and drops into the recursive per-segment mover,
 * which decrements the slot index back down to 0 as it goes.
 *
 * ROM: the segment-sweep entry in the centipede-motion block. Grounding: [code] — control flow read
 * from behaviour; the only MAME-confirmed cell it touches is the ch2 SFX timer (0xb3) [seen].
 *
 * Live-out: may set SFX_TIMER_CH2 (0xb3) to 0x07, sets m.regs.x to 0x0b, and mutates whatever the
 * per-segment mover writes downstream; returns that mover's result (or nothing when gated off).
 */
export function beginCentipedeSegmentSweep(m) {
  const { mem8 } = m;

  // The $87 busy/gate byte suppresses the entire segment pass. It is set by other subsystems (the
  // spawn-cadence handshake, the death/respawn dispatcher) while a spawn or teardown owns the strip;
  // while it is nonzero the centipede must hold still, so we bail before touching anything.
  if (mem8[loc_87] !== 0) return; // gated off -> return

  // $00 is the free-running master frame counter. Every sixteenth frame (its low nibble == 0) we
  // re-arm the channel-2 SFX countdown to 7, which is the centipede's rhythmic marching footstep —
  // pacing the click to the frame clock rather than to the segments' own motion.
  if ((mem8[loc_00] & 0x0f) === 0) mem8[SFX_TIMER_CH2] = 0x07;

  // Seed the sweep at the last segment slot (index 0x0b) and enter the mover. The mover tail-recurses
  // toward slot 0, so this single call carries the whole body strip forward one step.
  return (m.regs.x = 0x0b), moveCentipedeSegment(m);
}

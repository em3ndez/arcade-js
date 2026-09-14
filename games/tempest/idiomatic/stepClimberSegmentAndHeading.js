// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, ENEMY_PHASE } from "./names.js";
import { lookupRingHeading } from "./lookupRingHeading.js";

/**
 * stepClimberSegmentAndHeading — step a climber one segment and set its next heading. ROM 0x9e5f
 * (the guard-less mid entry; stepClimberSegmentGuarded falls into this same body).
 *
 * Role in the machine: a climber walks the rim of the tube in a zig-zag. Each call advances it one
 * segment and computes the heading byte the renderer/mover reads to draw and move it that step. The
 * low three bits of the slot flag encode which of the ring's segments the climber is on; segment 4 is
 * the "seam" (the ring's wrap point) and is handled specially.
 *
 * Behavior: force bit7 on ENEMY_SLOT_FLAGS,x (mark the slot persistently live) and read back the
 * low-3-bit segment. Ordinary segments (not 4): if bit6 is set, step the depth (ENEMY_SEGMENT,x) up one
 * mod 16, then look the heading up in the ring table — bit6 selects the half-turn direction, bit7 is
 * forced on — and store it into ENEMY_PHASE,x. Segment 4 (the seam): bit6 set steps the depth DOWN one
 * mod 16 and stores 0x87; bit6 clear leaves depth alone and stores 0x81.
 *
 * Live-out: ENEMY_SLOT_FLAGS,x (bit7 forced on), ENEMY_SEGMENT,x (depth, when stepped), and the stored
 * heading in ENEMY_PHASE,x; A = the stored direction byte. Grounding: [seen].
 */
export function stepClimberSegmentAndHeading(m, x = m.regs.x) {
  const { mem8 } = m;
  const flag = mem8[u16(ENEMY_SLOT_FLAGS + x)] | 0x80;   // set bit7 on the slot flag, persistently
  mem8[u16(ENEMY_SLOT_FLAGS + x)] = flag;
  const segment = flag & 0x07;

  if (segment !== 0x04) {                        // ordinary segment
    if (flag & 0x40) {                           // bit6 set -> step depth up one (mod 16)
      mem8[u16(ENEMY_SEGMENT + x)] = (mem8[u16(ENEMY_SEGMENT + x)] + 1) & 0x0f;
    }
    const depth = mem8[u16(ENEMY_SEGMENT + x)];
    const dir = lookupRingHeading(m, flag, depth);        // ring lookup, bit6 = half-turn, bit7 forced on
    mem8[u16(ENEMY_PHASE + x)] = dir;
    return dir;                                  // live-out A
  }

  let val;                                       // segment 4 (the seam)
  if (flag & 0x40) {                             // bit6 set -> step depth down one (mod 16)
    mem8[u16(ENEMY_SEGMENT + x)] = (mem8[u16(ENEMY_SEGMENT + x)] - 1) & 0x0f;
    val = 0x87;
  } else {
    val = 0x81;
  }
  mem8[u16(ENEMY_PHASE + x)] = val;
  return (m.regs.a = val);
}

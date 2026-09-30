// SPDX-License-Identifier: GPL-3.0-only
/** serviceSlotByHeadByte — service one slot, splitting three ways on the head byte of its record. Zero does
 * nothing. All-ones flies the object one
 * step along the velocity it carries, and retires it — into the shared cooldown — only once that
 * step has put it on a retire line. Any OTHER value retires it on the spot, without moving it
 * first, so a slot holding anything else goes out where it stands. Which slot is the caller's (the
 * record and its sprite entry are arguments); this reads one byte to choose an arm. LIVE-OUT: memory.
 *
 * ROM 0x3DEB-0x3DFA, falling through into 0x3DFB (retireSlotIntoSharedCooldown). Grounding: [seen].
 * The "any other value" arm is a code-level reading: no capture wrote the head byte with any
 * value but zero or all-ones (names.js).
 *
 * Parameters: `record` -- the slot's object record in work RAM (IX in the ROM); `entry` -- the
 * slot's sprite entry, where its on-screen coordinates live (IY in the ROM). Both come from the
 * caller's walk over its slots.
 *
 * LIVE-OUT: memory -- the record and sprite entry (moved and/or retired), nothing returned. */

import { flyAlongStoredVelocity } from "./flyAlongStoredVelocity.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlotIntoSharedCooldown } from "./retireSlotIntoSharedCooldown.js";

// The head-byte value that marks a live, flying object. The ROM tests it with `inc a`, which
// reaches zero only from 0xFF.
const ALL_ONES = 255;

export function serviceSlotByHeadByte(m, record = m.regs.ix, entry = m.regs.iy) {
  // The head byte (record +0) chooses the arm (ROM `ld a,(ix+0)` / `and a` / `ret z`). Zero means
  // the slot is unused: return without touching anything.
  const head = m.mem8[record];
  if (head === 0) return;
  // Not zero and not all-ones (ROM `inc a` / `jp nz,0x3dfb`): retire the slot where it stands,
  // without moving it. retireSlotIntoSharedCooldown clears the slot the way retireSlot does and
  // then arms its delay byte from one shared address, so every slot retired here waits the
  // same shared cooldown before it can be reused.
  if (head !== ALL_ONES) {
    retireSlotIntoSharedCooldown(m, record, entry);
    return;
  }
  // All-ones: a live object. Fly it one step (ROM call 0x3E05): each coordinate gains the
  // velocity word banked in its own record at +0x0A..+0x0D plus the frame's shared world
  // scroll, so it moves under its own speed and with the world at the same time.
  flyAlongStoredVelocity(m, record, entry);
  // Then ask (ROM call 0x2B83) whether that step has put it on either of the two fixed retire
  // lines -- 0x04 and 0xF8, each half a wrapped screen away from the player's pinned sprite
  // position. Only on a yes (carry set; ROM `ret nc` otherwise) does it fall through into the
  // same shared-cooldown retire; otherwise the slot is left live.
  if (hasReachedRetireLine(m, entry)) retireSlotIntoSharedCooldown(m, record, entry);
}

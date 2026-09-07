// SPDX-License-Identifier: GPL-3.0-only
//
// seedObjectRamShadowField — fill the ODD lane of the OBJRAM shadow from a source table.
//
// WHAT IT IS
//   A strided memcpy: 32 source bytes are laid into every OTHER cell of the object-RAM shadow,
//   starting at loc_4021 (0x4021) with a destination stride of 2. Source is read contiguously
//   (srcPtr, srcPtr+1, ...); the caller supplies srcPtr, defaulting to HL (the Z80 entry reg).
//
// ROLE IN THE MACHINE
//   The OBJRAM shadow at 0x4020 is a stride-2 interleaved region the vblank service pushes
//   wholesale to the sprite/scroll hardware each frame. Its ODD lane (0x4021, 0x4023, ... 0x405f)
//   holds the sprite CODE bytes; this routine seeds exactly that lane from a ROM template at
//   screen/formation init. The EVEN lane (the swept column coordinate) is left alone, to be
//   repainted live by the formation sway.
//
// ROM 0x0598.  Grounding: [seen].
// LIVE-OUT: 32 odd-lane cells of the OBJRAM shadow (0x4021..0x405f).
import { loc_4021 } from "./names.js";

// The copy runs over 32 entries.
const ENTRIES = 32;

export function seedObjectRamShadowField(m, srcPtr = m.regs.hl) {
  const { mem8 } = m;

  // Walk the source one byte at a time into every other destination cell.
  // Destination advances by 2 (i*2) so only the odd/code lane is touched; source is contiguous.
  for (let i = 0; i < ENTRIES; i++) {
    mem8[loc_4021 + i * 2] = mem8[srcPtr + i];
  }
}

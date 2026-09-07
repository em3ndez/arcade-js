// SPDX-License-Identifier: GPL-3.0-only
//
// seedObjectShadowFromRom — the common entry that seeds the OBJRAM-shadow code lane from ROM.
//
// WHAT IT IS
//   A one-line wrapper: it points the strided copier at the fixed ROM template STRIDED_TABLE_SRC
//   (0x1d71) and runs it, laying 32 sprite-code bytes into every other destination cell of the
//   shadow (0x4021, 0x4023, ... 0x405f). On the Z80 this is "HL = 0x1d71; call seedObjectRamShadowField".
//
// ROLE IN THE MACHINE
//   The reseed always rides a sequence boundary — whenever the field is about to be rebuilt, the
//   sprite codes are restored from ROM here while the live coordinate lane is left for the sway to
//   repaint. Sibling templates (loc_1d91, OBJ_SHADOW_RESEED_TEMPLATE 0x1db1) seed the same lane in
//   other phases; this is the plain screen/formation-init variant.
//
// ROM 0x0595.  Grounding: [seen].
// LIVE-OUT: 32 odd-lane cells of the OBJRAM shadow (via seedObjectRamShadowField).
import { seedObjectRamShadowField as loc_0598 } from "./seedObjectRamShadowField.js";
import { STRIDED_TABLE_SRC } from "./names.js";

export function seedObjectShadowFromRom(m) {
  // Aim the strided copier at the fixed source table and let it run the 32-entry stride-2 copy.
  loc_0598(m, STRIDED_TABLE_SRC);
}

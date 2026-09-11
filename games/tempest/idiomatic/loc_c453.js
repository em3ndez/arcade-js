// SPDX-License-Identifier: GPL-3.0-only
import { loc_57, loc_5b, loc_5f } from "./names.js";

// When the guard byte is clear and one counter sits less than 0x0c above a reference,
// nudge that counter up to the reference plus 0x0f, capped at a ceiling of 0xf0.
export function loc_c453(m) {
  const { mem8 } = m;
  if (mem8[loc_5b] !== 0) return;
  if (mem8[loc_57] - mem8[loc_5f] >= 0x0c) return;
  let v = mem8[loc_5f] + 0x0f;
  if (v >= 0xf0) v = 0xf0;
  mem8[loc_57] = v;
}

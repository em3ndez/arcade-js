// SPDX-License-Identifier: GPL-3.0-only
import { loc_1c6, loc_1c7, loc_1c8 } from "./names.js";

// Fixed entry: stamp 0xff into the first flag byte and OR the mask 0x07 into the
// next two flag bytes.
export function loc_ddf1(m) {
  const { mem8 } = m;
  mem8[loc_1c6] = 0xff;
  mem8[loc_1c7] = (mem8[loc_1c7] | 0x07);
  mem8[loc_1c8] = (mem8[loc_1c8] | 0x07);
}

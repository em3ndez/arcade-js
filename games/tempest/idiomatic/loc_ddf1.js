// SPDX-License-Identifier: GPL-3.0-only
import { EAROM_BLANK_FLAG, EAROM_REGION_PENDING, EAROM_REGION_DIR } from "./names.js";

// Fixed entry: stamp 0xff into the first flag byte and OR the mask 0x07 into the
// next two flag bytes.
export function loc_ddf1(m) {
  const { mem8 } = m;
  mem8[EAROM_BLANK_FLAG] = 0xff;
  mem8[EAROM_REGION_PENDING] = (mem8[EAROM_REGION_PENDING] | 0x07);
  mem8[EAROM_REGION_DIR] = (mem8[EAROM_REGION_DIR] | 0x07);
}

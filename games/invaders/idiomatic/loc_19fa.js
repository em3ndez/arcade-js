// SPDX-License-Identifier: GPL-3.0-only
import { clearScreenStrip } from "./clearScreenStrip.js";

// Blank successive 16-row screen strips from HL, advancing one strip (HL += 0x200) per pass, until the strip base's high byte reaches the terminator row. Live-out HL/A/B.
export function loc_19fa(m, hl = m.regs.hl) {
  let cur = hl;
  do {
    cur = clearScreenStrip(m, 0x10, cur);
  } while (((cur >> 8) & 0xff) !== 0x35);
  return [(m.regs.hl = cur), (m.regs.a = (cur >> 8) & 0xff), (m.regs.b = 0)];
}

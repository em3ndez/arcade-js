// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_35, loc_36, loc_38, loc_56, loc_57, loc_73, loc_9e, loc_112,
  loc_b97c, loc_ba7c, loc_bccc, loc_c22d,
} from "./names.js";
import { loc_c2e8 } from "./loc_c2e8.js";
import { loc_df4c } from "./loc_df4c.js";
import { loc_df6a } from "./loc_df6a.js";
import { loc_df75 } from "./loc_df75.js";

// Reduce an input byte into two scratch fields, emit a framing record, then walk two
// delta tables (16 steps) emitting one vector segment per step.
export function loc_c4e1(m, a = m.regs.a) {
  const { mem8 } = m;

  const [reduced, quotient] = loc_c2e8(m, a);
  mem8[loc_36] = reduced;
  mem8[loc_35] = quotient;

  mem8[loc_73] = 0x00;
  loc_df6a(m, 0x05);

  const col = mem8[loc_35] & 0x07;
  const header = mem8[u16(loc_c22d + col)];
  mem8[loc_9e] = header;
  loc_df4c(m, 0x08, header);

  const shape = mem8[loc_112];
  let seed = mem8[loc_36];
  if (mem8[u16(loc_bccc + shape)] === 0) seed = (seed - 0x0f) & 0xff;

  const firstY = mem8[u16(loc_ba7c + seed)];
  mem8[loc_57] = firstY;
  const firstX = mem8[u16(loc_b97c + seed)];
  mem8[loc_56] = firstX;
  loc_df75(m, firstX ^ 0x80, firstY ^ 0x80);

  mem8[loc_73] = 0xc0;
  mem8[loc_38] = 0x0f;
  for (;;) {
    const idx = mem8[loc_36];
    const nx = mem8[u16(loc_b97c + idx)];
    const dx = (nx - mem8[loc_56]) & 0xff;
    mem8[loc_56] = nx;
    const ny = mem8[u16(loc_ba7c + idx)];
    const dy = (ny - mem8[loc_57]) & 0xff;
    mem8[loc_57] = ny;
    loc_df75(m, dx, dy);
    mem8[loc_36] = mem8[loc_36] - 1;
    const count = (mem8[loc_38] - 1) & 0xff;
    mem8[loc_38] = count;
    if (count >= 0x80) break;
  }

  loc_df6a(m, 0x01);
}

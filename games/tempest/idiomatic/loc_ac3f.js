// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_5, loc_9, loc_29, loc_2a, loc_2b, loc_2c, loc_2d, loc_2e, loc_36, loc_3d, loc_3e,
  loc_40, loc_41, loc_42, loc_51e, loc_51f, loc_520, loc_600, loc_601, loc_603, loc_605,
  loc_61e, loc_61f, loc_620,
} from "./names.js";
import { loc_ca62 } from "./loc_ca62.js";
import { loc_ddfb } from "./loc_ddfb.js";
import { loc_ad22 } from "./loc_ad22.js";

// Bubble-sort each channel's record table (a key triple against the stored rows) counting the
// passes it takes to settle, records the pass count per channel, nudges one running total, then
// derives a packed request byte and hands off to the request walker.

// Step the row cursor down by two (or three when still high), returning the new position.
function advanceCursor(y) {
  if (y >= 0x55) y = u8(y - 1);
  y = u8(y - 1);
  y = u8(y - 1);
  return y;
}

export function loc_ac3f(m) {
  const { mem8 } = m;
  mem8[loc_5] = mem8[loc_5] & 0xbf;
  if ((mem8[loc_9] & 0x43) === 0x40) loc_ca62(m);
  loc_ddfb(m);
  mem8[loc_601] = 0x00;

  let channel = mem8[loc_3e] === 0 ? 0 : 3;
  while (true) {
    mem8[loc_2c] = mem8[u8(loc_42 + channel)];
    mem8[loc_2d] = mem8[u8(loc_41 + channel)];
    mem8[loc_2e] = mem8[u8(loc_40 + channel)];
    mem8[loc_36] = channel & 0x01;
    mem8[loc_2b] = 0x00;
    mem8[loc_2a] = 0x1a;
    mem8[loc_29] = 0x1a;
    mem8[loc_605] = 0x00;

    let y = 0xfd;
    while (true) {
      // Ordered when the row triple is >= the key triple (lexicographic).
      let ordered;
      const hi = mem8[u16(loc_620 + y)];
      if (hi !== mem8[loc_2c]) ordered = hi >= mem8[loc_2c];
      else {
        const mid = mem8[u16(loc_61f + y)];
        if (mid !== mem8[loc_2d]) ordered = mid >= mem8[loc_2d];
        else if (y < 0x52) ordered = true;
        else ordered = mem8[u16(loc_61e + y)] >= mem8[loc_2e];
      }

      if (!ordered) {
        while (true) {
          if (y >= 0xe8) {
            let t = mem8[u16(loc_51e + y)];
            mem8[u16(loc_51e + y)] = mem8[loc_29]; mem8[loc_29] = t;
            t = mem8[u16(loc_51f + y)];
            mem8[u16(loc_51f + y)] = mem8[loc_2a]; mem8[loc_2a] = t;
            t = mem8[u16(loc_520 + y)];
            mem8[u16(loc_520 + y)] = mem8[loc_2b]; mem8[loc_2b] = t;
          }
          let t = mem8[u16(loc_61f + y)];
          mem8[u16(loc_61f + y)] = mem8[loc_2d]; mem8[loc_2d] = t;
          t = mem8[u16(loc_620 + y)];
          mem8[u16(loc_620 + y)] = mem8[loc_2c]; mem8[loc_2c] = t;
          if (y >= 0x52) {
            t = mem8[u16(loc_61e + y)];
            mem8[u16(loc_61e + y)] = mem8[loc_2e]; mem8[loc_2e] = t;
          }
          y = advanceCursor(y);
          if (y === 0) break;
        }
        y = 0x02;
      }

      mem8[loc_605] = u8(mem8[loc_605] + 1);
      y = advanceCursor(y);
      if (y === 0) break;
    }

    channel = mem8[loc_36];
    mem8[u16(loc_600 + channel)] = mem8[loc_605];
    channel = u8(channel - 1);
    if ((channel & 0x80) !== 0) break;
  }

  const total = mem8[loc_601];
  if (total >= mem8[loc_600] && total < 0x63) mem8[loc_601] = u8(mem8[loc_601] + 1);

  const flag = mem8[loc_3d];
  let request = (((flag ^ 0x01) << 2) & 0xff) | flag;
  request = u8(request + 0x05 + ((flag >> 6) & 0x01));
  mem8[loc_603] = request;
  return loc_ad22(m);
}

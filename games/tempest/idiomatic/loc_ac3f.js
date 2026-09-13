// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  STATUS_FLAGS, DSW1_SNAPSHOT, loc_29, loc_2a, loc_2b, COORD_LIST_PTR_LO, COORD_LIST_PTR_HI, loc_2e, SAVED_INDEX2, loc_3d, ACTIVE_SLOT_COUNT,
  loc_40, loc_41, loc_42, SORT_PAYLOAD_LO, SORT_PAYLOAD_MID, SORT_PAYLOAD_HI, SLOT_METRIC, loc_601, REQUEST_BITS, PASS_COUNTER,
  SORT_KEY_LO, SORT_KEY_MID, SORT_KEY_HI,
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
  mem8[STATUS_FLAGS] = mem8[STATUS_FLAGS] & 0xbf;
  if ((mem8[DSW1_SNAPSHOT] & 0x43) === 0x40) loc_ca62(m);
  loc_ddfb(m);
  mem8[loc_601] = 0x00;

  let channel = mem8[ACTIVE_SLOT_COUNT] === 0 ? 0 : 3;
  while (true) {
    mem8[COORD_LIST_PTR_LO] = mem8[u8(loc_42 + channel)];
    mem8[COORD_LIST_PTR_HI] = mem8[u8(loc_41 + channel)];
    mem8[loc_2e] = mem8[u8(loc_40 + channel)];
    mem8[SAVED_INDEX2] = channel & 0x01;
    mem8[loc_2b] = 0x00;
    mem8[loc_2a] = 0x1a;
    mem8[loc_29] = 0x1a;
    mem8[PASS_COUNTER] = 0x00;

    let y = 0xfd;
    while (true) {
      // Ordered when the row triple is >= the key triple (lexicographic).
      let ordered;
      const hi = mem8[u16(SORT_KEY_HI + y)];
      if (hi !== mem8[COORD_LIST_PTR_LO]) ordered = hi >= mem8[COORD_LIST_PTR_LO];
      else {
        const mid = mem8[u16(SORT_KEY_MID + y)];
        if (mid !== mem8[COORD_LIST_PTR_HI]) ordered = mid >= mem8[COORD_LIST_PTR_HI];
        else if (y < 0x52) ordered = true;
        else ordered = mem8[u16(SORT_KEY_LO + y)] >= mem8[loc_2e];
      }

      if (!ordered) {
        while (true) {
          if (y >= 0xe8) {
            let t = mem8[u16(SORT_PAYLOAD_LO + y)];
            mem8[u16(SORT_PAYLOAD_LO + y)] = mem8[loc_29]; mem8[loc_29] = t;
            t = mem8[u16(SORT_PAYLOAD_MID + y)];
            mem8[u16(SORT_PAYLOAD_MID + y)] = mem8[loc_2a]; mem8[loc_2a] = t;
            t = mem8[u16(SORT_PAYLOAD_HI + y)];
            mem8[u16(SORT_PAYLOAD_HI + y)] = mem8[loc_2b]; mem8[loc_2b] = t;
          }
          let t = mem8[u16(SORT_KEY_MID + y)];
          mem8[u16(SORT_KEY_MID + y)] = mem8[COORD_LIST_PTR_HI]; mem8[COORD_LIST_PTR_HI] = t;
          t = mem8[u16(SORT_KEY_HI + y)];
          mem8[u16(SORT_KEY_HI + y)] = mem8[COORD_LIST_PTR_LO]; mem8[COORD_LIST_PTR_LO] = t;
          if (y >= 0x52) {
            t = mem8[u16(SORT_KEY_LO + y)];
            mem8[u16(SORT_KEY_LO + y)] = mem8[loc_2e]; mem8[loc_2e] = t;
          }
          y = advanceCursor(y);
          if (y === 0) break;
        }
        y = 0x02;
      }

      mem8[PASS_COUNTER] = u8(mem8[PASS_COUNTER] + 1);
      y = advanceCursor(y);
      if (y === 0) break;
    }

    channel = mem8[SAVED_INDEX2];
    mem8[u16(SLOT_METRIC + channel)] = mem8[PASS_COUNTER];
    channel = u8(channel - 1);
    if ((channel & 0x80) !== 0) break;
  }

  const total = mem8[loc_601];
  if (total >= mem8[SLOT_METRIC] && total < 0x63) mem8[loc_601] = u8(mem8[loc_601] + 1);

  const flag = mem8[loc_3d];
  let request = (((flag ^ 0x01) << 2) & 0xff) | flag;
  request = u8(request + 0x05 + ((flag >> 6) & 0x01));
  mem8[REQUEST_BITS] = request;
  return loc_ad22(m);
}

// SPDX-License-Identifier: GPL-3.0-only
/** loc_10f8 — give five display-list slots a second appearance, half a screen away.
 *
 * A slot is a pair of bytes and the high bit of the first one is a request. Where it is set the
 * pair trades half a byte range: the requester gives that half up and the partner takes it on,
 * which is what carries the slot into the far half of the display. A slot with no request is
 * stepped over, not stopped at, so a gap in the middle costs the slots after it nothing.
 * The hold that belongs before each trade is not reproduced; the same bytes land either way.
 * LIVE-OUT: memory only. */

const SPLIT_SLOTS = [
  { request: 0xb437, partner: 0xb036 },
  { request: 0xb439, partner: 0xb038 },
  { request: 0xb43b, partner: 0xb03a },
  { request: 0xb43d, partner: 0xb03c },
  { request: 0xb43f, partner: 0xb03e },
];

const HALF_RANGE = 128;

export function loc_10f8(m) {
  const { mem8 } = m;
  for (const slot of SPLIT_SLOTS) {
    const request = mem8[slot.request];
    if (request < HALF_RANGE) continue;
    mem8[slot.request] = request - HALF_RANGE;
    mem8[slot.partner] = mem8[slot.partner] + HALF_RANGE;
  }
}

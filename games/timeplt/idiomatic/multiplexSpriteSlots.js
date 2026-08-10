// SPDX-License-Identifier: GPL-3.0-only
/** multiplexSpriteSlots — give eight display-list slots a second appearance half a screen away: where
 * a slot's request bit (high bit of its first byte) is set, the pair trades half a byte range so the
 * slot moves to the far half; a slot with no request is untouched. Each relocation is recorded in
 * m.beamPlan so the beam-sync render can repaint the first appearance in its band. LIVE-OUT: memory, m.beamPlan. */

const SPLIT_SLOTS = [
  { request: 0xb411, partner: 0xb010 },
  { request: 0xb413, partner: 0xb012 },
  { request: 0xb415, partner: 0xb014 },
  { request: 0xb437, partner: 0xb036 },
  { request: 0xb439, partner: 0xb038 },
  { request: 0xb43b, partner: 0xb03a },
  { request: 0xb43d, partner: 0xb03c },
  { request: 0xb43f, partner: 0xb03e },
];

const HALF_RANGE = 128;

export function multiplexSpriteSlots(m) {
  const { mem8 } = m;
  for (const slot of SPLIT_SLOTS) {
    const request = mem8[slot.request];
    if (request < HALF_RANGE) continue;
    mem8[slot.request] = request - HALF_RANGE;
    mem8[slot.partner] = mem8[slot.partner] + HALF_RANGE;
    if (m.beamPlan) m.beamPlan.push({ y: slot.request, x: slot.partner });
  }
}

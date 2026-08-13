// SPDX-License-Identifier: GPL-3.0-only
/** trampolineToSeatTheStackAndSettleTheControlLatch — where the processor starts from cold: three bytes that hand straight on to the
 * power-on routine, touching nothing on the way. LIVE-OUT: whatever that routine leaves. */

import { seatTheStackAndSettleTheControlLatch } from "./seatTheStackAndSettleTheControlLatch.js";

export function trampolineToSeatTheStackAndSettleTheControlLatch(m) {
  return seatTheStackAndSettleTheControlLatch(m);
}

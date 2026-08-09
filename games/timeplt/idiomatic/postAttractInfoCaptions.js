// SPDX-License-Identifier: GPL-3.0-only
/** postAttractInfoCaptions — one arm of the two-level sequence machine: hands a fixed run of codes to the
 * display-list writer as (1, code) pairs, two of them chosen by two work cells, then bumps the
 * sequence counter twice on the high branch and once on the low. LIVE-OUT: memory. */

import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";

export function postAttractInfoCaptions(m) {
  const { mem8, regs } = m;
  // each frozen callee pops a parked slot; the dissolved advanceSequenceSubStep tail takes no return.
  const call = (addr) => { m.push16(0); m.call(addr); };
  call(0x0b06);
  call(0x0b39);

  const post = (code) => { regs.de = 0x0100 | code; call(0x0038); };
  post(0x01);
  post(0x14);
  post(0x15);

  const flip = mem8[0xa9c3] === 0 ? 0x0f : 0x11;
  post(flip);
  post(flip + 1);
  post(0x16);
  post(0x00);

  if (mem8[0xa986] >= 2) {
    post(0x19);
    call(0x0f1a);
    return advanceSequenceSubStep(m);
  }
  post(0x17);
  return advanceSequenceSubStep(m);
}

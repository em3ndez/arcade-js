// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3fd6 -- a tail-jump trampoline back into the service-loop head. Its own body writes nothing;
 * it just transfers control, so the head is part of the cyclic spine and stays a dispatch. [code]
 */
export function loc_3fd6(m) {
  return m.call(0x3d57); // tail-jump to the spine head
}

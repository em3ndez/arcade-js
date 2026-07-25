// SPDX-License-Identifier: GPL-3.0-only
/**
 * Translated vblank NMI handler.
 *
 * DK uses NMI (0x0066), not IM1 -- the bytes at 0x0038 are an ordinary
 * subroutine, not an ISR.
 *
 * TIMING: the NMI fires AT the frame boundary, not partway into it.
 * `NMI_CYCLE_IN_FRAME` is 0 because MAME's frame origin for this driver IS the
 * vblank point, so vblank begins at the boundary and the NMI fires there.
 * (Real NMI entries land at frame N.000x, e.g. 202771, 253451, 304141.)
 *
 * THE HANDLER IS ALSO THE WATCHDOG KICK. `ld a,(0x7d00)` at 0x0072 reads IN2,
 * and that READ resets the watchdog -- nothing ever writes a watchdog
 * register. So the dog is fed exactly once per vblank, as a side effect of
 * reading the inputs. A translation that stops running the NMI therefore also
 * stops feeding the watchdog, and MAME would reset while we sail on.
 */

export { sub_003d } from "./sub_003d.js";
export { loc_0038 } from "./loc_0038.js";
export { entry_0066 } from "./entry_0066.js";
export { readControls } from "./readControls.js";
export { perFrame } from "./perFrame.js";
export { sub_0141 } from "./sub_0141.js";
export { sub_0057 } from "./sub_0057.js";
export { sub_017b } from "./sub_017b.js";
export { sub_00e0 } from "./sub_00e0.js";
export { handler_073c } from "./handler_073c.js";
export { sub_0028 } from "./sub_0028.js";
export { sub_0018 } from "./sub_0018.js";
export { sub_0020 } from "./sub_0020.js";
export { handler_0763 } from "./handler_0763.js";
export { handler_123c } from "./handler_123c.js";
export { loc_0c91 } from "./loc_0c91.js";
export { loc_0c92 } from "./loc_0c92.js";
export { loc_0cdf } from "./loc_0cdf.js";
export { loc_0cf2 } from "./loc_0cf2.js";
export { loc_0cd4 } from "./loc_0cd4.js";
export { loc_0cc6 } from "./loc_0cc6.js";
export { loc_3fa0 } from "./loc_3fa0.js";
export { loc_0d5f } from "./loc_0d5f.js";
export { sub_3fa6 } from "./sub_3fa6.js";
export { sub_0da7 } from "./sub_0da7.js";
export { loc_0dd3 } from "./loc_0dd3.js";
export { loc_0e19 } from "./loc_0e19.js";
export { loc_0e2a } from "./loc_0e2a.js";
export { dispatchGameState } from "./dispatchGameState.js";
export { loc_0e4f } from "./loc_0e4f.js";

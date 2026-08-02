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

export { loc_003d } from "./loc_003d.js";
export { loc_0038 } from "./loc_0038.js";
export { loc_0066 } from "./loc_0066.js";
export { loc_0087 } from "./loc_0087.js";
export { loc_00b5 } from "./loc_00b5.js";
export { loc_0141 } from "./loc_0141.js";
export { loc_0057 } from "./loc_0057.js";
export { loc_017b } from "./loc_017b.js";
export { loc_00e0 } from "./loc_00e0.js";
export { loc_073c } from "./loc_073c.js";
export { loc_0028 } from "./loc_0028.js";
export { loc_0018 } from "./loc_0018.js";
export { loc_0020 } from "./loc_0020.js";
export { loc_0763 } from "./loc_0763.js";
export { loc_123c } from "./loc_123c.js";
export { loc_0c91 } from "./loc_0c91.js";
export { loc_0c92 } from "./loc_0c92.js";
export { loc_0cdf } from "./loc_0cdf.js";
export { loc_0cf2 } from "./loc_0cf2.js";
export { loc_0cd4 } from "./loc_0cd4.js";
export { loc_0cc6 } from "./loc_0cc6.js";
export { loc_3fa0 } from "./loc_3fa0.js";
export { loc_0d5f } from "./loc_0d5f.js";
export { loc_3fa6 } from "./loc_3fa6.js";
export { loc_0da7 } from "./loc_0da7.js";
export { loc_0dd3 } from "./loc_0dd3.js";
export { loc_0e19 } from "./loc_0e19.js";
export { loc_0e2a } from "./loc_0e2a.js";
export { loc_00ca } from "./loc_00ca.js";
export { loc_0e4f } from "./loc_0e4f.js";

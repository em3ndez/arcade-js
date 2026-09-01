// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { loc_1b83 } from "./names.js";

// Copy the caller-sized record from the fixed template into the caller's destination.
export function copyTemplateToRecord(m) {
  blockCopy(m, loc_1b83);
}

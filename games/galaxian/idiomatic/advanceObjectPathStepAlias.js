// SPDX-License-Identifier: GPL-3.0-only
// Dispatch-state handler that does no work of its own: it forwards straight to the shared per-object
// path-move step for the object currently selected.
import { advanceObjectPathStep } from "./advanceObjectPathStep.js";

export function advanceObjectPathStepAlias(m) {
  return advanceObjectPathStep(m);
}

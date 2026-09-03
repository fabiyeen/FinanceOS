"use client";

import React from "react";
import { PinLockScreen } from "./PinLockScreen";

/**
 * BiometricGateModal is superseded by PinLockScreen which supports
 * dynamic salted PIN security, 30s rate limiting, WebAuthn, and password recovery.
 */
export const BiometricGateModal: React.FC = () => {
  return <PinLockScreen />;
};

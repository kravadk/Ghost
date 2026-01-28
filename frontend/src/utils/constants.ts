// Transaction fee: same as tipzo — 0.01 ALEO (fee value 10_000 as in tipzo Profile/QuickDonate)
// SECURITY: This is the ONLY fee charged - blockchain transaction fee only
// No additional tokens are deducted for any actions (sending messages, creating profiles, etc.)
export const TRANSACTION_FEE = 10_000; // 0.01 ALEO (matches tipzo project)

// Minimum balance check: 0.01 ALEO in microcredits (for "Need at least 0.01 ALEO" validation)
export const MIN_FEE_MICROCREDITS = 10_000_000_000; // 0.01 ALEO

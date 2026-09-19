// Postgres CHECK constraints pin some text columns to a fixed set of values, but
// the generated types only say `string`. Narrow them where rows enter the app,
// and fail loudly if the schema and the code ever disagree.

export function isOneOf<T extends string>(allowed: readonly T[], value: string): value is T {
  return allowed.some((a) => a === value)
}

export function oneOf<T extends string>(allowed: readonly T[], value: string, column: string): T {
  if (isOneOf(allowed, value)) return value
  throw new Error(`Unexpected ${column} "${value}" — expected one of: ${allowed.join(", ")}`)
}

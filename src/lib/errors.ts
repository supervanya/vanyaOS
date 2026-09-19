// Promise rejections and `catch` bindings are `unknown`: anything can be thrown.
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Promise rejections and `catch` bindings are `unknown`: anything can be thrown.
export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  if (err && typeof err === "object" && "message" in err) return String(err.message)
  else return String(err)
}

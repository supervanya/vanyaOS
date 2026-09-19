import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query"
import { toast } from "sonner"
import { errorMessage } from "./errors"

type ListChange<T> = {
  /** Applies the change to the cached list, for the screen to show at once. */
  change: (items: T[]) => T[]
  /** Sends the same change to the database. */
  write: () => Promise<unknown>
}

/**
 * Writes against a cached list that show up immediately: the cache takes the
 * change first, the database second. A failed write rolls the list back and
 * says so; either way the list refetches, so the cache ends up matching the
 * database. Returns `apply(change, write)`.
 */
export function useOptimisticList<T>(
  queryKey: QueryKey,
  /** What to refetch afterwards; defaults to the list. Pass a prefix to also
   * refresh data derived from it elsewhere. */
  { invalidate = queryKey }: { invalidate?: QueryKey } = {},
) {
  const queryClient = useQueryClient()
  const { mutate } = useMutation({
    mutationFn: ({ write }: ListChange<T>) => write(),
    onMutate: async ({ change }) => {
      // An in-flight refetch would overwrite the optimistic list when it lands.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<T[]>(queryKey)
      queryClient.setQueryData<T[]>(queryKey, (items) => items && change(items))
      return { previous }
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
      toast.error(`Didn't save: ${errorMessage(err)}`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidate }),
  })
  return (change: ListChange<T>["change"], write: ListChange<T>["write"]) =>
    mutate({ change, write })
}

# React conventions

How components, data and state are written in this app. The linter enforces what it can (Hooks rules, no floating promises, no unsafe `any`, accessibility); this covers the patterns it can't. Each rule points at code that already follows it.

## Reading data: route loader + TanStack Query

Every read is a `queryOptions` object in its feature's `queries.ts`. Routes load what the page needs **before it renders**; components read the same cache.

```ts
// features/tasks/queries.ts
export const tasksQuery = queryOptions({ queryKey: ["tasks"], queryFn: listTasks })

// routes/index.tsx
export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(retroAreasQuery) // optional: don't wait for it
    await queryClient.ensureQueryData(tasksQuery) // required: the page needs it
  },
  pendingComponent: DashboardSkeleton,
  component: Dashboard,
})

// features/tasks/TaskBoard.tsx
const { data: tasks } = useSuspenseQuery(tasksQuery) // never undefined
```

- **Required data**: `ensureQueryData` in the loader, `useSuspenseQuery` in the component. No `if (!data) return null`.
- **Optional data** (a badge, a delta): `prefetchQuery` in the loader, `useQuery` in the component, render nothing until it arrives. See `RetroNavCard` in `routes/index.tsx`.
- **Keys** start with the feature (`["tasks"]`, `["retro", "latest", areaId]`) and nest by what should be invalidated together. Settings rows live under `["config", …]` so an edit there also refreshes `configQuery`.
- **One query, many readers.** Dashboard and Reflect both render `TaskBoard` from `tasksQuery`; there is one copy of the data.
- **A query that needs another** gets it from the client: `queryFn: async ({ client }) => loadOrInitDay(date, await client.ensureQueryData(configQuery))`.
- **Never fetch in `useEffect`.** No `useState` + `useEffect` + `.then(setX)`.

Every route gets a loading state: a skeleton shaped like the page (`pendingComponent`), or the default `PageSkeleton`. Errors fall through to `RouteError`, which offers a retry.

## Writing data

- **Lists** (tasks, projects, settings rows) use `useOptimisticList` from `lib/optimistic.ts`: the cache shows the change at once, the database follows, a failure rolls back with a toast, and the list refetches either way.

  ```ts
  const apply = useOptimisticList<Task>(tasksQuery.queryKey)
  apply(
    (list) => list.filter((t) => t.id !== task.id), // what the screen shows now
    () => deleteTask(task.id), // what the database does
  )
  ```

- **New rows** get their id on the client (`crypto.randomUUID()`, see `newTask`) so they appear instantly under the id they keep.
- **Anything else** awaits the write, then invalidates the queries it changed, including derived ones elsewhere (`["retro"]` after a retro save updates the dashboard's "due" badge).
- **Async event handlers** handle their own errors and are called explicitly: `onClick={() => void save()}`.
- **The app never hard-deletes history.** Config rows are archived. Only tasks and projects are deleted.

## Effects are for syncing with things outside React

Allowed: DOM work (scrolling a chat to the bottom), timers (the autosave debounce), subscriptions. Not allowed:

| Instead of an effect that… | Do this |
|---|---|
| fetches data | a query (above) |
| computes a value from props or state | compute it during render (`const selectedModel = …` in `AiSettingsSection`) |
| resets state when a prop changes | give the component a `key` (`<ReflectionDay key={date}>`, `<LabelDraft key={value}>`) |
| copies loaded data into state | seed `useState` from it once, in a keyed component (`useEntryAutosave(config, loaded)`) |

## State

- Keep it where it's used; lift it only as far as needed.
- **State that should survive navigation goes in the URL**: Reflect's day is `?date=`, validated in `validateSearch`.
- **Per-device preferences** (Trends' window and sort) go in `localStorage`, read and written inside `try/catch`.
- Server data lives in the query cache, not in component state. The exception is an editor that owns a draft, like `useEntryAutosave`: it starts from the query and writes back through it.

## Components

- A component used by one feature lives in that feature's folder; move it to `src/components/` when a second feature needs it.
- Reach for the shared pieces first: `PageHeader`, `GoalBar`, `Skeleton`, and the shadcn/ui primitives in `components/ui/`.
- **Anything clickable is a `<button>` or `<Link>`**, never a `<div onClick>`. Icon-only buttons need an `aria-label`. A button can't contain another button: put secondary actions beside the row, not inside it (see `ProjectsCard`).
- Style with Tailwind classes; combine conditional classes with `cn()`. Prettier sorts them.
- No `useMemo`/`useCallback` by default. Use them only when a measured slowdown or a stable reference (a callback ref, as in `useAutoGrow`) calls for it.

## Types and errors

- Database rows are typed by `src/lib/database.types.ts` (generated, `bun run db:types`). Map snake_case rows to camelCase app types in the feature's `api.ts`.
- Text columns pinned by a `CHECK` constraint are `string` in the generated types: narrow them with `oneOf(ALLOWED, value, "table.column")`, which throws if the schema and the code disagree.
- Data from outside the program (localStorage, Edge Function responses, `JSON.parse`, `catch`) is `unknown` until checked: use `isRecord()` and friends, never `as`.
- Show errors with `errorMessage(err)`; surface failed writes to the user (toast), don't swallow them.
- Array and record lookups are `T | undefined` (`noUncheckedIndexedAccess`): narrow with a check or `??`, not `!`.

## Tests

Vitest, next to the code (`wellness.test.ts` beside `wellness.ts`). Pure logic gets unit tests; hooks get `renderHook` tests with a `QueryClientProvider` wrapper when they touch the cache (`useEntryAutosave.test.tsx`, `optimistic.test.tsx`). Mock the feature's `api.ts` or `@/lib/supabaseClient`, never the network.

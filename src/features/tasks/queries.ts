import { queryOptions } from "@tanstack/react-query"
import { listTasks } from "./api"

export const tasksQuery = queryOptions({ queryKey: ["tasks"], queryFn: listTasks })

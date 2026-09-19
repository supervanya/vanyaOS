import { queryOptions } from "@tanstack/react-query"
import { listProjects } from "./api"

export const projectsQuery = queryOptions({ queryKey: ["projects"], queryFn: listProjects })

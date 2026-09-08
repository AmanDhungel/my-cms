import { QueryClient, isServer } from "@tanstack/react-query"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Avoids refetching immediately on the client for data the server
        // already rendered.
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  // The server must never share a client between requests; the browser must
  // never create a new one on re-render (it would drop the cache).
  if (isServer) return makeQueryClient()
  return (browserQueryClient ??= makeQueryClient())
}

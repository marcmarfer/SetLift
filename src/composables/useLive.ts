import { liveQuery } from 'dexie'
import { onScopeDispose, shallowRef, watch, type ShallowRef, type WatchSource } from 'vue'

export function useLive<T>(
  query: () => Promise<T>,
  initial: T,
  deps?: WatchSource | WatchSource[],
): ShallowRef<T> {
  const value = shallowRef<T>(initial)

  const listen = () =>
    liveQuery(query).subscribe({
      next: (result) => {
        value.value = result as T
      },
      error: (error) => console.error('[dexie]', error),
    })

  let subscription = listen()

  if (deps) {
    watch(deps, () => {
      subscription.unsubscribe()
      value.value = initial
      subscription = listen()
    })
  }

  onScopeDispose(() => subscription.unsubscribe())

  return value
}

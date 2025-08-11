export class DebounceCancelledError extends Error {
  public readonly name = "DebounceCancelledError";
  constructor(message: string = "Debounced call was cancelled") {
    super(message);
  }
}

export type ConditionFn = () => boolean | Promise<boolean>;

export interface DebounceOptions {
  cancelOn?: string | null;
  maxWait?: number | null;
  condition?: ConditionFn | null;
}

type AnyFunction = (...args: any[]) => any;

type AsyncReturn<F extends AnyFunction> = ReturnType<F> extends Promise<infer R> ? R : never;

type FlushReturn<F extends AnyFunction> = ReturnType<F> extends Promise<infer R>
  ? Promise<R | undefined>
  : ReturnType<F> | undefined;

export interface DebouncedBase<F extends AnyFunction> {
  cancel: () => void;
  flush: () => FlushReturn<F>;
  pending: () => boolean;
}

export type DebouncedAsync<F extends (...args: any[]) => Promise<any>> = ((
  ...args: Parameters<F>
) => Promise<AsyncReturn<F>>) &
  DebouncedBase<F>;

export type DebouncedSync<F extends (...args: any[]) => any> = ((
  ...args: Parameters<F>
) => void) &
  DebouncedBase<F>;

function isPromise<T = unknown>(value: any): value is Promise<T> {
  return !!value && typeof value === "object" && typeof value.then === "function";
}

const isBrowser = typeof window !== "undefined" && typeof window.addEventListener === "function";

export function debounce<F extends (...args: any[]) => Promise<any>>(
  fn: F,
  delay: number,
  options?: DebounceOptions
): DebouncedAsync<F>;
export function debounce<F extends (...args: any[]) => any>(
  fn: F,
  delay: number,
  options?: DebounceOptions
): DebouncedSync<F>;
export function debounce<F extends AnyFunction>(
  fn: F,
  delay: number,
  options: DebounceOptions = {}
): DebouncedAsync<any> | DebouncedSync<any> {
  if (typeof fn !== "function") {
    throw new TypeError("Expected a function to debounce");
  }
  if (typeof delay !== "number" || !Number.isFinite(delay) || delay < 0) {
    throw new TypeError("Expected 'delay' to be a non-negative finite number");
  }

  const cancelKey = options.cancelOn ?? null;
  const maxWait = options.maxWait ?? null;
  const condition = options.condition ?? null;

  const isDeclaredAsyncFunction = fn && fn.constructor && fn.constructor.name === "AsyncFunction";

  let delayTimer: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<F> | null = null;
  let lastThis: any = null;
  let hasPending = false;

  let pendingPromise: Promise<any> | null = null;
  let resolvePending: ((value: any) => void) | null = null;
  let rejectPending: ((reason?: any) => void) | null = null;

  let removeKeyListener: (() => void) | null = null;

  function cleanupKeyListener() {
    if (removeKeyListener) {
      try {
        removeKeyListener();
      } finally {
        removeKeyListener = null;
      }
    }
  }

  function attachKeyListener() {
    if (!isBrowser || !cancelKey || removeKeyListener) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === cancelKey) {
        cancel();
      }
    };
    window.addEventListener("keydown", handler, { passive: true } as any);
    removeKeyListener = () => window.removeEventListener("keydown", handler as any);
  }

  function clearTimers() {
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    if (maxWaitTimer) {
      clearTimeout(maxWaitTimer);
      maxWaitTimer = null;
    }
  }

  function ensurePendingPromise(): Promise<any> {
    if (!pendingPromise) {
      pendingPromise = new Promise<any>((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
      });
    }
    return pendingPromise;
  }

  async function tryRun() {
    try {
      if (condition) {
        const maybeOk = condition();
        const ok = isPromise(maybeOk) ? await maybeOk : maybeOk;
        if (!ok) {
          delayTimer = setTimeout(tryRun, Math.max(10, delay));
          return;
        }
      }

      const currentArgs = lastArgs as Parameters<F>;
      const currentThis = lastThis;

      clearTimers();
      cleanupKeyListener();
      hasPending = false;
      lastArgs = null;
      lastThis = null;

      let result: any;
      try {
        result = fn.apply(currentThis, currentArgs);
      } catch (err) {
        const rej = rejectPending;
        pendingPromise = null;
        resolvePending = null;
        rejectPending = null;
        if (rej) rej(err);
        return;
      }

      if (isPromise(result)) {
        result
          .then((val) => {
            const res = resolvePending;
            pendingPromise = null;
            resolvePending = null;
            rejectPending = null;
            if (res) res(val);
          })
          .catch((err) => {
            const rej = rejectPending;
            pendingPromise = null;
            resolvePending = null;
            rejectPending = null;
            if (rej) rej(err);
          });
      } else {
        const res = resolvePending;
        pendingPromise = null;
        resolvePending = null;
        rejectPending = null;
        if (res) res(result);
      }
    } catch (err) {
      const rej = rejectPending;
      pendingPromise = null;
      resolvePending = null;
      rejectPending = null;
      if (rej) rej(err);
    }
  }

  function schedule() {
    if (!hasPending) {
      hasPending = true;
      if (maxWait != null && Number.isFinite(maxWait) && maxWait > 0) {
        maxWaitTimer = setTimeout(() => {
          if (hasPending) {
            if (delayTimer) {
              clearTimeout(delayTimer);
              delayTimer = null;
            }
            delayTimer = setTimeout(tryRun, 0);
          }
        }, maxWait);
      }
    }

    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    delayTimer = setTimeout(tryRun, delay);
    attachKeyListener();
  }

  function cancel() {
    if (!hasPending) return;
    clearTimers();
    cleanupKeyListener();
    hasPending = false;
    lastArgs = null;
    lastThis = null;
    const rej = rejectPending;
    pendingPromise = null;
    resolvePending = null;
    rejectPending = null;
    if (rej) rej(new DebounceCancelledError());
  }

  function flush(): any {
    if (!hasPending || !lastArgs) return undefined;

    const canRunSyncNow = !isDeclaredAsyncFunction && (!condition || (typeof condition === "function" && condition() === true));

    if (canRunSyncNow) {
      clearTimers();
      cleanupKeyListener();
      hasPending = false;
      const currentArgs = lastArgs as Parameters<F>;
      const currentThis = lastThis;
      lastArgs = null;
      lastThis = null;
      try {
        return (fn as any).apply(currentThis, currentArgs);
      } catch (err) {
        throw err;
      }
    }

    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    if (maxWaitTimer) {
      clearTimeout(maxWaitTimer);
      maxWaitTimer = null;
    }

    const maybePromise = isDeclaredAsyncFunction ? ensurePendingPromise() : undefined;
    setTimeout(tryRun, 0);
    return maybePromise as any;
  }

  const debounced = function (this: any, ...args: any[]) {
    lastArgs = args as Parameters<F>;
    lastThis = this;
    schedule();

    if (isDeclaredAsyncFunction) {
      return ensurePendingPromise();
    }
    return undefined;
  } as unknown as DebouncedAsync<F> & DebouncedSync<F>;

  debounced.cancel = cancel;
  debounced.flush = flush as any;
  debounced.pending = () => hasPending;

  return debounced as any;
} 
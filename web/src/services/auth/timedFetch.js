export function createTimedFetch(fetchImpl, timeoutMs = 20_000) {
  return (input, init = {}) => {
    const controller = new AbortController();
    const parentSignal = init.signal;
    const abortFromParent = () => controller.abort(parentSignal?.reason);

    if (parentSignal?.aborted) {
      abortFromParent();
    } else {
      parentSignal?.addEventListener("abort", abortFromParent, { once: true });
    }

    const timeout = setTimeout(() => {
      controller.abort(
        new DOMException(
          `Supabase Auth request timed out after ${timeoutMs} ms.`,
          "TimeoutError",
        ),
      );
    }, timeoutMs);

    return Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) {
          throw controller.signal.reason ?? new DOMException("Request aborted.", "AbortError");
        }
        return fetchImpl(input, { ...init, signal: controller.signal });
      })
      .finally(() => {
        clearTimeout(timeout);
        parentSignal?.removeEventListener("abort", abortFromParent);
      });
  };
}

export function withAuthDeadline(operation, timeoutMs = 25_000) {
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Supabase Auth operation timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
  });

  return Promise.race([
    Promise.resolve().then(operation),
    deadline,
  ]).finally(() => clearTimeout(timeout));
}

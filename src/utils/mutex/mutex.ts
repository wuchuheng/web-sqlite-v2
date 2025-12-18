export const createMutex = () => {
  // 'queue' tracks the promise of the last scheduled task.
  // We use Promise<unknown> as the common type for all tasks in the queue,
  // since we only care about their settlement (completion), not their values.
  let queue: Promise<unknown> = Promise.resolve();

  return <T>(fn: () => Promise<T>): Promise<T> => {
    // Chain the new task ('fn') to the end of the current queue.
    // 'fn' will only execute after the previous task in 'queue' has resolved.
    const next = queue.then(fn);

    // Update 'queue' to point to the completion of this new task.
    // We catch any errors from 'next' so that a failure in this task
    // does not break the chain for future tasks (ensuring the queue keeps moving).
    //
    // CRITICAL: We catch the error on the 'queue' branch, but we return 'next'
    // to the caller. This allows the caller to receive the error while the
    // internal queue recovers and continues.
    //
    // Visual Flow:
    //
    //      [ Task A Fails! ]
    //             |
    //             v
    //        [ Promise 'next' ]  <--- REJECTED (Error is here)
    //             /   \
    //            /     \
    //           /       \______________________
    //          /                               \
    //   [ Returned to User ]             [ .catch(() => {}) ]
    //          |                               |
    //          v                               v
    //   User receives Error!          [ Promise 'queue' ] <--- RESOLVED
    //   (Outside world sees it)       (Internal queue is safe)
    queue = next.catch(() => {});

    // Return the promise 'next' to the caller.
    // This allows the caller to await the result or catch errors from 'fn' directly.
    return next;
  };
};

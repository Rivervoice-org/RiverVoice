import { Toast } from "@base-ui/react/toast";

/**
 * Created outside React so it can be called from places that are not components
 * — the fetch layer reporting an expired session, for one.
 *
 * <Toaster /> in the root layout is what renders whatever lands here.
 */
export const toastManager = Toast.createToastManager();

type Options = { description?: string; timeout?: number };

/**
 * Three kinds, because a notice has three things it can be doing: confirming
 * what happened, reporting what did not, or warning about what is about to.
 *
 * An error holds until it is dismissed. Someone who looked away while a delete
 * failed has to be able to find out that it did.
 */
export const toast = {
  success: (title: string, options?: Options) =>
    toastManager.add({ ...options, title, type: "success" }),

  error: (title: string, options?: Options) =>
    toastManager.add({ timeout: 0, ...options, title, type: "error" }),

  warn: (title: string, options?: Options) =>
    toastManager.add({ ...options, title, type: "warning" }),

  /** No colour and no icon — for things that are neither good nor bad news. */
  message: (title: string, options?: Options) => toastManager.add({ ...options, title }),

  close: toastManager.close,
  promise: toastManager.promise,
};

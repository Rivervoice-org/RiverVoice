import { Toast } from "@base-ui/react/toast";

/**
 * The one manager the whole app posts to, created outside React so it can be
 * called from places that are not components — the fetch layer reporting an
 * expired session, for one.
 *
 * <Toaster /> in the root layout is what renders whatever lands here.
 */
export const toast = Toast.createToastManager();

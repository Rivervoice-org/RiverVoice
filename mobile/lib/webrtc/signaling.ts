/**
 * Signaling against ferry's WebRTC offer endpoints — POST /v1/try-agent/offer
 * (ferry/src/http/handlers/webrtc.rs webrtc_offer) for the one-way try-agent
 * demo, or POST /v1/call/start (ferry/src/http/handlers/call.rs start_call)
 * for a real two-leg PSTN call. Two distinct functions, not one branching on
 * an optional param, so each call site is explicit about which flow (and
 * which endpoint) it's using. Non-trickle: the caller is expected to wait
 * for local ICE gathering to finish before calling either, same as the
 * server does on its side (ferry/src/transport/webrtc/transport.rs).
 */

import { authHeader } from "@/lib/auth/tokens";
import { ferry, FerryApiError } from "@/lib/ferry";
import type { TryAgentOfferRequest } from "@/lib/bindings/TryAgentOfferRequest";
import type { TryAgentOfferResponse } from "@/lib/bindings/TryAgentOfferResponse";
import type { WebrtcOfferRequest } from "@/lib/bindings/WebrtcOfferRequest";
import type { WebrtcOfferResponse } from "@/lib/bindings/WebrtcOfferResponse";

export class SignalingError extends Error {}

/** Both endpoints answer with an SDP; `/v1/call/start` additionally returns a
 * `callId` that signaling has no use for, so the response type is a parameter
 * rather than the intersection of the two. */
async function post<T extends { answerSdp: string }>(
  path: string,
  body: TryAgentOfferRequest | WebrtcOfferRequest,
): Promise<string> {
  try {
    const result = await ferry.post<T>(path, body, authHeader());
    return result.answerSdp;
  } catch (err) {
    if (err instanceof FerryApiError) {
      throw new SignalingError(err.message);
    }
    throw new SignalingError(
      `Could not reach the call server: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Posts our SDP offer for `agentId` (a persisted agent — the endpoint is
 * require_user-protected and looks the agent up server-side) to the one-way
 * try-agent demo, returns ferry's SDP answer. */
export function postTryAgentOffer(offerSdp: string, agentId: string): Promise<string> {
  return post<TryAgentOfferResponse>("/v1/try-agent/offer", {
    offerSdp: offerSdp,
    agentId: agentId,
  });
}

/** Posts our SDP offer for a real two-leg call — `agentId` handles the
 * ferry-side leg, `toNumber` is who Twilio dials out to for the other leg.
 * Returns ferry's SDP answer. */
export function postCallOffer(
  offerSdp: string,
  agentId: string,
  toNumber: string,
): Promise<string> {
  return post<WebrtcOfferResponse>("/v1/call/start", {
    offerSdp: offerSdp,
    agentId: agentId,
    toNumber: toNumber,
  });
}

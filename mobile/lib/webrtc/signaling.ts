/**
 * Signaling against ferry's try-agent WebRTC endpoint (POST /v1/try-agent/offer —
 * see ferry/src/http/handlers/webrtc.rs webrtc_offer). Non-trickle: the caller is
 * expected to wait for local ICE gathering to finish before calling this,
 * same as the server does on its side (ferry/src/transport/webrtc/transport.rs).
 */

import { authHeader } from "@/lib/auth/tokens";
import { ferry, FerryApiError } from "@/lib/ferry";

export class SignalingError extends Error {}

/** Posts our SDP offer for `agentId` (a persisted agent — the endpoint is
 * require_user-protected and looks the agent up server-side), returns
 * ferry's SDP answer. */
export async function postOffer(offerSdp: string, agentId: string): Promise<string> {
  try {
    const result = await ferry.post<{ answer_sdp: string }>(
      "/v1/try-agent/offer",
      { offer_sdp: offerSdp, agent_id: agentId },
      authHeader(),
    );
    return result.answer_sdp;
  } catch (err) {
    if (err instanceof FerryApiError) {
      throw new SignalingError(err.message);
    }
    throw new SignalingError(
      `Could not reach the call server: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Signaling against ferry's try-agent WebRTC endpoint (POST /v1/try-agent/offer —
 * see ferry/src/http/handlers/webrtc.rs webrtc_offer). Non-trickle: the caller is
 * expected to wait for local ICE gathering to finish before calling this,
 * same as the server does on its side (ferry/src/transport/webrtc/transport.rs).
 */

import type { ApiResponse } from "@/lib/api-types";
import { ferryBaseUrl } from "@/lib/ferry";

const SIGNALING_TIMEOUT_MS = 15_000;

export class SignalingError extends Error {}

/** Posts our SDP offer, returns ferry's SDP answer. */
export async function postOffer(offerSdp: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SIGNALING_TIMEOUT_MS);

  let response: Response;
  try {
    console.log(
      "[ferry] posting offer to",
      `${ferryBaseUrl()}/v1/try-agent/offer`,
    );
    response = await fetch(`${ferryBaseUrl()}/v1/try-agent/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer_sdp: offerSdp }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new SignalingError("Timed out reaching the call server");
    }
    throw new SignalingError(
      `Could not reach the call server: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const body = (await response.json()) as ApiResponse<{ answer_sdp: string }>;

  if (!response.ok || body.error) {
    throw new SignalingError(
      body.error?.message ?? `Call server returned ${response.status}`,
    );
  }
  if (!body.data) {
    throw new SignalingError("Call server returned no answer");
  }

  return body.data.answer_sdp;
}

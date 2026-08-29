/**
 * Aliases over the generated bindings in `@/lib/bindings`, which ts-rs writes
 * straight from ferry's Rust types (`cargo test export_bindings`). Nothing
 * here is hand-maintained — a field renamed on the server becomes a type error
 * here instead of a runtime surprise.
 *
 * This file exists only to give the generated names app-local meaning:
 * `Status` and `Direction` are too generic to import bare, and `…Response` is
 * transport vocabulary that doesn't belong in screen code.
 */

export type { Speaker } from "@/lib/bindings/Speaker";
export type { Direction as CallDirection } from "@/lib/bindings/Direction";
export type { Status as CallLifecycleStatus } from "@/lib/bindings/Status";
export type { EndReason as CallEndReason } from "@/lib/bindings/EndReason";

export type { CallListItemResponse as CallListItem } from "@/lib/bindings/CallListItemResponse";
export type { CallDetailResponse as CallDetail } from "@/lib/bindings/CallDetailResponse";
export type { UtteranceResponse as Utterance } from "@/lib/bindings/UtteranceResponse";
export type { RecentCallsResponse } from "@/lib/bindings/RecentCallsResponse";

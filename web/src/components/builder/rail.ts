/**
 * The rail holds one panel at a time — asking about the agent, or trying it.
 *
 * Its own module so the topbar and the workspace can both name it without one
 * importing the other.
 */
export type RailView = "assistant" | "test";

// Called straight from the browser (no backend proxy yet):
// api.telegram.org allows cross-origin, and getUpdates works until a webhook is set.

const API = "https://api.telegram.org";

export type Bot = { id: number; username: string; first_name: string };

export type Chat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  first_name?: string;
};

type Update = {
  update_id: number;
  message?: { chat: Chat };
  my_chat_member?: { chat: Chat; new_chat_member: { status: string } };
};

async function call<T>(token: string, method: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/bot${token}/${method}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url);
  const body = await response.json();

  if (!body.ok) throw new Error(body.description ?? "Telegram rejected the request");
  return body.result as T;
}

export const getMe = (token: string) => call<Bot>(token, "getMe");

export const sendMessage = (token: string, chatId: number, text: string) =>
  call(token, "sendMessage", { chat_id: String(chatId), text });

export function chatLabel(chat: Chat) {
  return chat.title ?? chat.first_name ?? String(chat.id);
}

// Passing the next offset acks the batch, so a chat is only reported once.
export async function pollChats(token: string, offset: number) {
  const updates = await call<Update[]>(token, "getUpdates", {
    offset: String(offset),
    timeout: "0",
    allowed_updates: '["message","my_chat_member"]',
  });

  const chats = new Map<number, Chat>();
  for (const update of updates) {
    // A bot that was removed is not somewhere we can post.
    if (update.my_chat_member?.new_chat_member.status === "left") continue;
    const chat = update.message?.chat ?? update.my_chat_member?.chat;
    if (chat) chats.set(chat.id, chat);
  }

  const last = updates.at(-1)?.update_id;
  return { chats: [...chats.values()], offset: last === undefined ? offset : last + 1 };
}

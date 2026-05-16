export interface Message {
  id: number;
  content: string;
  isRead: boolean;
}

export type InsertMessage = Pick<Message, "content" | "isRead">;

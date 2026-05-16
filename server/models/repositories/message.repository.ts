import {
  DatabaseConfigurationError,
  getDataSource,
  getDatabaseReadHelpMessage,
} from "../../db";
import { MessageEntity } from "../entities/message.entity";
import type { Message } from "../types/message";

export interface MessageRepository {
  findLatestMessage(): Promise<Message | null>;
}

function toMessage(entity: MessageEntity): Message {
  return {
    id: entity.id,
    content: entity.content,
    isRead: entity.isRead,
  };
}

export class DatabaseMessageRepository implements MessageRepository {
  async findLatestMessage(): Promise<Message | null> {
    try {
      const dataSource = await getDataSource();
      const rows = await dataSource.getRepository(MessageEntity).find({
        order: { id: "DESC" },
        take: 1,
      });

      return rows[0] ? toMessage(rows[0]) : null;
    } catch (error) {
      console.error("DatabaseMessageRepository.findLatestMessage() failed:", error);

      if (error instanceof DatabaseConfigurationError) {
        throw error;
      }

      throw new Error(`数据库读取失败：${getDatabaseReadHelpMessage()}`);
    }
  }
}

export const messageRepository = new DatabaseMessageRepository();

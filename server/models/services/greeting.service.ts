import { messageRepository, type MessageRepository } from "../repositories/message.repository";

const DEFAULT_GREETING_MESSAGE = "Hello from the Backend API!";

export class GreetingService {
  constructor(private readonly messageRepository: MessageRepository) {}

  async getGreetingMessage(): Promise<string> {
    const latestMessage = await this.messageRepository.findLatestMessage();
    return latestMessage?.content ?? DEFAULT_GREETING_MESSAGE;
  }
}

export const greetingService = new GreetingService(messageRepository);

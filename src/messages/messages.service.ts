import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async sendMessage(senderId: number, receiverId: number, content: string) {
    if (senderId === receiverId) {
      throw new BadRequestException('You cannot send a message to yourself');
    }
    const receiver = await this.userRepository.findOne({ where: { id: receiverId } });
    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    const message = this.messageRepository.create({
      senderId,
      receiverId,
      content,
    });

    return await this.messageRepository.save(message);
  }

  async getConversations(userId: number) {
    // This is a more complex query to get the latest message for each conversation
    // For simplicity in this implementation, we'll get all messages involving the user
    // and then group them by the other person in memory.
    const messages = await this.messageRepository.find({
      where: [
        { senderId: userId },
        { receiverId: userId },
      ],
      relations: ['sender', 'receiver'],
      order: { createdAt: 'DESC' },
    });

    const conversationsMap = new Map();

    messages.forEach(msg => {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!conversationsMap.has(otherUser.id)) {
        conversationsMap.set(otherUser.id, {
          otherUser,
          lastMessage: msg,
          unreadCount: (msg.receiverId === userId && !msg.isRead) ? 1 : 0
        });
      } else if (msg.receiverId === userId && !msg.isRead) {
        conversationsMap.get(otherUser.id).unreadCount++;
      }
    });

    return Array.from(conversationsMap.values());
  }

  async getConversationMessages(userId: number, otherUserId: number) {
    const messages = await this.messageRepository.find({
      where: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
      relations: ['sender', 'receiver'],
      order: { createdAt: 'ASC' },
    });

    // Mark as read while we're here
    const unreadMessages = messages.filter(m => m.receiverId === userId && !m.isRead);
    if (unreadMessages.length > 0) {
      await this.messageRepository.update(
        unreadMessages.map(m => m.id),
        { isRead: true }
      );
    }

    return messages;
  }

  async markAsRead(userId: number, messageId: number) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, receiverId: userId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    message.isRead = true;
    return await this.messageRepository.save(message);
  }
}

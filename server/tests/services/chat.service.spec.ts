/* eslint-disable @typescript-eslint/no-var-requires */
import mongoose from 'mongoose';

import ChatModel from '../../models/chat.model';
import MessageModel from '../../models/messages.model';
import UserModel from '../../models/users.model';
import {
  saveChat,
  createMessage,
  addMessageToChat,
  getChat,
  addParticipantToChat,
  getChatsByParticipants,
} from '../../services/chat.service';
import { CreateChatPayload } from '../../types/chat';
import { Message } from '../../types/message';

const mockingoose = require('mockingoose');

describe('Chat service', () => {
  beforeEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockingoose.resetAll();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const mockChatPayload: CreateChatPayload = {
    participants: ['testUser'],
    messages: [
      {
        msg: 'Hello!',
        msgFrom: 'testUser',
        msgDateTime: new Date('2025-01-01T00:00:00Z'),
        type: 'direct',
      },
    ],
  };

  // ----------------------------------------------------------------------------
  // 1. saveChat
  // ----------------------------------------------------------------------------
  describe('saveChat', () => {
    it('should successfully save a chat and verify its body (ignore exact IDs)', async () => {
      // Mock message creation
      mockingoose(MessageModel).toReturn(
        {
          _id: new mongoose.Types.ObjectId(),
          msg: 'Hello!',
          msgFrom: 'testUser',
          msgDateTime: new Date('2025-01-01T00:00:00Z'),
          type: 'direct',
        },
        'create',
      );

      // Mock chat creation
      mockingoose(ChatModel).toReturn(
        {
          _id: new mongoose.Types.ObjectId(),
          participants: ['testUser'],
          messages: [new mongoose.Types.ObjectId()],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        'create',
      );

      const result = await saveChat(mockChatPayload);

      // Verify no error
      if ('error' in result) {
        throw new Error(`Expected a Chat, got error: ${result.error}`);
      }

      expect(result).toHaveProperty('_id');
      expect(Array.isArray(result.participants)).toBe(true);
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.participants[0]?.toString()).toEqual(expect.any(String));
      expect(result.messages[0]?.toString()).toEqual(expect.any(String));
    });

    it('should return error if message creation fails', async () => {
      // Mock MessageModel.create to throw an error
      jest.spyOn(MessageModel, 'create').mockRejectedValueOnce(new Error('Database error'));

      const result = await saveChat(mockChatPayload);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('Error occurred when saving chat');
      }
    });

    it('should return error if chat creation fails', async () => {
      // Mock successful message creation
      jest.spyOn(MessageModel, 'create').mockResolvedValueOnce([
        {
          _id: new mongoose.Types.ObjectId(),
          msg: '',
          msgFrom: '',
          msgDateTime: new Date(),
          type: 'direct',
        },
      ] as never);

      // Mock ChatModel.create to throw an error
      jest.spyOn(ChatModel, 'create').mockRejectedValueOnce(new Error('Database error'));

      const result = await saveChat(mockChatPayload);

      expect('error' in result).toBe(true);
    });

    it('should handle empty messages array', async () => {
      const emptyMessagePayload: CreateChatPayload = {
        participants: ['user1', 'user2'],
        messages: [],
      };

      mockingoose(ChatModel).toReturn(
        {
          _id: new mongoose.Types.ObjectId(),
          participants: ['user1', 'user2'],
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        'create',
      );

      const result = await saveChat(emptyMessagePayload);

      if ('error' in result) {
        throw new Error('Expected success, got error');
      }

      expect(result.messages).toEqual([]);
      expect(result.participants).toEqual(['user1', 'user2']);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. createMessage
  // ----------------------------------------------------------------------------
  describe('createMessage', () => {
    const mockMessage: Message = {
      msg: 'Hey!',
      msgFrom: 'userX',
      msgDateTime: new Date('2025-01-01T10:00:00.000Z'),
      type: 'direct',
    };

    it('should create a message successfully if user exists', async () => {
      // Mock the user existence check
      mockingoose(UserModel).toReturn(
        { _id: new mongoose.Types.ObjectId(), username: 'userX' },
        'findOne',
      );

      // Mock the created message
      const mockCreatedMsg = {
        _id: new mongoose.Types.ObjectId(),
        ...mockMessage,
      };
      mockingoose(MessageModel).toReturn(mockCreatedMsg, 'create');

      const result = await createMessage(mockMessage);

      expect(result).toMatchObject({
        msg: 'Hey!',
        msgFrom: 'userX',
        msgDateTime: new Date('2025-01-01T10:00:00.000Z'),
        type: 'direct',
      });
    });

    it('should return error if user does not exist', async () => {
      mockingoose(UserModel).toReturn(null, 'findOne');

      const result = await createMessage(mockMessage);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('User not found');
      }
    });

    it('should return error if message creation fails', async () => {
      // Mock user exists
      mockingoose(UserModel).toReturn({ username: 'userX' }, 'findOne');

      // Mock MessageModel.create to throw an error
      jest.spyOn(MessageModel, 'create').mockRejectedValueOnce(new Error('Database error'));

      const result = await createMessage(mockMessage);

      expect('error' in result).toBe(true);
    });

    it('should use default date if not provided', async () => {
      const messageWithoutDate: Message = {
        msg: 'Test',
        msgFrom: 'userX',
        type: 'direct',
      } as Message;

      mockingoose(UserModel).toReturn({ username: 'userX' }, 'findOne');
      mockingoose(MessageModel).toReturn(
        {
          _id: new mongoose.Types.ObjectId(),
          ...messageWithoutDate,
          msgDateTime: new Date(),
        },
        'create',
      );

      const result = await createMessage(messageWithoutDate);

      if ('error' in result) {
        throw new Error('Expected success');
      }

      expect(result.msgDateTime).toBeDefined();
    });
  });

  // ----------------------------------------------------------------------------
  // 3. addMessageToChat
  // ----------------------------------------------------------------------------
  describe('addMessageToChat', () => {
    it('should add a message ID to an existing chat', async () => {
      const chatId = new mongoose.Types.ObjectId().toString();
      const messageId = new mongoose.Types.ObjectId().toString();

      const mockUpdatedChat = {
        _id: new mongoose.Types.ObjectId(),
        participants: ['testUser'],
        messages: [new mongoose.Types.ObjectId()],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findByIdAndUpdate
      mockingoose(ChatModel).toReturn(mockUpdatedChat, 'findOneAndUpdate');

      const result = await addMessageToChat(chatId, messageId);
      if ('error' in result) {
        throw new Error('Expected a chat, got an error');
      }

      expect(result).toHaveProperty('_id');
      expect(result).toHaveProperty('messages');
    });

    it('should return error if chat not found', async () => {
      mockingoose(ChatModel).toReturn(null, 'findOneAndUpdate');

      const result = await addMessageToChat('invalidId', 'messageId');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('Chat not found');
      }
    });

    it('should return error on database error', async () => {
      mockingoose(ChatModel).toReturn(new Error('Database error'), 'findOneAndUpdate');

      const result = await addMessageToChat('chatId', 'messageId');

      expect('error' in result).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. getChat
  // ----------------------------------------------------------------------------
  describe('getChat', () => {
    it('should retrieve a chat successfully', async () => {
      const mockChat = {
        _id: new mongoose.Types.ObjectId(),
        participants: ['user1', 'user2'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockingoose(ChatModel).toReturn(mockChat, 'findOne');

      const result = await getChat(mockChat._id.toString());

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result._id?.toString()).toEqual(mockChat._id.toString());
      }
    });

    it('should return error if chat not found', async () => {
      mockingoose(ChatModel).toReturn(null, 'findOne');

      const result = await getChat('nonexistentId');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('Chat not found');
      }
    });

    it('should return error on database error', async () => {
      mockingoose(ChatModel).toReturn(new Error('Database error'), 'findOne');

      const result = await getChat('chatId');

      expect('error' in result).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. addParticipantToChat
  // ----------------------------------------------------------------------------
  describe('addParticipantToChat', () => {
    it('should add a participant if user exists', async () => {
      // Mock user
      mockingoose(UserModel).toReturn(
        { _id: new mongoose.Types.ObjectId(), username: 'testUser' },
        'findOne',
      );

      const mockChat = {
        _id: new mongoose.Types.ObjectId(),
        participants: ['testUser'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockingoose(ChatModel).toReturn(mockChat, 'findOneAndUpdate');

      const result = await addParticipantToChat(mockChat._id.toString(), 'newUserId');
      if ('error' in result) {
        throw new Error('Expected a chat, got an error');
      }
      expect(result._id?.toString()).toEqual(mockChat._id.toString());
    });

    it('should return error if user not found', async () => {
      mockingoose(UserModel).toReturn(null, 'findOne');

      const result = await addParticipantToChat('chatId', 'nonexistentUser');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('User not found');
      }
    });

    it('should return error if chat not found', async () => {
      mockingoose(UserModel).toReturn({ username: 'testUser' }, 'findOne');
      mockingoose(ChatModel).toReturn(null, 'findOneAndUpdate');

      const result = await addParticipantToChat('invalidChatId', 'userId');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('Chat not found');
      }
    });

    it('should return error on database error', async () => {
      mockingoose(UserModel).toReturn({ username: 'testUser' }, 'findOne');
      mockingoose(ChatModel).toReturn(new Error('Database error'), 'findOneAndUpdate');

      const result = await addParticipantToChat('chatId', 'userId');

      expect('error' in result).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // 6. getChatsByParticipants
  // ----------------------------------------------------------------------------
  describe('getChatsByParticipants', () => {
    it('should retrieve chats by participants', async () => {
      const mockChat = {
        _id: new mongoose.Types.ObjectId(),
        participants: ['user1', 'user2'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject() {
          return this;
        },
      };

      mockingoose(ChatModel).toReturn([mockChat], 'find');

      const result = await getChatsByParticipants(['user1', 'user2']);
      expect(result).toHaveLength(1);
      expect(result[0].participants).toEqual(['user1', 'user2']);
    });

    it('should retrieve chats by participants where the provided list is a subset', async () => {
      const mockChats = [
        {
          _id: new mongoose.Types.ObjectId(),
          participants: ['user1', 'user2'],
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          toObject() {
            return this;
          },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          participants: ['user1', 'user3'],
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          toObject() {
            return this;
          },
        },
      ];

      mockingoose(ChatModel).toReturn(mockChats, 'find');

      const result = await getChatsByParticipants(['user1']);
      expect(result).toHaveLength(2);
    });

    it('should return an empty array if no chats are found', async () => {
      mockingoose(ChatModel).toReturn([], 'find');

      const result = await getChatsByParticipants(['user1']);
      expect(result).toHaveLength(0);
    });

    it('should return an empty array if chats is null', async () => {
      mockingoose(ChatModel).toReturn(null, 'find');

      const result = await getChatsByParticipants(['user1']);
      expect(result).toHaveLength(0);
    });

    it('should return an empty array if a database error occurs', async () => {
      mockingoose(ChatModel).toReturn(new Error('database error'), 'find');

      const result = await getChatsByParticipants(['user1']);
      expect(result).toHaveLength(0);
    });

    it('should handle multiple participants correctly', async () => {
      const mockChat = {
        _id: new mongoose.Types.ObjectId(),
        participants: ['user1', 'user2', 'user3'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject() {
          return this;
        },
      };

      mockingoose(ChatModel).toReturn([mockChat], 'find');

      const result = await getChatsByParticipants(['user1', 'user2']);
      expect(result).toHaveLength(1);
      expect(result[0].participants).toEqual(['user1', 'user2', 'user3']);
    });
  });
});

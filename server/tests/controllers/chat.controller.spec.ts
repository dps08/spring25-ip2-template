import mongoose from 'mongoose';
import supertest from 'supertest';
import { app } from '../../app';
import * as chatService from '../../services/chat.service';
import * as databaseUtil from '../../utils/database.util';
import { Chat, MessageInChat } from '../../types/chat';
import { Message } from '../../types/message';

/**
 * Spies on the service functions
 */
const saveChatSpy = jest.spyOn(chatService, 'saveChat');
const createMessageSpy = jest.spyOn(chatService, 'createMessage');
const addMessageSpy = jest.spyOn(chatService, 'addMessageToChat');
const getChatSpy = jest.spyOn(chatService, 'getChat');
const addParticipantSpy = jest.spyOn(chatService, 'addParticipantToChat');
const populateDocumentSpy = jest.spyOn(databaseUtil, 'populateDocument');
const getChatsByParticipantsSpy = jest.spyOn(chatService, 'getChatsByParticipants');

/**
 * Sample test suite for the /chat endpoints
 */
describe('Chat Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('POST /chat/createChat', () => {
    it('should create a new chat successfully', async () => {
      const validChatPayload = {
        participants: ['user1', 'user2'],
        messages: [{ msg: 'Hello!', msgFrom: 'user1', msgDateTime: new Date('2025-01-01') }],
      };

      const serializedPayload = {
        ...validChatPayload,
        messages: validChatPayload.messages.map(message => ({
          ...message,
          msgDateTime: message.msgDateTime.toISOString(),
        })),
      };

      const chatResponse: Chat = {
        _id: new mongoose.Types.ObjectId(),
        participants: ['user1', 'user2'],
        messages: [
          {
            _id: new mongoose.Types.ObjectId(),
            msg: 'Hello!',
            msgFrom: 'user1',
            msgDateTime: new Date('2025-01-01'),
            user: {
              _id: new mongoose.Types.ObjectId(),
              username: 'user1',
            },
            type: 'direct',
          } as MessageInChat,
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      saveChatSpy.mockResolvedValue(chatResponse);
      populateDocumentSpy.mockResolvedValue(chatResponse);

      const response = await supertest(app).post('/chat/createChat').send(validChatPayload);

      expect(response.status).toBe(200);

      const messages = chatResponse.messages as MessageInChat[];
      expect(response.body).toMatchObject({
        _id: chatResponse._id?.toString(),
        participants: chatResponse.participants.map(participant => participant.toString()),
        messages: messages.map(message => ({
          ...message,
          _id: message._id?.toString(),
          msgDateTime: message.msgDateTime.toISOString(),
          user: {
            ...message.user,
            _id: message.user?._id.toString(),
          },
        })),
        createdAt: chatResponse.createdAt?.toISOString(),
        updatedAt: chatResponse.updatedAt?.toISOString(),
      });

      expect(saveChatSpy).toHaveBeenCalledWith(serializedPayload);
      expect(populateDocumentSpy).toHaveBeenCalledWith(chatResponse._id?.toString(), 'chat');
    });

    it('should return 400 for invalid request - missing participants', async () => {
      const invalidPayload = {
        messages: [],
      };

      const response = await supertest(app).post('/chat/createChat').send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid request');
    });

    it('should return 400 for invalid request - empty participants', async () => {
      const invalidPayload = {
        participants: [],
        messages: [],
      };

      const response = await supertest(app).post('/chat/createChat').send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid request');
    });

    it('should return 400 for invalid request - non-array participants', async () => {
      const invalidPayload = {
        participants: 'user1',
        messages: [],
      };

      const response = await supertest(app).post('/chat/createChat').send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid request');
    });

    it('should return 500 if saveChat fails', async () => {
      const validPayload = {
        participants: ['user1'],
        messages: [],
      };

      saveChatSpy.mockResolvedValue({ error: 'Database error' });

      const response = await supertest(app).post('/chat/createChat').send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Database error' });
    });

    it('should return 500 if populateDocument fails', async () => {
      const chatResponse = {
        _id: new mongoose.Types.ObjectId(),
        participants: ['user1'],
        messages: [],
      };

      saveChatSpy.mockResolvedValue(chatResponse);
      populateDocumentSpy.mockResolvedValue({ error: 'Population error' });

      const response = await supertest(app)
        .post('/chat/createChat')
        .send({
          participants: ['user1'],
          messages: [],
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Population error' });
    });
  });

  describe('POST /chat/:chatId/addMessage', () => {
    it('should add a message to chat successfully', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const messagePayload: Message = {
        msg: 'Hello!',
        msgFrom: 'user1',
        msgDateTime: new Date('2025-01-01'),
        type: 'direct',
      };

      const serializedPayload = {
        ...messagePayload,
        msgDateTime: messagePayload.msgDateTime.toISOString(),
      };

      const messageResponse: Message = {
        _id: new mongoose.Types.ObjectId(),
        msg: 'Hello!',
        msgFrom: 'user1',
        msgDateTime: new Date('2025-01-01'),
        type: 'direct',
      };

      const chatResponse: Chat = {
        _id: chatId,
        participants: ['user1', 'user2'],
        messages: [
          {
            _id: messageResponse._id!,
            msg: messageResponse.msg,
            msgFrom: messageResponse.msgFrom,
            msgDateTime: messageResponse.msgDateTime,
            type: messageResponse.type,
            user: {
              _id: new mongoose.Types.ObjectId(),
              username: 'user1',
            },
          } as MessageInChat,
        ],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      createMessageSpy.mockResolvedValue(messageResponse);
      addMessageSpy.mockResolvedValue(chatResponse);
      populateDocumentSpy.mockResolvedValue(chatResponse);

      const response = await supertest(app).post(`/chat/${chatId}/addMessage`).send(messagePayload);

      expect(response.status).toBe(200);

      const messages = chatResponse.messages as MessageInChat[];
      expect(response.body).toMatchObject({
        _id: chatResponse._id?.toString(),
        participants: chatResponse.participants.map(participant => participant.toString()),
        messages: messages.map(message => ({
          _id: message._id?.toString(),
          msg: message.msg,
          msgFrom: message.msgFrom,
          msgDateTime: message.msgDateTime.toISOString(),
          type: message.type,
          user: {
            _id: message.user?._id.toString(),
            username: message.user?.username,
          },
        })),
        createdAt: chatResponse.createdAt?.toISOString(),
        updatedAt: chatResponse.updatedAt?.toISOString(),
      });

      expect(createMessageSpy).toHaveBeenCalledWith(serializedPayload);
      expect(addMessageSpy).toHaveBeenCalledWith(
        chatId.toString(),
        messageResponse._id!.toString(),
      );
      expect(populateDocumentSpy).toHaveBeenCalledWith(chatResponse._id?.toString(), 'chat');
    });

    it('should return 400 for invalid message - missing msg', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const invalidPayload = {
        msgFrom: 'user1',
      };

      const response = await supertest(app).post(`/chat/${chatId}/addMessage`).send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid message');
    });

    it('should return 400 for invalid message - empty msg', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const invalidPayload = {
        msg: '   ',
        msgFrom: 'user1',
      };

      const response = await supertest(app).post(`/chat/${chatId}/addMessage`).send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid message');
    });

    it('should return 400 for invalid message - missing msgFrom', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const invalidPayload = {
        msg: 'Hello',
      };

      const response = await supertest(app).post(`/chat/${chatId}/addMessage`).send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid message');
    });

    it('should return 500 if createMessage fails', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const messagePayload = {
        msg: 'Hello',
        msgFrom: 'user1',
      };

      createMessageSpy.mockResolvedValue({ error: 'Failed to create message' });

      const response = await supertest(app).post(`/chat/${chatId}/addMessage`).send(messagePayload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create message' });
    });

    it('should return 500 if addMessageToChat fails', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const messagePayload = {
        msg: 'Hello',
        msgFrom: 'user1',
      };

      const message: Message = {
        _id: new mongoose.Types.ObjectId(),
        msg: 'Hello',
        msgFrom: 'user1',
        msgDateTime: new Date(),
        type: 'direct',
      };
      createMessageSpy.mockResolvedValue(message);
      addMessageSpy.mockResolvedValue({ error: 'Failed to add message' });

      const response = await supertest(app).post(`/chat/${chatId}/addMessage`).send(messagePayload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to add message' });
    });
  });

  describe('GET /chat/:chatId', () => {
    it('should retrieve a chat by ID', async () => {
      const chatId = new mongoose.Types.ObjectId().toString();

      const mockFoundChat: Chat = {
        _id: new mongoose.Types.ObjectId(),
        participants: ['user1'],
        messages: [
          {
            _id: new mongoose.Types.ObjectId(),
            msg: 'Hello!',
            msgFrom: 'user1',
            msgDateTime: new Date('2025-01-01T00:00:00Z'),
            user: {
              _id: new mongoose.Types.ObjectId(),
              username: 'user1',
            },
            type: 'direct',
          } as MessageInChat,
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      getChatSpy.mockResolvedValue(mockFoundChat);
      populateDocumentSpy.mockResolvedValue(mockFoundChat);

      const response = await supertest(app).get(`/chat/${chatId}`);

      expect(response.status).toBe(200);
      expect(getChatSpy).toHaveBeenCalledWith(chatId);
      expect(populateDocumentSpy).toHaveBeenCalledWith(mockFoundChat._id?.toString(), 'chat');

      const messages = mockFoundChat.messages as MessageInChat[];
      expect(response.body).toMatchObject({
        _id: mockFoundChat._id?.toString(),
        participants: mockFoundChat.participants.map(p => p.toString()),
        messages: messages.map(m => ({
          _id: m._id?.toString(),
          msg: m.msg,
          msgFrom: m.msgFrom,
          msgDateTime: m.msgDateTime.toISOString(),
          user: {
            _id: m.user?._id.toString(),
            username: m.user?.username,
          },
        })),
        createdAt: mockFoundChat.createdAt?.toISOString(),
        updatedAt: mockFoundChat.updatedAt?.toISOString(),
      });
    });

    it('should return 404 if chat not found', async () => {
      const chatId = new mongoose.Types.ObjectId().toString();

      getChatSpy.mockResolvedValue({ error: 'Chat not found' });

      const response = await supertest(app).get(`/chat/${chatId}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Chat not found' });
    });

    it('should return 500 if populateDocument fails', async () => {
      const chatId = new mongoose.Types.ObjectId().toString();
      const mockChat = {
        _id: new mongoose.Types.ObjectId(),
        participants: ['user1'],
        messages: [],
      };

      getChatSpy.mockResolvedValue(mockChat);
      populateDocumentSpy.mockResolvedValue({ error: 'Population error' });

      const response = await supertest(app).get(`/chat/${chatId}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Population error' });
    });
  });

  describe('POST /chat/:chatId/addParticipant', () => {
    it('should add a participant to an existing chat', async () => {
      const chatId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();

      const updatedChat: Chat = {
        _id: new mongoose.Types.ObjectId(),
        participants: ['user1', 'user2'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addParticipantSpy.mockResolvedValue(updatedChat);

      const response = await supertest(app).post(`/chat/${chatId}/addParticipant`).send({ userId });

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        _id: updatedChat._id?.toString(),
        participants: updatedChat.participants.map(id => id.toString()),
        messages: [],
        createdAt: updatedChat.createdAt?.toISOString(),
        updatedAt: updatedChat.updatedAt?.toISOString(),
      });

      expect(addParticipantSpy).toHaveBeenCalledWith(chatId, userId);
    });

    it('should return 400 for invalid request - missing userId', async () => {
      const chatId = new mongoose.Types.ObjectId().toString();

      const response = await supertest(app).post(`/chat/${chatId}/addParticipant`).send({});

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid request');
    });

    it('should return 400 for invalid request - empty userId', async () => {
      const chatId = new mongoose.Types.ObjectId().toString();

      const response = await supertest(app).post(`/chat/${chatId}/addParticipant`).send({
        userId: '   ',
      });

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid request');
    });

    it('should return 500 if addParticipantToChat fails', async () => {
      const chatId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();

      addParticipantSpy.mockResolvedValue({ error: 'Failed to add participant' });

      const response = await supertest(app).post(`/chat/${chatId}/addParticipant`).send({ userId });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to add participant' });
    });
  });

  describe('GET /chat/getChatsByUser/:username', () => {
    it('should return 200 with an array of chats', async () => {
      const username = 'user1';
      const chats: Chat[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          participants: ['user1', 'user2'],
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      getChatsByParticipantsSpy.mockResolvedValueOnce(chats);
      populateDocumentSpy.mockResolvedValueOnce(chats[0]);

      const response = await supertest(app).get(`/chat/getChatsByUser/${username}`);

      expect(getChatsByParticipantsSpy).toHaveBeenCalledWith([username]);
      expect(populateDocumentSpy).toHaveBeenCalledWith(chats[0]._id?.toString(), 'chat');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject([
        {
          _id: chats[0]._id?.toString(),
          participants: ['user1', 'user2'],
          messages: [],
          createdAt: chats[0].createdAt?.toISOString(),
          updatedAt: chats[0].updatedAt?.toISOString(),
        },
      ]);
    });

    it('should return 500 if populateDocument fails for any chat', async () => {
      const username = 'user1';
      const chats: Chat[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          participants: ['user1', 'user2'],
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      getChatsByParticipantsSpy.mockResolvedValueOnce(chats);
      populateDocumentSpy.mockResolvedValueOnce({ error: 'Service error' });

      const response = await supertest(app).get(`/chat/getChatsByUser/${username}`);

      expect(getChatsByParticipantsSpy).toHaveBeenCalledWith([username]);
      expect(populateDocumentSpy).toHaveBeenCalledWith(chats[0]._id?.toString(), 'chat');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Failed populating chats');
    });

    it('should return empty array if no chats found', async () => {
      getChatsByParticipantsSpy.mockResolvedValueOnce([]);

      const response = await supertest(app).get('/chat/getChatsByUser/testuser');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle multiple chats', async () => {
      const username = 'user1';
      const chats: Chat[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          participants: ['user1', 'user2'],
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          participants: ['user1', 'user3'],
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      getChatsByParticipantsSpy.mockResolvedValueOnce(chats);
      populateDocumentSpy.mockResolvedValueOnce(chats[0]);
      populateDocumentSpy.mockResolvedValueOnce(chats[1]);

      const response = await supertest(app).get(`/chat/getChatsByUser/${username}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should handle error in getChatsByParticipants', async () => {
      getChatsByParticipantsSpy.mockRejectedValueOnce(new Error('Database error'));

      const response = await supertest(app).get('/chat/getChatsByUser/user1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});

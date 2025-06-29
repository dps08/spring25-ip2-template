import express, { Response } from 'express';
import {
  saveChat,
  createMessage,
  addMessageToChat,
  getChat,
  addParticipantToChat,
  getChatsByParticipants,
} from '../services/chat.service';
import { populateDocument } from '../utils/database.util';
import {
  CreateChatRequest,
  AddMessageRequestToChat,
  AddParticipantRequest,
  ChatIdRequest,
  GetChatByParticipantsRequest,
} from '../types/chat';
import { FakeSOSocket } from '../types/socket';

/*
 * This controller handles chat-related routes.
 * @param socket The socket instance to emit events.
 * @returns {express.Router} The router object containing the chat routes.
 * @throws {Error} Throws an error if the chat creation fails.
 */
const chatController = (socket: FakeSOSocket) => {
  const router = express.Router();

  /**
   * Validates that the request body contains all required fields for a chat.
   * @param req The incoming request containing chat data.
   * @returns `true` if the body contains valid chat fields; otherwise, `false`.
   */
  const isCreateChatRequestValid = (req: CreateChatRequest): boolean =>
    !!(
      req.body &&
      req.body.participants &&
      Array.isArray(req.body.participants) &&
      req.body.participants.length > 0 &&
      req.body.messages !== undefined &&
      Array.isArray(req.body.messages)
    );

  /**
   * Validates that the request body contains all required fields for a message.
   * @param req The incoming request containing message data.
   * @returns `true` if the body contains valid message fields; otherwise, `false`.
   */
  const isAddMessageRequestValid = (req: AddMessageRequestToChat): boolean =>
    !!(
      req.body &&
      req.body.msg &&
      req.body.msg.trim().length > 0 &&
      req.body.msgFrom &&
      req.body.msgFrom.trim().length > 0
    );

  /**
   * Validates that the request body contains all required fields for a participant.
   * @param req The incoming request containing participant data.
   * @returns `true` if the body contains valid participant fields; otherwise, `false`.
   */
  const isAddParticipantRequestValid = (req: AddParticipantRequest): boolean =>
    !!(req.body && req.body.userId && req.body.userId.trim().length > 0);

  /**
   * Creates a new chat with the given participants (and optional initial messages).
   * @param req The request object containing the chat data.
   * @param res The response object to send the result.
   * @returns {Promise<void>} A promise that resolves when the chat is created.
   * @throws {Error} Throws an error if the chat creation fails.
   */
  const createChatRoute = async (req: CreateChatRequest, res: Response): Promise<void> => {
    try {
      if (!isCreateChatRequestValid(req)) {
        res.status(400).send('Invalid request');
        return;
      }

      const result = await saveChat(req.body);

      if ('error' in result) {
        res.status(500).json(result);
        return;
      }

      // Populate the chat document
      const populatedChat = await populateDocument(result._id?.toString(), 'chat');

      if ('error' in populatedChat) {
        res.status(500).json(populatedChat);
        return;
      }

      // Emit chatUpdate event
      socket.emit('chatUpdate', {
        chat: populatedChat,
        type: 'created',
      });

      res.status(200).json(populatedChat);
    } catch (error) {
      res.status(500).json({ error: `Error creating chat: ${error}` });
    }
  };

  /**
   * Adds a new message to an existing chat.
   * @param req The request object containing the message data.
   * @param res The response object to send the result.
   * @returns {Promise<void>} A promise that resolves when the message is added.
   * @throws {Error} Throws an error if the message addition fails.
   */
  const addMessageToChatRoute = async (
    req: AddMessageRequestToChat,
    res: Response,
  ): Promise<void> => {
    try {
      if (!isAddMessageRequestValid(req)) {
        res.status(400).send('Invalid message');
        return;
      }

      const { chatId } = req.params;
      const messageData = {
        ...req.body,
        type: 'direct' as const,
        msgDateTime: req.body.msgDateTime || new Date(),
      };

      // Create the message
      const message = await createMessage(messageData);

      if ('error' in message) {
        res.status(500).json(message);
        return;
      }

      // Add message to chat
      const updatedChat = await addMessageToChat(chatId, message._id!.toString());

      if ('error' in updatedChat) {
        res.status(500).json(updatedChat);
        return;
      }

      // Populate the updated chat
      const populatedChat = await populateDocument(updatedChat._id?.toString(), 'chat');

      if ('error' in populatedChat) {
        res.status(500).json(populatedChat);
        return;
      }

      // Emit to specific chat room
      socket.to(chatId).emit('chatUpdate', {
        chat: populatedChat,
        type: 'newMessage',
      });

      res.status(200).json(populatedChat);
    } catch (error) {
      res.status(500).json({ error: `Error adding message: ${error}` });
    }
  };

  /**
   * Retrieves a chat by its ID, optionally populating participants and messages.
   * @param req The request object containing the chat ID.
   * @param res The response object to send the result.
   * @returns {Promise<void>} A promise that resolves when the chat is retrieved.
   * @throws {Error} Throws an error if the chat retrieval fails.
   */
  const getChatRoute = async (req: ChatIdRequest, res: Response): Promise<void> => {
    try {
      const { chatId } = req.params;

      const chat = await getChat(chatId);

      if ('error' in chat) {
        res.status(404).json(chat);
        return;
      }

      // Populate the chat
      const populatedChat = await populateDocument(chat._id?.toString(), 'chat');

      if ('error' in populatedChat) {
        res.status(500).json(populatedChat);
        return;
      }

      res.status(200).json(populatedChat);
    } catch (error) {
      res.status(500).json({ error: `Error retrieving chat: ${error}` });
    }
  };

  /**
   * Retrieves chats for a user based on their username.
   * @param req The request object containing the username parameter in `req.params`.
   * @param res The response object to send the result, either the populated chats or an error message.
   * @returns {Promise<void>} A promise that resolves when the chats are successfully retrieved and populated.
   */
  const getChatsByUserRoute = async (
    req: GetChatByParticipantsRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const { username } = req.params;

      const chats = await getChatsByParticipants([username]);

      // Populate each chat
      const populatedChats = await Promise.all(
        chats.map(async chat => {
          const populated = await populateDocument(chat._id?.toString(), 'chat');
          if ('error' in populated) {
            throw new Error('Failed populating chats');
          }
          return populated;
        }),
      );

      res.status(200).json(populatedChats);
    } catch (error) {
      res.status(500).json({ error: `Error retrieving chats: ${error}` });
    }
  };

  /**
   * Adds a participant to an existing chat.
   * @param req The request object containing the participant data.
   * @param res The response object to send the result.
   * @returns {Promise<void>} A promise that resolves when the participant is added.
   * @throws {Error} Throws an error if the participant addition fails.
   */
  const addParticipantToChatRoute = async (
    req: AddParticipantRequest,
    res: Response,
  ): Promise<void> => {
    try {
      if (!isAddParticipantRequestValid(req)) {
        res.status(400).send('Invalid request');
        return;
      }

      const { chatId } = req.params;
      const { userId } = req.body;

      const updatedChat = await addParticipantToChat(chatId, userId);

      if ('error' in updatedChat) {
        res.status(500).json(updatedChat);
        return;
      }

      res.status(200).json(updatedChat);
    } catch (error) {
      res.status(500).json({ error: `Error adding participant: ${error}` });
    }
  };

  socket.on('connection', conn => {
    conn.on('joinChat', (chatID: string) => {
      conn.join(chatID);
    });

    conn.on('leaveChat', (chatID: string | undefined) => {
      if (chatID) {
        conn.leave(chatID);
      }
    });
  });

  // Register the routes
  router.post('/createChat', createChatRoute);
  router.post('/:chatId/addMessage', addMessageToChatRoute);
  router.get('/:chatId', getChatRoute);
  router.get('/getChatsByUser/:username', getChatsByUserRoute);
  router.post('/:chatId/addParticipant', addParticipantToChatRoute);

  return router;
};

export default chatController;

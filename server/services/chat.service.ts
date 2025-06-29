import ChatModel from '../models/chat.model';
import MessageModel from '../models/messages.model';
import UserModel from '../models/users.model';
import { Chat, ChatResponse, CreateChatPayload } from '../types/chat';
import { Message, MessageResponse } from '../types/message';

/**
 * Creates and saves a new chat document in the database, saving messages dynamically.
 *
 * @param chat - The chat object to be saved, including full message objects.
 * @returns {Promise<ChatResponse>} - Resolves with the saved chat or an error message.
 */
export const saveChat = async (chatPayload: CreateChatPayload): Promise<ChatResponse> => {
  try {
    // Create message documents first
    const messagePromises = chatPayload.messages.map(message =>
      MessageModel.create({
        msg: message.msg,
        msgFrom: message.msgFrom,
        msgDateTime: message.msgDateTime || new Date(),
        type: 'direct',
      }),
    );

    const messages = await Promise.all(messagePromises);
    const messageIds = messages.map(m => m._id);
    // Create the chat with message references
    const newChat = await ChatModel.create({
      participants: chatPayload.participants,
      messages: messageIds,
    });

    return newChat;
  } catch (error) {
    return { error: `Error occurred when saving chat: ${error}` };
  }
};

/**
 * Creates and saves a new message document in the database.
 * @param messageData - The message data to be created.
 * @returns {Promise<MessageResponse>} - Resolves with the created message or an error message.
 */
export const createMessage = async (messageData: Message): Promise<MessageResponse> => {
  try {
    // Verify user exists
    const user = await UserModel.findOne({ username: messageData.msgFrom });
    if (!user) {
      throw new Error('User not found');
    }

    const newMessage = await MessageModel.create({
      msg: messageData.msg,
      msgFrom: messageData.msgFrom,
      msgDateTime: messageData.msgDateTime || new Date(),
      type: messageData.type || 'direct',
    });

    return newMessage;
  } catch (error) {
    return { error: `Error occurred when creating message: ${error}` };
  }
};

/**
 * Adds a message ID to an existing chat.
 * @param chatId - The ID of the chat to update.
 * @param messageId - The ID of the message to add to the chat.
 * @returns {Promise<ChatResponse>} - Resolves with the updated chat object or an error message.
 */
export const addMessageToChat = async (
  chatId: string,
  messageId: string,
): Promise<ChatResponse> => {
  try {
    const updatedChat = await ChatModel.findByIdAndUpdate(
      chatId,
      { $push: { messages: messageId } },
      { new: true },
    );

    if (!updatedChat) {
      throw new Error('Chat not found');
    }

    return updatedChat;
  } catch (error) {
    return { error: `Error occurred when adding message to chat: ${error}` };
  }
};

/**
 * Retrieves a chat document by its ID.
 * @param chatId - The ID of the chat to retrieve.
 * @returns {Promise<ChatResponse>} - Resolves with the found chat object or an error message.
 */
export const getChat = async (chatId: string): Promise<ChatResponse> => {
  try {
    const chat = await ChatModel.findById(chatId);

    if (!chat) {
      throw new Error('Chat not found');
    }

    return chat;
  } catch (error) {
    return { error: `Error occurred when retrieving chat: ${error}` };
  }
};

/**
 * Retrieves chats that include all the provided participants.
 * @param p An array of participant usernames to match in the chat's participants.
 * @returns {Promise<Chat[]>} A promise that resolves to an array of chats where the participants match.
 * If no chats are found or an error occurs, the promise resolves to an empty array.
 */
export const getChatsByParticipants = async (p: string[]): Promise<Chat[]> => {
  try {
    const chats = await ChatModel.find({
      participants: { $all: p },
    });

    return chats || [];
  } catch (error) {
    // console.error('Error getting chats by participants:', error);
    return [];
  }
};

/**
 * Adds a participant to an existing chat.
 *
 * @param chatId - The ID of the chat to update.
 * @param userId - The ID of the user to add to the chat.
 * @returns {Promise<ChatResponse>} - Resolves with the updated chat object or an error message.
 */
export const addParticipantToChat = async (
  chatId: string,
  userId: string,
): Promise<ChatResponse> => {
  try {
    // Verify user exists
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedChat = await ChatModel.findByIdAndUpdate(
      chatId,
      { $addToSet: { participants: user.username } },
      { new: true },
    );

    if (!updatedChat) {
      throw new Error('Chat not found');
    }

    return updatedChat;
  } catch (error) {
    return { error: `Error occurred when adding participant: ${error}` };
  }
};

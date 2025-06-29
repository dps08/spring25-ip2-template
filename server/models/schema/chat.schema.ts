import { Schema } from 'mongoose';

/**
 * Mongoose schema for the Chat collection.
 *
 * - `participants`: an array of strings representing usernames of users in the chat.
 * - `messages`: an array of ObjectIds referencing the Message collection.
 * - Timestamps store `createdAt` & `updatedAt`.
 */
const chatSchema: Schema = new Schema(
  {
    participants: {
      type: [String],
      required: true,
    },
    messages: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Message',
      },
    ],
  },
  {
    collection: 'Chat',
    timestamps: true,
  },
);

export default chatSchema;

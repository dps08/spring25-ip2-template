import { useEffect, useState } from 'react';
import { Chat, ChatUpdatePayload, Message, User } from '../types';
import useUserContext from './useUserContext';
import { createChat, getChatById, getChatsByUser, sendMessage } from '../services/chatService';

/**
 * useDirectMessage is a custom hook that provides state and functions for direct messaging between users.
 * It includes a selected user, messages, and a new message state.
 */
const useDirectMessage = () => {
  const { user, socket } = useUserContext();
  const [showCreatePanel, setShowCreatePanel] = useState<boolean>(false);
  const [chatToCreate, setChatToCreate] = useState<string>('');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const handleJoinChat = (chatID: string) => {
    socket.emit('joinChat', chatID);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) {
      return;
    }

    try {
      const message: Omit<Message, 'type'> = {
        msg: newMessage,
        msgFrom: user.username,
        msgDateTime: new Date(),
      };

      const updatedChat = await sendMessage(message, selectedChat._id!);
      setSelectedChat(updatedChat);
      setNewMessage('');
    } catch (error) {
      // console.error('Error sending message:', error);
    }
  };

  const handleChatSelect = async (chatID: string | undefined) => {
    if (!chatID) return;

    try {
      const chat = await getChatById(chatID);
      setSelectedChat(chat);
      handleJoinChat(chatID);
    } catch (error) {
      // console.error('Error selecting chat:', error);
    }
  };

  const handleUserSelect = (selectedUser: User) => {
    setChatToCreate(selectedUser.username);
  };

  const handleCreateChat = async () => {
    if (!chatToCreate) return;

    try {
      const newChat = await createChat([user.username, chatToCreate]);
      setChats([newChat, ...chats]);
      setSelectedChat(newChat);
      handleJoinChat(newChat._id!);
      setShowCreatePanel(false);
      setChatToCreate('');
    } catch (error) {
      // console.error('Error creating chat:', error);
    }
  };

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const userChats = await getChatsByUser(user.username);
        setChats(userChats);
      } catch (error) {
        // console.error('Error fetching chats:', error);
      }
    };

    fetchChats();
  }, [user.username]);

  useEffect(() => {
    const handleChatUpdate = (chatUpdate: ChatUpdatePayload) => {
      const { chat, type } = chatUpdate;

      switch (type) {
        case 'created':
          // Add new chat if user is a participant
          if (chat.participants.includes(user.username)) {
            setChats(prevChats => [chat, ...prevChats]);
          }
          break;

        case 'newMessage':
          // Update selected chat if it matches
          setSelectedChat(prevSelected => {
            if (prevSelected && prevSelected._id === chat._id) {
              return chat;
            }
            return prevSelected;
          });
          // Update chat in list
          setChats(prevChats => prevChats.map(c => (c._id === chat._id ? chat : c)));
          break;

        default:
          throw new Error(`Unknown chat update type: ${type}`);
      }
    };

    socket.on('chatUpdate', handleChatUpdate);

    return () => {
      socket.off('chatUpdate', handleChatUpdate);
    };
  }, [user.username, socket]);

  useEffect(
    () => () => {
      if (selectedChat?._id) {
        socket.emit('leaveChat', selectedChat._id);
      }
    },
    [selectedChat, socket],
  );

  return {
    selectedChat,
    chatToCreate,
    chats,
    newMessage,
    setNewMessage,
    showCreatePanel,
    setShowCreatePanel,
    handleSendMessage,
    handleChatSelect,
    handleUserSelect,
    handleCreateChat,
  };
};

export default useDirectMessage;

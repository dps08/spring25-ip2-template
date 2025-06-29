import { useEffect, useState } from 'react';
import useUserContext from './useUserContext';
import { User, UserUpdatePayload } from '../types';
import { getUsers } from '../services/userService';

/**
 * Custom hook for managing the users list page state, filtering, and real-time updates.
 *
 * @returns titleText - The current title of the users list page
 * @returns ulist - The list of users to display
 * @returns setUserFilter - Function to set the filtering value of the user search.
 */
const useUsersListPage = () => {
  const { socket } = useUserContext();

  const [userFilter, setUserFilter] = useState<string>('');
  const [userList, setUserList] = useState<User[]>([]);

  useEffect(() => {
    /**
     * Function to fetch users based and update the user list
     */
    const fetchData = async () => {
      try {
        const res = await getUsers();
        setUserList(res || []);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(error);
      }
    };

    /**
     * Removes a user from the userList using a filter
     * @param prevUserList the list of users
     * @param user the user to remove
     * @returns a list without the given user
     */
    const removeUserFromList = (prevUserList: User[], user: User) =>
      prevUserList.filter(u => u._id?.toString() !== user._id?.toString());

    /**
     * Adds a user to the userList, if not present. Otherwise updates the user.
     * @param prevUserList the list of users
     * @param user the user to add
     * @returns a list with the user added, or updated if present.
     */
    const addUserToList = (prevUserList: User[], user: User) => {
      const existingIndex = prevUserList.findIndex(u => u._id?.toString() === user._id?.toString());

      if (existingIndex >= 0) {
        // Update existing user
        const updatedList = [...prevUserList];
        updatedList[existingIndex] = user;
        return updatedList;
      }
      // Add new user to the front
      return [user, ...prevUserList];
    };

    /**
     * Function to handle user updates from the socket.
     *
     * @param user - the updated user object.
     */
    const handleModifiedUserUpdate = (userUpdate: UserUpdatePayload) => {
      const { user, type } = userUpdate;

      if (type === 'deleted') {
        setUserList(prevList => removeUserFromList(prevList, user));
      } else if (type === 'created' || type === 'updated') {
        setUserList(prevList => addUserToList(prevList, user));
      }
    };

    fetchData();

    socket.on('userUpdate', handleModifiedUserUpdate);

    return () => {
      socket.off('userUpdate', handleModifiedUserUpdate);
    };
  }, [socket]);

  // Filter the user list based on the userFilter value
  const filteredUserlist = userList.filter(user => user.username.includes(userFilter));

  return { userList: filteredUserlist, setUserFilter };
};

export default useUsersListPage;

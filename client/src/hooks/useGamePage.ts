import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import useUserContext from './useUserContext';
import { GameErrorPayload, GameInstance, GameUpdatePayload } from '../types';
import { joinGame, leaveGame, getGames } from '../services/gamesService';

/**
 * Custom hook to manage the state and logic for the game page, including joining, leaving the game, and handling game updates.
 * @returns An object containing the following:
 * - `gameState`: The current state of the game, or null if no game is joined.
 * - `error`: A string containing any error messages related to the game, or null if no errors exist.
 * - `handleLeaveGame`: A function to leave the current game and navigate back to the game list.
 */
const useGamePage = () => {
  const { user, socket } = useUserContext();
  const { gameID } = useParams();
  const navigate = useNavigate();

  const [gameState, setGameState] = useState<GameInstance | null>(null);
  const [joinedGameID, setJoinedGameID] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLeaveGame = async () => {
    if (joinedGameID && gameState && gameState.state.status !== 'OVER') {
      try {
        await leaveGame(joinedGameID, user.username);
        socket.emit('leaveGame', joinedGameID);
      } catch (err) {
        // console.error('Error leaving game:', err);
      }
    }
    navigate('/games');
  };

  useEffect(() => {
    const handleJoinGame = async (id: string) => {
      try {
        // First, always try to fetch the game to see if we're already in it
        const allGames = await getGames(undefined, undefined);
        const existingGame = allGames.find(g => g.gameID === id);

        if (existingGame) {
          // Check if we're already a player in this game
          if (existingGame.players.includes(user.username)) {
            // We're already in this game, just restore the state
            setGameState(existingGame);
            setJoinedGameID(id);
            socket.emit('joinGame', id);
            setError(null);
            return; // Exit early, we're done
          }

          // Game exists but we're not in it, try to join
          try {
            const game = await joinGame(id, user.username);
            setGameState(game);
            setJoinedGameID(id);
            socket.emit('joinGame', id);
            setError(null);
          } catch (joinErr: unknown) {
            setError('Failed to join game');
            // console.error('Error joining game:', joinErr);
          }
        } else {
          // Game doesn't exist
          setError('Game not found');
        }
      } catch (err: unknown) {
        setError('Failed to load game');
        // console.error('Error loading game:', err);
      }
    };

    if (gameID) {
      handleJoinGame(gameID);
    }

    const handleGameUpdate = (updatedState: GameUpdatePayload) => {
      setGameState(updatedState.gameState);
    };

    const handleGameError = (gameError: GameErrorPayload) => {
      if (gameError.player === user.username) {
        setError(gameError.error);
      }
    };

    socket.on('gameUpdate', handleGameUpdate);
    socket.on('gameError', handleGameError);

    return () => {
      socket.off('gameUpdate', handleGameUpdate);
      socket.off('gameError', handleGameError);
    };
  }, [gameID, socket, user.username]);

  return {
    gameState,
    error,
    handleLeaveGame,
  };
};

export default useGamePage;

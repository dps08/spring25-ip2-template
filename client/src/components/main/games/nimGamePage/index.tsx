import React from 'react';
import './index.css';
import { GameInstance } from '../../../../types';
import useNimGamePage from '../../../../hooks/useNimGamePage';

/**
 * Component to display the "Nim" game page, including the rules, game details, and functionality to make a move.
 * @param gameState The current state of the Nim game, including player details, game status, and remaining objects.
 * @returns A React component that shows:
 * - The rules of the Nim game.
 * - The current game details, such as players, current turn, remaining objects, and winner (if the game is over).
 * - An input field for making a move (if the game is in progress) and a submit button to finalize the move.
 */
const NimGamePage = ({ gameState }: { gameState: GameInstance }) => {
  const { user, move, handleMakeMove, handleInputChange } = useNimGamePage(gameState);

  // Determine whose turn it is
  const currentPlayer =
    gameState.state.moves.length % 2 === 0 ? gameState.state.player1 : gameState.state.player2;

  const isUserTurn = currentPlayer === user.username;

  return (
    <>
      <div className='nim-rules'>
        <h2>Rules of Nim</h2>
        <p>The game of Nim is played as follows:</p>
        <ol>
          <li>The game starts with a pile of objects.</li>
          <li>Players take turns removing objects from the pile.</li>
          <li>On their turn, a player must remove 1, 2, or 3 objects from the pile.</li>
          <li>The player who removes the last object loses the game.</li>
        </ol>
        <p>Think strategically and try to force your opponent into a losing position!</p>
      </div>
      <div className='nim-game-details'>
        <h2>Current Game</h2>
        <p>
          <strong>Player 1:</strong> {gameState.state.player1 || 'Waiting...'}
        </p>
        <p>
          <strong>Player 2:</strong> {gameState.state.player2 || 'Waiting...'}
        </p>
        <p>
          <strong>Current Player to Move:</strong> {currentPlayer || 'N/A'}
        </p>
        <p>
          <strong>Remaining Objects:</strong> {gameState.state.remainingObjects}
        </p>
        {gameState.state.winners && gameState.state.winners.length > 0 && (
          <p>
            <strong>Winner:</strong> {gameState.state.winners[0] || 'No winner'}
          </p>
        )}

        {gameState.state.status === 'IN_PROGRESS' && (
          <div className='nim-game-move'>
            <h3>Make Your Move</h3>
            <input
              type='number'
              className='input-move'
              value={move}
              onChange={handleInputChange}
              placeholder='Enter 1, 2, or 3'
              min='1'
              max='3'
            />
            <button className='btn-submit' onClick={handleMakeMove} disabled={!isUserTurn}>
              Submit Move
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default NimGamePage;

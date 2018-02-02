import { Observable } from 'rxjs';
import React from 'react';
import ReactDOM from 'react-dom';
import { createStore, applyMiddleware } from 'redux'
import { Provider, connect } from 'react-redux';
import { combineEpics, createEpicMiddleware } from 'redux-observable';

// REDUX STUFF
const initialState = {
  board: Array(3).fill().map(() => new Array(3).fill()),
  player: 'x',
  score: Array(8).fill().map(() => 0)
}

const updateBoard = (board, x, y, player) => [
  ...board.slice(0, y),
  [
    ...board[y].slice(0, x),
    player,
    ...board[y].slice(x+1)
  ],
  ...board.slice(y+1)
]

const updateScore = (score, x, y, player) => {
  const increment = player === 'x' ? 1 : -1

  score[x] += increment
  score[3+y] += increment
  if (x === y) score[6] += increment
  if (2-y === x) score[7] += increment

  return score
}

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case 'UPDATE_BOARD':
      return {
        ...state,
        board: updateBoard(state.board, action.x,action.y, state.player),
        player: state.player === 'x' ? 'o' : 'x',
        score: updateScore(state.score, action.x, action.y, state.player)
      };
    case 'REPORT_ERROR':
      return {
        ...state,
        error: action.error
      };
    case 'RESET_ERROR':
      return {
        ...state,
        error: undefined
      }
    case 'DECLARE_WINNER':
      return {
        ...state,
        winner: action.winner
      }
    case 'RESET_BOARD':
      return initialState
    default:
      return state;
  }
}

const actions = {
  playerAction: ({x, y}) => ({type: 'PLAYER_ACTION', x, y}),
  resetBoard: () => ({type: 'RESET_BOARD'})
}

const playerActionEpic = (action$, {getState}) =>
  action$.ofType('PLAYER_ACTION')
    .flatMap(({x,y}) => {
      const { board, player } = getState()
      return board[y][x] // check if square taken
        ? Observable.of({type: 'REPORT_ERROR', error: 'Square taken!'})
        : Observable.from([
            {type: 'UPDATE_BOARD', x, y, player},
            {type: 'RESET_ERROR'}
          ])
    })

const checkWinEpic = (action$, {getState}) =>
  action$.ofType('UPDATE_BOARD')
    // using flatmap here to emit nothing sometimes
    // could also emit something like {type: 'NOOP'}
    .flatMap(({player}) => {
      const { score } = getState()
      const winner = score.some(i => Math.abs(i) === 3)
      return winner
        ? Observable.of({type: 'DECLARE_WINNER', winner: player})
        : Observable.empty()
    })

const clearErrorAfter2SecsEpic = action$ =>
  action$.ofType('REPORT_ERROR')
    .delay(2000)
    .mapTo({type: 'RESET_ERROR'})

const rootEpic = combineEpics(
  playerActionEpic,
  clearErrorAfter2SecsEpic,
  checkWinEpic
)

const epicMiddleware = createEpicMiddleware(rootEpic);

const store = createStore(reducer, applyMiddleware(epicMiddleware));

// COMPONENTS
const Square = ({children, onClick}) =>
  <div onClick={onClick} style={{width: '50px', height: '50px', border: '1px solid black'}}>
    {children}
  </div>

const TicTacToe = ({board, playerAction, player, error, winner, resetBoard}) =>
  <div>
    {
      winner ? (
        <h1>Player {winner} won!!</h1>
      ) : (
        <h1>Player {player} click:</h1>
      )
    }
    {
      board.map((row, yIndex) => (
        <div key={yIndex} style={{display: 'flex', flexDirection: 'row'}}>
          {
            row.map((value, xIndex) => (
              <Square key={xIndex} onClick={playerAction.bind(null, {x:xIndex, y:yIndex})}>
                {value}
              </Square>
            ))
          }
        </div>
      ))
    }
    {
      error && <span style={{color: 'red', fontWeight: 'bold'}}>{error}</span>
    }
    {
      winner &&
        <span onClick={resetBoard} style={{pointer: 'cursor', color: 'blue'}}>reset board</span>
    }
  </div>

const ConnectedTicTacToe = connect(state => state, actions)(TicTacToe)

// RENDER COMPONENT
ReactDOM.render(
  <Provider store={store}>
    <ConnectedTicTacToe />
  </Provider>,
  document.getElementById('root')
);

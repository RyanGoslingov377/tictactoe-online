const socket = io();
let playerSymbol, currentGame;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const roomInput = document.getElementById('roomId');
document.getElementById('joinBtn').onclick = () => {
    const room = roomInput.value.trim();
    if (room) socket.emit('joinGame', room);
};

for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.onclick = () => {
        if (currentGame?.turn === playerSymbol) {
            socket.emit('makeMove', { roomId: roomInput.value, index: i, player: playerSymbol });
        }
    };
    boardEl.appendChild(cell);
}

socket.on('playerAssignment', sym => {
    playerSymbol = sym;
    statusEl.textContent = `Вы — ${sym}`;
});

socket.on('gameState', game => {
    currentGame = game;
    game.board.forEach((v, i) => boardEl.children[i].textContent = v || '');
    if (game.board.every(c => c)) {
        statusEl.textContent = 'Ничья!';
    } else {
        statusEl.textContent = game.turn === playerSymbol ? 'Ваш ход' : 'Ожидайте';
    }
});

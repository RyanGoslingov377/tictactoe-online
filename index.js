const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const games = {};

io.on('connection', socket => {
    socket.on('joinGame', roomId => {
        socket.join(roomId);
        if (!games[roomId]) {
            games[roomId] = { board: Array(9).fill(null), turn: 'X', players: [] };
        }
        const game = games[roomId];
        if (game.players.length < 2) {
            game.players.push(socket.id);
            socket.emit('playerAssignment', game.players.length === 1 ? 'X' : 'O');
        }
        io.to(roomId).emit('gameState', game);
    });

    socket.on('makeMove', ({ roomId, index, player }) => {
        const game = games[roomId];
        if (game.turn === player && game.board[index] === null) {
            game.board[index] = player;
            game.turn = player === 'X' ? 'O' : 'X';
            io.to(roomId).emit('gameState', game);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));


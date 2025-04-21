const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

const TICK = 50;         // 20 fps
const WORLD = { w: 4000, h: 4000 };
const MAX_PELLETS = 500;

const games = {};

io.on('connection', socket => {
    socket.on('join', roomId => {
        socket.join(roomId);
        let room = games[roomId];
        if (!room) {
            room = games[roomId] = {
                players: {},
                bots: [],
                pellets: [],
            };
            // раз в игру: добавляем ботов
            for (let i = 0; i < 5; i++) room.bots.push(makeBot());
        }
        // создаём игрока
        room.players[socket.id] = {
            x: WORLD.w / 2, y: WORLD.h / 2, dx: 0, dy: 0, mass: 30, color: '#2196f3'
        };
        socket.emit('joined', { world: WORLD });
    });

    socket.on('move', vec => {
        const room = findRoom(socket);
        if (!room) return;
        const p = room.players[socket.id];
        p.dx = vec.x; p.dy = vec.y;
    });

    // relay chat
    socket.on('chatMessage', ({ roomId, name, text }) => {
        io.to(roomId).emit('chatMessage', { name, text });
    });

    socket.on('disconnect', () => {
        const room = findRoom(socket);
        if (room) delete room.players[socket.id];
    });
});

// периодический цикл
setInterval(() => {
    for (const [roomId, room] of Object.entries(games)) {
        stepRoom(room);
        io.to(roomId).emit('world', exportState(room));
    }
}, TICK);

// helper’ы
function findRoom(socket) {
    const rooms = Object.entries(games);
    for (const [id, room] of rooms)
        if (room.players[socket.id]) return room;
}
function rand(max) { return Math.random() * max; }
function makeBot() {
    return { x: rand(WORLD.w), y: rand(WORLD.h), dx: 0, dy: 0, mass: 30, color: '#f44336' };
}

function stepRoom(room) {
    // спавн пеллет
    while (room.pellets.length < MAX_PELLETS)
        room.pellets.push({ x: rand(WORLD.w), y: rand(WORLD.h), mass: 5, color: '#4caf50' });
    // всех сущности: игроки + боты
    [...Object.values(room.players), ...room.bots].forEach(ent => {
        // движение
        const speed = 6 / Math.pow(ent.mass, 0.35);
        const len = Math.hypot(ent.dx, ent.dy) || 1;
        ent.x += ent.dx / len * speed;
        ent.y += ent.dy / len * speed;
        // границы
        ent.x = Math.max(0, Math.min(WORLD.w, ent.x));
        ent.y = Math.max(0, Math.min(WORLD.h, ent.y));
        // decay массы
        ent.mass = Math.max(10, ent.mass * 0.998);
    });
    // боты: простейшее следование к ближайшей пеллете
    room.bots.forEach(bot => {
        const target = room.pellets[0];
        room.pellets.forEach(p => {
            if (Math.hypot(p.x - bot.x, p.y - bot.y) < Math.hypot(target.x - bot.x, target.y - bot.y))
                target.x && target.y && (bot.target = target);
        });
        if (bot.target) {
            bot.dx = bot.target.x - bot.x;
            bot.dy = bot.target.y - bot.y;
        }
    });
    // поедание: игроки/боты vs пеллеты
    for (const ent of [...Object.values(room.players), ...room.bots]) {
        room.pellets = room.pellets.filter(pel => {
            if (Math.hypot(ent.x - pel.x, ent.y - pel.y) < ent.mass) {
                ent.mass += pel.mass * 0.5;
                return false;
            }
            return true;
        });
    }
    // поедание меньших между собой
    const all = [...Object.values(room.players), ...room.bots];
    for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            if (dist < a.mass && a.mass > b.mass * 1.25) {
                a.mass += b.mass * 0.8; b.mass = 0; // b умрет
            } else if (dist < b.mass && b.mass > a.mass * 1.25) {
                b.mass += a.mass * 0.8; a.mass = 0;
            }
        }
    }
    // чистим мёртвых ботов
    room.bots = room.bots.filter(b => b.mass > 5);
}

// формируем состояние, которое уйдёт на клиент
function exportState(room) {
    const players = Object.entries(room.players)
        .map(([id, p]) => ({ id, ...p }));   // теперь каждый объект имеет поле id
    return {
        players,
        bots: room.bots,
        pellets: room.pellets
    };
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on ${PORT}`));

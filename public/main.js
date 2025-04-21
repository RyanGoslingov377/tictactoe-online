const socket = io();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let world, you, state;

// размер Canvas под окно
function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
}
window.addEventListener('resize', resize);
resize();

// подключаемся
const room = prompt('Room?', 'room1');
socket.emit('join', room);

socket.on('joined', data => {
    world = data.world;
    you = null;
});

socket.on('world', s => {
    state = s;
    if (!you) {
        you = state.players.find(p => p.id === socket.id);
    }
    // draw() здесь больше не вызываем
});

// Теперь внизу main.js добавь:
function loop() {
    if (state && you) draw();
    requestAnimationFrame(loop);
}
loop();


// новый вариант — не чаще чем каждые 50 мс
let lastEmit = 0;
canvas.addEventListener('mousemove', e => {
    const now = Date.now();
    if (now - lastEmit < 50) return;
    lastEmit = now;

    const vx = e.clientX - canvas.width / 2;
    const vy = e.clientY - canvas.height / 2;
    socket.emit('move', { x: vx, y: vy });
});


// отрисовка
function draw() {
    if (!state) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // камера: смещение чтобы ты был в центре
    const camX = you.x - canvas.width / 2;
    const camY = you.y - canvas.height / 2;

    // рисуем пеллеты
    state.pellets.forEach(p => {
        drawCircle(p.x - camX, p.y - camY, p.mass, p.color);
    });
    // боты
    state.bots.forEach(b => {
        if (b.mass > 0) drawCircle(b.x - camX, b.y - camY, b.mass, b.color);
    });
    // игроки
    state.players.forEach(p => {
        drawCircle(p.x - camX, p.y - camY, p.mass, p.color);
    });
}

function drawCircle(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

// —————————————— чат ——————————————

const messages = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const yourName = prompt('Как вас зовут в чате?', 'Player');

// отменяем сабмит формы
chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    socket.emit('chatMessage', { roomId: room, name: yourName, text });
    chatInput.value = '';
});

// когда сервер рассылает чужое сообщение — показываем его
socket.on('chatMessage', ({ name, text }) => {
    const div = document.createElement('div');
    div.textContent = `${name}: ${text}`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
});
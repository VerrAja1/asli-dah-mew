const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'sbwhook-4tnvrmfzuyswb6mw1fedpjd9';
let queue = [];

function sortQueue() {
  queue.sort((a, b) => b.priority - a.priority || a.id - b.id);
}

app.post('/webhook', (req, res) => {
  const token = req.headers['x-sociabuzz-token'] || req.body.token;
  if (token !== WEBHOOK_TOKEN) {
    return res.status(401).json({ message: 'Token invalid' });
  }

  const data = req.body;
  const supporter = data.supporter || data.name || 'Anonim';
  const amount = Number(data.amount || data.amount_raw || 0);
  const message = data.message || '-';

  let tier = null;
  let priority = 0;

  if (amount >= 15000) {
    tier = 'SKIP ALL';
    priority = 3;
  } else if (amount >= 10000) {
    tier = 'VIP';
    priority = 2;
  } else if (amount >= 5000) {
    tier = 'REGULER';
    priority = 1;
  }

  if (tier) {
    queue.push({
      id: Date.now(),
      name: supporter,
      amount,
      note: message,
      tier,
      priority
    });
    sortQueue();
    io.emit('updateQueue', queue);
  }

  res.status(200).json({ status: 'ok' });
});

io.on('connection', (socket) => {
  socket.emit('updateQueue', queue);

  socket.on('removeQueue', (id) => {
    queue = queue.filter(item => item.id !== id);
    io.emit('updateQueue', queue);
  });

  socket.on('addManual', (item) => {
    const priorityMap = { 'SKIP ALL': 3, 'VIP': 2, 'REGULER': 1 };
    queue.push({
      id: Date.now(),
      name: item.name,
      amount: item.amount || 0,
      note: item.note || '-',
      tier: item.tier,
      priority: priorityMap[item.tier] || 1
    });
    sortQueue();
    io.emit('updateQueue', queue);
  });
});
app.get('/', (req, res) => res.redirect('/overlay.html'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server jalan di port ${PORT}`));

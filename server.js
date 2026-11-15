const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'sbwhook-4tnvrmfzuyswb6mw1fedpjd9';

let antrian = [];

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/webhook', (req, res) => {
  console.log('=== WEBHOOK MASUK ===');
  console.log('HEADERS:', JSON.stringify(req.headers));
  console.log('BODY:', JSON.stringify(req.body));

  // Cek semua kemungkinan header/body token SociaBuzz
  const incomingToken =
    req.headers['x-sociabuzz-webhook-token'] ||
    req.headers['x-webhook-token'] ||
    req.headers['webhook-token'] ||
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.body?.token ||
    req.body?.webhook_token;

  // Log aja kalau beda, biar gak langsung gagal 401 pas tes
  if (incomingToken && incomingToken !== WEBHOOK_TOKEN) {
    console.log('Peringatan token beda:', incomingToken);
  }

  const data = req.body || {};
  const nama = data.supporter_name || data.name || data.supporter || 'Anonim';
  const nominal = Number(data.amount_raw || data.amount || 0);
  const pesan = data.message || '-';

  let tier = 'Reguler';
  let prioritas = 3;

  if (nominal >= 15000) {
    tier = 'Skip All';
    prioritas = 1;
  } else if (nominal >= 10000) {
    tier = 'VIP';
    prioritas = 2;
  } else if (nominal >= 5000) {
    tier = 'Reguler';
    prioritas = 3;
  } else {
    return res.status(200).json({ status: 'ignored', reason: 'Nominal di bawah 5k' });
  }

  antrian.push({
    id: Date.now(),
    nama,
    nominal,
    pesan,
    tier,
    prioritas
  });

  // Urutkan berdasarkan prioritas (1 = Skip All paling atas)
  antrian.sort((a, b) => a.prioritas - b.prioritas || a.id - b.id);

  io.emit('update_antrian', antrian);
  res.status(200).json({ status: 'ok' });
});

io.on('connection', (socket) => {
  socket.emit('update_antrian', antrian);

  socket.on('hapus_antrian', (id) => {
    antrian = antrian.filter((item) => item.id !== id);
    io.emit('update_antrian', antrian);
  });

  socket.on('reset_antrian', () => {
    antrian = [];
    io.emit('update_antrian', antrian);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server jalan di port ${PORT}`);
});

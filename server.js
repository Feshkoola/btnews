const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let users = {};

io.on('connection', socket => {
  users[socket.id] = "Unnamed";

  socket.on('set-username', name => {
    users[socket.id] = name;
    io.emit('update-users', users);
  });

  socket.on('call-user', targetId => {
    io.to(targetId).emit('incoming-call', socket.id);
  });

  socket.on('signal', (targetId, data) => {
    io.to(targetId).emit('signal', socket.id, data);
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('update-users', users);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('🟢 BT News server running...');
});
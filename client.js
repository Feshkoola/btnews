const socket = io();
let peerConnection;
let localStream;
let username = '';
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Wake Lock for mobile
if ('wakeLock' in navigator) {
  let wakeLock;
  const requestLock = async () => {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
  };
  requestLock();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestLock();
  });
}

// Join button logic
document.getElementById('joinBtn').onclick = () => {
  const nameInput = document.getElementById('username').value.trim();
  if (!nameInput) return alert('Please enter a camera name');
  username = nameInput;
  socket.emit('set-username', username);

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
    })
    .catch(err => {
      console.error('Media error:', err);
      alert('Unable to access camera/mic.');
    });
};

// Populate camera list
socket.on('update-users', users => {
  const list = document.getElementById('cameraOptions');
  list.innerHTML = '';
  Object.entries(users).forEach(([id, name]) => {
    if (id !== socket.id) {
      const item = document.createElement('li');
      item.textContent = name;
      item.onclick = () => startCall(id);
      list.appendChild(item);
    }
  });
});

function startCall(targetId) {
  if (!localStream) return alert('Join first and allow camera access');

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  peerConnection.ontrack = e => {
    document.getElementById('cameraView').srcObject = e.streams[0];
  };
  peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', targetId, { candidate: e.candidate });
  };

  peerConnection.createOffer()
    .then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit('call-user', targetId);
      socket.emit('signal', targetId, { offer });
    });
}

socket.on('incoming-call', callerId => {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  peerConnection.ontrack = e => {
    document.getElementById('cameraView').srcObject = e.streams[0];
  };
  peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', callerId, { candidate: e.candidate });
  };
});

socket.on('signal', (fromId, data) => {
  if (!peerConnection) return;

  if (data.offer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
      .then(() => peerConnection.createAnswer())
      .then(answer => {
        peerConnection.setLocalDescription(answer);
        socket.emit('signal', fromId, { answer });
      });
  } else if (data.answer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  } else if (data.candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

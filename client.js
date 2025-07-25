const socket = io();
let localStream;
let peerConnection = null;
let candidateQueue = [];
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const remoteVideo = document.getElementById('remoteVideo');
const usersDiv = document.getElementById('users');

let username = prompt("Enter your reporter name for BT News:");
socket.emit('set-username', username);

// Prevent device sleep
if ('wakeLock' in navigator) {
  let wakeLock = null;
  const requestWakeLock = async () => {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.warn("Wake Lock failed:", err);
    }
  };
  requestWakeLock();
  document.addEventListener("visibilitychange", () => {
    if (wakeLock !== null && document.visibilityState === "visible") {
      requestWakeLock();
    }
  });
}

// Show online users by name
socket.on('update-users', userMap => {
  usersDiv.innerHTML = '';
  Object.entries(userMap).forEach(([id, name]) => {
    if (id !== socket.id) {
      const div = document.createElement('div');
      div.className = 'user';
      div.textContent = name;
      div.onclick = () => callUser(id);
      usersDiv.appendChild(div);
    }
  });
});

// Call another user
function callUser(targetId) {
  candidateQueue = [];

  peerConnection = new RTCPeerConnection(config);

  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('signal', targetId, { candidate: e.candidate });
    }
  };

  peerConnection.createOffer()
    .then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit('call-user', targetId);
      socket.emit('signal', targetId, { offer });
    });
}

// Incoming call
socket.on('incoming-call', fromId => {
  candidateQueue = [];

  peerConnection = new RTCPeerConnection(config);

  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('signal', fromId, { candidate: e.candidate });
    }
  };
});

// Handle signaling
socket.on('signal', (fromId, data) => {
  if (!peerConnection) {
    candidateQueue.push(data);
    return;
  }

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

  candidateQueue.forEach(c => {
    if (c.candidate) {
      peerConnection.addIceCandidate(new RTCIceCandidate(c.candidate));
    }
  });
  candidateQueue = [];
});
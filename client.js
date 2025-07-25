const socket = io();
let peerConnection;
let localStream;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

let username = prompt("Enter your reporter name for BT News:");
socket.emit("set-username", username);

// Prevent screen timeout
if ("wakeLock" in navigator) {
  let wakeLock = null;
  const requestLock = async () => {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch (err) { console.warn("Wake Lock error:", err); }
  };
  requestLock();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestLock();
  });
}

// Get media stream on load
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    // We won't show local video, but we must keep the stream for connection setup
  })
  .catch(err => {
    console.error("Failed to get media:", err);
    alert("Media access blocked.");
  });

const usersDiv = document.getElementById("users");
const remoteVideo = document.getElementById("remoteVideo");

// Show reporters
socket.on("update-users", userMap => {
  usersDiv.innerHTML = "";
  Object.entries(userMap).forEach(([id, name]) => {
    if (id !== socket.id) {
      const div = document.createElement("div");
      div.className = "user";
      div.textContent = name;
      div.onclick = () => startCall(id);
      usersDiv.appendChild(div);
    }
  });
});

function startCall(targetId) {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  peerConnection = new RTCPeerConnection(config);

  // Add local tracks — even if you don’t show local video!
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", targetId, { candidate: e.candidate });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log("State:", peerConnection.connectionState);
  };

  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => {
      socket.emit("call-user", targetId);
      socket.emit("signal", targetId, { offer: peerConnection.localDescription });
    });
}

// Incoming call
socket.on("incoming-call", callerId => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", callerId, { candidate: e.candidate });
    }
  };
});

// Handle signal
socket.on("signal", (fromId, data) => {
  if (!peerConnection) return;

  if (data.offer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
      .then(() => peerConnection.createAnswer())
      .then(answer => {
        peerConnection.setLocalDescription(answer);
        socket.emit("signal", fromId, { answer });
      });
  }

  if (data.answer && peerConnection.signalingState === "have-local-offer") {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  }

  if (data.candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

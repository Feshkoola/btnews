let stream = null;
let peerConnection = null;

const videoEl = document.getElementById("cameraView");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const cameraSelector = document.getElementById("cameraSelector");

// 🎥 Fetch available video devices
navigator.mediaDevices.enumerateDevices().then(devices => {
  const videoDevices = devices.filter(d => d.kind === "videoinput");
  videoDevices.forEach((device, index) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.text = `Camera ${index + 1}`;
    cameraSelector.appendChild(option);
  });
});

// 🎬 Start filming
startBtn.onclick = async () => {
  const cameraId = cameraSelector.value;
  if (stream) stopStream();

  stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: cameraId ? { exact: cameraId } : undefined },
    audio: false,
  });

  videoEl.srcObject = stream;

  peerConnection = new RTCPeerConnection();
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
  console.log("🎬 Filming started");
};

// 🛑 Stop filming
stopBtn.onclick = () => {
  stopStream();
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    console.log("🛑 Connection closed");
  }
  videoEl.srcObject = null;
};

function stopStream() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

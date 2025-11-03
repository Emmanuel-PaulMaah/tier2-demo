<script type="module">
// ===== webrtc.js
export async function createPeer(isOfferer, onData, onConnState) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
  });

  // Data channel setup
  let dc;
  if (isOfferer) {
    dc = pc.createDataChannel("pose", { ordered: true });
    wireDC(dc, onData, onConnState);
  } else {
    pc.ondatachannel = (e) => {
      if (e.channel.label === "pose") {
        dc = e.channel;
        wireDC(dc, onData, onConnState);
      }
    };
  }

  pc.onicecandidate = () => {
    // gathering happens implicitly; we read SDP from pc.localDescription when ready
  };

  return {
    pc,
    get dc() { return dc; },
    async makeOffer() {
      const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);
      await waitIceGathering(pc);
      return pc.localDescription.sdp;
    },
    async acceptRemoteSdp(type, sdp) {
      await pc.setRemoteDescription({ type, sdp });
      if (type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitIceGathering(pc);
        return pc.localDescription.sdp;
      }
      return null;
    }
  };
}

function wireDC(dc, onData, onConnState) {
  dc.onopen = () => onConnState?.("open");
  dc.onclose = () => onConnState?.("closed");
  dc.onerror = (e) => onConnState?.("error:" + e.message);
  dc.onmessage = (e) => onData?.(e.data);
}

function waitIceGathering(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((res) => {
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        res();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
  });
}
</script>

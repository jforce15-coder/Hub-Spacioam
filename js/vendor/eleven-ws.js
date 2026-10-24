/* @elevenlabs/client 1.27.0 (MIT) · solo websocket, sin livekit · generado con esbuild para Spacio AM */
var ze=Object.defineProperty;var Je=(n,t,e)=>t in n?ze(n,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):n[t]=e;var a=(n,t,e)=>Je(n,typeof t!="symbol"?t+"":t,e);var P=class{constructor(t={}){a(this,"queue",[]);a(this,"outgoingQueue",[]);a(this,"disconnectionDetails",null);a(this,"onDisconnectCallback",null);a(this,"onMessageCallback",null);a(this,"onModeChangeCallback",null);a(this,"onDebug");a(this,"onOutgoingMessageCallback",null);this.onDebug=t.onDebug}debug(t){this.onDebug&&this.onDebug(t)}onMessage(t){this.onMessageCallback=t;let e=this.queue;this.queue=[],e.length>0&&queueMicrotask(()=>{e.forEach(t)})}onDisconnect(t){this.onDisconnectCallback=t;let e=this.disconnectionDetails;e&&queueMicrotask(()=>{t(e)})}onModeChange(t){this.onModeChangeCallback=t}onOutgoingMessage(t){this.onOutgoingMessageCallback=t;let e=this.outgoingQueue;this.outgoingQueue=[],e.length>0&&queueMicrotask(()=>{e.forEach(t)})}updateMode(t){var e;(e=this.onModeChangeCallback)==null||e.call(this,t)}disconnect(t){var e;this.disconnectionDetails||(this.disconnectionDetails=t,(e=this.onDisconnectCallback)==null||e.call(this,t))}handleMessage(t){this.onMessageCallback?this.onMessageCallback(t):this.queue.push(t)}handleOutgoingMessage(t){this.onOutgoingMessageCallback?this.onOutgoingMessageCallback(t):this.outgoingQueue.push(t)}};function D(n){let[t,e]=n.split("_");if(!["pcm","ulaw"].includes(t))throw new Error(`Invalid format: ${n}`);let o=Number.parseInt(e);if(Number.isNaN(o))throw new Error(`Invalid sample rate: ${e}`);return{format:t,sampleRate:o}}function L(n){return n!=null&&typeof n=="object"&&!Array.isArray(n)}function he(n,t="Expected a JSON object"){if(!L(n))throw new Error(t)}async function j(n){try{let t=await n.json();if(!L(t))return n.statusText||"Unknown error";let e=t.detail,o=L(e)?e.message:e;if(typeof o=="string")return o}catch(t){console.warn("Failed to parse API error response as JSON:",t)}return n.statusText||"Unknown error"}var O=class extends Error{constructor(e,o){super(e);a(this,"closeCode");a(this,"closeReason");this.name="SessionConnectionError",this.closeCode=o==null?void 0:o.closeCode,this.closeReason=o==null?void 0:o.closeReason}};var me="1.27.0";var T=Object.freeze({name:"js_sdk",version:me});function F(n){return!!n.type}function fe(){throw new Error("webrtc no disponible")}var G=class{constructor(){fe()}},S={},C={Source:{},Kind:{}},ge={};function _e(){fe()}var ae="conversation_initiation_client_data";function z(n){var e,o,r,i,s,c,l,u,p;let t={type:ae};return n.overrides&&(t.conversation_config_override={agent:{prompt:(e=n.overrides.agent)==null?void 0:e.prompt,first_message:(o=n.overrides.agent)==null?void 0:o.firstMessage,language:(r=n.overrides.agent)==null?void 0:r.language},tts:{voice_id:(i=n.overrides.tts)==null?void 0:i.voiceId,speed:(s=n.overrides.tts)==null?void 0:s.speed,stability:(c=n.overrides.tts)==null?void 0:c.stability,similarity_boost:(l=n.overrides.tts)==null?void 0:l.similarityBoost},...((u=n.overrides.asr)==null?void 0:u.keywords)!==void 0?{asr:{keywords:n.overrides.asr.keywords}}:{},conversation:{text_only:(p=n.overrides.conversation)==null?void 0:p.textOnly}}),n.customLlmExtraBody&&(t.custom_llm_extra_body=n.customLlmExtraBody),n.dynamicVariables&&(t.dynamic_variables=n.dynamicVariables),n.userId&&(t.user_id=n.userId),t.source_info={source:T.name,version:T.version},n.toolMockConfig&&(t.tool_mock_config={mocking_strategy:n.toolMockConfig.mockingStrategy,mocked_tool_names:n.toolMockConfig.mockedToolNames,fallback_strategy:n.toolMockConfig.fallbackStrategy}),t}function U(n){let t=new Uint8Array(n);return btoa(String.fromCharCode(...t))}function ve(n){let t=atob(n),e=t.length,o=new Uint8Array(e);for(let r=0;r<e;r++)o[r]=t.charCodeAt(r);return o.buffer}var B={getVolume:()=>0,getByteFrequencyData:()=>{}},Ye=100,Ke=8e3;function ce(n,t,e){let o=n.length,r=e/2/o,i=Math.floor(Ye/r),s=Math.min(Math.ceil(Ke/r),o),c=s-i,l=t.length;for(let u=0;u<l;u++){let p=u/l*c,d=i+Math.floor(p),h=Math.min(d+1,s-1),m=p-Math.floor(p);t[u]=Math.round(n[d]*(1-m)+n[h]*m)}}var J;function ye(n){J=n}function Se(){var n;return(n=J==null?void 0:J())!=null?n:null}var Qe="wss://livekit.rtc.elevenlabs.io",Xe="https://api.elevenlabs.io",Ze=.01;function et(n){return n.replace(/^wss:\/\//,"https://")}var E=class n extends P{constructor(e,o,r,i,s={}){super(s);a(this,"conversationId");a(this,"inputFormat");a(this,"outputFormat");a(this,"room");a(this,"isConnected",!1);a(this,"audioEventId",1);a(this,"outputDeviceId",null);a(this,"audioAdapter");a(this,"workletPaths");a(this,"inputAnalyser");a(this,"inputVolumeProvider",B);a(this,"outputAnalyser");a(this,"outputVolumeProvider",B);a(this,"_isMuted",!1);a(this,"input",{close:async()=>{if(this.isConnected)try{this.room.localParticipant.audioTrackPublications.forEach(e=>{e.track&&e.track.stop()})}catch(e){console.warn("Error stopping local tracks:",e)}},setDevice:async e=>{if((e==null?void 0:e.sampleRate)!==void 0||(e==null?void 0:e.format)!==void 0||(e==null?void 0:e.preferHeadphonesForIosDevices)!==void 0)throw new Error("WebRTC input device does not support sampleRate, format, or preferHeadphonesForIosDevices options");let o=e==null?void 0:e.inputDeviceId;o&&await this.setAudioInputDevice(o)},setMuted:async e=>{var r;if(!this.isConnected||!this.room.localParticipant){console.warn("Cannot set microphone muted: room not connected or no local participant");return}this._isMuted=e;let o=this.room.localParticipant.getTrackPublication(C.Source.Microphone);if(o!=null&&o.track)try{e?await o.track.mute():await o.track.unmute()}catch{await this.room.localParticipant.setMicrophoneEnabled(!e)}else await this.room.localParticipant.setMicrophoneEnabled(!e);if(!e){let i=(r=this.room.localParticipant.getTrackPublication(C.Source.Microphone))==null?void 0:r.track;i&&this.setupInputAnalyser(i.mediaStreamTrack)}},isMuted:()=>this._isMuted,getAnalyser:()=>this.inputAnalyser,getVolume:()=>this._isMuted?0:this.inputVolumeProvider.getVolume(),getByteFrequencyData:e=>{if(this._isMuted){e.fill(0);return}this.inputVolumeProvider.getByteFrequencyData(e)}});a(this,"output",{close:async()=>{},setDevice:async e=>{if((e==null?void 0:e.sampleRate)!==void 0||(e==null?void 0:e.format)!==void 0)throw new Error("WebRTC output device does not support sampleRate or format options");let o=e==null?void 0:e.outputDeviceId;o&&await this.setAudioOutputDevice(o)},setVolume:e=>{this.setAudioVolume(e)},interrupt:e=>{},getAnalyser:()=>this.outputAnalyser,getVolume:()=>this.outputVolumeProvider.getVolume(),getByteFrequencyData:e=>{this.outputVolumeProvider.getByteFrequencyData(e)}});this.room=e,this.conversationId=o,this.inputFormat=r,this.outputFormat=i,this.audioAdapter=Se(),this.workletPaths=s.workletPaths,this.setupRoomEventListeners()}static async create(e){var s,c,l,u,p;let o;if("conversationToken"in e&&e.conversationToken)o=e.conversationToken;else if("agentId"in e&&e.agentId)try{let{name:d,version:h}=T,m=(s=e.origin)!=null?s:Xe,v=`${et(m)}/v1/convai/conversation/token?agent_id=${e.agentId}&source=${d}&version=${h}`;e.environment&&(v+=`&environment=${encodeURIComponent(e.environment)}`);let _=await fetch(v);if(!_.ok){let y=await j(_);throw new Error(`ElevenLabs API returned ${_.status} ${y}`)}let f=await _.json();if(!L(f)||typeof f.token!="string")throw new Error("No conversation token received from API");if(o=f.token,!o)throw new Error("No conversation token received from API")}catch(d){let h=d instanceof Error?d.message:String(d);throw d instanceof Error&&d.message.includes("401")&&(h="Your agent has authentication enabled, but no signed URL or conversation token was provided."),new Error(`Failed to fetch conversation token for agent ${e.agentId}: ${h}`)}else throw new Error("Either conversationToken or agentId is required for WebRTC connection");let r=(c=e.webRtc)==null?void 0:c.singlePeerConnection,i=new G(r===void 0?void 0:{singlePeerConnection:r});try{let d=`room_${Date.now()}`,h=D("pcm_48000"),m=D("pcm_48000"),g=new n(i,d,h,m,e),v=e.livekitUrl||Qe,_=e.textOnly?Promise.resolve():new Promise((A,x)=>{i.once(S.SignalConnected,()=>{g.enableMicrophone(e.inputDeviceId).then(()=>A()).catch(x)})}),f=(l=e.webRtc)==null?void 0:l.iceTransportPolicy;await i.connect(v,o,{rtcConfig:f?{iceTransportPolicy:f}:void 0}),await new Promise(A=>{if(g.isConnected)A();else{let x=()=>{i.off(S.Connected,x),A()};i.on(S.Connected,x)}}),await _;let y=(u=i.localParticipant.getTrackPublication(C.Source.Microphone))==null?void 0:u.track;y&&g.setupInputAnalyser(y.mediaStreamTrack),i.name&&(g.conversationId=((p=i.name.match(/(conv_[a-zA-Z0-9]+)/))==null?void 0:p[0])||i.name);let W=z(e);return g.debug({type:ae,message:W}),await g.sendRequiredMessage(W),g}catch(d){throw await i.disconnect(),d}}setupRoomEventListeners(){this.room.on(S.Connected,()=>{this.isConnected=!0}),this.room.on(S.Disconnected,e=>{this.isConnected=!1,this.disconnect({reason:"agent",context:{type:"close",reason:e==null?void 0:e.toString()}})}),this.room.on(S.ConnectionStateChanged,e=>{e===ge.Disconnected&&(this.isConnected=!1,this.disconnect({reason:"error",message:`LiveKit connection state changed to ${e}`,context:{type:"connection_state_changed"}}))}),this.room.on(S.DataReceived,(e,o)=>{try{let r=JSON.parse(new TextDecoder().decode(e));if(r.type==="audio"){F(r)&&this.handleMessage(r);return}F(r)?this.handleMessage(r):console.warn("Invalid socket event received:",r)}catch(r){console.warn("Failed to parse incoming data message:",r),console.warn("Raw payload:",new TextDecoder().decode(e))}}),this.room.on(S.TrackSubscribed,async(e,o,r)=>{var i;if(e.kind===C.Kind.Audio&&r.identity.includes("agent")){let s=e;this.audioAdapter&&(await this.audioAdapter.attachRemoteTrack(s,this.outputDeviceId),await this.setupAudioCapture(s),(i=this.onDebug)==null||i.call(this,{type:"audio_element_ready"}))}}),this.room.on(S.ActiveSpeakersChanged,async e=>{e.length>0?this.updateMode(e[0].identity.startsWith("agent")?"speaking":"listening"):this.updateMode("listening")}),this.room.on(S.ParticipantDisconnected,e=>{var o;(o=e.identity)!=null&&o.startsWith("agent")&&this.disconnect({reason:"agent",context:{type:"close",reason:"agent disconnected"}})})}close(){var e;if(this.isConnected){try{this.room.localParticipant.audioTrackPublications.forEach(o=>{o.track&&o.track.stop()})}catch(o){console.warn("Error stopping local tracks:",o)}(e=this.audioAdapter)==null||e.cleanup(),this.inputAnalyser=void 0,this.outputAnalyser=void 0,this.inputVolumeProvider=B,this.outputVolumeProvider=B,this.room.disconnect()}}async sendMessage(e){if(!this.isConnected||!this.room.localParticipant){console.warn("Cannot send message: room not connected or no local participant");return}if(!("user_audio_chunk"in e)){this.handleOutgoingMessage(e);try{await this.publishMessage(e)}catch(o){this.debug({type:"send_message_error",message:{message:e,error:o}}),console.error("Failed to send message via WebRTC:",o)}}}async sendRequiredMessage(e){if(!this.isConnected||!this.room.localParticipant)throw new Error("Cannot send message: room not connected or no local participant");this.handleOutgoingMessage(e),await this.publishMessage(e)}async publishMessage(e){let r=new TextEncoder().encode(JSON.stringify(e));await this.room.localParticipant.publishData(r,{reliable:!0})}getRoom(){return this.room}setupInputAnalyser(e){if(this.audioAdapter)try{let o=this.audioAdapter.setupInputAnalysis(e);this.inputVolumeProvider=o.volumeProvider,this.inputAnalyser=o.analyser}catch(o){console.warn("[ConversationalAI] Failed to set up input volume analyser:",o)}}setInputVolumeProvider(e){this.inputVolumeProvider=e}setOutputVolumeProvider(e){this.outputVolumeProvider=e}async setupAudioCapture(e){if(this.audioAdapter)try{let o=(i,s)=>{if(s>Ze){let c=U(i),l=this.audioEventId++;this.handleMessage({type:"audio",audio_event:{audio_base_64:c,event_id:l}})}},r=await this.audioAdapter.setupOutputAnalysis(e,this.outputFormat,o,this.workletPaths);this.outputVolumeProvider=r.volumeProvider,this.outputAnalyser=r.analyser}catch(o){console.warn("Failed to set up audio capture:",o)}}setAudioVolume(e){var o;(o=this.audioAdapter)==null||o.setVolume(e)}async setAudioOutputDevice(e){if(!this.audioAdapter)throw new Error("Cannot set output device: no audio adapter available on this platform");await this.audioAdapter.setOutputDevice(e),this.outputDeviceId=e}async setAudioInputDevice(e){var r;if(!this.isConnected||!this.room.localParticipant)throw new Error("Cannot change input device: room not connected or no local participant");let o=await this.createMicrophoneTrack(e);try{let i=this.room.localParticipant.getTrackPublication(C.Source.Microphone);i!=null&&i.track&&await this.room.localParticipant.unpublishTrack(i.track),this._isMuted&&await o.mute(),await this.room.localParticipant.publishTrack(o,{name:"microphone",source:C.Source.Microphone})}catch(i){console.error("Failed to change input device:",i);let s=this.room.localParticipant.getTrackPublication(C.Source.Microphone);if((s==null?void 0:s.track)!==o&&o.stop(),!(s!=null&&s.track))try{await this.room.localParticipant.setMicrophoneEnabled(!this._isMuted);let c=(r=this.room.localParticipant.getTrackPublication(C.Source.Microphone))==null?void 0:r.track;c&&this.setupInputAnalyser(c.mediaStreamTrack)}catch(c){console.error("Failed to recover microphone after device switch error:",c)}throw i}this.setupInputAnalyser(o.mediaStreamTrack)}async enableMicrophone(e){if(!e){await this.room.localParticipant.setMicrophoneEnabled(!0);return}let o=await this.createMicrophoneTrack(e);try{await this.room.localParticipant.publishTrack(o,{name:"microphone",source:C.Source.Microphone})}catch(r){throw o.stop(),r}}createMicrophoneTrack(e){return _e({deviceId:{exact:e},echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0,channelCount:{ideal:1}})}};var tt='Import the platform-specific entry point (e.g. @elevenlabs/client via the "browser" export).',ot=tt;function le(n){return new Error(`No ${n} registered. ${ot}`)}var ue;function Ce(n){ue=n}function be(){if(ue)return ue;throw le("voice session setup strategy")}function we(n){var t,e;if(!(n instanceof E))throw new Error(`setupWebRTCSession requires a WebRTCConnection. Received: ${(e=(t=n==null?void 0:n.constructor)==null?void 0:t.name)!=null?e:typeof n}`);return{connection:n,input:n.input,output:n.output,playbackEventTarget:null,detach:async()=>{}}}var Y=new Map;function nt(n,t){return t?`${n} ${t}`:n}function N(n,t){return async(e,o)=>{let r=nt(n,o),i=Y.get(r);if(i)return e.addModule(i);if(o)try{await e.addModule(o),Y.set(r,o);return}catch(l){throw new Error(`Failed to load the ${n} worklet module from path: ${o}. Error: ${l}`)}let s=new Blob([t],{type:"application/javascript"}),c=URL.createObjectURL(s);try{await e.addModule(c),Y.set(r,c);return}catch{URL.revokeObjectURL(c)}try{let u=`data:application/javascript;base64,${btoa(t)}`;await e.addModule(u),Y.set(r,u)}catch{throw new Error(`Failed to load the ${n} worklet module. Make sure the browser supports AudioWorklets. If you are using a strict CSP, you may need to self-host the worklet files.`)}}}var Ae=N("audioConcatProcessor",`/*
 * ulaw decoding logic taken from the wavefile library
 * https://github.com/rochars/wavefile/blob/master/lib/codecs/mulaw.js
 * USED BY @elevenlabs/client
 */

const decodeTable = [0, 132, 396, 924, 1980, 4092, 8316, 16764];

function decodeSample(muLawSample) {
  let sign;
  let exponent;
  let mantissa;
  let sample;
  muLawSample = ~muLawSample;
  sign = muLawSample & 0x80;
  exponent = (muLawSample >> 4) & 0x07;
  mantissa = muLawSample & 0x0f;
  sample = decodeTable[exponent] + (mantissa << (exponent + 3));
  if (sign !== 0) sample = -sample;

  return sample;
}

class AudioConcatProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffers = []; // Initialize an empty buffer
    this.cursor = 0;
    this.currentBuffer = null;
    this.wasInterrupted = false;
    this.finished = false;

    this.port.onmessage = ({ data }) => {
      switch (data.type) {
        case "setFormat":
          this.format = data.format;
          if (globalThis.LibSampleRate && sampleRate !== data.sampleRate) {
            globalThis.LibSampleRate.create(
              1,
              data.sampleRate,
              sampleRate
            ).then(resampler => {
              this.resampler = resampler;
            });
          }
          break;
        case "buffer":
          this.wasInterrupted = false;
          this.buffers.push(
            this.format === "ulaw"
              ? new Uint8Array(data.buffer)
              : new Int16Array(data.buffer)
          );
          break;
        case "interrupt":
          this.wasInterrupted = true;
          break;
        case "clearInterrupted":
          if (this.wasInterrupted) {
            this.wasInterrupted = false;
            this.buffers = [];
            this.currentBuffer = null;
          }
      }
    };
  }
  process(_, outputs) {
    let finished = false;
    const output = outputs[0][0];
    for (let i = 0; i < output.length; i++) {
      if (!this.currentBuffer) {
        if (this.buffers.length === 0) {
          finished = true;
          break;
        }
        this.currentBuffer = this.buffers.shift();
        if (this.resampler) {
          this.currentBuffer = this.resampler.full(this.currentBuffer);
        }
        this.cursor = 0;
      }

      let value = this.currentBuffer[this.cursor];
      if (this.format === "ulaw") {
        value = decodeSample(value);
      }
      output[i] = value / 32768;
      this.cursor++;

      if (this.cursor >= this.currentBuffer.length) {
        this.currentBuffer = null;
      }
    }

    if (this.finished !== finished) {
      this.finished = finished;
      this.port.postMessage({ type: "process", finished });
    }

    return true; // Continue processing
  }
}

registerProcessor("audioConcatProcessor", AudioConcatProcessor);
`);var rt="https://cdn.jsdelivr.net/npm/@alexanderolsen/libsamplerate-js@2.1.2/dist/libsamplerate.worklet.js";async function K(n,t){let e=t||rt;await n.audioWorklet.addModule(e)}function Te(n){if(n.length===0)return 0;let t=0;for(let e=0;e<n.length;e++)t+=n[e]/255;return t/=n.length,t<0?0:t>1?1:t}function k(n,t){let e=n.frequencyBinCount,o,r;return{getVolume(){return o!=null||(o=new Uint8Array(e)),r!=null||(r=new Uint8Array(e)),n.getByteFrequencyData(o),ce(o,r,t),Te(r)},getByteFrequencyData(i){o!=null||(o=new Uint8Array(e)),n.getByteFrequencyData(o),ce(o,i,t)}}}function b(){return["iPad Simulator","iPhone Simulator","iPod Simulator","iPad","iPhone","iPod"].includes(navigator.platform)||navigator.userAgent.includes("Mac")&&"ontouchend"in document}function Ee(){return/android/i.test(navigator.userAgent)}function it({sampleRate:n,format:t,worklet:e,audioElement:o}){if(!b())return;let i=Math.floor(n*100/1e3),s=t==="ulaw"?new Uint8Array(i).fill(255):new Int16Array(i);e.port.postMessage({type:"buffer",buffer:s.buffer}),o.play().catch(()=>{})}var Q=class n{constructor(t,e,o,r,i){a(this,"context");a(this,"analyser");a(this,"gain");a(this,"worklet");a(this,"audioElement");a(this,"volume",1);a(this,"interrupted",!1);a(this,"interruptTimeout",null);a(this,"volumeProvider");this.context=t,this.analyser=e,this.gain=o,this.worklet=r,this.audioElement=i,this.worklet.port.start(),this.volumeProvider=k(e,t.sampleRate)}static async create({sampleRate:t,format:e,outputDeviceId:o,workletPaths:r,libsampleratePath:i,audioContext:s}){let c=s!=null?s:null,l=null;try{let u=navigator.mediaDevices.getSupportedConstraints().sampleRate;c||(c=new AudioContext(u?{sampleRate:t}:{}));let p=c.createAnalyser(),d=c.createGain();l=new Audio,l.src="",l.load(),l.autoplay=!0,l.style.display="none",document.body.appendChild(l);let h=c.createMediaStreamDestination();l.srcObject=h.stream,d.connect(p),p.connect(h),(!u||c.sampleRate!==t)&&(c.sampleRate!==t&&console.warn(`[ConversationalAI] Sample rate ${t} not available, resampling to ${c.sampleRate}`),await K(c,i)),await Ae(c.audioWorklet,r==null?void 0:r.audioConcatProcessor);let m=new AudioWorkletNode(c,"audioConcatProcessor");return m.port.postMessage({type:"setFormat",format:e,sampleRate:t}),m.connect(d),await c.resume(),it({sampleRate:t,format:e,worklet:m,audioElement:l}),o&&l.setSinkId&&await l.setSinkId(o),new n(c,p,d,m,l)}catch(u){throw l!=null&&l.parentNode&&l.parentNode.removeChild(l),l==null||l.pause(),c&&c.state!=="closed"&&await c.close(),u}}getAnalyser(){return this.analyser}getVolume(){return this.volumeProvider.getVolume()}getByteFrequencyData(t){this.volumeProvider.getByteFrequencyData(t)}addListener(t){this.worklet.port.addEventListener("message",t)}removeListener(t){this.worklet.port.removeEventListener("message",t)}setVolume(t){this.volume=t,this.gain.gain.value=t}playAudio(t){this.gain.gain.cancelScheduledValues(this.context.currentTime),this.gain.gain.value=this.volume,this.interruptTimeout&&(clearTimeout(this.interruptTimeout),this.interruptTimeout=null),this.worklet.port.postMessage({type:"clearInterrupted"}),this.worklet.port.postMessage({type:"buffer",buffer:t})}interrupt(t=2e3){this.interrupted=!0,this.interruptTimeout&&(clearTimeout(this.interruptTimeout),this.interruptTimeout=null),this.worklet.port.postMessage({type:"interrupt"}),this.gain.gain.exponentialRampToValueAtTime(1e-4,this.context.currentTime+t/1e3),this.interruptTimeout=setTimeout(()=>{this.interrupted=!1,this.gain.gain.value=this.volume,this.worklet.port.postMessage({type:"clearInterrupted"}),this.interruptTimeout=null},t)}async setDevice(t){if(!("setSinkId"in HTMLAudioElement.prototype))throw new Error("setSinkId is not supported in this browser");let e=t==null?void 0:t.outputDeviceId;await this.audioElement.setSinkId(e||"")}async close(){this.interruptTimeout&&(clearTimeout(this.interruptTimeout),this.interruptTimeout=null),this.audioElement.parentNode&&this.audioElement.parentNode.removeChild(this.audioElement),this.audioElement.pause(),await this.context.close()}};var X=N("rawAudioProcessor",`/*
 * ulaw encoding logic taken from the wavefile library
 * https://github.com/rochars/wavefile/blob/master/lib/codecs/mulaw.js
 * USED BY @elevenlabs/client
 */

const BIAS = 0x84;
const CLIP = 32635;
const encodeTable = [
  0,0,1,1,2,2,2,2,3,3,3,3,3,3,3,3,
  4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
  5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
  5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7
];

function encodeSample(sample) {
  let sign;
  let exponent;
  let mantissa;
  let muLawSample;
  sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  sample = sample + BIAS;
  if (sample > CLIP) sample = CLIP;
  exponent = encodeTable[(sample>>7) & 0xFF];
  mantissa = (sample >> (exponent+3)) & 0x0F;
  muLawSample = ~(sign | (exponent << 4) | mantissa);
  
  return muLawSample;
}

class RawAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
              
    this.port.onmessage = ({ data }) => {
      switch (data.type) {
        case "setFormat":
          this.isMuted = false;
          this.buffer = []; // Initialize an empty buffer
          const chunkDurationMs = data.chunkDurationMs ?? 25;
          this.bufferSize = Math.max(
            1,
            Math.round((data.sampleRate * chunkDurationMs) / 1000)
          );
          this.format = data.format;

          if (globalThis.LibSampleRate && sampleRate !== data.sampleRate) {
            globalThis.LibSampleRate.create(1, sampleRate, data.sampleRate).then(resampler => {
              this.resampler = resampler;
            });
          }
          break;
        case "setMuted":
          this.isMuted = data.isMuted;
          break;
      }
    };
  }
  process(inputs) {
    if (!this.buffer) {
      return true;
    }
    
    const input = inputs[0]; // Get the first input node
    if (input.length > 0) {
      let channelData = input[0]; // Get the first channel's data

      // Resample the audio if necessary
      if (this.resampler) {
        channelData = this.resampler.full(channelData);
      }

      // Add channel data to the buffer
      this.buffer.push(...channelData);
      // Get max volume 
      let sum = 0.0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const maxVolume = Math.sqrt(sum / channelData.length);
      // Check if buffer size has reached or exceeded the threshold
      if (this.buffer.length >= this.bufferSize) {
        const float32Array = this.isMuted 
          ? new Float32Array(this.buffer.length)
          : new Float32Array(this.buffer);

        let encodedArray = this.format === "ulaw"
          ? new Uint8Array(float32Array.length)
          : new Int16Array(float32Array.length);

        // Iterate through the Float32Array and convert each sample to PCM16
        for (let i = 0; i < float32Array.length; i++) {
          // Clamp the value to the range [-1, 1]
          let sample = Math.max(-1, Math.min(1, float32Array[i]));

          // Scale the sample to the range [-32768, 32767]
          let value = sample < 0 ? sample * 32768 : sample * 32767;
          if (this.format === "ulaw") {
            value = encodeSample(Math.round(value));
          }

          encodedArray[i] = value;
        }

        // Send the buffered data to the main script
        this.port.postMessage([encodedArray, maxVolume]);

        // Clear the buffer after sending
        this.buffer = [];
      }
    }
    return true; // Continue processing
  }
}
registerProcessor("rawAudioProcessor", RawAudioProcessor);
`);var ke={echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0,channelCount:{ideal:1}},Z=class n{constructor(t,e,o,r,i,s,c=console.error){a(this,"context");a(this,"analyser");a(this,"worklet");a(this,"inputStream");a(this,"mediaStreamSource");a(this,"permissions");a(this,"onError");a(this,"muted",!1);a(this,"volumeProvider");a(this,"settingInput",!1);a(this,"handlePermissionsChange",()=>{var t;if(this.permissions.state==="denied")this.onError("Microphone permission denied");else if(!this.settingInput){let[e]=this.inputStream.getAudioTracks(),{deviceId:o}=(t=e==null?void 0:e.getSettings())!=null?t:{};this.setDevice({inputDeviceId:o}).catch(r=>{this.onError("Failed to reset input device after permission change:",r)})}});this.context=t,this.analyser=e,this.worklet=o,this.inputStream=r,this.mediaStreamSource=i,this.permissions=s,this.onError=c,this.permissions.addEventListener("change",this.handlePermissionsChange),this.worklet.port.start(),this.volumeProvider=k(e,t.sampleRate)}static async create({sampleRate:t,format:e,preferHeadphonesForIosDevices:o,inputDeviceId:r,workletPaths:i,libsampleratePath:s,onError:c,inputChunkDurationMs:l=25}){let u=null,p=null;try{let d={sampleRate:{ideal:t},...ke};if(b()&&o){let W=(await window.navigator.mediaDevices.enumerateDevices()).find(A=>A.kind==="audioinput"&&["airpod","headphone","earphone"].find(x=>A.label.toLowerCase().includes(x)));W&&(d.deviceId={ideal:W.deviceId})}r&&(d.deviceId=n.getDeviceIdConstraint(r));let h=navigator.mediaDevices.getSupportedConstraints().sampleRate;u=new window.AudioContext(h?{sampleRate:t}:{});let m=u.createAnalyser();h||await K(u,s),await X(u.audioWorklet,i==null?void 0:i.rawAudioProcessor);let g={voiceIsolation:!0,...d};p=await navigator.mediaDevices.getUserMedia({audio:g});let v=u.createMediaStreamSource(p),_=new AudioWorkletNode(u,"rawAudioProcessor");_.port.postMessage({type:"setFormat",format:e,sampleRate:t,chunkDurationMs:l}),v.connect(m),m.connect(_),await u.resume();let f=await navigator.permissions.query({name:"microphone"});return new n(u,m,_,p,v,f,c)}catch(d){throw p==null||p.getTracks().forEach(h=>{h.stop()}),u==null||u.close(),d}}static getDeviceIdConstraint(t){if(t)return b()?{ideal:t}:{exact:t}}getAnalyser(){return this.analyser}getVolume(){return this.muted?0:this.volumeProvider.getVolume()}getByteFrequencyData(t){if(this.muted){t.fill(0);return}this.volumeProvider.getByteFrequencyData(t)}isMuted(){return this.muted}addListener(t){this.worklet.port.addEventListener("message",t)}removeListener(t){this.worklet.port.removeEventListener("message",t)}forgetInputStreamAndSource(){for(let t of this.inputStream.getTracks())t.stop();this.mediaStreamSource.disconnect()}async close(){this.forgetInputStreamAndSource(),this.permissions.removeEventListener("change",this.handlePermissionsChange),await this.context.close()}async setMuted(t){this.muted=t,this.worklet.port.postMessage({type:"setMuted",isMuted:t})}async setDevice(t){try{if(this.settingInput)throw new Error("Input device is already being set");this.settingInput=!0;let e=t==null?void 0:t.inputDeviceId,o={...ke};e&&(o.deviceId=n.getDeviceIdConstraint(e));let r={voiceIsolation:!0,...o},i=await navigator.mediaDevices.getUserMedia({audio:r});this.forgetInputStreamAndSource(),this.inputStream=i,this.mediaStreamSource=this.context.createMediaStreamSource(i),this.mediaStreamSource.connect(this.analyser)}catch(e){throw this.onError("Failed to switch input device:",e),e}finally{this.settingInput=!1}}};var st="enclave_setup_config";function Me(n){return{url:n.url,...n.hmacSecret!==void 0?{hmac_secret:n.hmacSecret}:{}}}function Re(n){var e,o,r,i;let t={type:st,agent_config_dict:(e=n.agentConfig)!=null?e:null,override_agent_config_list:(o=n.agentConfigOverrides)!=null?o:null,tools_config_list:(r=n.tools)!=null?r:null,prompt_knowledge_base:(i=n.promptKnowledgeBase)!=null?i:null};return n.bedrockInferenceProfile!==void 0&&(t.bedrock_inference_profile=n.bedrockInferenceProfile),n.postCallTranscriptionWebhook&&(t.post_call_transcription_webhook=Me(n.postCallTranscriptionWebhook)),n.postCallAudioWebhook&&(t.post_call_audio_webhook=Me(n.postCallAudioWebhook)),t}var at="convai",ct="wss://api.elevenlabs.io",lt="/v1/convai/conversation?agent_id=",I=class n extends P{constructor(e,o,r,i){super();a(this,"socket");a(this,"conversationId");a(this,"inputFormat");a(this,"outputFormat");a(this,"outputListeners",new Set);a(this,"pendingAudioEvents",[]);this.socket=e,this.conversationId=o,this.inputFormat=r,this.outputFormat=i,this.socket.addEventListener("error",s=>{setTimeout(()=>this.disconnect({reason:"error",message:"The connection was closed due to a socket error.",context:{type:s.type}}),0)}),this.socket.addEventListener("close",s=>{let c=s.code,l=s.reason||void 0,u={type:s.type,code:c,reason:l};this.disconnect(c===1e3?{reason:"agent",context:u,closeCode:c,closeReason:l}:{reason:"error",message:l||"The connection was closed by the server.",context:u,closeCode:c,closeReason:l})}),this.socket.addEventListener("message",s=>{try{let c=JSON.parse(s.data);if(!F(c)){this.debug({type:"invalid_event",message:"Received invalid socket event",data:s.data});return}this.handleMessage(c)}catch(c){this.debug({type:"parsing_error",message:"Failed to parse socket message",error:c instanceof Error?c.message:String(c),data:s.data})}})}static async create(e){var r;let o=null;try{let i,s,{name:c,version:l}=T;if(e.orchestrator)i=e.orchestrator.url;else{let v=(r=e.origin)!=null?r:ct;if(e.signedUrl){let _=e.signedUrl.includes("?")?"&":"?";i=`${e.signedUrl}${_}source=${c}&version=${l}`}else i=`${v}${lt}${e.agentId}&source=${c}&version=${l}`;e.environment&&(i+=`&environment=${encodeURIComponent(e.environment)}`),s=[at],e.authorization&&s.push(`bearer.${e.authorization}`)}o=new WebSocket(i,s);let u=await new Promise((v,_)=>{o.addEventListener("open",()=>{e.orchestrator&&(o==null||o.send(JSON.stringify(Re(e.orchestrator))));let f=z(e);o==null||o.send(JSON.stringify(f))},{once:!0}),o.addEventListener("error",f=>{setTimeout(()=>_(new O("The connection was closed due to a socket error.")),0)}),o.addEventListener("close",f=>{let y=f.reason||(f.code===1e3?"Connection closed normally before session could be established.":"Connection closed unexpectedly before session could be established.");_(new O(y,{closeCode:f.code,closeReason:f.reason||void 0}))}),o.addEventListener("message",f=>{let y=JSON.parse(f.data);F(y)&&(y.type==="conversation_initiation_metadata"?v(y.conversation_initiation_metadata_event):console.warn("First received message is not conversation metadata."))},{once:!0})}),{conversation_id:p,agent_output_audio_format:d,user_input_audio_format:h}=u,m=D(h!=null?h:"pcm_16000"),g=D(d);return new n(o,p,m,g)}catch(i){throw o==null||o.close(),i}}close(){this.pendingAudioEvents=[],this.socket.close(1e3,"User ended conversation")}sendMessage(e){this.handleOutgoingMessage(e),this.socket.send(JSON.stringify(e))}addListener(e){let o=this.outputListeners.size>0;if(this.outputListeners.add(e),o||this.pendingAudioEvents.length===0)return;let r=this.pendingAudioEvents;this.pendingAudioEvents=[];for(let i of r)e(i)}removeListener(e){this.outputListeners.delete(e)}handleMessage(e){if(super.handleMessage(e),e.type==="audio"&&e.audio_event.audio_base_64){let o={audio_base_64:e.audio_event.audio_base_64};if(this.outputListeners.size===0){this.pendingAudioEvents.push(o);return}this.outputListeners.forEach(r=>r(o))}}};function xe(n,t){let e=o=>{let r=o.data[0];t.sendMessage({user_audio_chunk:U(r.buffer)})};return n.addListener(e),()=>{n.removeListener(e)}}function Pe(n,t){let e=o=>{t.playAudio(ve(o.audio_base_64))};return n.addListener(e),()=>{n.removeListener(e)}}function ut(n){let t="signedUrl"in n&&n.signedUrl,e="orchestrator"in n&&n.orchestrator;if(t&&n.connectionType==="webrtc")throw new Error("signedUrl only supports websocket connections. Remove connectionType or set it to 'websocket'.");if(e&&n.connectionType==="webrtc")throw new Error("Orchestrator sessions only support websocket connections. Remove connectionType or set it to 'websocket'.");if(e&&(t||"conversationToken"in n&&n.conversationToken||n.authorization))throw new Error("The orchestrator option cannot be combined with signedUrl, conversationToken or authorization.");return n.connectionType?n.connectionType:"conversationToken"in n&&n.conversationToken?"webrtc":t||e||n.textOnly?"websocket":"webrtc"}async function $(n){let t=ut(n);switch(t){case"websocket":return I.create(n);case"webrtc":return E.create(n);default:throw new Error(`Unknown connection type: ${t}`)}}var dt={default:0,android:3e3};function ee(n,t="default"){var o,r;let e=n!=null?n:dt;return t==="android"?(o=e.android)!=null?o:e.default:t==="ios"&&(r=e.ios)!=null?r:e.default}async function te(n){n>0&&await new Promise(t=>setTimeout(t,n))}var pt=3e4,ht=["touchstart","touchend","click"],R=null,M=null,De=!1;function mt(n){let t=n.createBuffer(1,1,22050),e=n.createBufferSource();e.buffer=t,e.connect(n.destination),e.start(0),n.resume().catch(()=>{})}function ft(){M&&clearTimeout(M),M=setTimeout(()=>{M=null,oe()},pt)}function Le(){M&&(clearTimeout(M),M=null)}function gt(){if(!b()||R)return;let n=new AudioContext;mt(n),R=n,ft()}function Oe(){if(!b()||De||typeof document=="undefined")return;De=!0;let n=()=>{gt()};for(let t of ht)document.addEventListener(t,n,!0)}function Fe(){let n=R;return R=null,Le(),n}function oe(){R&&(R.close().catch(()=>{}),R=null,Le())}function _t(){return Ee()?"android":b()?"ios":"default"}async function Ue(){if("wakeLock"in navigator)try{return await navigator.wakeLock.request("screen")}catch{}return null}async function vt(n,t,e){let[o,r]=await Promise.all([Z.create({...t.inputFormat,preferHeadphonesForIosDevices:n.preferHeadphonesForIosDevices,inputDeviceId:n.inputDeviceId,inputChunkDurationMs:n.inputChunkDurationMs,workletPaths:n.workletPaths,libsampleratePath:n.libsampleratePath}),Q.create({...t.outputFormat,outputDeviceId:n.outputDeviceId,workletPaths:n.workletPaths,libsampleratePath:n.libsampleratePath,audioContext:e!=null?e:void 0})]),i=xe(o,t),s=Pe(t,r);return{input:o,output:r,playbackEventTarget:r,detach:async()=>{i(),s()}}}async function yt(n){var i;let t=(i=n.useWakeLock)!=null?i:!0,e=null,o=null,r=null;try{t&&(e=await Ue()),o=await navigator.mediaDevices.getUserMedia({audio:!0});let s=_t();await te(ee(n.connectionDelay,s));let c=await $(n),l;try{c instanceof I?(r=Fe(),l={connection:c,...await vt(n,c,r)},r=null):(oe(),l=we(c))}catch(d){throw await(r==null?void 0:r.close().catch(()=>{})),r=null,c.close(),d}if(o){for(let d of o.getTracks())d.stop();o=null}let u=null;e&&(u=()=>{document.visibilityState==="visible"&&(e!=null&&e.released)&&Ue().then(d=>{e=d})},document.addEventListener("visibilitychange",u));let p=l.detach;return{...l,detach:async()=>{await p(),u&&document.removeEventListener("visibilitychange",u);try{await(e==null?void 0:e.release()),e=null}catch{}}}}catch(s){if(o)for(let c of o.getTracks())c.stop();try{await(e==null?void 0:e.release()),e=null}catch{}throw oe(),s}}Ce(yt);var ne=class{constructor(){a(this,"audioElements",[]);a(this,"inputAudioContext",null);a(this,"audioCaptureContext",null)}async attachRemoteTrack(t,e){let o=t.attach();if(o.autoplay=!0,o.controls=!1,e&&o.setSinkId)try{await o.setSinkId(e)}catch(r){console.warn("Failed to set output device for new audio element:",r)}o.style.display="none",document.body.appendChild(o),this.audioElements.push(o)}setupInputAnalysis(t){this.inputAudioContext&&(this.inputAudioContext.close().catch(()=>{}),this.inputAudioContext=null);let e=new AudioContext,o=e.createAnalyser();return e.createMediaStreamSource(new MediaStream([t])).connect(o),this.inputAudioContext=e,{volumeProvider:k(o,e.sampleRate),analyser:o}}async setupOutputAnalysis(t,e,o,r){this.audioCaptureContext&&(this.audioCaptureContext.close().catch(()=>{}),this.audioCaptureContext=null);let i=new AudioContext;this.audioCaptureContext=i;let s=i.createAnalyser();s.fftSize=2048,s.smoothingTimeConstant=.8;let c=new MediaStream([t.mediaStreamTrack]),l=i.createMediaStreamSource(c),u=k(s,i.sampleRate);await X(i.audioWorklet,r==null?void 0:r.rawAudioProcessor);let p=new AudioWorkletNode(i,"rawAudioProcessor");return p.port.postMessage({type:"setFormat",format:e.format,sampleRate:e.sampleRate}),p.port.onmessage=d=>{let[h,m]=d.data;o(h.buffer,m)},l.connect(s),s.connect(p),{volumeProvider:u,analyser:s}}setVolume(t){for(let e of this.audioElements)e.volume=t}async setOutputDevice(t){if(!("setSinkId"in HTMLAudioElement.prototype))throw new Error("setSinkId is not supported in this browser");await Promise.all(this.audioElements.map(async e=>{try{await e.setSinkId(t)}catch(o){throw console.error("Failed to set sink ID for audio element:",o),o}}))}cleanup(){this.inputAudioContext&&(this.inputAudioContext.close().catch(t=>{console.warn("Error closing input audio context:",t)}),this.inputAudioContext=null),this.audioCaptureContext&&(this.audioCaptureContext.close().catch(t=>{console.warn("Error closing audio capture context:",t)}),this.audioCaptureContext=null);for(let t of this.audioElements)t.remove();this.audioElements=[]}};var St=null;function Ne(n){St=n}var Ve=N("scribeAudioProcessor",`/*
 * Scribe Audio Processor for converting microphone audio to PCM16 format
 * Supports resampling for browsers like Firefox that don't support
 * AudioContext sample rate constraints.
 * USED BY @elevenlabs/client
 */

class ScribeAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 4096; // Buffer size for optimal chunk transmission

    // Resampling state
    this.inputSampleRate = null;
    this.outputSampleRate = null;
    this.resampleRatio = 1;
    this.lastSample = 0;
    this.resampleAccumulator = 0;

    this.port.onmessage = ({ data }) => {
      if (data.type === "configure") {
        this.inputSampleRate = data.inputSampleRate;
        this.outputSampleRate = data.outputSampleRate;
        if (this.inputSampleRate && this.outputSampleRate) {
          this.resampleRatio = this.inputSampleRate / this.outputSampleRate;
        }
      }
    };
  }

  // Linear interpolation resampling
  resample(inputData) {
    if (this.resampleRatio === 1 || !this.inputSampleRate) {
      return inputData;
    }

    const outputSamples = [];

    for (let i = 0; i < inputData.length; i++) {
      const currentSample = inputData[i];

      // Generate output samples using linear interpolation
      while (this.resampleAccumulator < 1) {
        const interpolated =
          this.lastSample +
          (currentSample - this.lastSample) * this.resampleAccumulator;
        outputSamples.push(interpolated);
        this.resampleAccumulator += this.resampleRatio;
      }

      this.resampleAccumulator -= 1;
      this.lastSample = currentSample;
    }

    return new Float32Array(outputSamples);
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      let channelData = input[0]; // Get first channel (mono)

      // Resample if needed (for Firefox and other browsers that don't
      // support AudioContext sample rate constraints)
      if (this.resampleRatio !== 1) {
        channelData = this.resample(channelData);
      }

      // Add incoming audio to buffer
      for (let i = 0; i < channelData.length; i++) {
        this.buffer.push(channelData[i]);
      }

      // When buffer reaches threshold, convert and send
      if (this.buffer.length >= this.bufferSize) {
        const float32Array = new Float32Array(this.buffer);
        const int16Array = new Int16Array(float32Array.length);

        // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
        for (let i = 0; i < float32Array.length; i++) {
          // Clamp the value to prevent overflow
          const sample = Math.max(-1, Math.min(1, float32Array[i]));
          // Scale to PCM16 range
          int16Array[i] = sample < 0 ? sample * 32768 : sample * 32767;
        }

        // Send to main thread as transferable ArrayBuffer
        this.port.postMessage(
          {
            audioData: int16Array.buffer
          },
          [int16Array.buffer]
        );

        // Clear buffer
        this.buffer = [];
      }
    }

    return true; // Continue processing
  }
}

registerProcessor("scribeAudioProcessor", ScribeAudioProcessor);

`);var de=16e3,We=async(n,t)=>{var c,l,u,p,d;let e,o,r,i,s=()=>{var h;for(let m of(h=e==null?void 0:e.getTracks())!=null?h:[])m.stop();r==null||r.disconnect(),i==null||i.disconnect(),o==null||o.close()};try{e=await navigator.mediaDevices.getUserMedia({audio:{deviceId:n.deviceId,echoCancellation:(c=n.echoCancellation)!=null?c:!0,noiseSuppression:(l=n.noiseSuppression)!=null?l:!0,autoGainControl:(u=n.autoGainControl)!=null?u:!0,channelCount:(p=n.channelCount)!=null?p:1,sampleRate:{ideal:de}}});let[h]=e.getAudioTracks(),m=h==null?void 0:h.getSettings().sampleRate;return o=new AudioContext(m?{sampleRate:m}:{}),await Ve(o.audioWorklet,(d=n.workletPaths)==null?void 0:d.scribeAudioProcessor),r=o.createMediaStreamSource(e),i=new AudioWorkletNode(o,"scribeAudioProcessor"),o.sampleRate!==de&&i.port.postMessage({type:"configure",inputSampleRate:o.sampleRate,outputSampleRate:de}),i.port.onmessage=g=>{t(U(g.data.audioData))},r.connect(i),o.state==="suspended"&&await o.resume(),{mediaStreamTrack:h,cleanup:s}}catch(h){throw s(),h}};var Ct="https://api.elevenlabs.io";async function Be({conversationId:n,origin:t,file:e,filename:o}){var p;let r=(t!=null?t:Ct).replace(/^wss:\/\//,"https://").replace(/^ws:\/\//,"http://"),i=o!=null?o:"name"in e&&typeof e.name=="string"?e.name:`upload.${(p=(e.type||"image/png").split("/").pop())==null?void 0:p.split("+")[0]}`,s=new FormData;s.append("file",e,i);let c=await fetch(`${r}/v1/convai/conversations/${n}/files`,{method:"POST",body:s});if(!c.ok){let d=await j(c);throw new Error(`Upload failed: ${c.status} ${d}`)}let l=await c.json();he(l,"Upload response is not a JSON object");let{file_id:u}=l;if(typeof u!="string"||!u)throw new Error("Upload response is missing a valid file_id");return{fileId:u}}function $e(n,t,e={}){var u,p;let o=(u=e.leading)!=null?u:!0,r=(p=e.trailing)!=null?p:!1,i,s,c=()=>{i!==void 0&&(clearTimeout(i),i=void 0)},l=(...d)=>{i===void 0&&o?n(...d):r&&(s=d),c(),i=setTimeout(()=>{if(i=void 0,r&&s!==void 0){let m=s;s=void 0,n(...m)}},t)};return l.cancel=()=>{c(),s=void 0},l}var qe={reason:"agent",context:{type:"end_call",reason:"Agent ended the call"}},bt=1e3;function pe(n){var o,r;let{textOnly:t}=(r=(o=n.overrides)==null?void 0:o.conversation)!=null?r:{},{textOnly:e}=n;return typeof e=="boolean"?(typeof t=="boolean"&&e!==t&&console.warn(`Conflicting textOnly options provided: ${e} via options.textOnly (will be used) and ${t} via options.overrides.conversation.textOnly (will be ignored)`),e):typeof t=="boolean"?t:void 0}var w=class{constructor(t,e){a(this,"options");a(this,"connection");a(this,"lastInterruptTimestamp",0);a(this,"mode","listening");a(this,"status","connecting");a(this,"volume",1);a(this,"currentEventId",1);a(this,"canSendFeedback",!1);a(this,"mcpApprovals",new Map);a(this,"throttledUserActivity",$e(()=>{this.connection.sendMessage({type:"user_activity"})},bt));a(this,"endSessionWithDetails",async t=>{if(!(this.status!=="connected"&&this.status!=="connecting")){this.updateStatus("disconnecting");for(let e of this.mcpApprovals.keys())this.markMCPApprovalStale(e);try{await this.handleEndSession()}finally{this.updateStatus("disconnected"),this.options.onDisconnect&&this.options.onDisconnect(t)}}});a(this,"onMessage",async t=>{var e,o;switch((o=(e=this.options).onIncomingEvent)==null||o.call(e,t),t.type){case"interruption":{this.handleInterruption(t);return}case"agent_response":{this.handleAgentResponse(t);return}case"agent_response_correction":{this.handleAgentResponseCorrection(t);return}case"user_transcript":{this.handleUserTranscript(t);return}case"internal_tentative_agent_response":{this.handleTentativeAgentResponse(t);return}case"client_tool_call":{try{await this.handleClientToolCall(t)}catch(r){this.onError(`Unexpected error in client tool call handling: ${r instanceof Error?r.message:String(r)}`,{clientToolName:t.client_tool_call.tool_name,toolCallId:t.client_tool_call.tool_call_id})}return}case"audio":{this.handleAudio(t);return}case"vad_score":{this.handleVadScore(t);return}case"ping":{this.connection.sendMessage({type:"pong",event_id:t.ping_event.event_id}),this.handlePing(t);return}case"context_usage":{this.handleContextUsage(t);return}case"mcp_tool_call":{try{await this.handleMCPToolCall(t)}catch(r){this.onError(`Unexpected error in MCP tool call handling: ${r instanceof Error?r.message:String(r)}`,{toolCallId:t.mcp_tool_call.tool_call_id,toolName:t.mcp_tool_call.tool_name})}return}case"mcp_connection_status":{this.handleMCPConnectionStatus(t);return}case"agent_tool_request":{this.handleAgentToolRequest(t);return}case"agent_tool_response":{this.handleAgentToolResponse(t);return}case"agent_tool_response_full_payload":{this.handleAgentToolResponseFullPayload(t);return}case"conversation_initiation_metadata":{this.handleConversationMetadata(t);return}case"asr_initiation_metadata":{this.handleAsrInitiationMetadata(t);return}case"agent_chat_response_part":{this.handleAgentChatResponsePart(t);return}case"agent_reasoning_response_part":{this.handleAgentReasoningResponsePart(t);return}case"rich_content":{this.handleRichContent(t);return}case"guardrail_triggered":{this.handleGuardrailTriggered(t);return}case"error":{this.handleErrorEvent(t);return}case"agent_typing":{this.handleAgentTyping(t);return}case"external_agent_connected":{this.handleExternalAgentConnected(t);return}case"external_agent_disconnected":{this.handleExternalAgentDisconnected(t);return}default:{this.options.onDebug&&this.options.onDebug(t);return}}});a(this,"onOutgoingMessage",t=>{var e,o;(o=(e=this.options).onOutgoingEvent)==null||o.call(e,t)});this.options=t,this.connection=e,this.connection.onMessage(this.onMessage),this.connection.onDisconnect(this.endSessionWithDetails),this.connection.onModeChange(o=>this.updateMode(o)),this.connection.onOutgoingMessage(this.onOutgoingMessage)}static getFullOptions(t){var o;let e=pe(t);return{clientTools:{},onConnect:()=>{},onDebug:()=>{},onDisconnect:()=>{},onError:()=>{},onMessage:()=>{},onAudio:()=>{},onModeChange:()=>{},onStatusChange:()=>{},onCanSendFeedbackChange:()=>{},onInterruption:()=>{},onAgentResponseCorrection:()=>{},onAgentTyping:()=>{},onExternalAgentConnected:()=>{},onExternalAgentDisconnected:()=>{},onPing:()=>{},...t,textOnly:e,overrides:{...t.overrides,conversation:{...(o=t.overrides)==null?void 0:o.conversation,textOnly:e}}}}markConnected(){this.updateStatus("connected")}endSession(){return this.endSessionWithDetails({reason:"user"})}async handleEndSession(){this.throttledUserActivity.cancel(),this.connection.close()}updateMode(t){t!==this.mode&&(this.mode=t,this.options.onModeChange&&this.options.onModeChange({mode:t}))}updateStatus(t){t!==this.status&&(this.status=t,this.options.onStatusChange&&this.options.onStatusChange({status:t}),this.updateCanSendFeedback())}updateCanSendFeedback(){let t=this.status==="connected";this.canSendFeedback!==t&&(this.canSendFeedback=t,this.options.onCanSendFeedbackChange&&this.options.onCanSendFeedbackChange({canSendFeedback:t}))}handleInterruption(t){t.interruption_event&&(this.lastInterruptTimestamp=t.interruption_event.event_id,this.options.onInterruption&&this.options.onInterruption({event_id:t.interruption_event.event_id}))}handleAgentResponse(t){this.currentEventId=t.agent_response_event.event_id,this.options.onMessage&&this.options.onMessage({source:"ai",role:"agent",message:t.agent_response_event.agent_response,event_id:t.agent_response_event.event_id,...t.agent_response_event.response_id?{response_id:t.agent_response_event.response_id}:{},attachments:t.agent_response_event.attachments})}handleAgentResponseCorrection(t){this.options.onAgentResponseCorrection&&this.options.onAgentResponseCorrection(t.agent_response_correction_event)}handleUserTranscript(t){this.options.onMessage&&this.options.onMessage({source:"user",role:"user",message:t.user_transcription_event.user_transcript,event_id:t.user_transcription_event.event_id})}handleTentativeAgentResponse(t){this.options.onDebug&&this.options.onDebug({type:"tentative_agent_response",response:t.tentative_agent_response_internal_event.tentative_agent_response})}handleVadScore(t){this.options.onVadScore&&this.options.onVadScore({vadScore:t.vad_score_event.vad_score})}handlePing(t){this.options.onPing&&this.options.onPing(t.ping_event)}handleContextUsage(t){this.options.onContextUsage&&this.options.onContextUsage(t.context_usage_event)}async handleClientToolCall(t){var e;if(Object.prototype.hasOwnProperty.call(this.options.clientTools,t.client_tool_call.tool_name))try{let o=(e=await this.options.clientTools[t.client_tool_call.tool_name](t.client_tool_call.parameters))!=null?e:"Client tool execution successful.",r=typeof o=="object"?JSON.stringify(o):String(o);this.connection.sendMessage({type:"client_tool_result",tool_call_id:t.client_tool_call.tool_call_id,result:r,is_error:!1})}catch(o){this.onError(`Client tool execution failed with following error: ${o==null?void 0:o.message}`,{clientToolName:t.client_tool_call.tool_name}),this.connection.sendMessage({type:"client_tool_result",tool_call_id:t.client_tool_call.tool_call_id,result:`Client tool execution failed: ${o==null?void 0:o.message}`,is_error:!0})}else{if(this.options.onUnhandledClientToolCall){this.options.onUnhandledClientToolCall(t.client_tool_call);return}this.onError(`Client tool with name ${t.client_tool_call.tool_name} is not defined on client`,{clientToolName:t.client_tool_call.tool_name}),this.connection.sendMessage({type:"client_tool_result",tool_call_id:t.client_tool_call.tool_call_id,result:`Client tool with name ${t.client_tool_call.tool_name} is not defined on client`,is_error:!0})}}handleAudio(t){}async handleMCPToolCall(t){let e=t.mcp_tool_call;if(this.options.onMCPToolCall&&this.options.onMCPToolCall(e),e.state!=="awaiting_approval"){this.markMCPApprovalStale(e.tool_call_id);return}let o=this.options.onMCPToolApprovalRequest;if(!o)return;if(this.status==="disconnecting"||this.status==="disconnected"){this.onError(`Ignored an approval request for MCP tool call ${e.tool_call_id}, which arrived after the session ended`,this.mcpApprovalErrorContext(e));return}if(this.mcpApprovals.has(e.tool_call_id)){this.onError(`Ignored a repeated approval request for MCP tool call ${e.tool_call_id}, which has already been handled`,this.mcpApprovalErrorContext(e));return}let r={state:"pending",controller:new AbortController};this.mcpApprovals.set(e.tool_call_id,r);let i;try{i=await o(e,{signal:r.controller.signal})}catch(s){this.onError(`MCP tool approval handler failed: ${s==null?void 0:s.message}`,this.mcpApprovalErrorContext(e)),this.settleMCPApproval(e,!1);return}if(typeof i!="boolean"){this.onError(`MCP tool approval handler must resolve to a boolean, received ${typeof i}`,this.mcpApprovalErrorContext(e)),this.settleMCPApproval(e,!1);return}this.settleMCPApproval(e,i)}settleMCPApproval(t,e){let o=this.mcpApprovals.get(t.tool_call_id);if(!o||o.state!=="pending"){this.onError(`Discarded an approval decision for MCP tool call ${t.tool_call_id}, which is no longer awaiting approval`,this.mcpApprovalErrorContext(t));return}o.state="settled",this.sendMCPToolApprovalResult(t.tool_call_id,e)}markMCPApprovalStale(t){let e=this.mcpApprovals.get(t);!e||e.state!=="pending"||(e.state="stale",e.controller.abort())}mcpApprovalErrorContext(t){return{toolCallId:t.tool_call_id,toolName:t.tool_name,serviceId:t.service_id}}handleMCPConnectionStatus(t){this.options.onMCPConnectionStatus&&this.options.onMCPConnectionStatus(t.mcp_connection_status)}handleAgentToolRequest(t){this.options.onAgentToolRequest&&this.options.onAgentToolRequest(t.agent_tool_request)}handleAgentToolResponse(t){var e,o;t.agent_tool_response.tool_name==="end_call"&&this.endSessionWithDetails(qe).catch(r=>{this.onError("Failed to end session after agent end_call",r)}),(o=(e=this.options).onAgentToolResponse)==null||o.call(e,t.agent_tool_response)}handleAgentToolResponseFullPayload(t){var e,o;t.agent_tool_response_full_payload.tool_name==="end_call"&&this.endSessionWithDetails(qe).catch(r=>{this.onError("Failed to end session after agent end_call",r)}),(o=(e=this.options).onAgentToolResponse)==null||o.call(e,t.agent_tool_response_full_payload)}handleConversationMetadata(t){this.options.onConversationMetadata&&this.options.onConversationMetadata(t.conversation_initiation_metadata_event)}handleAsrInitiationMetadata(t){this.options.onAsrInitiationMetadata&&this.options.onAsrInitiationMetadata(t.asr_initiation_metadata_event)}handleAgentChatResponsePart(t){this.options.onAgentChatResponsePart&&this.options.onAgentChatResponsePart(t.text_response_part)}handleAgentReasoningResponsePart(t){this.options.onAgentReasoningResponsePart&&this.options.onAgentReasoningResponsePart(t.reasoning_response_part)}handleRichContent(t){this.options.onRichContent&&this.options.onRichContent(t.rich_content)}handleGuardrailTriggered(t){this.options.onGuardrailTriggered&&this.options.onGuardrailTriggered()}handleAgentTyping(t){this.options.onAgentTyping&&this.options.onAgentTyping(t.agent_typing_event)}handleExternalAgentConnected(t){this.options.onExternalAgentConnected&&this.options.onExternalAgentConnected()}handleExternalAgentDisconnected(t){this.options.onExternalAgentDisconnected&&this.options.onExternalAgentDisconnected()}handleErrorEvent(t){let e=t.error_event,o=e==null?void 0:e.error_type,r=(e==null?void 0:e.message)||(e==null?void 0:e.reason)||"Unknown error";if(o==="max_duration_exceeded"){this.endSessionWithDetails({reason:"error",message:r,context:{type:"max_duration_exceeded"}}).catch(i=>{this.onError("Failed to end session after max_duration_exceeded",i)});return}this.onError(`Server error: ${r}`,{errorType:o,code:e==null?void 0:e.code,debugMessage:e==null?void 0:e.debug_message,details:e==null?void 0:e.details})}onError(t,e){console.error(t,e),this.options.onError&&this.options.onError(t,e)}getId(){return this.connection.conversationId}isOpen(){return this.status==="connected"}sendFeedback(t,e){if(!this.canSendFeedback){console.warn("Cannot send feedback: the conversation is not connected.");return}this.connection.sendMessage({type:"feedback",score:t!==null?t?"like":"dislike":null,event_id:e!=null?e:this.currentEventId})}sendContextualUpdate(t,e){this.connection.sendMessage({type:"contextual_update",text:t,...e!=null&&e.contextId?{context_id:e.contextId}:{}})}sendUserMessage(t,e){var o;this.connection.sendMessage({type:"user_message",text:t,rich_content_id:(o=e==null?void 0:e.richContentId)!=null?o:void 0})}sendUserActivity(){this.throttledUserActivity()}sendMCPToolApprovalResult(t,e){this.connection.sendMessage({type:"mcp_tool_approval_result",tool_call_id:t,is_approved:e})}sendMultimodalMessage(t){var r;let o=((r=t.fileIds)!=null&&r.length?t.fileIds:t.fileId?[t.fileId]:[]).map(i=>({type:"file_input",file_id:i}));this.connection.sendMessage({type:"multimodal_message",text:t.text?{type:"user_message",text:t.text}:void 0,file:o[0],files:o.length?o:void 0})}async uploadFile(t){if(this.options.orchestrator)throw new Error("uploadFile is not supported for self-hosted orchestrator sessions.");return Be({conversationId:this.connection.conversationId,origin:this.options.origin,file:t})}};function He(){let n=["fetch","WebSocket","TextEncoder","TextDecoder","URL","btoa","atob"];for(let t of n)if(typeof globalThis[t]=="undefined")throw new Error(`${t} is not available in this environment.`)}var je=new Uint8Array(0),q=class n extends w{constructor(){super(...arguments);a(this,"type","text")}setVolume(){throw new Error("setVolume is not supported in text conversations")}setMicMuted(){throw new Error("setMicMuted is not supported in text conversations")}getInputByteFrequencyData(){return je}getOutputByteFrequencyData(){return je}getInputVolume(){return 0}getOutputVolume(){return 0}static async startSession(e){var s,c,l;let o=w.getFullOptions(e);o.onStatusChange&&o.onStatusChange({status:"connecting"}),o.onCanSendFeedbackChange&&o.onCanSendFeedbackChange({canSendFeedback:!1}),o.onModeChange&&o.onModeChange({mode:"listening"}),o.onCanSendFeedbackChange&&o.onCanSendFeedbackChange({canSendFeedback:!1});let r=null,i=null;try{return await te(ee(o.connectionDelay)),r=await $(o),i=new n(o,r),(s=o.onConversationCreated)==null||s.call(o,i),i.markConnected(),(c=o.onConnect)==null||c.call(o,{conversationId:r.conversationId}),i}catch(u){throw i?await i.endSession().catch(()=>{}):((l=o.onStatusChange)==null||l.call(o,{status:"disconnected"}),r==null||r.close()),u}}};var V=class V extends w{constructor(e,o,r,i,s,c){super(e,o);a(this,"input");a(this,"output");a(this,"playbackEventTarget");a(this,"cleanUp");a(this,"type","voice");a(this,"inputFrequencyData");a(this,"outputFrequencyData");a(this,"handlePlaybackEvent",e=>{e.data.type==="process"&&this.updateMode(e.data.finished?"listening":"speaking")});a(this,"setVolume",({volume:e})=>{let o=Number.isFinite(e)?Math.min(1,Math.max(0,e)):1;this.volume=o,this.output.setVolume(o)});this.input=r,this.output=i,this.playbackEventTarget=s,this.cleanUp=c,s==null||s.addListener(this.handlePlaybackEvent)}static async startSession(e){var s,c,l;let o=w.getFullOptions(e);o.onStatusChange&&o.onStatusChange({status:"connecting"}),o.onCanSendFeedbackChange&&o.onCanSendFeedbackChange({canSendFeedback:!1});let r=null,i=null;try{return i=await be()(o),r=new V(o,i.connection,i.input,i.output,i.playbackEventTarget,i.detach),(s=o.onConversationCreated)==null||s.call(o,r),r.markConnected(),(c=o.onConnect)==null||c.call(o,{conversationId:i.connection.conversationId}),r}catch(u){throw r?await r.endSession().catch(()=>{}):(i&&await i.detach().catch(()=>{}),(l=o.onStatusChange)==null||l.call(o,{status:"disconnected"})),u}}async handleEndSession(){var e;(e=this.playbackEventTarget)==null||e.removeListener(this.handlePlaybackEvent),this.playbackEventTarget=null,await this.cleanUp(),await super.handleEndSession(),await this.input.close(),await this.output.close()}handleInterruption(e){super.handleInterruption(e),this.updateMode("listening"),this.output.interrupt()}handleAudio(e){var o,r;super.handleAudio(e),e.audio_event.alignment&&this.options.onAudioAlignment&&this.options.onAudioAlignment(e.audio_event.alignment),this.lastInterruptTimestamp<=e.audio_event.event_id&&(e.audio_event.audio_base_64&&((r=(o=this.options).onAudio)==null||r.call(o,e.audio_event.audio_base_64)),this.currentEventId=e.audio_event.event_id,this.updateCanSendFeedback(),this.updateMode("speaking"))}setMicMuted(e){this.input.setMuted(e).catch(o=>{var r,i;(i=(r=this.options).onError)==null||i.call(r,"Failed to set input muted state",o)})}getInputByteFrequencyData(){var e;return(e=this.inputFrequencyData)!=null||(this.inputFrequencyData=new Uint8Array(V.FREQUENCY_BIN_COUNT)),this.input.getByteFrequencyData(this.inputFrequencyData),this.inputFrequencyData}getOutputByteFrequencyData(){var e;return(e=this.outputFrequencyData)!=null||(this.outputFrequencyData=new Uint8Array(V.FREQUENCY_BIN_COUNT)),this.output.getByteFrequencyData(this.outputFrequencyData),this.outputFrequencyData}getInputVolume(){return this.input.getVolume()}getOutputVolume(){return this.output.getVolume()}async changeInputDevice({sampleRate:e,format:o,preferHeadphonesForIosDevices:r,inputDeviceId:i}){try{await this.input.setDevice({inputDeviceId:i,sampleRate:e,format:o,preferHeadphonesForIosDevices:r})}catch(s){throw console.error("Error changing input device",s),s}}async changeOutputDevice({sampleRate:e,format:o,outputDeviceId:r}){try{await this.output.setDevice({outputDeviceId:r,sampleRate:e,format:o})}catch(i){throw console.error("Error changing output device",i),i}}};a(V,"FREQUENCY_BIN_COUNT",1024);var H=V;var re;(function(n){n.SESSION_STARTED="session_started",n.PARTIAL_TRANSCRIPT="partial_transcript",n.FINAL_TRANSCRIPT="final_transcript",n.FINAL_TRANSCRIPT_WITH_TIMESTAMPS="final_transcript_with_timestamps",n.COMMITTED_TRANSCRIPT="committed_transcript",n.COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS="committed_transcript_with_timestamps",n.COMMITTED_TRANSCRIPT_ENTITIES="committed_transcript_entities",n.EDITED_TRANSCRIPT="edited_transcript",n.AUTH_ERROR="auth_error",n.ERROR="error",n.OPEN="open",n.CLOSE="close",n.QUOTA_EXCEEDED="quota_exceeded",n.COMMIT_THROTTLED="commit_throttled",n.TRANSCRIBER_ERROR="transcriber_error",n.UNACCEPTED_TERMS="unaccepted_terms",n.RATE_LIMITED="rate_limited",n.INPUT_ERROR="input_error",n.INVALID_REQUEST="invalid_request",n.QUEUE_OVERFLOW="queue_overflow",n.RESOURCE_EXHAUSTED="resource_exhausted",n.SESSION_TIME_LIMIT_EXCEEDED="session_time_limit_exceeded",n.CHUNK_SIZE_EXCEEDED="chunk_size_exceeded",n.INSUFFICIENT_AUDIO_ACTIVITY="insufficient_audio_activity"})(re||(re={}));var ie;(function(n){n.PCM_8000="pcm_8000",n.PCM_16000="pcm_16000",n.PCM_22050="pcm_22050",n.PCM_24000="pcm_24000",n.PCM_44100="pcm_44100",n.PCM_48000="pcm_48000",n.ULAW_8000="ulaw_8000"})(ie||(ie={}));var se;(function(n){n.MANUAL="manual",n.VAD="vad"})(se||(se={}));var At={async startSession(n){return He(),pe(n)?q.startSession(n):H.startSession(n)}};Oe();ye(()=>new ne);Ne(We);export{At as Conversation};

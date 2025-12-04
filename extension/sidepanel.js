// Simple Implementation for Chrome Extension Demo
// Uses standard Web Audio API & Fetch for non-streaming answer generation
// or setup WebSocket for streaming if needed.

let isRecording = false;
let mediaRecorder;
let chunks = [];

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const outputDiv = document.getElementById('output');
const injectBtn = document.getElementById('injectBtn');

// Helper to log
function log(msg, type = 'ai') {
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  div.textContent = msg;
  outputDiv.appendChild(div);
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

// Load Key
const apiKeyInput = document.getElementById('apiKey');
chrome.storage.local.get(['geminiKey'], (result) => {
  if (result.geminiKey) apiKeyInput.value = result.geminiKey;
});

document.getElementById('saveKey').addEventListener('click', () => {
  chrome.storage.local.set({ geminiKey: apiKeyInput.value }, () => {
    alert('Key Saved');
  });
});

// Capture Logic
startBtn.onclick = async () => {
  const key = apiKeyInput.value;
  if (!key) return alert("Please enter API Key");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];

    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    
    mediaRecorder.onstop = async () => {
      statusDiv.textContent = "Processing audio...";
      const blob = new Blob(chunks, { type: 'audio/webm' });
      await processAudio(blob, key);
    };

    mediaRecorder.start();
    isRecording = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    statusDiv.textContent = "Listening... (Speak now)";
  } catch (e) {
    console.error(e);
    statusDiv.textContent = "Error: " + e.message;
  }
};

stopBtn.onclick = () => {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    stopBtn.style.display = 'none';
    startBtn.style.display = 'block';
  }
};

async function processAudio(audioBlob, key) {
  // Convert blob to base64
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    const base64Audio = reader.result.split(',')[1];
    
    // Call Gemini API (Text-only for simplicity in extension, assume 2.5 flash supports audio)
    // Note: Chrome extensions can't easily use the Live API WebSocket directly without complex setup.
    // We will use standard generateContent with audio part.
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: "audio/webm", data: base64Audio } },
              { text: "Transcribe this audio and if it is a question, answer it briefly." }
            ]
          }]
        })
      });
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
      log(text, 'ai');
      statusDiv.textContent = "Ready";
      
      // Save last answer for injection
      chrome.storage.local.set({ lastAnswer: text });

    } catch (e) {
      log("Error: " + e.message, 'ai');
    }
  };
}

// Injection Logic
injectBtn.onclick = async () => {
  chrome.storage.local.get(['lastAnswer'], (result) => {
    if (!result.lastAnswer) return;
    
    // Inject into active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (text) => {
          const el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true')) {
             if (el.getAttribute('contenteditable') === 'true') {
                el.innerText += text;
             } else {
                el.value += text;
             }
             // Trigger input event
             el.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            alert("Click into a text box first!");
          }
        },
        args: [result.lastAnswer]
      });
    });
  });
};
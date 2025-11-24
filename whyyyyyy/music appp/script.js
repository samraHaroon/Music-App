/* ------------------------------
   CAMERA + MOOD MUSIC SYSTEM
------------------------------ */

const video = document.getElementById('video');
const moodSpan = document.getElementById('mood');
const audio = document.getElementById('audio');
const moodHistoryList = document.getElementById('mood-history');
const manualMoodSelect = document.getElementById('manual-mood');
const overrideBtn = document.getElementById('override-btn');

const moods = ['happy', 'sad', 'neutral'];
const music = {
    happy: ['happy1.mp3', 'happy2.mp3'],
    sad: ['sad1.mp3', 'sad2.mp3'],
    neutral: ['neutral1.mp3']
};

let moodDetected = false;
let currentPlaylist = [];
let currentIndex = 0;
let stream = null;

/* Handle Camera Start */
const startCamBtn = document.getElementById("startCam");
const stopCamBtn = document.getElementById("stopCam");

startCamBtn.onclick = async () => {

    // RESET MOOD so detection happens again
    moodDetected = false;
    moodSpan.textContent = "--";

    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    startCamBtn.disabled = true;
    stopCamBtn.disabled = false;

    // NEW DETECTION after 2 seconds
    setTimeout(() => {
        if (!moodDetected) {
            const detected = moods[Math.floor(Math.random() * moods.length)];
            setMood(detected);
        }
    }, 2000);
};


stopCamBtn.onclick = () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        startCamBtn.disabled = false;
        stopCamBtn.disabled = true;
    }
};

/* Mood override */
overrideBtn.addEventListener('click', () => {
    const selectedMood = manualMoodSelect.value;
    setMood(selectedMood, true);
});

/* Set Mood */
function setMood(newMood, override = false) {
    if (moodDetected && !override) return;

    moodDetected = true;
    moodSpan.textContent = newMood;
    updateMoodHistory(newMood);
    updateBackground(newMood);

    currentPlaylist = music[newMood] || [];
    currentIndex = 0;
    playCurrentSong();
}

/* Play Music */
function playCurrentSong() {
    if (!currentPlaylist.length) return;

    audio.src = currentPlaylist[currentIndex];
    audio.play();

    audio.onended = () => {
        currentIndex = (currentIndex + 1) % currentPlaylist.length;
        playCurrentSong();
    };
}

function stopMusic() {
    audio.pause();
    audio.currentTime = 0;
}

/* History */
function updateMoodHistory(mood) {
    const li = document.createElement('li');
    li.textContent = `${new Date().toLocaleTimeString()}: ${mood}`;
    moodHistoryList.appendChild(li);
}

/* Background change */
function updateBackground(mood) {
    if (mood === "happy") document.body.style.background = "#f4c542";
    else if (mood === "sad") document.body.style.background = "#34568B";
    else document.body.style.background = "#444";
}

/* ---------------------------------------------------
   CHATBOT SYSTEM (FINAL VERSION)
--------------------------------------------------- */

const chatbotBtn = document.getElementById("chatbot-btn");
const chatbotBox = document.getElementById("chatbot-box");
const chatClose = document.getElementById("chat-close");
const chatSend = document.getElementById("chat-send");
const chatInput = document.getElementById("chat-input");
const chatBody = document.getElementById("chat-body");

/* Open/Close Chatbot */
chatbotBtn.onclick = () => chatbotBox.style.display = "flex";
chatClose.onclick = () => chatbotBox.style.display = "none";

/* Add message to UI */
function addMessage(sender, text) {
    const div = document.createElement("div");
    div.innerHTML = `<b>${sender}:</b> ${text}`;
    div.style.marginBottom = "8px";
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
}

/* Detect mood in text */
function extractMoodFromText(text) {
    if (!text) return null;
    text = text.toLowerCase();
    if (text.includes("sad")) return "sad";
    if (text.includes("happy")) return "happy";
    if (text.includes("neutral") || text.includes("ok")) return "neutral";
    return null;
}

/* Prevent double sending */
let sending = false;

/* MAIN SEND FUNCTION */
chatSend.onclick = sendMessage;
chatInput.onkeypress = (e) => { if (e.key === "Enter") sendMessage(); };

async function sendMessage() {

    if (sending) return;
    sending = true;

    let msg = chatInput.value.trim().toLowerCase();
    if (!msg) {
        sending = false;
        return;
    }

    /* --- Autocorrect common misspellings --- */
    msg = msg.replace("msuic", "music")
             .replace("muisc", "music")
             .replace("musci", "music")
             .replace("muic", "music")
             .replace("plau", "play");

    addMessage("You", msg);
    chatInput.value = "";

    /* --- STOP commands --- */
    if (msg.includes("stop")) {
        stopMusic();
        addMessage("AI", "⏹ Music stopped.");
        sending = false;
        return;
    }

    /* --- "play sad music", "play music", etc. --- */
    if (msg.includes("play") && msg.includes("music")) {

        // detect mood in sentence
        let detectedMood = extractMoodFromText(msg);

        // fallback to last mood or neutral
        if (!detectedMood) {
            detectedMood = (moodSpan.textContent !== "--")
                ? moodSpan.textContent.toLowerCase()
                : "neutral";
        }

        setMood(detectedMood, true);
        addMessage("AI", `🎵 Playing ${detectedMood} music`);

        // still ask AI for suggestions (DO NOT RETURN)
    }

    /* --- Mood words in general message --- */
    const moodFound = extractMoodFromText(msg);
    if (moodFound) {
        setMood(moodFound, true);
    }

    /* --- Send to backend with auto-retry --- */
    let attempts = 0;
    let replyReceived = false;
    let finalReply = "";

    while (attempts < 2 && !replyReceived) {
        try {
            const response = await fetch("http://127.0.0.1:5000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg }),
            });

            if (!response.ok) throw new Error("network");

            const data = await response.json();
            if (data.reply && data.reply.trim() !== "") {
                finalReply = data.reply.trim();
                replyReceived = true;
            }

        } catch (e) {
            // silent retry
        }

        attempts++;
    }

    if (replyReceived) {
        addMessage("AI", finalReply);

        // mood detection from AI reply
        const aiMood = extractMoodFromText(finalReply);
        if (aiMood) setMood(aiMood, true);
    }

    sending = false;
}

let stream = null; // Global stream
let chunks = [];
let threadId = null;
let apiKey = ''; // Replace with your actual OpenAI API key
let isRecording = false; // To track if we are currently recording
let isMicPermissionGranted = false; // To track microphone permission status

// Obtain the record button and add event listeners for mouse down and up
const recordButton = document.getElementById('recordButton');
const saveKeyButton = document.getElementById('saveKeyButton');

// Click on saveKeyButton should store the content of the apiKey field into the variable apiKey
saveKeyButton.addEventListener('click', function () {
    apiKey = document.getElementById('apiKey').value;
    console.log('apiKey is now: ', apiKey);
});


recordButton.addEventListener('mousedown', function () {
    console.log('mousedown event detected, starting recording.');
    startRecording();
});
recordButton.addEventListener('mouseup', function () {
    console.log('mouseup event detected, stopping recording.');
    stopRecording();
});

// Request microphone permission and get the stream as soon as the page loads
window.addEventListener('load', () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (audioStream) {
            stream = audioStream;
            isMicPermissionGranted = true;
            recordButton.textContent = 'Hold to Record';
        })
        .catch(err => {
            console.error('Microphone access was not granted: ', err);
            recordButton.textContent = 'Microphone access denied';
            recordButton.disabled = true; // Disable the button if access is denied
        });
});

function startRecording() {
    console.log("startRecording is called");
    if (!isRecording && stream && stream.active) {
        // Disable the button to prevent further interaction
        recordButton.textContent = 'Recording...'; // Indicate recording is in progress

        // Create a MediaRecorder if one doesn't exist
        if (!window.recorder || window.recorder.state === 'inactive') {
            window.recorder = new MediaRecorder(stream);
            window.recorder.ondataavailable = e => chunks.push(e.data);
            window.recorder.onstop = processRecording;
            window.recorder.start();
        }
        isRecording = true;
    } else if (!stream) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function (audioStream) {
                stream = audioStream;
                startRecording(); // Recursive call to startRecording now that we have the stream
            })
            .catch(err => {
                console.log('Microphone access error: ', err);
                // Enable the button if there's an error after requesting access
                recordButton.disabled = false;
                recordButton.textContent = 'Hold to Record';
            });
    } else {
        console.log('Stream not active or already recording.');
    }
}

function stopRecording() {
    console.log("stopRecording is called");
    if (isRecording && window.recorder && window.recorder.state !== 'inactive') {
        window.recorder.stop(); // This triggers the onstop event and processRecording function
        recordButton.textContent = 'Processing...'; // Indicate processing is happening
        isRecording = false;
        // Do not re-enable the button here; it will be re-enabled after processing
    } else {
        console.log('Recorder not active or not recording.');
    }
}

// Process recording function
function processRecording() {
    const audioBlob = new Blob(chunks, { type: 'audio/wav' });
    chunks = [];
    sendToWhisper(audioBlob);

}


function sendToWhisper(audioBlob) {
    // Replace with your actual OpenAI API key
    const whisperUrl = 'https://api.openai.com/v1/audio/transcriptions';
    const formData = new FormData();
    formData.append('file', audioBlob, 'openai.mp3');
    formData.append('model', 'whisper-1'); // Using the model as specified in your cURL example

    fetch(whisperUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`
            // 'Content-Type': 'multipart/form-data' is not needed as it's automatically set by FormData
        },
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            const transcription = data.text;
            console.log(transcription);
            // If thread is nil, create it with the createThread function
            if (!threadId) {
                createThread(transcription);
            }
            else {
                // Otherwise, add the transcription to the thread with the addMessageToThread function
                addMessageToThread(threadId, transcription);
                runThread(threadId);
            }
            // Then run the thread with the runThread function
        })
        .catch(error => console.error('Error with Whisper:', error));

    recordButton.disabled = false;
    recordButton.textContent = 'Hold to Record';
}

//    const assistantUrl = 'https://api.openai.com/v1/assistants/asst_7fqa2q4squlDig7itjbh48Kn/messages';

function createThread(userMessage) {
    const url = 'https://api.openai.com/v1/threads';

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v1'
    };

    const body = JSON.stringify({
        messages: [
            {
                role: "user",
                content: userMessage,
            }
        ]
    });

    fetch(url, {
        method: 'POST',
        headers: headers,
        body: body
    })
        .then(response => response.json())
        .then(data => {
            threadId = data.id;
            runThread(threadId);
        })
        .catch(error => console.error('Error with OpenAI Assistant:', error));
}

// The addMessageToThread function must replicate the below curl function
/* curl https://api.openai.com/v1/threads/thread_abc123/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "OpenAI-Beta: assistants=v1" \
  -d '{
      "role": "user",
      "content": "How does AI work? Explain it in simple terms."
    }'
*/

function addMessageToThread(threadId, messageContent) {
    const url = `https://api.openai.com/v1/threads/${threadId}/messages`;

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v1'
    };

    const body = JSON.stringify({
        role: "user",
        content: messageContent
    });

    fetch(url, {
        method: 'POST',
        headers: headers,
        body: body
    })
        .then(response => response.json())
        .then(data => {
            // Process the response data
            runThread(threadId);
        })
        .catch(error => console.error('Error adding message to thread:', error));
}

function runThread(threadId) {
    const assistantId = 'asst_7fqa2q4squlDig7itjbh48Kn'; // Your assistant ID
    const url = `https://api.openai.com/v1/threads/${threadId}/runs`;

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v1'
    };

    const body = JSON.stringify({
        assistant_id: assistantId
    });

    fetch(url, {
        method: 'POST',
        headers: headers,
        body: body
    })
        .then(response => response.json())
        .then(data => {
            // Check Thread Status every 500ms if data.is is not undefined
            if (data.id) {
                const intervalId = setInterval(() => checkThreadStatus(threadId, data.id, intervalId), 500);
            }
        })
        .catch(error => console.error('Error running thread with OpenAI Assistant:', error));
}

function checkThreadStatus(threadId, runId, intervalId) {
    const url = `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`;

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v1'
    };

    fetch(url, {
        method: 'GET',
        headers: headers
    })
        .then(response => response.json())
        .then(data => {
            if (data.status && data.status === 'completed') {
                console.log('Thread is completed!');
                clearInterval(intervalId);
                speakLastMessage(threadId);
                // Process the completed thread data
            } else {
                console.log('Thread is not completed yet. Checking again in 500ms.');
            }
        })
        .catch(error => console.error('Error checking thread status:', error));
}


function speakLastMessage(threadId) {
    const url = `https://api.openai.com/v1/threads/${threadId}/messages`;

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v1'
    };

    fetch(url, {
        method: 'GET',
        headers: headers
    })
        .then(response => response.json())
        .then(data => {
            // Process the response data
            lastMessage = data.data[0].content[0].text.value;
            console.log(lastMessage);
            useTextToSpeech(lastMessage);
        })
        .catch(error => console.error('Error listing messages of thread', error));
}

function listMessagesOfThread(threadId) {
    const url = `https://api.openai.com/v1/threads/${threadId}/messages`;

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v1'
    };

    fetch(url, {
        method: 'GET',
        headers: headers
    })
        .then(response => response.json())
        .then(data => {
            // Process the response data
            return data;
        })
        .catch(error => console.error('Error listing messages of thread', error));
}

function useTextToSpeech(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR'; // or any other language
    utterance.rate = 0.75; // Slower speech rate. You can adjust this value.

    speechSynthesis.speak(utterance);
}

// Ensure the stream gets stopped when the page is unloaded
window.addEventListener('beforeunload', function () {
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }
});

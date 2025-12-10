// State management
let currentScreen = '1a';
let gestureStartTime = null;
let lastDetectedGesture = null;
const HOLD_DURATION = 2000; // 2 seconds to trigger animation
let hands = null;
let camera = null;

// Initialize webcam and MediaPipe Hands
async function initializeCamera() {
    const videoElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('output-canvas');
    const canvasCtx = canvasElement.getContext('2d');

    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });

    camera.start();
}

// Process hand detection results
function onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        gestureStartTime = null;
        lastDetectedGesture = null;
        return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const gesture = detectGesture(landmarks);

    if (gesture) {
        handleGesture(gesture);
    } else {
        gestureStartTime = null;
        lastDetectedGesture = null;
    }
}

// Detect specific gestures based on hand landmarks
function detectGesture(landmarks) {
    // Get finger tip and base positions
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const indexBase = landmarks[5];
    const middleBase = landmarks[9];
    const ringBase = landmarks[13];
    const pinkyBase = landmarks[17];
    const wrist = landmarks[0];

    // Helper function to check if finger is extended
    const isFingerExtended = (tip, base, wrist) => {
        return tip.y < base.y && Math.abs(tip.y - wrist.y) > 0.1;
    };

    const thumbExtended = Math.abs(thumbTip.x - wrist.x) > 0.15;
    const indexExtended = isFingerExtended(indexTip, indexBase, wrist);
    const middleExtended = isFingerExtended(middleTip, middleBase, wrist);
    const ringExtended = isFingerExtended(ringTip, ringBase, wrist);
    const pinkyExtended = isFingerExtended(pinkyTip, pinkyBase, wrist);

    // Rabbit gesture: Peace sign (index and middle fingers up)
    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
        return 'rabbit';
    }

    // Elephant gesture: Fist with thumb out (thumbs up variation)
    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return 'elephant';
    }

    // Butterfly gesture: All fingers extended (open palm)
    if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
        return 'butterfly';
    }

    // Dog gesture: Index finger pointing (only index extended)
    if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return 'dog';
    }

    return null;
}

// Handle detected gestures
function handleGesture(gesture) {
    // Only process gestures when on screen 1b (gesture icons visible)
    if (currentScreen !== '1b') {
        return;
    }

    // If this is a new gesture, start timing
    if (gesture !== lastDetectedGesture) {
        gestureStartTime = Date.now();
        lastDetectedGesture = gesture;
        
        // Show the corresponding animal screen immediately
        const screenMap = {
            'rabbit': '2a',
            'elephant': '2b',
            'butterfly': '2c',
            'dog': '2d'
        };
        
        showScreen(screenMap[gesture]);
    } else {
        // Check if gesture has been held long enough
        const holdTime = Date.now() - gestureStartTime;
        
        if (holdTime >= HOLD_DURATION && gesture === 'rabbit') {
            // Animate to screen 3a for rabbit
            showScreen('3a');
            gestureStartTime = null;
            lastDetectedGesture = null;
        }
    }
}

// Show specific screen
function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
        targetScreen.classList.add('active');
        currentScreen = screenId;
    }
}

// Hint button click handler
document.addEventListener('DOMContentLoaded', () => {
    const hintButton = document.getElementById('hint-button');
    
    if (hintButton) {
        hintButton.addEventListener('click', () => {
            if (currentScreen === '1a') {
                showScreen('1b');
            } else {
                showScreen('1a');
            }
        });
    }

    // Make all hint icons clickable to toggle back to gesture screen
    const allHintIcons = document.querySelectorAll('.hint-icon');
    allHintIcons.forEach((icon, index) => {
        if (index > 0) { // Skip the first one (already handled)
            icon.addEventListener('click', () => {
                showScreen('1b');
                gestureStartTime = null;
                lastDetectedGesture = null;
            });
        }
    });

    // Initialize camera
    initializeCamera().catch(err => {
        console.error('Failed to initialize camera:', err);
        alert('Please allow camera access to use gesture controls.');
    });
});

// Handle visibility changes to pause/resume camera
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (camera) {
            camera.stop();
        }
    } else {
        if (camera) {
            camera.start();
        }
    }
});

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
        maxNumHands: 2,
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

    // Check for butterfly gesture (requires 2 hands)
    if (results.multiHandLandmarks.length === 2) {
        const gesture = detectTwoHandGesture(results.multiHandLandmarks[0], results.multiHandLandmarks[1]);
        if (gesture) {
            handleGesture(gesture);
            return;
        }
    }

    // Check for single hand gestures
    const landmarks = results.multiHandLandmarks[0];
    const handedness = results.multiHandedness ? results.multiHandedness[0].label : 'Right';
    const gesture = detectGesture(landmarks, handedness);

    if (gesture) {
        handleGesture(gesture);
    } else {
        gestureStartTime = null;
        lastDetectedGesture = null;
    }
}

// Detect two-hand gestures (butterfly)
function detectTwoHandGesture(landmarks1, landmarks2) {
    // Butterfly: Two hands with fingers spread, thumbs close together
    // Check if both hands have fingers extended
    const hand1FingersExtended = checkAllFingersExtended(landmarks1);
    const hand2FingersExtended = checkAllFingersExtended(landmarks2);

    if (hand1FingersExtended && hand2FingersExtended) {
        // Check if hands are positioned close together (butterfly shape)
        const hand1Wrist = landmarks1[0];
        const hand2Wrist = landmarks2[0];
        const distance = Math.sqrt(
            Math.pow(hand1Wrist.x - hand2Wrist.x, 2) +
            Math.pow(hand1Wrist.y - hand2Wrist.y, 2)
        );

        // If wrists are reasonably close (forming butterfly shape)
        if (distance < 0.3) {
            return 'butterfly';
        }
    }

    return null;
}

// Helper to check if all fingers are extended
function checkAllFingersExtended(landmarks) {
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const indexBase = landmarks[5];
    const middleBase = landmarks[9];
    const ringBase = landmarks[13];
    const pinkyBase = landmarks[17];

    // Check if fingers are extended upward
    const indexExtended = indexTip.y < indexBase.y;
    const middleExtended = middleTip.y < middleBase.y;
    const ringExtended = ringTip.y < ringBase.y;
    const pinkyExtended = pinkyTip.y < pinkyBase.y;

    return indexExtended && middleExtended && ringExtended && pinkyExtended;
}

// Detect single hand gestures based on shadow puppet shapes
function detectGesture(landmarks, handedness) {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const thumbBase = landmarks[2];
    const indexBase = landmarks[5];
    const middleBase = landmarks[9];
    const ringBase = landmarks[13];
    const pinkyBase = landmarks[17];

    // Helper function to check if finger is extended vertically
    const isFingerExtendedUp = (tip, base) => {
        return tip.y < base.y - 0.02;
    };

    // Helper function to check if finger is extended horizontally/forward
    const isFingerExtendedForward = (tip, base, wrist) => {
        const tipDistFromWrist = Math.abs(tip.x - wrist.x);
        const baseDistFromWrist = Math.abs(base.x - wrist.x);
        return tipDistFromWrist > baseDistFromWrist + 0.05;
    };

    const indexUp = isFingerExtendedUp(indexTip, indexBase);
    const middleUp = isFingerExtendedUp(middleTip, middleBase);
    const ringUp = isFingerExtendedUp(ringTip, ringBase);
    const pinkyUp = isFingerExtendedUp(pinkyTip, pinkyBase);

    // Rabbit gesture: Peace sign (index and middle fingers up, others down)
    if (indexUp && middleUp && !ringUp && !pinkyUp) {
        return 'rabbit';
    }

    // Elephant gesture: Hand horizontal with all fingers extended forward (trunk shape)
    // All fingers should be extended forward/horizontally
    const allFingersExtended = indexUp || middleUp || ringUp || pinkyUp;
    const handHorizontal = Math.abs(indexTip.y - pinkyTip.y) < 0.12; // Fingers at similar height
    const thumbOut = Math.abs(thumbTip.x - wrist.x) > 0.1; // Thumb extended to side

    if (handHorizontal && allFingersExtended && thumbOut && !(indexUp && middleUp && !ringUp && !pinkyUp)) {
        return 'elephant';
    }

    // Dog gesture: Hand sideways with thumb extended (creates dog profile)
    // Thumb should be prominent (lower jaw), fingers form the head
    const thumbExtended = Math.abs(thumbTip.x - wrist.x) > 0.15;
    const fingersGrouped = Math.sqrt(
        Math.pow(indexTip.x - middleTip.x, 2) +
        Math.pow(indexTip.y - middleTip.y, 2)
    ) < 0.08;

    if (thumbExtended && fingersGrouped && !indexUp && !middleUp) {
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

        if (holdTime >= HOLD_DURATION) {
            // Animate to screen 3x for each animal
            const animatedScreenMap = {
                'rabbit': '3a',
                'elephant': '3b',
                'butterfly': '3c',
                'dog': '3d'
            };

            showScreen(animatedScreenMap[gesture]);
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

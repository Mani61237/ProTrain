let selectedSport = '';
let currentFilter = 'all';
let isStreaming = false;

// ── Navigation ────────────────────────────────────────────────────────────────

function scrollToSection(sectionId) {
    document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth' });
}

function updateActiveNav() {
    var sections = document.querySelectorAll('section[id]');
    var navItems = document.querySelectorAll('.nav-item');
    window.addEventListener('scroll', function () {
        var current = '';
        sections.forEach(function (section) {
            if (window.pageYOffset >= section.offsetTop - 200) {
                current = section.getAttribute('id');
            }
        });
        navItems.forEach(function (item) {
            item.classList.remove('active');
            if (item.getAttribute('href') === '#' + current) {
                item.classList.add('active');
            }
        });
    });
}

// ── Sport filter & select ─────────────────────────────────────────────────────

function filterSports(category) {
    currentFilter = category;
    document.querySelectorAll('.category-btn').forEach(function (btn) {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    document.querySelectorAll('.sport-card-new').forEach(function (card) {
        var cat = card.getAttribute('data-category');
        if (category === 'all' || cat === category) {
            card.style.display = 'block';
            card.style.animation = 'fadeIn 0.5s ease-out';
        } else {
            card.style.display = 'none';
        }
    });
}

function selectSport(sport) {
    selectedSport = sport;
    var label = document.getElementById('selected-sport');
    if (label) label.textContent = sport + ' Coach';

    document.querySelectorAll('.sport-card-new').forEach(function (card) {
        var h3 = card.querySelector('h3');
        if (h3 && h3.textContent === sport) {
            card.style.borderColor = '#6366f1';
            card.style.transform = 'translateY(-10px) scale(1.05)';
            setTimeout(function () { card.style.transform = ''; }, 800);
        }
    });

    var chatbot = document.getElementById('chatbot-window');
    if (chatbot && !chatbot.classList.contains('active')) toggleChatbot();

    addBotMessage(
        '🏆 I\'m your ' + sport + ' coach! Ask me about:\n' +
        '• Techniques & form\n' +
        '• Training plans & drills\n' +
        '• Rules & strategy\n\n' +
        'What would you like to know?'
    );
}

// ── Chatbot window ────────────────────────────────────────────────────────────

function toggleChatbot() {
    var chatbot = document.getElementById('chatbot-window');
    if (!chatbot) return;
    chatbot.classList.toggle('active');
    if (chatbot.classList.contains('active')) {
        var input = document.getElementById('user-input');
        if (input) input.focus();
    }
}

function openChatbotNewPage() {
    var width = 500, height = 700;
    var left = (screen.width - width) / 2;
    var top = (screen.height - height) / 2;
    var win = window.open(
        'chat.html', 'Sports Master Chat',
        'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes'
    );
    if (win && selectedSport) win.selectedSportFromMain = selectedSport;
}

// ── Message helpers ───────────────────────────────────────────────────────────

function addBotMessage(text) {
    var chat = document.getElementById('chat-messages');
    if (!chat) return;
    var group = document.createElement('div');
    group.className = 'message-group bot';
    var paras = text.split('\n').map(function (line) {
        return line.trim() ? '<p>' + line + '</p>' : '';
    }).join('');
    group.innerHTML =
        '<div class="message-avatar">🤖</div>' +
        '<div class="message-bubble bot-bubble">' + paras + '</div>';
    chat.appendChild(group);
    chat.scrollTop = chat.scrollHeight;
}

function addUserMessage(text) {
    var chat = document.getElementById('chat-messages');
    if (!chat) return;
    var group = document.createElement('div');
    group.className = 'message-group user';
    group.innerHTML =
        '<div class="message-avatar">👤</div>' +
        '<div class="message-bubble user-bubble"><p>' + text + '</p></div>';
    chat.appendChild(group);
    chat.scrollTop = chat.scrollHeight;
}

function createStreamBubble() {
    var chat = document.getElementById('chat-messages');
    if (!chat) return null;
    var group = document.createElement('div');
    group.className = 'message-group bot';
    group.id = 'stream-msg';
    group.innerHTML =
        '<div class="message-avatar">🤖</div>' +
        '<div class="message-bubble bot-bubble" id="stream-bubble">' +
        '<span class="stream-cursor"></span></div>';
    chat.appendChild(group);
    chat.scrollTop = chat.scrollHeight;
    return document.getElementById('stream-bubble');
}

function finaliseStreamBubble(fullText) {
    var bubble = document.getElementById('stream-bubble');
    if (!bubble) return;
    var paras = fullText.split('\n').map(function (line) {
        return line.trim() ? '<p>' + line + '</p>' : '';
    }).join('');
    bubble.innerHTML = paras;
    var msg = document.getElementById('stream-msg');
    if (msg) msg.removeAttribute('id');
    bubble.removeAttribute('id');
}

function addLoadingMessage() {
    var chat = document.getElementById('chat-messages');
    if (!chat) return;
    var group = document.createElement('div');
    group.className = 'message-group bot';
    group.id = 'loading-message';
    group.innerHTML =
        '<div class="message-avatar">🤖</div>' +
        '<div class="message-bubble bot-bubble"><div class="loading"></div></div>';
    chat.appendChild(group);
    chat.scrollTop = chat.scrollHeight;
}

function removeLoadingMessage() {
    var el = document.getElementById('loading-message');
    if (el) el.remove();
}

// ── Send message (streaming SSE) ──────────────────────────────────────────────

async function sendMessage() {
    if (isStreaming) return;

    var input = document.getElementById('user-input');
    if (!input) return;
    var message = input.value.trim();
    if (!message) return;

    if (!selectedSport) {
        addBotMessage('⚠️ Please select a sport first so I can give you specific advice!');
        return;
    }

    addUserMessage(message);
    input.value = '';
    isStreaming = true;

    var sendBtn = document.querySelector('.send-btn');
    if (sendBtn) sendBtn.disabled = true;

    var bubble = createStreamBubble();
    var fullText = '';

    try {
        var response = await fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, sport: selectedSport })
        });

        if (!response.ok) throw new Error('Server error ' + response.status);

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        while (true) {
            var result = await reader.read();
            if (result.done) break;

            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line.startsWith('data:')) continue;
                var jsonStr = line.slice(5).trim();
                if (!jsonStr) continue;
                try {
                    var data = JSON.parse(jsonStr);
                    if (data.error) {
                        fullText += '\n⚠️ ' + data.error;
                    } else if (data.text) {
                        fullText += data.text;
                        // Live-update bubble
                        if (bubble) {
                            bubble.innerHTML = fullText.replace(/\n/g, '<br>') +
                                '<span class="stream-cursor"></span>';
                            var chat = document.getElementById('chat-messages');
                            if (chat) chat.scrollTop = chat.scrollHeight;
                        }
                    }
                    // data.done — nothing extra needed
                } catch (e) { /* skip bad JSON */ }
            }
        }

        finaliseStreamBubble(fullText || 'Sorry, I did not receive a response.');

    } catch (err) {
        // Remove the half-built stream bubble and show error
        var streamMsg = document.getElementById('stream-msg');
        if (streamMsg) streamMsg.remove();
        addBotMessage(
            '⚠️ Connection error. Please make sure:\n' +
            '• The Flask server is running (python app.py)\n' +
            '• Your Gemini API key is set in app.py\n' +
            '• Your internet connection is active'
        );
        console.error('sendMessage error:', err);
    } finally {
        isStreaming = false;
        if (sendBtn) sendBtn.disabled = false;
    }
}

// ── CalCount page ─────────────────────────────────────────────────────────────

function calculateCalories() {
    var weight = parseFloat(document.getElementById('cc-weight').value);
    var height = parseFloat(document.getElementById('cc-height').value);
    var age    = parseInt(document.getElementById('cc-age').value);
    var gender = document.querySelector('input[name="cc-gender"]:checked');
    var activityEl = document.getElementById('cc-activity');
    var sport  = document.getElementById('cc-sport').value;
    var errorEl  = document.getElementById('cc-error');
    var resultEl = document.getElementById('cc-result');

    // Validation
    if (!weight || !height || !age || !gender || !activityEl.value) {
        errorEl.textContent = 'Please fill in all fields.';
        errorEl.style.display = 'block';
        resultEl.style.display = 'none';
        return;
    }
    if (weight < 20 || weight > 300) { errorEl.textContent = 'Enter a realistic weight (20–300 kg).'; errorEl.style.display = 'block'; resultEl.style.display = 'none'; return; }
    if (height < 100 || height > 250) { errorEl.textContent = 'Enter a realistic height (100–250 cm).'; errorEl.style.display = 'block'; resultEl.style.display = 'none'; return; }
    if (age < 10 || age > 100) { errorEl.textContent = 'Enter a realistic age (10–100).'; errorEl.style.display = 'block'; resultEl.style.display = 'none'; return; }
    errorEl.style.display = 'none';

    // Mifflin-St Jeor BMR
    var bmr;
    if (gender.value === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // Activity multipliers
    var activityMultipliers = {
        sedentary:  1.2,
        light:      1.375,
        moderate:   1.55,
        active:     1.725,
        very_active: 1.9
    };
    var activityFactor = activityMultipliers[activityEl.value] || 1.55;
    var tdee = Math.round(bmr * activityFactor);

    // Sport calorie burn (per hour, per kg bodyweight in kcal/kg/hr)
    var sportBurnRates = {
        'Gym – Bodybuilding':        5.5,
        'Gym – Strength Training':   4.5,
        'Gym – HIIT':                9.5,
        'Gym – CrossFit':            8.5,
        'Gym – Cardio (Treadmill/Bike)': 7.0,
        'Gym – Powerlifting':        4.0,
        'Gym – Calisthenics':        6.5,
        'Cricket':          4.5,
        'Football':         8.0,
        'Basketball':       7.5,
        'Volleyball':       5.0,
        'Hockey':           7.0,
        'Kabaddi':          6.5,
        'Badminton':        6.0,
        'Tennis':           7.0,
        'Table Tennis':     4.0,
        'Squash':           9.0,
        'Athletics':        9.0,
        'Swimming':         8.0,
        'Boxing':           9.5,
        'Wrestling':        8.5,
        'Gymnastics':       6.0,
        'Cycling':          7.5,
        'Weightlifting':    5.0,
        'Taekwondo':        8.5,
        'Judo':             8.0,
        'Golf':             3.5,
        'Archery':          3.0,
        'Rugby':            8.0,
        'Baseball':         5.0,
        'American Football':7.0,
        'Handball':         7.5,
        'Pickleball':       5.5,
        'Chess':            1.5,
        'Carrom':           1.5,
        'Ludo':             1.2,
        'Checkers':         1.5,
        'Scrabble':         1.2,
        'Backgammon':       1.3,
        'Monopoly':         1.2,
        'Poker':            1.3,
        'Kho Kho':          7.0
    };

    var burnRate = sportBurnRates[sport] || 5.0;
    var sportBurn1hr = Math.round(burnRate * weight);

    // Goals
    var maintain  = tdee;
    var loseWeight = Math.round(tdee * 0.85);
    var gainMuscle = Math.round(tdee * 1.15);

    // BMI
    var heightM = height / 100;
    var bmi = (weight / (heightM * heightM)).toFixed(1);
    var bmiCategory = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal weight' : bmi < 30 ? 'Overweight' : 'Obese';
    var bmiColor = bmi < 18.5 ? '#f59e0b' : bmi < 25 ? '#10b981' : bmi < 30 ? '#f59e0b' : '#ef4444';

    // Macros for maintain
    var proteinG   = Math.round(weight * 1.8);
    var fatG       = Math.round((maintain * 0.25) / 9);
    var carbG      = Math.round((maintain - proteinG * 4 - fatG * 9) / 4);

    // Render
    document.getElementById('cc-bmr').textContent    = Math.round(bmr) + ' kcal';
    document.getElementById('cc-tdee').textContent   = tdee + ' kcal';
    document.getElementById('cc-sport-burn').textContent = sportBurn1hr + ' kcal / hr';
    document.getElementById('cc-sport-name').textContent = sport || 'your sport';
    document.getElementById('cc-maintain').textContent   = maintain + ' kcal/day';
    document.getElementById('cc-lose').textContent       = loseWeight + ' kcal/day';
    document.getElementById('cc-gain').textContent       = gainMuscle + ' kcal/day';
    document.getElementById('cc-bmi').textContent        = bmi + ' (' + bmiCategory + ')';
    document.getElementById('cc-bmi').style.color        = bmiColor;
    document.getElementById('cc-protein').textContent    = proteinG + 'g';
    document.getElementById('cc-fat').textContent        = fatG + 'g';
    document.getElementById('cc-carbs').textContent      = carbG + 'g';

    resultEl.style.display = 'block';
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetCalc() {
    document.getElementById('cc-weight').value = '';
    document.getElementById('cc-height').value = '';
    document.getElementById('cc-age').value = '';
    document.getElementById('cc-activity').value = '';
    document.getElementById('cc-sport').value = '';
    document.getElementById('cc-error').style.display = 'none';
    document.getElementById('cc-result').style.display = 'none';
    var radios = document.querySelectorAll('input[name="cc-gender"]');
    radios.forEach(function(r) { r.checked = false; });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('user-input');
    if (input) {
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') sendMessage();
        });
    }
    updateActiveNav();

    var style = document.createElement('style');
    style.textContent =
        '@keyframes fadeIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}' +
        '@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}' +
        '.stream-cursor{display:inline-block;width:2px;height:1em;background:var(--primary);margin-left:2px;animation:blink 1s infinite;vertical-align:text-bottom;}';
    document.head.appendChild(style);
});

// ── Workout / Muscle Section ──────────────────────────────────────────────────

var MUSCLE_DATA = {
    chest: {
        icon: '🫀',
        name: 'Chest',
        sub: 'Pectoralis Major & Minor',
        exercises: [
            { name: 'Barbell Bench Press', sets: '4 x 6–8', type: 'Compound', desc: 'Lie flat, grip slightly wider than shoulder-width, lower bar to mid-chest and press explosively.', tip: 'Keep shoulder blades retracted and feet flat on the floor.' },
            { name: 'Incline Dumbbell Press', sets: '3 x 10–12', type: 'Compound', desc: 'Set bench to 30–45°. Press dumbbells from shoulder level to lockout, focusing on upper pec.', tip: 'Do not flare elbows too wide — keep at 70° from torso.' },
            { name: 'Cable Chest Fly', sets: '3 x 12–15', type: 'Isolation', desc: 'Set cables at shoulder height, slightly bend elbows and bring handles together in a wide arc.', tip: 'Squeeze the chest hard at the peak contraction.' },
            { name: 'Push-Ups', sets: '3 x 15–20', type: 'Bodyweight', desc: 'Classic push-up with hands slightly wider than shoulders. Control the descent for 2 seconds.', tip: 'Elevate feet to shift load to upper chest.' },
            { name: 'Dips (Chest Focus)', sets: '3 x 10–12', type: 'Compound', desc: 'Lean torso forward and lower until a mild chest stretch is felt, then press back up.', tip: 'Add weight with a dip belt once bodyweight becomes easy.' },
            { name: 'Decline Bench Press', sets: '3 x 8–10', type: 'Compound', desc: 'Set bench to -15°. Targets lower pec. Lower bar to lower chest and press.', tip: 'Use a spotter or perform in a power rack for safety.' }
        ]
    },
    back: {
        icon: '🏋️',
        name: 'Back',
        sub: 'Lats, Traps & Rhomboids',
        exercises: [
            { name: 'Deadlift', sets: '4 x 4–6', type: 'Compound', desc: 'Hip-hinge movement. Pull bar from floor keeping neutral spine, drive hips forward at lockout.', tip: 'Brace core hard and push the floor away rather than pulling the bar up.' },
            { name: 'Pull-Ups / Chin-Ups', sets: '4 x 6–10', type: 'Compound', desc: 'Hang from bar, depress scapula and pull chest to bar. Wide grip = lats; close supinated = biceps+lats.', tip: 'Dead hang fully at the bottom to maximise lat stretch.' },
            { name: 'Barbell Bent-Over Row', sets: '4 x 8–10', type: 'Compound', desc: 'Hinge at hips ~45°, retract scapula and row bar to lower ribcage. Drive elbows back.', tip: 'Keep lower back neutral — do not round under heavy load.' },
            { name: 'Seated Cable Row', sets: '3 x 10–12', type: 'Compound', desc: 'Pull v-bar to navel, hold 1 second squeeze, then slowly extend arms.', tip: 'Avoid rocking the torso — isolate the back.' },
            { name: 'Lat Pulldown', sets: '3 x 10–12', type: 'Compound', desc: 'Pull bar to upper chest, driving elbows into back pockets. Control the return.', tip: 'Lean back slightly (10–15°) to create a better lat angle.' },
            { name: 'Single-Arm Dumbbell Row', sets: '3 x 10 each', type: 'Compound', desc: 'Brace on bench, row dumbbell to hip. Allow full shoulder depression at bottom.', tip: 'Pull with your elbow, not your hand.' }
        ]
    },
    shoulders: {
        icon: '💪',
        name: 'Shoulders',
        sub: 'Anterior, Lateral & Posterior Deltoids',
        exercises: [
            { name: 'Overhead Press (Barbell)', sets: '4 x 6–8', type: 'Compound', desc: 'Press bar from front rack position overhead to full lockout. Squeeze glutes for stability.', tip: 'Push your head through at the top — do not press in front.' },
            { name: 'Dumbbell Lateral Raise', sets: '4 x 12–15', type: 'Isolation', desc: 'Raise dumbbells to shoulder height with slight elbow bend. Pinky higher than thumb.', tip: 'Use controlled tempo — 2 sec up, 3 sec down. Avoid swinging.' },
            { name: 'Rear Delt Fly', sets: '3 x 15', type: 'Isolation', desc: 'Hinge forward, raise dumbbells to side with elbows slightly bent. Pinch shoulder blades.', tip: 'Most people neglect rear delts — prioritise them for balanced shoulders.' },
            { name: 'Arnold Press', sets: '3 x 10–12', type: 'Compound', desc: 'Start with palms facing you, rotate outward as you press overhead. Reverse on descent.', tip: 'Slow rotation engages all three deltoid heads.' },
            { name: 'Face Pull', sets: '3 x 15–20', type: 'Isolation', desc: 'Pull rope to face with high elbows, flaring handles apart at the end.', tip: 'Great for rear delts and rotator cuff health.' },
            { name: 'Front Raise', sets: '3 x 12', type: 'Isolation', desc: 'Raise dumbbell or plate straight ahead to shoulder height.', tip: 'Avoid shrugging shoulders — keep traps relaxed.' }
        ]
    },
    biceps: {
        icon: '💪',
        name: 'Biceps',
        sub: 'Biceps Brachii & Brachialis',
        exercises: [
            { name: 'Barbell Curl', sets: '4 x 8–10', type: 'Compound', desc: 'Stand upright, curl bar from hips to shoulders without swinging.', tip: 'Supinate (turn out) wrists at the top for peak contraction.' },
            { name: 'Incline Dumbbell Curl', sets: '3 x 10–12', type: 'Isolation', desc: 'Set bench to 60°, let arms hang straight down and curl — maximises stretch.', tip: 'Do not swing or lift shoulder — keep upper arm vertical.' },
            { name: 'Hammer Curl', sets: '3 x 10–12', type: 'Compound', desc: 'Neutral grip (thumbs up) curl — targets brachialis and brachioradialis.', tip: 'Alternate arms to focus on contraction quality.' },
            { name: 'Concentration Curl', sets: '3 x 12', type: 'Isolation', desc: 'Seated, brace elbow on inner thigh, curl dumbbell to shoulder.', tip: 'Peak contraction is everything here — pause and squeeze.' },
            { name: 'Cable Curl', sets: '3 x 12–15', type: 'Isolation', desc: 'Low pulley cable keeps tension on bicep through full range of motion.', tip: 'Cables maintain constant tension unlike free weights.' },
            { name: 'Chin-Up', sets: '3 x 8–10', type: 'Compound', desc: 'Supinated grip pull-up. Biceps are heavily involved alongside lats.', tip: 'Add weight once you can do 10 clean reps.' }
        ]
    },
    triceps: {
        icon: '💪',
        name: 'Triceps',
        sub: 'Long, Lateral & Medial Heads',
        exercises: [
            { name: 'Close-Grip Bench Press', sets: '4 x 8–10', type: 'Compound', desc: 'Bench press with hands shoulder-width apart. Elbows stay close to torso.', tip: 'All three tricep heads are worked — best mass builder for tris.' },
            { name: 'Skull Crusher', sets: '3 x 10–12', type: 'Isolation', desc: 'Lying tricep extension — lower EZ-bar or dumbbells to forehead, extend back up.', tip: 'Targets the long head. Keep elbows pointed at ceiling.' },
            { name: 'Tricep Pushdown (Cable)', sets: '4 x 12–15', type: 'Isolation', desc: 'Push rope or bar down to full lockout, flare rope ends apart at bottom.', tip: 'Keep elbows pinned to sides throughout.' },
            { name: 'Overhead Tricep Extension', sets: '3 x 10–12', type: 'Isolation', desc: 'Press dumbbell overhead, lower behind head by bending elbows, extend back up.', tip: 'Best exercise for the long head which makes up the most tricep mass.' },
            { name: 'Dips (Tricep Focus)', sets: '3 x 10–15', type: 'Compound', desc: 'Keep torso upright and elbows close to body for maximum tricep activation.', tip: 'Tricep dips on parallel bars are the king of tricep builders.' },
            { name: 'Diamond Push-Up', sets: '3 x 12–15', type: 'Bodyweight', desc: 'Form a diamond shape with hands under chest, perform a push-up.', tip: 'Great bodyweight finisher — go slow for maximum burn.' }
        ]
    },
    abs: {
        icon: '🔥',
        name: 'Abs',
        sub: 'Rectus Abdominis & Obliques',
        exercises: [
            { name: 'Cable Crunch', sets: '4 x 15–20', type: 'Weighted', desc: 'Kneel facing cable, hold rope at head, crunch down rounding lower back. Resist on the way up.', tip: 'Weighted ab work builds thickness — do not just do bodyweight.' },
            { name: 'Hanging Leg Raise', sets: '4 x 10–15', type: 'Compound', desc: 'Hang from bar, raise legs to 90° or higher. Keep movement controlled.', tip: 'For lower abs, tilt pelvis backward at the top.' },
            { name: 'Ab Wheel Rollout', sets: '3 x 8–12', type: 'Compound', desc: 'From kneeling, roll wheel out as far as possible, keeping core braced, roll back.', tip: 'One of the most effective ab exercises — demands core stability.' },
            { name: 'Plank', sets: '3 x 45–60 sec', type: 'Isometric', desc: 'Forearm plank — straight line from head to heel. Squeeze everything.', tip: 'Progress by adding a weight plate on your back.' },
            { name: 'Russian Twist', sets: '3 x 20', type: 'Rotation', desc: 'Seated, lean back 45°, rotate torso side to side touching hands to floor.', tip: 'Hold a weight plate to increase resistance.' },
            { name: 'Bicycle Crunch', sets: '3 x 20', type: 'Rotation', desc: 'Alternate elbow to opposite knee in a cycling motion. Fully extend the straight leg.', tip: 'Go slow — speed kills form on this one.' }
        ]
    },
    quadriceps: {
        icon: '🦵',
        name: 'Quadriceps',
        sub: '4-headed Anterior Thigh Muscle',
        exercises: [
            { name: 'Barbell Back Squat', sets: '4 x 6–8', type: 'Compound', desc: 'Bar on upper traps, squat to parallel or below. Drive through heels and mid-foot.', tip: 'Keep knees tracking over toes and chest proud.' },
            { name: 'Leg Press', sets: '4 x 10–12', type: 'Compound', desc: 'Place feet mid-platform, press to near lockout. Control descent over 3 seconds.', tip: 'A low foot placement increases quad emphasis.' },
            { name: 'Bulgarian Split Squat', sets: '3 x 10 each', type: 'Compound', desc: 'Rear foot elevated, lower until front thigh is parallel. Dumbbells or barbell.', tip: 'Best single-leg quad builder — also improves hip mobility.' },
            { name: 'Leg Extension', sets: '3 x 12–15', type: 'Isolation', desc: 'Extend knees to full lockout, squeeze quads at top, slowly lower.', tip: 'Use for isolation finishing work — not as a primary exercise.' },
            { name: 'Hack Squat', sets: '3 x 10', type: 'Compound', desc: 'Machine squat — great for maximising quad activation with less lower back load.', tip: 'A very upright torso emphasises vastus medialis (teardrop).' },
            { name: 'Walking Lunge', sets: '3 x 12 each', type: 'Compound', desc: 'Step forward and lower knee to just above floor. Alternate legs for 12 each.', tip: 'Add dumbbells or a barbell for progressive overload.' }
        ]
    },
    hamstrings: {
        icon: '🦵',
        name: 'Hamstrings',
        sub: 'Posterior Thigh Muscles',
        exercises: [
            { name: 'Romanian Deadlift', sets: '4 x 8–10', type: 'Compound', desc: 'Hip-hinge with soft knees — lower bar down shins feeling deep hamstring stretch, then drive hips through.', tip: 'The gold standard hamstring exercise for size and strength.' },
            { name: 'Lying Leg Curl', sets: '4 x 10–12', type: 'Isolation', desc: 'Curl heels toward glutes, hold 1 second at peak, lower slowly.', tip: 'Point toes slightly inward to hit biceps femoris more.' },
            { name: 'Seated Leg Curl', sets: '3 x 12', type: 'Isolation', desc: 'Seated position stretches hamstrings at the hip — greater range of motion.', tip: 'Research shows seated curls produce better hamstring activation.' },
            { name: 'Nordic Curl', sets: '3 x 5–8', type: 'Eccentric', desc: 'Anchor feet, lower your body toward floor under control using only hamstrings.', tip: 'Extremely effective for injury prevention in sprinters and athletes.' },
            { name: 'Good Morning', sets: '3 x 10', type: 'Compound', desc: 'Bar on traps, hinge at hips keeping spine neutral, push hips back until stretch felt.', tip: 'Keep a very slight knee bend — this is not a squat.' },
            { name: 'Glute-Ham Raise', sets: '3 x 8', type: 'Compound', desc: 'On GHR machine, lower torso and raise using hamstrings to a straight position.', tip: 'One of the most effective hamstring exercises available.' }
        ]
    },
    glutes: {
        icon: '🍑',
        name: 'Glutes',
        sub: 'Gluteus Maximus, Medius & Minimus',
        exercises: [
            { name: 'Barbell Hip Thrust', sets: '4 x 10–12', type: 'Compound', desc: 'Upper back on bench, bar over hips, drive hips upward squeezing glutes at top.', tip: 'Best glute-specific exercise. Use a barbell pad for comfort.' },
            { name: 'Sumo Deadlift', sets: '4 x 6–8', type: 'Compound', desc: 'Wide stance with toes out. Glutes and adductors are heavily recruited vs conventional.', tip: 'Push knees out throughout the lift.' },
            { name: 'Cable Kickback', sets: '3 x 15 each', type: 'Isolation', desc: 'Attach ankle cuff to low cable, kick leg back and up squeezing glute hard.', tip: 'Keep hips square and avoid rotating torso.' },
            { name: 'Bulgarian Split Squat', sets: '3 x 10 each', type: 'Compound', desc: 'Rear foot elevated, forward trunk lean increases glute activation.', tip: 'Lean slightly forward to shift load from quads to glutes.' },
            { name: 'Glute Bridge', sets: '4 x 15–20', type: 'Compound', desc: 'Lying on floor, drive hips up with feet flat, squeeze glutes at peak.', tip: 'Add a resistance band above knees to activate glute medius.' },
            { name: 'Step-Up', sets: '3 x 12 each', type: 'Compound', desc: 'Step onto an elevated surface, drive through the heel of the working leg.', tip: 'Use a high box (knee height) to maximise glute range of motion.' }
        ]
    },
    calves: {
        icon: '🦵',
        name: 'Calves',
        sub: 'Gastrocnemius & Soleus',
        exercises: [
            { name: 'Standing Calf Raise', sets: '4 x 15–20', type: 'Compound', desc: 'Rise to full tip-toe, hold 2 seconds, lower to full stretch below platform.', tip: 'Full range of motion is critical — most people only do half reps.' },
            { name: 'Seated Calf Raise', sets: '4 x 15–20', type: 'Isolation', desc: 'Targets soleus (deep calf). Press through balls of feet from full stretch to full rise.', tip: 'Soleus responds to higher reps — go 15–25.' },
            { name: 'Leg Press Calf Raise', sets: '3 x 15–20', type: 'Compound', desc: 'Use leg press machine with only toes on platform edge and press through balls of feet.', tip: 'Allows heavier loading than bodyweight standing raises.' },
            { name: 'Donkey Calf Raise', sets: '3 x 15', type: 'Compound', desc: 'Hinge forward with upper body supported, raise heels as high as possible.', tip: 'Hip flexion position stretches gastrocnemius further than standing.' },
            { name: 'Single-Leg Calf Raise', sets: '3 x 12 each', type: 'Compound', desc: 'Bodyweight single leg — the gold standard for building calf strength.', tip: 'Hold a dumbbell in the opposite hand to add progressive load.' },
            { name: 'Jump Rope', sets: '3 x 2 min', type: 'Cardio', desc: 'High frequency calf contractions build endurance and coordination.', tip: 'Stay on the balls of your feet throughout.' }
        ]
    },
    forearms: {
        icon: '💪',
        name: 'Forearms',
        sub: 'Flexors, Extensors & Brachioradialis',
        exercises: [
            { name: 'Wrist Curl', sets: '3 x 15–20', type: 'Isolation', desc: 'Sit with forearm on thigh, curl wrist upward holding dumbbell. Full range up and down.', tip: 'Trains wrist flexors. Use a full range of motion.' },
            { name: 'Reverse Wrist Curl', sets: '3 x 15–20', type: 'Isolation', desc: 'Overhand grip wrist curl targets extensors — very important for balance.', tip: 'Neglecting extensors leads to tennis elbow risk.' },
            { name: 'Farmer\'s Carry', sets: '3 x 40m', type: 'Functional', desc: 'Walk with heavy dumbbells at sides for distance or time — builds grip and forearms.', tip: 'Go heavy — use 50–75% of your bodyweight total.' },
            { name: 'Dead Hang', sets: '3 x 30–60 sec', type: 'Isometric', desc: 'Hang from a pull-up bar as long as possible — builds crushing grip strength.', tip: 'Alternate between overhand, underhand and mixed grip.' },
            { name: 'Reverse Curl', sets: '3 x 12', type: 'Compound', desc: 'Barbell curl with overhand grip — targets brachioradialis and extensors.', tip: 'Use 30–40% less weight than regular curls.' },
            { name: 'Plate Pinch', sets: '3 x 20 sec each', type: 'Isometric', desc: 'Pinch two plates smooth-side-out using fingers and thumb as long as possible.', tip: 'Builds the finger flexors and crushing strength.' }
        ]
    },
    traps: {
        icon: '🏋️',
        name: 'Traps',
        sub: 'Upper, Middle & Lower Trapezius',
        exercises: [
            { name: 'Barbell Shrug', sets: '4 x 10–12', type: 'Isolation', desc: 'Hold barbell, shrug shoulders straight up toward ears, hold 1–2 seconds, lower slowly.', tip: 'Do NOT roll shoulders — straight up and down is the safest path.' },
            { name: 'Dumbbell Shrug', sets: '4 x 12–15', type: 'Isolation', desc: 'Greater range of motion than barbell. Hold peak contraction 2 seconds.', tip: 'Use straps so grip does not limit the weight.' },
            { name: 'Deadlift', sets: '4 x 5', type: 'Compound', desc: 'Heavy deadlifts are one of the best trap builders — isometrically holds the bar during the pull.', tip: 'You do not need to shrug at the top — just maintain rigid traps.' },
            { name: 'Face Pull', sets: '3 x 15–20', type: 'Compound', desc: 'Cable face pull with rope — heavily activates mid and lower traps plus rear delts.', tip: 'Do these for shoulder health — not just aesthetics.' },
            { name: 'Rack Pull', sets: '3 x 6–8', type: 'Compound', desc: 'Deadlift from knee height — allows heavier loading and greater trap isometric stress.', tip: 'Great accessory for building upper back thickness.' },
            { name: 'Upright Row', sets: '3 x 10–12', type: 'Compound', desc: 'Pull barbell up to chin level leading with elbows. Trains upper traps and lateral delts.', tip: 'Keep elbows above wrists throughout the movement.' }
        ]
    }
};

function openExercises(muscleKey) {
    var data = MUSCLE_DATA[muscleKey];
    if (!data) return;

    document.getElementById('ex-modal-icon').textContent = data.icon;
    document.getElementById('ex-modal-title').textContent = data.name + ' Exercises';
    document.getElementById('ex-modal-sub').textContent = data.sub;

    var typeColors = {
        'Compound':   '#6366f1',
        'Isolation':  '#8b5cf6',
        'Bodyweight': '#10b981',
        'Weighted':   '#f59e0b',
        'Rotation':   '#ec4899',
        'Isometric':  '#06b6d4',
        'Eccentric':  '#ef4444',
        'Functional': '#84cc16',
        'Cardio':     '#f97316'
    };

    var listEl = document.getElementById('ex-exercise-list');
    listEl.innerHTML = '';

    data.exercises.forEach(function (ex, i) {
        var color = typeColors[ex.type] || '#6366f1';
        var card = document.createElement('div');
        card.className = 'ex-card';
        card.innerHTML =
            '<div class="ex-card-top">' +
                '<div class="ex-number">' + (i + 1) + '</div>' +
                '<div class="ex-card-info">' +
                    '<div class="ex-card-name">' + ex.name + '</div>' +
                    '<div class="ex-card-meta">' +
                        '<span class="ex-sets">📊 ' + ex.sets + '</span>' +
                        '<span class="ex-type-badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44">' + ex.type + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<p class="ex-desc">' + ex.desc + '</p>' +
            '<div class="ex-tip"><span class="ex-tip-icon">💡</span>' + ex.tip + '</div>';
        listEl.appendChild(card);
    });

    document.getElementById('exercise-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('exercise-modal').classList.remove('active');
    document.body.style.overflow = '';
}

function closeExerciseModal(event) {
    if (event.target === document.getElementById('exercise-modal')) {
        closeModal();
    }
}

// Close modal with Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
});
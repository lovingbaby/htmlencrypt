// ==================== LOGIN GATE SCRIPTS ====================
gsap.registerPlugin(Draggable);

(function() {
    var loginGate = document.getElementById('loginGate');
    var loginForm = loginGate.querySelector('.login-form');
    var cordBead = loginGate.querySelector('.cord-bead');
    var cordLine = loginGate.querySelector('.cord-line');
    var hitArea = loginGate.querySelector('.cord-hit');
    var usernameInput = document.getElementById('lampUsername');
    var passwordInput = document.getElementById('lampPassword');
    var loginBtn = document.getElementById('lampLoginBtn');

    var LAMP_VALID_USERNAME = 'Dh@X9rik#AI';
    var LAMP_VALID_PASSWORD = 'D7@hK#26!rQ9xA';
    var isOn = false;
    var clickSound = new Audio("https://assets.codepen.io/605876/click.mp3");

    Draggable.create(hitArea, {
        type: "y",
        bounds: { minY: 0, maxY: 60 },
        onDrag() {
            gsap.set(cordBead, { y: this.y });
            gsap.set(cordLine, { attr: { y2: 180 + this.y } });
        },
        onRelease() {
            if (this.y > 30) toggleLamp();
            gsap.to([cordBead, hitArea], { y: 0, duration: 0.5, ease: "back.out(2.5)" });
            gsap.to(cordLine, { attr: { y2: 180 }, duration: 0.5, ease: "back.out(2.5)" });
        },
    });

    function toggleLamp() {
        isOn = !isOn;
        clickSound.play().catch(function() {});
        loginGate.setAttribute("data-on", isOn);
        loginGate.style.setProperty("--lamp-on", isOn ? 1 : 0);

        if (isOn) {
            loginForm.classList.add("active");
            gsap.to(loginGate, { backgroundColor: "#1c1f24", duration: 0.6 });
        } else {
            loginForm.classList.remove("active");
            gsap.to(loginGate, { backgroundColor: "#121417", duration: 0.6 });
        }
    }

    loginBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var enteredUsername = usernameInput.value.trim();
        var enteredPassword = passwordInput.value.trim();

        if (enteredUsername === '') {
            alert('⚠️ Please enter your username!');
            usernameInput.focus();
            usernameInput.select();
            return;
        }
        if (enteredPassword === '') {
            alert('⚠️ Please enter your password!');
            passwordInput.focus();
            passwordInput.select();
            return;
        }

        if (enteredUsername === LAMP_VALID_USERNAME && enteredPassword === LAMP_VALID_PASSWORD) {
            setTimeout(function() {
                var gateContainer = document.getElementById('gateContainer');
                var licensePage = document.getElementById('licensePage');
                loginGate.classList.add('hidden');
                if (gateContainer) gateContainer.classList.remove('hidden');
                if (licensePage) licensePage.classList.remove('hidden');
            }, 400);
            usernameInput.value = '';
            passwordInput.value = '';
        } else {
            if (enteredUsername !== LAMP_VALID_USERNAME) {
                alert('❌ Invalid Username! Please try again.');
                usernameInput.focus();
                usernameInput.select();
            } else {
                alert('❌ Invalid Password! Please try again.');
                passwordInput.focus();
                passwordInput.select();
            }
        }
    });

    loginForm.querySelector('form').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            loginBtn.click();
        }
    });

    window.addEventListener('load', function() {
        usernameInput.value = '';
        passwordInput.value = '';
    });
})();

// ==================== CONFIG ====================
const DB_NAME = 'Wingo30S_100000_Last10_DB';
const STORE_NAME = 'patterns';
const MAX_PATTERNS = 100000;
const PATTERN_LENGTH = 10;
let db = null;
let isProcessing = false;
let liveHistory = [];
let pendingVerification = null;
let dbReady = false;

const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json";

// ==================== TOAST ====================
function showToast(msg, isSuccess = true) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.borderColor = isSuccess ? 'var(--green)' : 'var(--red)';
    el.className = 'toast show';
    setTimeout(() => { el.className = 'toast'; }, 3500);
}

// ==================== PERIOD NORMALIZATION ====================
function normalizePeriod(period) {
    if (!period) return null;
    period = String(period);
    if (/^\d{6}$/.test(period)) return period;
    const match = period.match(/(\d{6})$/);
    if (match) return match[1];
    if (period.length > 6) return period.slice(-6);
    return period;
}

function nextPeriod(period) {
    if (!period) return null;
    const p = normalizePeriod(period);
    const num = parseInt(p, 10) + 1;
    return String(num).padStart(p.length, '0');
}

// ==================== PREDICTION ENGINE ====================
function getColorFromNumber(num) {
    if (num === 0 || num === 5) return { color: 'Violet', css: 'violet-bg', class: 'violet-color', value: 'Violet' };
    if ([1, 3, 7, 9].includes(num)) return { color: 'Green', css: 'green-bg', class: 'green-color', value: 'Green' };
    if ([2, 4, 6, 8].includes(num)) return { color: 'Red', css: 'red-bg', class: 'red-color', value: 'Red' };
    return { color: 'Unknown', css: '', class: '', value: '?' };
}

function predictColorFromPattern(pattern, dbPatterns) {
    let colorVotes = { Green: 0, Red: 0, Violet: 0 };
    let totalMatches = 0;
    
    for (const p of dbPatterns) {
        if (!p.pattern || p.pattern.length < PATTERN_LENGTH) continue;
        let matchCount = 0;
        for (let i = 0; i < PATTERN_LENGTH; i++) {
            if (i < pattern.length && i < p.pattern.length && pattern[i] === p.pattern[i]) matchCount++;
        }
        const similarity = (matchCount / PATTERN_LENGTH) * 100;
        if (similarity >= 80) {
            totalMatches++;
            const reliability = p.reliability || 0.5;
            const recencyWeight = 1 + 0.1 * (1 - (Date.now() - p.timestamp) / (30 * 24 * 60 * 60 * 1000));
            const weight = (similarity / 100) * reliability * recencyWeight;
            const num = p.nextResultNum !== undefined ? p.nextResultNum : (p.nextResult === 'Big' ? 7 : 2);
            const colorInfo = getColorFromNumber(num);
            if (colorInfo.value !== 'Unknown') {
                colorVotes[colorInfo.value] += weight;
            } else {
                if (p.nextResult === 'Big') colorVotes.Green += weight * 0.7;
                else colorVotes.Red += weight * 0.7;
            }
        }
    }
    
    if (totalMatches < 3) {
        const lastType = pattern[pattern.length - 1] || 'Small';
        if (lastType === 'Big') {
            colorVotes.Green += 1.0;
            colorVotes.Red += 0.4;
        } else {
            colorVotes.Red += 1.0;
            colorVotes.Green += 0.4;
        }
        colorVotes.Violet += 0.15;
    }
    
    let maxColor = 'Green';
    let maxVotes = colorVotes.Green;
    if (colorVotes.Red > maxVotes) { maxVotes = colorVotes.Red; maxColor = 'Red'; }
    if (colorVotes.Violet > maxVotes) { maxVotes = colorVotes.Violet; maxColor = 'Violet'; }
    
    const totalVotes = colorVotes.Green + colorVotes.Red + colorVotes.Violet;
    const confidence = totalVotes > 0 ? Math.min(92, Math.round((maxVotes / totalVotes) * 100)) : 55;
    
    return { color: maxColor, confidence };
}

function predictNumberFromPattern(pattern, dbPatterns) {
    let numberVotes = {};
    let totalMatches = 0;
    
    for (const p of dbPatterns) {
        if (!p.pattern || p.pattern.length < PATTERN_LENGTH) continue;
        let matchCount = 0;
        for (let i = 0; i < PATTERN_LENGTH; i++) {
            if (i < pattern.length && i < p.pattern.length && pattern[i] === p.pattern[i]) matchCount++;
        }
        const similarity = (matchCount / PATTERN_LENGTH) * 100;
        if (similarity >= 80) {
            totalMatches++;
            const reliability = p.reliability || 0.5;
            const recencyWeight = 1 + 0.1 * (1 - (Date.now() - p.timestamp) / (30 * 24 * 60 * 60 * 1000));
            const weight = (similarity / 100) * reliability * recencyWeight;
            const num = p.nextResultNum !== undefined ? p.nextResultNum : (p.nextResult === 'Big' ? 7 : 2);
            numberVotes[num] = (numberVotes[num] || 0) + weight;
        }
    }
    
    if (totalMatches < 3) {
        const lastType = pattern[pattern.length - 1] || 'Small';
        if (lastType === 'Big') {
            numberVotes[7] = (numberVotes[7] || 0) + 1.0;
            numberVotes[8] = (numberVotes[8] || 0) + 0.5;
            numberVotes[9] = (numberVotes[9] || 0) + 0.4;
            numberVotes[5] = (numberVotes[5] || 0) + 0.3;
        } else {
            numberVotes[2] = (numberVotes[2] || 0) + 1.0;
            numberVotes[1] = (numberVotes[1] || 0) + 0.5;
            numberVotes[3] = (numberVotes[3] || 0) + 0.4;
            numberVotes[0] = (numberVotes[0] || 0) + 0.3;
        }
    }
    
    let maxNum = 2;
    let maxVotes = 0;
    for (const [num, votes] of Object.entries(numberVotes)) {
        if (votes > maxVotes) { maxVotes = votes; maxNum = parseInt(num); }
    }
    
    const totalVotes = Object.values(numberVotes).reduce((a, b) => a + b, 0);
    const confidence = totalVotes > 0 ? Math.min(90, Math.round((maxVotes / totalVotes) * 100)) : 50;
    
    return { number: maxNum, confidence };
}

async function predictAll(currentPattern) {
    const allPatterns = await getAllPatterns();
    
    if (allPatterns.length === 0) {
        const last = currentPattern[currentPattern.length - 1] || 'Small';
        const prediction = last === 'Big' ? 'Small' : 'Big';
        return {
            bsPrediction: prediction,
            bsConfidence: 55,
            colorPrediction: prediction === 'Big' ? 'Green' : 'Red',
            colorConfidence: 50,
            numberPrediction: prediction === 'Big' ? 7 : 2,
            numberConfidence: 50,
            matchType: "📊 TREND FALLBACK (no DB)",
            exactMatch: false,
            patternId: null
        };
    }

    let exactMatch = null;
    let exactPatternId = null;
    for (const p of allPatterns) {
        if (!p.pattern || p.pattern.length < PATTERN_LENGTH) continue;
        let isExact = true;
        for (let i = 0; i < PATTERN_LENGTH; i++) {
            if (i < currentPattern.length && i < p.pattern.length) {
                if (currentPattern[i] !== p.pattern[i]) { isExact = false; break; }
            } else {
                isExact = false; break;
            }
        }
        if (isExact) {
            exactMatch = p;
            exactPatternId = p.id;
            break;
        }
    }

    if (exactMatch) {
        const pred = exactMatch.nextResult;
        const num = exactMatch.nextResultNum !== undefined ? exactMatch.nextResultNum : (pred === 'Big' ? 7 : 2);
        const colorPred = predictColorFromPattern(currentPattern, allPatterns);
        const numPred = predictNumberFromPattern(currentPattern, allPatterns);
        
        return {
            bsPrediction: pred,
            bsConfidence: 95,
            colorPrediction: colorPred.color,
            colorConfidence: colorPred.confidence,
            numberPrediction: numPred.number,
            numberConfidence: numPred.confidence,
            matchType: "✅ EXACT PATTERN MATCH",
            exactMatch: true,
            patternId: exactPatternId
        };
    }

    const highMatches = [];
    for (const p of allPatterns) {
        if (!p.pattern || p.pattern.length < PATTERN_LENGTH) continue;
        let matchCount = 0;
        for (let i = 0; i < PATTERN_LENGTH; i++) {
            if (i < currentPattern.length && i < p.pattern.length && currentPattern[i] === p.pattern[i]) matchCount++;
        }
        const similarity = (matchCount / PATTERN_LENGTH) * 100;
        if (similarity >= 90) highMatches.push({ pattern: p, similarity });
    }

    if (highMatches.length > 0) {
        highMatches.sort((a, b) => {
            if (b.similarity !== a.similarity) return b.similarity - a.similarity;
            return (b.pattern.reliability || 0) - (a.pattern.reliability || 0);
        });
        
        const bestMatch = highMatches[0];
        const pred = bestMatch.pattern.nextResult;
        const colorPred = predictColorFromPattern(currentPattern, allPatterns);
        const numPred = predictNumberFromPattern(currentPattern, allPatterns);
        
        return {
            bsPrediction: pred,
            bsConfidence: Math.min(92, 70 + Math.round(bestMatch.similarity / 5)),
            colorPrediction: colorPred.color,
            colorConfidence: colorPred.confidence,
            numberPrediction: numPred.number,
            numberConfidence: numPred.confidence,
            matchType: `✅ HIGH SIMILARITY (${bestMatch.similarity}%)`,
            exactMatch: false,
            patternId: bestMatch.pattern.id
        };
    }

    const mediumMatches = [];
    for (const p of allPatterns) {
        if (!p.pattern || p.pattern.length < PATTERN_LENGTH) continue;
        let matchCount = 0;
        for (let i = 0; i < PATTERN_LENGTH; i++) {
            if (i < currentPattern.length && i < p.pattern.length && currentPattern[i] === p.pattern[i]) matchCount++;
        }
        const similarity = (matchCount / PATTERN_LENGTH) * 100;
        if (similarity >= 80 && similarity < 90) mediumMatches.push({ pattern: p, similarity });
    }

    if (mediumMatches.length >= 3) {
        mediumMatches.sort((a, b) => {
            if (b.similarity !== a.similarity) return b.similarity - a.similarity;
            return (b.pattern.reliability || 0) - (a.pattern.reliability || 0);
        });
        
        const bestMatch = mediumMatches[0];
        const pred = bestMatch.pattern.nextResult;
        const colorPred = predictColorFromPattern(currentPattern, allPatterns);
        const numPred = predictNumberFromPattern(currentPattern, allPatterns);
        
        return {
            bsPrediction: pred,
            bsConfidence: Math.min(85, 60 + Math.round(bestMatch.similarity / 4)),
            colorPrediction: colorPred.color,
            colorConfidence: colorPred.confidence,
            numberPrediction: numPred.number,
            numberConfidence: numPred.confidence,
            matchType: `✅ MEDIUM SIMILARITY (${bestMatch.similarity}%)`,
            exactMatch: false,
            patternId: bestMatch.pattern.id
        };
    }

    function getRunLength(arr) {
        if (!arr.length) return 0;
        let len = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[0]) len++; else break;
        }
        return len;
    }

    const streakLen = getRunLength(currentPattern);
    
    if (streakLen >= 3) {
        const prediction = currentPattern[0] === 'Big' ? 'Small' : 'Big';
        let confidence = 70;
        if (streakLen >= 7) confidence = 85;
        else if (streakLen >= 5) confidence = 78;
        
        const colorPred = predictColorFromPattern(currentPattern, allPatterns);
        const numPred = predictNumberFromPattern(currentPattern, allPatterns);
        
        return {
            bsPrediction: prediction,
            bsConfidence: confidence,
            colorPrediction: colorPred.color,
            colorConfidence: colorPred.confidence,
            numberPrediction: numPred.number,
            numberConfidence: numPred.confidence,
            matchType: `✅ STREAK BREAK (${streakLen}x ${currentPattern[0]})`,
            exactMatch: false,
            patternId: null
        };
    }

    let isAlternating = true;
    for (let i = 1; i < currentPattern.length; i++) {
        if (currentPattern[i] === currentPattern[i-1]) {
            isAlternating = false;
            break;
        }
    }
    if (isAlternating && allPatterns.length > 5) {
        const prediction = currentPattern[0];
        const colorPred = predictColorFromPattern(currentPattern, allPatterns);
        const numPred = predictNumberFromPattern(currentPattern, allPatterns);
        
        return {
            bsPrediction: prediction,
            bsConfidence: 78,
            colorPrediction: colorPred.color,
            colorConfidence: colorPred.confidence,
            numberPrediction: numPred.number,
            numberConfidence: numPred.confidence,
            matchType: "✅ ALTERNATING PATTERN",
            exactMatch: false,
            patternId: null
        };
    }

    return null;
}

// ==================== API FETCH ====================
let lastProcessedPeriod = null;

async function fetchLiveResult() {
    try {
        const response = await fetch(API_URL + "?ts=" + Date.now(), { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();

        if (data?.data?.list?.length > 0) {
            const latest = data.data.list[0];
            
            let period = null;
            if (latest.issueNumber) period = normalizePeriod(latest.issueNumber);
            if (!period && latest.IssueNumber) period = normalizePeriod(latest.IssueNumber);
            if (!period && latest.period) period = normalizePeriod(latest.period);
            if (!period) period = Date.now().toString().slice(-6);
            
            const num = parseInt(latest.number || latest.num || latest.Number);
            const type = num >= 5 ? "Big" : "Small";

            document.getElementById('apiDot').className = 'api-dot live';
            document.getElementById('apiText').innerHTML = '● API LIVE · WINGO 30S';
            document.getElementById('periodDisplay').innerHTML = `PERIOD: ${period.slice(-6)}`;

            if (lastProcessedPeriod === period) return;
            lastProcessedPeriod = period;
            
            liveHistory.unshift({ period, num, type });
            if (liveHistory.length > 5000) liveHistory.pop();
            updateHistoryTable();

            if (pendingVerification) {
                const predictedResult = liveHistory.find(r => r.period === pendingVerification.period);
                if (predictedResult) {
                    const isWin = pendingVerification.prediction === predictedResult.type;
                    if (pendingVerification.patternId) {
                        await updateSinglePatternReliability(pendingVerification.patternId, isWin);
                    }
                    pendingVerification = null;
                }
            }

            const recent9 = liveHistory.slice(0, PATTERN_LENGTH).map(r => r.type);
            if (recent9.length === PATTERN_LENGTH && liveHistory.length >= PATTERN_LENGTH) {
                const result = await predictAll(recent9);
                if (result) {
                    const targetPeriod = nextPeriod(period);
                    pendingVerification = {
                        prediction: result.bsPrediction,
                        period: targetPeriod,
                        timestamp: Date.now(),
                        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 3),
                        patternId: result.patternId
                    };
                    updatePredictionUI(result, targetPeriod);
                }
            }
        }
    } catch (error) {
        document.getElementById('apiDot').className = 'api-dot off';
        document.getElementById('apiText').innerHTML = '⚠ API OFFLINE';
    }
}

// ==================== DATABASE RELIABILITY ====================
async function updateSinglePatternReliability(patternId, isWin) {
    if (!patternId) return;
    
    try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const request = store.get(patternId);
        request.onsuccess = () => {
            const p = request.result;
            if (p) {
                if (isWin) p.wins = (p.wins || 0) + 1;
                else p.losses = (p.losses || 0) + 1;
                p.reliability = (p.wins || 0) / ((p.wins || 0) + (p.losses || 0) + 0.1);
                p.lastUsed = Date.now();
                store.put(p);
            }
        };
        request.onerror = () => console.error("Failed to update pattern reliability");
    } catch (e) {
        console.error("Error updating pattern reliability:", e);
    }
}

// ==================== DATABASE OPERATIONS ====================
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { 
            db = request.result; 
            dbReady = true;
            resolve(db); 
        };
        request.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(STORE_NAME)) {
                d.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function getPatternCount() {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const count = store.count();
        count.onsuccess = () => resolve(count.result);
        count.onerror = () => resolve(0);
    });
}

async function getAllPatterns() {
    if (!db) return [];
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        } catch (e) {
            console.error('getAllPatterns error:', e);
            resolve([]);
        }
    });
}

async function savePattern(pattern, nextResult, nextResultNum, imageData = null, source = 'import') {
    if (!db) {
        console.error('DB not ready');
        return false;
    }
    
    try {
        const existing = await getAllPatterns();
        if (source !== 'import') return false;
        if (existing.length >= MAX_PATTERNS) return false;

        const key = pattern.join(',') + '|' + nextResult + '|' + nextResultNum;
        const isDuplicate = existing.some(p => 
            p.pattern && p.pattern.join(',') + '|' + p.nextResult + '|' + p.nextResultNum === key
        );
        if (isDuplicate) return false;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const record = { 
                    pattern, 
                    nextResult, 
                    nextResultNum, 
                    imageData, 
                    source: 'import',
                    timestamp: Date.now(),
                    wins: 0,
                    losses: 0,
                    reliability: 0.5,
                    lastUsed: Date.now()
                };
                const request = store.add(record);
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            } catch (e) {
                console.error('savePattern error:', e);
                resolve(false);
            }
        });
    } catch (e) {
        console.error('savePattern error:', e);
        return false;
    }
}

async function deleteAllPatterns() {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
    });
}

// ==================== IMPORT ====================
async function importData() {
    if (!db || !dbReady) {
        showToast('⏳ Database is initializing. Please wait...', false);
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!Array.isArray(data) || data.length === 0) {
                showToast('❌ Invalid file format!', false);
                return;
            }
            
            if (!db) {
                showToast('❌ Database not ready. Please refresh and try again.', false);
                return;
            }
            
            let imported = 0;
            let skipped = 0;
            
            for (const item of data) {
                if (!item.pattern || !item.nextResult) {
                    skipped++;
                    continue;
                }
                
                try {
                    const existing = await getAllPatterns();
                    const key = item.pattern.join(',') + '|' + item.nextResult + '|' + item.nextResultNum;
                    const exists = existing.some(p => 
                        p.pattern && p.pattern.join(',') + '|' + p.nextResult + '|' + p.nextResultNum === key
                    );
                    
                    if (!exists) {
                        const saved = await savePattern(
                            item.pattern,
                            item.nextResult,
                            item.nextResultNum || (item.nextResult === 'Big' ? 7 : 2),
                            null,
                            'import'
                        );
                        if (saved) imported++;
                        else skipped++;
                    } else {
                        skipped++;
                    }
                } catch (err) {
                    console.error('Import item error:', err);
                    skipped++;
                }
            }
            
            await updateStorageStats();
            showToast(`✅ Imported: ${imported} new | Skipped: ${skipped} (duplicates)`);
        } catch (e) {
            showToast('❌ Import failed: ' + e.message, false);
            console.error('Import error:', e);
        }
    };
    input.click();
}

// ==================== UI UPDATES ====================
function updatePredictionUI(result, targetPeriod) {
    const bsPred = document.getElementById('bsPrediction');
    bsPred.textContent = result.bsPrediction.toUpperCase();
    bsPred.className = 'pred-card-value ' + (result.bsPrediction === 'Big' ? 'big' : 'small');
    document.getElementById('bsConfidence').textContent = result.bsConfidence + '%';

    const colorInfo = getColorFromNumber(result.numberPrediction);
    const colorBall = document.getElementById('colorBall');
    colorBall.className = 'color-ball ' + colorInfo.css;
    colorBall.textContent = colorInfo.value.charAt(0);
    document.getElementById('colorPrediction').textContent = result.colorPrediction;
    document.getElementById('colorPrediction').className = 'pred-card-value ' + colorInfo.class;
    document.getElementById('colorConfidence').textContent = result.colorConfidence + '%';

    document.getElementById('numberPrediction').textContent = result.numberPrediction;
    document.getElementById('numberConfidence').textContent = result.numberConfidence + '%';

    const avgConf = result.bsConfidence;
    const confClass = avgConf >= 75 ? 'high' : (avgConf >= 60 ? 'mid' : 'low');
    const bar = document.getElementById('confidenceBar');
    bar.className = 'conf-fill ' + confClass;
    bar.style.width = avgConf + '%';
    document.getElementById('confPct').textContent = avgConf + '%';

    const pattern = liveHistory.slice(0, PATTERN_LENGTH).map(r => r.type);
    const displayPeriod = targetPeriod ? normalizePeriod(targetPeriod) : '---';
    document.getElementById('patternDisplay').innerHTML = 
        `📋 LAST ${PATTERN_LENGTH}: ${pattern.join(' → ')} → [PREDICT: ${result.bsPrediction}]`;
    document.getElementById('matchInfo').innerHTML = 
        `${result.matchType} · ${avgConf}% overall · TARGET: ${displayPeriod}`;

    document.getElementById('ticker').innerHTML =
        `<span>⚡ NEXT: ${result.bsPrediction}</span><span>CONF: ${avgConf}%</span>`.repeat(2);
}

function updateHistoryTable() {
    const tbody = document.getElementById('historyTable');
    tbody.innerHTML = '';
    liveHistory.slice(0, 10).forEach(r => {
        const colorInfo = getColorFromNumber(r.num);
        const tr = document.createElement('tr');
        const displayPeriod = r.period ? normalizePeriod(r.period) : '---';
        tr.innerHTML = `<td>${displayPeriod}</td><td style="color:${colorInfo.color === 'Green' ? '#00cc66' : colorInfo.color === 'Red' ? '#ff2244' : '#aa44ff'}">${r.num}</td><td class="${r.type === 'Big' ? 'tb' : 'ts'}">${r.type}</td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('liveCount').textContent = liveHistory.length;
}

async function updateStorageStats() {
    const all = await getAllPatterns();
    const ocrCount = all.filter(p => p.source !== 'api').length;
    const percent = Math.min(100, (ocrCount / MAX_PATTERNS) * 100);
    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('statCount').textContent = ocrCount;
    document.getElementById('storageBadge').textContent = ocrCount >= MAX_PATTERNS ? '🔴 FULL' : '🟢 ACTIVE';
    document.getElementById('statPatterns').textContent = all.length;
}

function setStatus(msg) {
    const el = document.getElementById('storageStatus');
    if (el) el.textContent = msg;
}

// ==================== TIMER ====================
function updateTimer() {
    const seconds = new Date().getUTCSeconds();
    const remaining = 30 - (seconds % 30);
    document.getElementById('timerDisplay').textContent = remaining + 's';
    fetchLiveResult();
}

// ==================== INIT ====================
async function init() {
    await openDB();
    await updateStorageStats();
    await fetchLiveResult();
    setInterval(updateTimer, 1000);
    setStatus('✅ WINGO 30S · DHARIK AI TOOL SYSTEM READY');
    showToast('✅ Ready! IMPORT is working.', true);
}

// ==================== EVENT LISTENERS ====================
document.getElementById('refreshStatsBtn').addEventListener('click', async () => {
    await updateStorageStats();
    fetchLiveResult();
    setStatus('🔄 Refreshed');
    showToast('🔄 Refreshed');
});

document.getElementById('deleteDataBtn').addEventListener('click', async () => {
    if (!db) {
        showToast('⏳ Database is initializing. Please wait...', false);
        return;
    }
    const count = await getPatternCount();
    if (count === 0) {
        showToast('❌ No data to delete!', false);
        return;
    }
    if (!confirm(`Delete all ${count} stored patterns? This cannot be undone.`)) return;
    await deleteAllPatterns();
    await updateStorageStats();
    showToast(`🗑️ Deleted ${count} patterns successfully!`);
});

document.getElementById('importBtn').addEventListener('click', importData);

// ==================== LICENSE GATE LOGIC ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDDqqd_suR9xbvFSb3XUq1kxmdAp1Q6gpY",
    authDomain: "dharik-ai-tool-26f55.firebaseapp.com",
    projectId: "dharik-ai-tool-26f55",
    storageBucket: "dharik-ai-tool-26f55.firebasestorage.app",
    messagingSenderId: "282249822477",
    appId: "1:282249822477:web:91847c9cc6e9c6464e7044",
    measurementId: "G-8T3H8NZ1J9"
};

const app = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(app);

const gateContainer = document.getElementById('gateContainer');
const licensePage = document.getElementById('licensePage');
const securityGatePage = document.getElementById('securityGatePage');
const mainDashboard = document.getElementById('mainDashboard');
const popup = document.getElementById('popup');
const warningPopup = document.getElementById('warningPopup');
const successPopup = document.getElementById('successPopup');
const popupMessage = document.getElementById('popupMessage');
const warningMessage = document.getElementById('warningMessage');
const successMessage = document.getElementById('successMessage');
const expiryBackground = document.getElementById('expiryBackground');

function getEnhancedBrowserFingerprint() {
    let fingerprint = localStorage.getItem('dharik_enhanced_fingerprint');
    
    if (!fingerprint) {
        const components = [];
        components.push(navigator.userAgent);
        components.push(navigator.language);
        components.push(navigator.platform);
        components.push(screen.width + 'x' + screen.height);
        components.push(screen.colorDepth);
        components.push(new Date().getTimezoneOffset());
        components.push(navigator.hardwareConcurrency || 'unknown');
        
        const fingerprintString = components.join('|');
        
        let hash = 0;
        for (let i = 0; i < fingerprintString.length; i++) {
            const char = fingerprintString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        fingerprint = btoa(Math.abs(hash).toString()).substring(0, 32);
        localStorage.setItem('dharik_enhanced_fingerprint', fingerprint);
    }
    
    return fingerprint;
}

const browserFingerprint = getEnhancedBrowserFingerprint();
let activeKey = null;
let activeDocRef = null;
let unsubscribe = null;
let expiryInterval = null;
let currentExpiryDate = null;

window.goToSecurityGate = function() {
    licensePage.classList.add('hidden');
    securityGatePage.classList.remove('hidden');
    document.getElementById('keyInput').value = '';
    document.getElementById('status').innerText = '';
};

window.logout = function() {
    mainDashboard.classList.add('hidden');
    gateContainer.classList.remove('hidden');
    licensePage.classList.remove('hidden');
    securityGatePage.classList.add('hidden');
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    if (expiryInterval) {
        clearInterval(expiryInterval);
        expiryInterval = null;
    }
    expiryBackground.style.display = 'none';
    activeKey = null;
    activeDocRef = null;
    currentExpiryDate = null;
};

window.closePopup = function() { popup.style.display = 'none'; };
window.closeWarningPopup = function() { warningPopup.style.display = 'none'; };
window.closeSuccessPopup = function() { successPopup.style.display = 'none'; };

function forceLogout(reason) {
    if (!mainDashboard.classList.contains('hidden')) {
        mainDashboard.classList.add('hidden');
        gateContainer.classList.remove('hidden');
        licensePage.classList.remove('hidden');
        securityGatePage.classList.add('hidden');
        
        if (reason === 'different_browser') {
            warningMessage.innerText = 'This key is already active in another browser/device!';
            warningPopup.style.display = 'block';
        } else if (reason === 'revoked') {
            popupMessage.innerText = 'Key has been revoked by admin!';
            popup.style.display = 'block';
        } else if (reason === 'expired') {
            popupMessage.innerText = 'Key has expired!';
            popup.style.display = 'block';
        }
        
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        if (expiryInterval) {
            clearInterval(expiryInterval);
            expiryInterval = null;
        }
        expiryBackground.style.display = 'none';
        activeKey = null;
        activeDocRef = null;
        currentExpiryDate = null;
    }
}

function setupKeyListener(docRef) {
    if (unsubscribe) unsubscribe();
    
    unsubscribe = onSnapshot(docRef, (doc) => {
        if (!doc.exists()) {
            forceLogout('revoked');
            return;
        }
        
        const data = doc.data();
        const now = new Date();
        const expiry = data.expiry ? data.expiry.toDate() : null;
        
        if (data.status !== 'active') {
            forceLogout('revoked');
            return;
        }
        
        if (expiry && now > expiry) {
            forceLogout('expired');
            return;
        }
        
        if (data.deviceid && data.deviceid !== browserFingerprint) {
            forceLogout('different_browser');
            return;
        }
    });
}

window.checkKey = async function() {
    const input = document.getElementById('keyInput').value.trim();
    const status = document.getElementById('status');

    if (!input) {
        status.innerText = "❗ Enter License Key";
        status.style.color = "red";
        return;
    }

    status.innerText = "⏳ Verifying...";
    status.style.color = "#333";

    try {
        const q = query(collection(firestoreDb, "licenses"), where("key", "==", input));
        const snap = await getDocs(q);

        if (snap.empty) {
            status.innerText = "❌ INVALID KEY";
            status.style.color = "red";
            popupMessage.innerText = "Invalid License Key";
            popup.style.display = "block";
            return;
        }

        const docSnap = snap.docs[0];
        const data = docSnap.data();
        const ref = doc(firestoreDb, "licenses", docSnap.id);

        if (data.status !== "active") {
            status.innerText = "❌ KEY REVOKED";
            status.style.color = "red";
            popupMessage.innerText = "Key has been revoked!";
            popup.style.display = "block";
            return;
        }

        const now = new Date();
        const expiry = data.expiry.toDate();

        if (now > expiry) {
            status.innerText = "❌ KEY EXPIRED";
            status.style.color = "red";
            popupMessage.innerText = "Key has expired!";
            popup.style.display = "block";
            return;
        }

        if (data.deviceid && data.deviceid !== browserFingerprint) {
            status.innerText = "❌ ALREADY IN USE";
            status.style.color = "red";
            warningMessage.innerText = 'This key is already active in another browser/device!';
            warningPopup.style.display = 'block';
            return;
        }

        activeKey = input;
        
        if (!data.deviceid) {
            await updateDoc(ref, { deviceid: browserFingerprint });
        }

        status.innerText = "✅ ACCESS GRANTED";
        status.style.color = "green";
        
        activeDocRef = ref;
        currentExpiryDate = expiry;
        
        expiryBackground.style.display = "flex";
        
        setupKeyListener(ref);
        
        updateExpiryCountdown(expiry);
        if (expiryInterval) clearInterval(expiryInterval);
        expiryInterval = setInterval(() => updateExpiryCountdown(expiry), 1000);

        setTimeout(() => {
            gateContainer.classList.add('hidden');
            securityGatePage.classList.add('hidden');
            mainDashboard.classList.remove('hidden');
            init();
        }, 1500);
    } catch (error) {
        console.error("Verification error:", error);
        status.innerText = "❌ ERROR";
        status.style.color = "red";
        popupMessage.innerText = "Connection error. Try again!";
        popup.style.display = "block";
    }
};

function updateExpiryCountdown(expiryDate) {
    const now = new Date();
    const timeLeft = expiryDate - now;
    
    if (timeLeft <= 0) {
        document.getElementById('expiryText').innerHTML = "⚠️ LICENSE EXPIRED";
        forceLogout('expired');
        return;
    }
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    document.getElementById('expiryText').innerHTML = `⏳ ${days}d ${hours}h ${minutes}m ${seconds}s`;
}

window.onload = function() {
    licensePage.classList.remove('hidden');
    securityGatePage.classList.add('hidden');
    mainDashboard.classList.add('hidden');
};
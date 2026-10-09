/**
 * 3D单词宇宙 - 存储与离线持久化中枢 (含备注与目标纠正版)
 */

const SEED_CORE_WORDS = [
    { words: "she", phonetic: "/ʃiː/", chinese: "pron. 她", part_of_speech: "pron.", root_form: "she", method: "【象形】s似弯腰曲背的女子", notes: [] },
    { words: "milk", phonetic: "/mɪlk/", chinese: "n. 牛奶", part_of_speech: "noun", root_form: "milk", method: "【谐音】妙可 -> 牛奶美味可口", notes: [] },
    { words: "do", phonetic: "/duː/", chinese: "v. 做；干；行动", part_of_speech: "verb", root_form: "do", method: "【联想】Just do it！", notes: [] },
    { words: "first", phonetic: "/fɜːst/", chinese: "adj. 第一的；最初的", part_of_speech: "adj.", root_form: "first", method: "【词根】fir(最前) + st", notes: [] },
    { words: "this", phonetic: "/ðɪs/", chinese: "pron. 这个；这", part_of_speech: "pron.", root_form: "this", method: "【基础】指代近处的人或物", notes: [] },
    { words: "play", phonetic: "/pleɪ/", chinese: "v. 玩耍；演奏；比赛", part_of_speech: "verb", root_form: "play", method: "【联想】扑克牌打出 -> 玩", notes: [] },
    { words: "red", phonetic: "/red/", chinese: "adj. 红色的 n. 红色", part_of_speech: "adj.", root_form: "red", method: "【联想】火焰与朝霞的颜色", notes: [] },
    { words: "sun", phonetic: "/sʌn/", chinese: "n. 太阳；阳光", part_of_speech: "noun", root_form: "sun", method: "【天象】天空中最耀眼的光源", notes: [] },
    { words: "hot", phonetic: "/hɒt/", chinese: "adj. 热的；辣的", part_of_speech: "adj.", root_form: "hot", method: "【感受】烈日下灼热的感觉", notes: [] },
    { words: "study", phonetic: "/ˈstʌdi/", chinese: "v. 学习；研究 n. 书房", part_of_speech: "verb", root_form: "study", method: "【成长】汲取智慧与新知", notes: [] }
];

function buildFullSphereFallbackWords(targetCount = 500) {
    const fullList = [];
    const seedLen = SEED_CORE_WORDS.length;
    for (let i = 0; i < targetCount; i++) {
        const item = SEED_CORE_WORDS[i % seedLen];
        fullList.push({
            num: `core_word_${i + 1}`,
            words: item.words,
            phonetic: item.phonetic,
            chinese: item.chinese,
            part_of_speech: item.part_of_speech,
            root_form: item.root_form,
            method: item.method,
            notes: [],
            grade: "核心词汇",
            term: "1",
            unit: `Unit ${(i % 12) + 1}`,
            Source: "内置3D高频库"
        });
    }
    return fullList;
}

const idbHelper = {
    db: null,
    async initDB(dbName, version, storeConfig) {
        if (this.db) return this.db;
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open(dbName, version);
                request.onerror = () => resolve(null);
                request.onsuccess = (e) => { 
                    this.db = e.target.result; 
                    resolve(this.db); 
                };
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (db.objectStoreNames.contains(storeConfig.name)) {
                        db.deleteObjectStore(storeConfig.name);
                    }
                    db.createObjectStore(storeConfig.name, storeConfig.options);
                };
            } catch (err) {
                resolve(null);
            }
        });
    },
    async setAll(storeName, items) {
        if (!this.db) return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
            items.forEach(item => store.put(item));
        });
    },
    async getAll(storeName) {
        if (!this.db) return [];
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    },
    async clear(storeName) {
        if (!this.db) return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
};

const AppStorage = {
    async init() {
        try {
            await idbHelper.initDB('WordUniverseDB_V2', 2, {
                name: 'wordLibraries',
                options: { keyPath: 'num' }
            });
        } catch (e) {}
    },

    async loadLibrary() {
        try {
            const records = await idbHelper.getAll('wordLibraries');
            const master = records.find(r => r.num === 'packed_master');
            if (master && Array.isArray(master.data) && master.data.length > 0) {
                return master.data;
            }
        } catch (e) {}

        const localBackup = safeJSONParse(localStorage.getItem('3DWordUniverse_MasterBackup'), null);
        if (Array.isArray(localBackup) && localBackup.length > 0) {
            return localBackup;
        }

        const seededWords = buildFullSphereFallbackWords(500);
        await this.saveLibrary(seededWords);
        return seededWords;
    },

    async saveLibrary(wordsArray) {
        if (!Array.isArray(wordsArray)) return;
        try {
            await idbHelper.clear('wordLibraries');
            await idbHelper.setAll('wordLibraries', [{ num: 'packed_master', data: wordsArray }]);
            localStorage.setItem('3DWordUniverse_MasterBackup', JSON.stringify(wordsArray.slice(0, 500)));
        } catch (e) {}
    },

    loadViewedWords() {
        const raw = localStorage.getItem(APP_CONFIG.VIEWED_WORDS_STORAGE_KEY);
        return raw ? new Set(safeJSONParse(raw, [])) : new Set();
    },

    saveViewedWords(viewedSet) {
        localStorage.setItem(APP_CONFIG.VIEWED_WORDS_STORAGE_KEY, JSON.stringify(Array.from(viewedSet)));
    },

    loadShieldedWords() {
        const raw = localStorage.getItem('shieldedWordsV8');
        return raw ? new Set(safeJSONParse(raw, [])) : new Set();
    },

    saveShieldedWords(shieldedSet) {
        localStorage.setItem('shieldedWordsV8', JSON.stringify(Array.from(shieldedSet)));
    },

    loadStudyLog() {
        try {
            const raw = localStorage.getItem(APP_CONFIG.STUDY_LOG_STORAGE_KEY);
            const d = raw ? JSON.parse(raw) : {};
            return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
        } catch (e) { return {}; }
    },

    saveStudyLog(log) {
        localStorage.setItem(APP_CONFIG.STUDY_LOG_STORAGE_KEY, JSON.stringify(log));
    },

    getStudyGoal() {
        const v = parseInt(localStorage.getItem(APP_CONFIG.STUDY_GOAL_STORAGE_KEY), 10);
        return (isNaN(v) || v < 1) ? 50 : v;
    },

    setStudyGoal(val) {
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 1) return false;
        localStorage.setItem(APP_CONFIG.STUDY_GOAL_STORAGE_KEY, String(n));
        return true;
    },

    getTodayStudiedCount() {
        const log = this.loadStudyLog();
        const day = log[getDateKey()];
        return (day && day.cards && typeof day.cards === 'object') ? Object.keys(day.cards).length : 0;
    },

    // 严谨的学习记录：杜绝未开始前误报目标达成
    recordStudyClick(word) {
        if (!word) return { count: 0, justReached: false };
        const now = new Date();
        const dayKey = getDateKey(now);
        const log = this.loadStudyLog();
        if (!log[dayKey] || typeof log[dayKey] !== 'object' || !log[dayKey].cards) {
            log[dayKey] = { cards: {} };
        }
        const key = getWordKey(word);
        const cards = log[dayKey].cards;
        const prevCount = Object.keys(cards).length;

        let entry = cards[key];
        if (!entry) {
            entry = {
                num: word.num,
                words: word.words || '',
                phonetic: word.phonetic || '',
                chinese: word.chinese || '',
                clickTimes: 0,
                lastAt: timeHHMM(now)
            };
            cards[key] = entry;
        }
        entry.clickTimes++;
        entry.lastAt = timeHHMM(now);
        this.saveStudyLog(log);

        const currentCount = Object.keys(cards).length;
        const goal = this.getStudyGoal();
        const toastKey = '3DWordUniverseToastGoal_' + dayKey;

        // 仅当今日有效学习量确实从小于目标跨越到大于等于目标时，才触发一次
        let justReached = false;
        if (prevCount < goal && currentCount >= goal && !localStorage.getItem(toastKey)) {
            localStorage.setItem(toastKey, 'true');
            justReached = true;
        }
        return { count: currentCount, justReached };
    }
};

window.AppStorage = AppStorage;
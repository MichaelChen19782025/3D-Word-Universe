/**
 * 3D单词宇宙 - 存储与离线容灾管理中枢
 * 修复学习日志记录逻辑与目标达成事件响应
 */

const SEED_CORE_WORDS = [
    { words: "she", phonetic: "/ʃiː/", chinese: "pron. 她", part_of_speech: "pron.", root_form: "she", method: "【象形】s似弯腰曲背的女子" },
    { words: "milk", phonetic: "/mɪlk/", chinese: "n. 牛奶", part_of_speech: "noun", root_form: "milk", method: "【谐音】妙可 -> 牛奶美味可口" },
    { words: "do", phonetic: "/duː/", chinese: "v. 做；干；行动", part_of_speech: "verb", root_form: "do", method: "【联想】Just do it！" },
    { words: "first", phonetic: "/fɜːst/", chinese: "adj. 第一的；最初的", part_of_speech: "adj.", root_form: "first", method: "【词根】fir(最前) + st" },
    { words: "this", phonetic: "/ðɪs/", chinese: "pron. 这个；这", part_of_speech: "pron.", root_form: "this", method: "【基础】指代近处的人或物" },
    { words: "play", phonetic: "/pleɪ/", chinese: "v. 玩耍；演奏；比赛", part_of_speech: "verb", root_form: "play", method: "【联想】扑克牌打出 -> 玩" },
    { words: "red", phonetic: "/red/", chinese: "adj. 红色的 n. 红色", part_of_speech: "adj.", root_form: "red", method: "【联想】火焰与朝霞的颜色" },
    { words: "sun", phonetic: "/sʌn/", chinese: "n. 太阳；阳光", part_of_speech: "noun", root_form: "sun", method: "【天象】天空中最耀眼的光源" },
    { words: "hot", phonetic: "/hɒt/", chinese: "adj. 热的；辣的", part_of_speech: "adj.", root_form: "hot", method: "【感受】烈日下灼热的感觉" },
    { words: "farm", phonetic: "/fɑːm/", chinese: "n. 农场；农庄", part_of_speech: "noun", root_form: "farm", method: "【场景】田野、牲畜与庄稼" },
    { words: "cool", phonetic: "/kuːl/", chinese: "adj. 凉爽的；酷的", part_of_speech: "adj.", root_form: "cool", method: "【联想】微风拂面的清凉" },
    { words: "nine", phonetic: "/naɪn/", chinese: "num. 九", part_of_speech: "num.", root_form: "nine", method: "【数字】个位数中最大的数字" },
    { words: "class", phonetic: "/klɑːs/", chinese: "n. 班级；阶层；课", part_of_speech: "noun", root_form: "class", method: "【场景】同窗共同学习的集体" },
    { words: "fish", phonetic: "/fɪʃ/", chinese: "n. 鱼 v. 钓鱼", part_of_speech: "noun", root_form: "fish", method: "【象形】水里游动带有鳞片的生物" },
    { words: "hair", phonetic: "/heə(r)/", chinese: "n. 头发；毛发", part_of_speech: "noun", root_form: "hair", method: "【联想】乌黑柔顺的长发" },
    { words: "can", phonetic: "/kæn/", chinese: "v. 能；可以 n. 罐头", part_of_speech: "verb", root_form: "can", method: "【情态】表示能力或许可" },
    { words: "has", phonetic: "/hæz/", chinese: "v. 有；吃（第三人称单数）", part_of_speech: "verb", root_form: "have", method: "【语法】have的三单形式" },
    { words: "fan", phonetic: "/fæn/", chinese: "n. 风扇；扇子；迷", part_of_speech: "noun", root_form: "fan", method: "【功能】扇动带来凉爽之风" },
    { words: "living", phonetic: "/ˈlɪvɪŋ/", chinese: "n. 生活；生存 adj. 活的", part_of_speech: "noun", root_form: "live", method: "【联想】充满生命力的律动" },
    { words: "like", phonetic: "/laɪk/", chinese: "v. 喜欢 prep. 像", part_of_speech: "verb", root_form: "like", method: "【情感】由衷地心生欢喜" },
    { words: "room", phonetic: "/ruːm/", chinese: "n. 房间；空间", part_of_speech: "noun", root_form: "room", method: "【空间】四壁围成的温馨居所" },
    { words: "wait", phonetic: "/weɪt/", chinese: "v. 等待；等候", part_of_speech: "verb", root_form: "wait", method: "【场景】守候时间的流逝" },
    { words: "fridge", phonetic: "/frɪdʒ/", chinese: "n. 冰箱", part_of_speech: "noun", root_form: "fridge", method: "【电器】低温保鲜食物的设备" },
    { words: "dinner", phonetic: "/ˈdɪnə(r)/", chinese: "n. 正餐；晚餐", part_of_speech: "noun", root_form: "dinner", method: "【生活】一家人欢聚的晚宴" },
    { words: "math", phonetic: "/mæθ/", chinese: "n. 数学", part_of_speech: "noun", root_form: "math", method: "【学科】逻辑与数字的奥秘" },
    { words: "people", phonetic: "/ˈpiːpl/", chinese: "n. 人们；人民", part_of_speech: "noun", root_form: "people", method: "【社会】万千众生的总称" },
    { words: "ready", phonetic: "/ˈredi/", chinese: "adj. 准备好的", part_of_speech: "adj.", root_form: "ready", method: "【状态】万事俱备，整装待发" },
    { words: "study", phonetic: "/ˈstʌdi/", chinese: "v. 学习；研究 n. 书房", part_of_speech: "verb", root_form: "study", method: "【成长】汲取智慧与新知" },
    { words: "sports", phonetic: "/spɔːts/", chinese: "n. 运动；体育活动", part_of_speech: "noun", root_form: "sport", method: "【活力】挥洒汗水的强健之举" },
    { words: "boy", phonetic: "/bɔɪ/", chinese: "n. 男孩", part_of_speech: "noun", root_form: "boy", method: "【形象】活泼朝气的少年" }
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
        } catch (e) {
            console.warn('IDB 初始化捕获异常:', e);
        }
    },

    async loadLibrary() {
        try {
            const records = await idbHelper.getAll('wordLibraries');
            const master = records.find(r => r.num === 'packed_master');
            if (master && Array.isArray(master.data) && master.data.length > 0) {
                return master.data;
            }
        } catch (e) {
            console.warn('IDB 读取失败，正在检查本地镜像备份:', e);
        }

        const localBackup = safeJSONParse(localStorage.getItem('3DWordUniverse_MasterBackup'), null);
        if (Array.isArray(localBackup) && localBackup.length > 0) {
            return localBackup;
        }

        console.log('未检测到外置词库，自动注入饱满的 500 张核心 3D 魔法球卡片...');
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
        } catch (e) {
            console.error('词库持久化存储异常:', e);
        }
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

    // 记录点击复习并判断今日目标是否首次达成
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
        let entry = cards[key];
        if (!entry) {
            entry = {
                num: word.num,
                words: word.words || '',
                phonetic: word.phonetic || '',
                chinese: word.chinese || '',
                clickTimes: 0,
                firstAt: timeHHMM(now),
                lastAt: timeHHMM(now),
                clicks: []
            };
            cards[key] = entry;
        }
        entry.clickTimes++;
        entry.lastAt = timeHHMM(now);
        if (!Array.isArray(entry.clicks)) entry.clicks = [];
        entry.clicks.push(timeHHMM(now));
        this.saveStudyLog(log);

        const count = Object.keys(cards).length;
        const goal = this.getStudyGoal();
        const toastKey = '3DWordUniverseToastGoal_' + dayKey;
        let justReached = false;
        if (count >= goal && !localStorage.getItem(toastKey)) {
            localStorage.setItem(toastKey, 'true');
            justReached = true;
        }
        return { count, justReached };
    }
};

window.AppStorage = AppStorage;
window.idbHelper = idbHelper;
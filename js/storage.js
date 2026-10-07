/**
 * 3D单词宇宙 - 存储与离线容灾管理中枢
 * 包含开箱即用内置高频词库，保障清除缓存后绝不黑屏卡死！
 */

// 内置高频兜底词库（当缓存或本地数据库完全为空时自动装载）
const DEFAULT_FALLBACK_WORDS = [
    {
        num: "init_1", words: "universe", phonetic: "/ˈjuːnɪvɜːs/",
        chinese: "n. 宇宙；天地万物；领域", "part of speech": "noun",
        root_form: "uni-(单一) + vers(转) + -e",
        method: "【词根记忆】uni(单一) + vers(旋转) -> 万物同旋归于一体 -> 宇宙",
        grade: "CET4/高中", term: "1", unit: "Unit 1", Source: "内置核心库"
    },
    {
        num: "init_2", words: "galaxy", phonetic: "/ˈɡæləksi/",
        chinese: "n. 银河；星系；群英", "part of speech": "noun",
        root_form: "galax-(乳汁) + -y",
        method: "【联想记忆】源自希腊神话如同喷洒在夜空的乳汁 -> 银河系",
        grade: "CET4", term: "1", unit: "Unit 1", Source: "内置核心库"
    },
    {
        num: "init_3", words: "nebula", phonetic: "/ˈnebjələ/",
        chinese: "n. 星云；云状斑点", "part of speech": "noun",
        root_form: "nebul-(雾、云) + -a",
        method: "【词根记忆】nebul(雾气) -> 宇宙深处如雾一般的发光天体 -> 星云",
        grade: "CET6/GRE", term: "2", unit: "Unit 1", Source: "内置核心库"
    },
    {
        num: "init_4", words: "cosmos", phonetic: "/ˈkɒzmɒs/",
        chinese: "n. 和谐的宇宙；秩序", "part of speech": "noun",
        root_form: "kosmos(秩序、美丽)",
        method: "【反义联想】与 chaos(混乱) 相对，代表秩序井然的壮丽宇宙",
        grade: "CET6", term: "1", unit: "Unit 1", Source: "内置核心库"
    },
    {
        num: "init_5", words: "constellation", phonetic: "/ˌkɒnstəˈleɪʃn/",
        chinese: "n. 星座；荟萃", "part of speech": "noun",
        root_form: "con-(一起) + stell-(星) + -ation",
        method: "【词根记忆】con(聚合) + stell(繁星) + ation -> 聚在一起的群星 -> 星座",
        grade: "CET6/IELTS", term: "1", unit: "Unit 2", Source: "内置核心库"
    },
    {
        num: "init_6", words: "luminescent", phonetic: "/ˌluːmɪˈnesnt/",
        chinese: "adj. 发冷光的；发光的", "part of speech": "adj",
        root_form: "lumin-(光) + -escent(渐起的)",
        method: "【词根记忆】lumin(光辉) + escent -> 在深邃宇宙中闪烁微光的",
        grade: "TOEFL", term: "2", unit: "Unit 2", Source: "内置核心库"
    },
    {
        num: "init_7", words: "resilience", phonetic: "/rɪˈzɪliəns/",
        chinese: "n. 韧性；复原力；弹力", "part of speech": "noun",
        root_form: "re-(回) + sili-(跳) + -ence",
        method: "【词根记忆】re(向后/重新) + sili(弹跳) -> 受击后迅速弹回原状 -> 坚韧",
        grade: "CET6/IELTS", term: "1", unit: "Unit 3", Source: "内置核心库"
    },
    {
        num: "init_8", words: "ephemeral", phonetic: "/ɪˈfemərəl/",
        chinese: "adj. 短暂的；朝生暮死的", "part of speech": "adj",
        root_form: "epi-(在...上) + hemera(日子) + -al",
        method: "【联想记忆】流星划过夜空，绚烂却只存在于朝夕之间 -> 短暂的",
        grade: "GRE", term: "2", unit: "Unit 3", Source: "内置核心库"
    },
    {
        num: "init_9", words: "serendipity", phonetic: "/ˌserənˈdɪpəti/",
        chinese: "n. 意外发现珍奇事物的本领；意外之喜", "part of speech": "noun",
        root_form: "Serendip(锡兰古名)",
        method: "【故事联想】童话《锡兰三王子》总是在旅途中意外收获奇珍 -> 偶得机缘",
        grade: "IELTS/GRE", term: "1", unit: "Unit 3", Source: "内置核心库"
    },
    {
        num: "init_10", words: "solitude", phonetic: "/ˈsɒlətjuːd/",
        chinese: "n. 独处；幽静；隐居", "part of speech": "noun",
        root_form: "sol-(单独) + -itude(状态)",
        method: "【词根记忆】soli(独单一) + tude -> 享受独自沉浸在知识星空中的宁静",
        grade: "CET4", term: "2", unit: "Unit 4", Source: "内置核心库"
    },
    {
        num: "init_11", words: "wanderlust", phonetic: "/ˈwɒndəlʌst/",
        chinese: "n. 漫游癖；旅行热", "part of speech": "noun",
        root_form: "wander(漫步) + lust(渴望)",
        method: "【组合记忆】wander(流浪) + lust(强烈渴望) -> 对探索未知的无尽向往",
        grade: "CET6", term: "2", unit: "Unit 4", Source: "内置核心库"
    },
    {
        num: "init_12", words: "equilibrium", phonetic: "/ˌiːkwɪˈlɪbriəm/",
        chinese: "n. 平衡；均衡；平静", "part of speech": "noun",
        root_form: "equi-(平等) + libr-(天平) + -ium",
        method: "【词根记忆】equi(同等) + libr(天平) -> 两侧完全对等 -> 平衡状态",
        grade: "CET6/TOEFL", term: "1", unit: "Unit 5", Source: "内置核心库"
    },
    {
        num: "init_13", words: "symphony", phonetic: "/ˈsɪmfəni/",
        chinese: "n. 交响乐；和谐协奏", "part of speech": "noun",
        root_form: "sym-(共同) + phon-(声音) + -y",
        method: "【词根记忆】sym(协同一体) + phon(音调) -> 多重旋律交织鸣响",
        grade: "CET4", term: "1", unit: "Unit 5", Source: "内置核心库"
    },
    {
        num: "init_14", words: "horizon", phonetic: "/həˈraɪzn/",
        chinese: "n. 地平线；视野；眼界", "part of speech": "noun",
        root_form: "horiz-(界线) + -on",
        method: "【场景联想】目光所及与宇宙天幕相接的遥远界线 -> 眼界",
        grade: "CET4", term: "2", unit: "Unit 5", Source: "内置核心库"
    },
    {
        num: "init_15", words: "alchemy", phonetic: "/ˈælkəmi/",
        chinese: "n. 炼金术；神秘魔力", "part of speech": "noun",
        root_form: "al-(阿拉伯冠词) + khemia(埃及原意)",
        method: "【联想记忆】单词经过联想重组，在脑海中点石成金的魔法",
        grade: "CET6", term: "2", unit: "Unit 6", Source: "内置核心库"
    },
    {
        num: "init_16", words: "chronicle", phonetic: "/ˈkrɒnɪkl/",
        chinese: "n. 编年史；叙事记", "part of speech": "noun",
        root_form: "chron-(时间) + -icle",
        method: "【词根记忆】chron(时光岁月) + icle -> 记载时间流逝的历史长卷",
        grade: "CET6", term: "1", unit: "Unit 6", Source: "内置核心库"
    },
    {
        num: "init_17", words: "metamorphosis", phonetic: "/ˌmetəˈmɔːfəsɪs/",
        chinese: "n. 蜕变；变形；质变", "part of speech": "noun",
        root_form: "meta-(改变) + morph-(形状) + -osis(过程)",
        method: "【词根记忆】meta(跨越转变) + morph(形态) -> 破茧成蝶的飞跃",
        grade: "GRE", term: "2", unit: "Unit 6", Source: "内置核心库"
    },
    {
        num: "init_18", words: "paradox", phonetic: "/ˈpærədɒks/",
        chinese: "n. 悖论；自相矛盾的人或事", "part of speech": "noun",
        root_form: "para-(超越/对抗) + dox-(观点)",
        method: "【词根记忆】para(相反) + dox(观点) -> 似乎荒谬实则蕴含真理的话",
        grade: "CET6", term: "1", unit: "Unit 7", Source: "内置核心库"
    },
    {
        num: "init_19", words: "zenith", phonetic: "/ˈzenɪθ/",
        chinese: "n. 天顶；鼎盛时期", "part of speech": "noun",
        root_form: "samt(头顶天穹方向)",
        method: "【方位联想】仰望星空的最最高点 -> 辉煌至极的高光时刻",
        grade: "GRE", term: "2", unit: "Unit 7", Source: "内置核心库"
    },
    {
        num: "init_20", words: "infinite", phonetic: "/ˈɪnfɪnət/",
        chinese: "adj. 无限的；无边无际的", "part of speech": "adj",
        root_form: "in-(无) + fin-(界限) + -ite",
        method: "【词根记忆】in(否定) + fin(终点/边界) -> 没有止境的宇宙浩瀚",
        grade: "CET4", term: "1", unit: "Unit 7", Source: "内置核心库"
    }
];

// IndexedDB 本地底层封装
const idbHelper = {
    db: null,
    async initDB(dbName, version, storeConfig) {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(dbName, version);
                request.onerror = (e) => {
                    console.warn('IndexedDB 打开遇到异常，自动降级为内存模式', e);
                    resolve(null);
                };
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
                console.warn('浏览器禁用了 IndexedDB:', err);
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

// 存储对外统一接口 API
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

    // 核心容灾修复：加载词库。若为空，强制装载内置词库并自动落盘
    async loadLibrary() {
        try {
            const records = await idbHelper.getAll('wordLibraries');
            const master = records.find(r => r.num === 'packed_master');
            if (master && Array.isArray(master.data) && master.data.length > 0) {
                return master.data;
            }
        } catch (e) {
            console.warn('IndexedDB 读取词库失败，准备检查降级存储:', e);
        }

        // 二级容灾：尝试从 localStorage 读取备份
        const localBackup = safeJSONParse(localStorage.getItem('3DWordUniverse_MasterBackup'), null);
        if (Array.isArray(localBackup) && localBackup.length > 0) {
            return localBackup;
        }

        // 终极保护：全面清除缓存后的首次启动，自动无损装载内置精品高频词库
        console.log('检测到初次启动或缓存已被清除，正在自动装配内置高频核心词库...');
        await this.saveLibrary(DEFAULT_FALLBACK_WORDS);
        return [...DEFAULT_FALLBACK_WORDS];
    },

    async saveLibrary(wordsArray) {
        if (!Array.isArray(wordsArray)) return;
        try {
            await idbHelper.clear('wordLibraries');
            await idbHelper.setAll('wordLibraries', [{ num: 'packed_master', data: wordsArray }]);
            // 镜像写入 localStorage 保护
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
    }
};

// 挂载全局
window.AppStorage = AppStorage;
window.idbHelper = idbHelper;
window.DEFAULT_FALLBACK_WORDS = DEFAULT_FALLBACK_WORDS;
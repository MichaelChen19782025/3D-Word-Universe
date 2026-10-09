/**
 * 3D单词宇宙 - 全局配置中心、三维运算共享池与基础常量 (V8.5 增强版)
 */
const IS_MOBILE_DEVICE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0);

const AppMath = {
    vecCamWorld: new THREE.Vector3(),
    vecCardWorld: new THREE.Vector3(),
    vecView: new THREE.Vector3(),
    quadParentInv: new THREE.Quaternion(),
    color: new THREE.Color(),
    zAxis: new THREE.Vector3(0, 0, 1)
};
window.AppMath = AppMath;

const APP_CONFIG = {
    DEFAULT_ROTATION_SPEED: 0.135,
    DEFAULT_BATCH_SIZE_CN: IS_MOBILE_DEVICE ? 300 : 800,
    DEFAULT_BATCH_SIZE_EN: IS_MOBILE_DEVICE ? 200 : 500,
    DEFAULT_SPHERE_CARD_FONT_SIZE: 30,
    SPHERE_CARD_FONT_SIZE_OVERALL_FACTOR: 2.33,
    SPHERE_CARD_FONT_SIZE_CLOSEUP_FACTOR: 1.0,
    CAMERA_DISTANCE_THRESHOLD_OVERALL: 200,
    CAMERA_DISTANCE_THRESHOLD_CLOSEUP: 100,

    // 3D 展舱与卡片默认参数
    DEFAULT_CARD_STYLE_PRESET: 'cyber_blue',
    DEFAULT_CARD_CHAMBER_DEPTH: 0.65,
    DEFAULT_CARD_LIGHT_POSITION: 'center',
    DEFAULT_CARD_LIGHT_BRIGHTNESS: 0.85,
    DEFAULT_CARD_LIGHT_COLOR: '#00f0ff',
    DEFAULT_CARD_LIGHT_SPREAD: 0.85,
    DEFAULT_CARD_TEXT_STYLE: 'relief_metal',
    DEFAULT_CARD_OPACITY: 0.96,

    // 查词卡片默认模式
    DEFAULT_HOVER_CARD_STYLE_MODE: 'classic_hud',
    DEFAULT_HOVER_CARD_BRIGHTNESS: 1.0,

    DEFAULT_SPHERE_CARD_FONT_COLOR: '#ffffff',
    DEFAULT_SPHERE_CARD_FONT_FAMILY: "'Microsoft YaHei', sans-serif",
    DEFAULT_SPHERE_CARD_BG_OPACITY: 0.8,
    DEFAULT_SPHERE_CARD_EMISSIVE_COLOR: '#00b8ff',
    DEFAULT_SPHERE_CARD_EMISSIVE_INTENSITY_FACTOR: 1.0,
    DEFAULT_SPHERE_CARD_BASE_COLOR_MULTIPLIER: 1.0,
    DEFAULT_SPHERE_CARD_SIDE_COLOR: '#1f3568',
    DEFAULT_STORM_WORD_CARD_BG_COLOR: '#FFCC20',

    MAX_CHARS_PER_LINE_CN: 8,
    MAX_CHARS_PER_LINE_EN: 15,
    HOVER_INFO_DELAY: 120,
    CAMERA_ZOOM_STEP: 3,

    VIEWED_WORDS_STORAGE_KEY: '3DWordUniverseViewedWordsV8',
    LAST_STATE_STORAGE_KEY: '3DWordUniverseLastStateV8',
    SETTINGS_STORAGE_KEY: '3DWordUniverseSettingsV8',
    CUSTOM_VIEWS_STORAGE_KEY: '3DWordUniverseCustomViewsV8',
    STUDY_LOG_STORAGE_KEY: '3DWordUniverseStudyLogV8',
    STUDY_GOAL_STORAGE_KEY: '3DWordUniverseStudyGoal',

    CORE_SPHERE_DEFAULT_RADIUS_FACTOR: 0.8,
    DYNAMIC_BG_DEFAULT_HUE_START: 230,
    DYNAMIC_BG_DEFAULT_HUE_END: 270,
    DYNAMIC_BG_DEFAULT_LIGHTNESS: 10,
    DYNAMIC_BG_DEFAULT_SATURATION: 30,
    DYNAMIC_BG_DEFAULT_PARTICLE_COUNT: IS_MOBILE_DEVICE ? 40 : 300,
    DYNAMIC_BG_DEFAULT_PARTICLE_SPEED: 0.05,

    DEFAULT_STARFIELD_ENABLED: true,
    DEFAULT_STAR_COUNT: IS_MOBILE_DEVICE ? 2000 : 25000,
    DEFAULT_STAR_COLOR: '#ffffff',
    DEFAULT_STAR_SIZE: 0.8,

    // 视觉增强系统（Vortex 限速 0.001 ~ 0.01）
    DEFAULT_VORTEX_SPEED: 0.003,
    DEFAULT_VORTEX_MIN_SPEED: 0.001,
    DEFAULT_VORTEX_MAX_SPEED: 0.01,

    HEMISPHERE_LAYOUT_THRESHOLD: 20,
    GRAPPLE_MAX_SPEED: 260,

    DEFAULT_FOCUS_CRUISE_ENABLED: true,
    DEFAULT_FOCUS_CRUISE_INTERVAL: 50,
    DEFAULT_FOCUS_CRUISE_RATIO_PERCENT: 8,
    DEFAULT_FOCUS_CRUISE_SCALE: 1.5
};

const appState = {
    scene: null, camera: null, renderer: null, controls: null,
    composer: null, bloomPass: null,
    dynamicBgParticles: null, vortexParticles: null,
    wordSphereGroup: null, cosmicDust: null, clickBurstParticles: null, coreSphere: null,
    starfield: null,
    
    allWords: [], filteredWords: [], currentBatchWords: [], wordObjects: [],
    currentBatchIndex: 0, totalBatches: 0, autoRotate: true, showEnglish: false, sphereRadius: 85,
    rotationMultiplier: 1.0, rotationMultiplierTemporary: 1.0,
    cardScaleMultiplier: 1.0,
    hoveredObject: null, activeCardObject: null,
    currentRotationSpeedBase: APP_CONFIG.DEFAULT_ROTATION_SPEED, 
    actualDisplayRotationSpeed: APP_CONFIG.DEFAULT_ROTATION_SPEED,
    batchSize: APP_CONFIG.DEFAULT_BATCH_SIZE_EN, 
    
    hoverOverlayCard: null, overlayCardTargetOpacity: 0,
    overlayCardTargetScale: null,
    overlayCardTargetPosition: null,
    currentSphereCardFontSizeFactor: 1.0,
    dynamicBgHueStart: APP_CONFIG.DYNAMIC_BG_DEFAULT_HUE_START, 
    dynamicBgHueEnd: APP_CONFIG.DYNAMIC_BG_DEFAULT_HUE_END,
    customViews: [],
    hoverCardPositionMode: 'default',
    activePanel: null,
    ttsSynth: null, ttsVoices: [],
    ttsSettings: { voice: '', rate: 1.0, pitch: 1.0, times: 1, volume: 1.0 },
    currentDetailWord: null,
    activeNoteWord: null,
    editingNoteId: null,
    needsRender: true,
    
    rt: {
        rotateX: true, rotateY: true, rotateZ: false,
        cardSelfRotation: true, cardRotationSpeed: 2,
        grappleEnabled: true,
        visualFxEnabled: false, vortexSpeed: 0.003, vortexModel: 'linear',
        hoverBgOpacity: 0.78
    },

    focusCruise: {
        enabled: true,
        interval: 50,
        ratioPercent: 8,
        scaleFactor: 1.5,
        visitedIndices: new Set(),
        currentSpotlightIndices: new Set(),
        lastSwitchTime: 0
    },
    
    batchShieldMode: false, selectedShieldWords: new Set(), shieldedWords: new Set(),
    isInitializing: true
};

function safeParseFloat(val, fallback = 0) {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
}
function safeParseInt(val, fallback = 0) {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? fallback : parsed;
}
function safeJSONParse(str, fallback = null) {
    try { return JSON.parse(str); } catch (e) { return fallback; }
}

function getColor(colorNameOrHex, type = 'css') {
    if (!colorNameOrHex) return type === 'three' ? new THREE.Color(0x000000) : '#000000';
    if (typeof colorNameOrHex === 'string' && colorNameOrHex.startsWith('--')) {
        const val = getComputedStyle(document.documentElement).getPropertyValue(colorNameOrHex.trim()).trim();
        return type === 'three' ? new THREE.Color(val || '#000000') : (val || '#000000');
    }
    return type === 'three' ? new THREE.Color(colorNameOrHex) : colorNameOrHex;
}

function getWordKey(word) {
    if (!word) return '';
    return String(word.num != null ? word.num : ((word.words || '') + (word.chinese || '')));
}

function getDateKey(d) {
    const dd = d || new Date();
    return dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
}

function timeHHMM(d) {
    const dd = d || new Date();
    return String(dd.getHours()).padStart(2, '0') + ':' + String(dd.getMinutes()).padStart(2, '0');
}

function getTodayYMD() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/**
 * 3D单词宇宙 - 全局配置中心、三维运算共享池与基础常量
 */
const IS_MOBILE_DEVICE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0);

// 核心共享数学对象池（统一收拢，杜绝各模块重复声明冲突）
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

    DEFAULT_SPHERE_CARD_FONT_COLOR: '#ffffff',
    DEFAULT_SPHERE_CARD_FONT_FAMILY: "'Microsoft YaHei', sans-serif",
    DEFAULT_SPHERE_CARD_BG_OPACITY: 0.8,
    DEFAULT_SPHERE_CARD_EMISSIVE_COLOR: '#00b8ff',
    DEFAULT_SPHERE_CARD_EMISSIVE_INTENSITY_FACTOR: 1.0,
    DEFAULT_SPHERE_CARD_BASE_COLOR_MULTIPLIER: 1.0,
    DEFAULT_SPHERE_CARD_SIDE_COLOR: '#1f3568',
    DEFAULT_STORM_WORD_CARD_BG_COLOR: '#FFCC20',

    DEFAULT_HOVER_APPENDED_FONT_COLOR: '#E0F5FF',
    DEFAULT_HOVER_APPENDED_FONT_SIZE: 12,
    DEFAULT_HOVER_APPENDED_BG_COLOR: 'rgba(10, 30, 70, 0.75)',

    DEFAULT_HOVER_CARD_TEXT_MAIN_WORD_COLOR: '#FFFFFF',
    DEFAULT_HOVER_CARD_TEXT_LABEL_COLOR: '#8CFEFF',
    DEFAULT_HOVER_CARD_TEXT_VALUE_COLOR: '#FFFFFF',
    DEFAULT_HOVER_CARD_TEXT_GLOW_COLOR: '#00FFFF',
    DEFAULT_HOVER_CARD_TEXT_GLOW_INTENSITY: 0.5,

    MAX_CHARS_PER_LINE_CN: 8,
    MAX_CHARS_PER_LINE_EN: 15,
    HOVER_INFO_DELAY: 120,
    MOUSE_ENTER_SPHERE_SPEED_MULTIPLIER: 0.001,
    CAMERA_ZOOM_STEP: 3,
    KEY_ROTATION_ACCEL_FACTOR: 1.40,
    KEY_ROTATION_DECEL_FACTOR: 0.80,
    ROTATION_SPEED_SLIDER_MAX_REPRESENTATION: 2.0,

    ROTATION_COMBINATIONS: [
        { x: true,  y: true,  z: false },
        { x: false, y: true,  z: false },
        { x: true,  y: false, z: false },
        { x: false, y: false, z: true  },
        { x: true,  y: false, z: true  },
        { x: false, y: true,  z: true  },
        { x: true,  y: true,  z: true  },
        { x: false, y: false, z: false }
    ],

    CARD_STYLES: [
        {
            id: 'deepspace', name: '深空青蓝', desc: '原版经典·科技晶莹幽蓝',
            bgTop: 'rgba(6, 18, 42, 0.86)', bgMid: 'rgba(10, 26, 56, 0.90)', bgBot: 'rgba(14, 34, 68, 0.92)',
            accent: 'rgba(0, 240, 255, 0.85)', accentSoft: 'rgba(0, 220, 255, 0.35)', glow: 'rgba(0, 240, 255, 0.12)',
            borderA: 'rgba(0, 220, 255, 0.45)', borderB: 'rgba(0, 110, 255, 0.35)',
            textTop: '#ffffff', textBot: '#d8f2ff',
            sideColor: 0x07204c, sideEmissive: 0x00bfff, pattern: 'cyber'
        }
    ],

    PIXELS_TO_WORLD_UNITS: 25,
    VIEWED_WORDS_STORAGE_KEY: '3DWordUniverseViewedWordsV8',
    LAST_STATE_STORAGE_KEY: '3DWordUniverseLastStateV8',
    SETTINGS_STORAGE_KEY: '3DWordUniverseSettingsV8',
    CUSTOM_VIEWS_STORAGE_KEY: '3DWordUniverseCustomViewsV8',
    MAX_CUSTOM_ITEMS: 12,
    CUSTOM_WORDBANKS_STORAGE_KEY: '3DWordUniverseCustomWordBanksV8',
    CUSTOM_ROTATIONS_STORAGE_KEY: '3DWordUniverseCustomRotationsV8',
    CUSTOM_HOVER_POSITIONS_STORAGE_KEY: '3DWordUniverseCustomHoverPositionsV8',
    DEFAULT_LIGHT_SETTINGS_KEY: '3DWordUniverseDefaultLightSettings_V8',
    STUDY_LOG_STORAGE_KEY: '3DWordUniverseStudyLogV8',
    STUDY_GOAL_STORAGE_KEY: '3DWordUniverseStudyGoal',

    CORE_SPHERE_DEFAULT_RADIUS_FACTOR: 0.8,
    DYNAMIC_BG_DEFAULT_HUE_START: 230,
    DYNAMIC_BG_DEFAULT_HUE_END: 270,
    DYNAMIC_BG_DEFAULT_LIGHTNESS: 10,
    DYNAMIC_BG_DEFAULT_SATURATION: 30,
    DYNAMIC_BG_DEFAULT_PARTICLE_COUNT: IS_MOBILE_DEVICE ? 40 : 300,
    DYNAMIC_BG_DEFAULT_PARTICLE_SPEED: 0.05,

    DEFAULT_DIRECTIONAL_LIGHT_2_COLOR: '#ffc080',
    DEFAULT_DIRECTIONAL_LIGHT_2_INTENSITY: 0.65,
    DEFAULT_DIRECTIONAL_LIGHT_2_POSITION_X: -11,
    DEFAULT_DIRECTIONAL_LIGHT_2_POSITION_Y: -6,
    DEFAULT_DIRECTIONAL_LIGHT_2_POSITION_Z: -14,

    DEFAULT_STARFIELD_ENABLED: true,
    DEFAULT_STAR_COUNT: IS_MOBILE_DEVICE ? 2000 : 25000,
    DEFAULT_STAR_COLOR: '#ffffff',
    DEFAULT_STAR_SIZE: 0.8,
    DEFAULT_STAR_VELOCITY_FACTOR: 0.1,
    DEFAULT_STAR_DENSITY_FALLOFF: 100,
    DEFAULT_STAR_MIN_ALPHA: 0.1,
    DEFAULT_STAR_MAX_ALPHA: 1.0,
    DEFAULT_STAR_TWINKLE_SPEED: 0.5,

    DEFAULT_BRIGHTNESS_ON_LOAD: 0.5,
    DEFAULT_CUSTOM_LIGHT_ENABLED: false,
    DEFAULT_CUSTOM_LIGHT_HELPER_VISIBLE: false,
    DEFAULT_CUSTOM_LIGHT_COLOR: '#ffffff',
    DEFAULT_CUSTOM_LIGHT_INTENSITY: 20,
    DEFAULT_CUSTOM_LIGHT_DISTANCE: 500,
    DEFAULT_CUSTOM_LIGHT_ANGLE: 0.8,
    DEFAULT_CUSTOM_LIGHT_PENUMBRA: 0.2,
    DEFAULT_CUSTOM_LIGHT_SOURCE_POS: { x: 0, y: 0, z: 200 },
    DEFAULT_CUSTOM_LIGHT_TARGET_POS: { x: 0, y: 0, z: 0 },
    DEFAULT_GUIDELINE_RADIUS: 200,
    DEFAULT_HOVER_CARD_BRIGHTNESS: 1.0,

    DEFAULT_VISUAL_EFFECTS_ENABLED: false,
    DEFAULT_VORTEX_PARTICLE_COUNT: IS_MOBILE_DEVICE ? 2000 : 50000,
    DEFAULT_VORTEX_COLOR: '#5588ff',
    DEFAULT_VORTEX_SIZE: 1.5,
    DEFAULT_VORTEX_SPEED: 0.02,
    DEFAULT_VORTEX_TIGHTNESS: 1.5,
    DEFAULT_BLOOM_THRESHOLD: 0.8,
    DEFAULT_BLOOM_STRENGTH: 0.5,
    DEFAULT_BLOOM_RADIUS: 0.2,

    HEMISPHERE_LAYOUT_THRESHOLD: 20,
    GRAPPLE_MAX_SPEED: 260
};

const appState = {
    scene: null, camera: null, renderer: null, controls: null,
    composer: null, bloomPass: null,
    dynamicBgParticles: null, vortexParticles: null,
    wordSphereGroup: null, cosmicDust: null, clickBurstParticles: null, coreSphere: null,
    starfield: null, customSpotLight: null, customSpotLightHelper: null,
    lightSourceMesh: null, lightTargetMesh: null, guidelineGroup: null,
    guidelines: {}, activeGuideline: 'none', selectedLightControl: null,
    
    allWords: [], filteredWords: [], currentBatchWords: [], wordObjects: [],
    currentBatchIndex: 0, totalBatches: 0, autoRotate: true, showEnglish: false, sphereRadius: 85,
    rotationMultiplier: 1.0, rotationMultiplierTemporary: 1.0,
    hoveredObject: null, lastHoveredObject: null, activeCardObject: null,
    currentRotationCombinationIndex: 0, currentRotationSpeedBase: APP_CONFIG.DEFAULT_ROTATION_SPEED, 
    actualDisplayRotationSpeed: APP_CONFIG.DEFAULT_ROTATION_SPEED,
    batchSize: APP_CONFIG.DEFAULT_BATCH_SIZE_EN, 
    isWordStormActive: false,
    wordStormInputWords: [], wordStormInputWordsProcessed: [], wordStormProcessedWords: [],
    wordStormFillEnabled: false, wordStormFillSource: '所有',
    
    hoverOverlayCard: null, overlayCardTargetOpacity: 0,
    overlayCardTargetScale: null,
    overlayCardTargetPosition: null,
    currentSphereCardFontSizeFactor: 1.0,
    dynamicBgHueStart: APP_CONFIG.DYNAMIC_BG_DEFAULT_HUE_START, 
    dynamicBgHueEnd: APP_CONFIG.DYNAMIC_BG_DEFAULT_HUE_END,
    customViews: [], customWordBanks: [], customRotations: [], customHoverPositions: [],
    hoverCardPositionMode: 'default',
    hoverCardPositionMargins: { top: 5, right: 5, bottom: 5, left: 5 },
    activePanel: null, originalControlsTarget: null,
    ttsSynth: null, ttsVoices: [],
    hoverPronounceTimer: null, hoverPronounceInterval: null,
    ttsSettings: { voice: '', rate: 1.0, pitch: 1.0, times: 1, volume: 1.0 },
    activeViewPresetIndex: null, currentDetailWord: null,
    detailViewHistory: [], detailViewHistoryIndex: -1,
    renderingPaused: false,
    studioLight: { localX: 0, localY: 0 },
    studioLightDragActive: false, studioLightIsDragging: false,
    pendingHoveredObject: null, hoverIntentTimer: null,
    needsRender: true,
    
    rt: {
        rotateX: true, rotateY: true, rotateZ: false,
        cardSelfRotation: false, cardRotationSpeed: 0,
        grappleEnabled: true,
        visualFxEnabled: false, vortexSpeed: 0, vortexModel: 'linear',
        particleSpeed: 1, hoverBgOpacity: 0.75, glowFrequency: 1,
        glowColor: null,
        fontSizeFactorOverall: 1.0, fontSizeFactorCloseUp: 1.0,
        cardEmissiveIntensity: 1.0
    },
    
    currentCardStyleId: 'deepspace',
    batchShieldMode: false, selectedShieldWords: new Set(), shieldedWords: new Set(),
    isInitializing: true,
    
    practiceSession: {
        active: false, shuffledWords: [], currentIndex: 0, correctCount: 0,
        currentOptions: [], correctAnswerIdx: -1, hasAnswered: false
    }
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

function studyEscapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
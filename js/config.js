/**
 * 3D单词宇宙 - 全局配置中心、三维运算共享池与基础常量
 */
const IS_MOBILE_DEVICE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0);

// 核心共享数学对象池（统一收拢，杜绝任何模块出现 duplicate declaration 语法死锁）
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
    HOVER_INFO_DELAY: 500,
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
            id: 'deepspace', name: '深空青蓝', desc: '命运2·质量效应·科幻史诗',
            bgTop: 'rgba(7,13,30,0.95)', bgMid: 'rgba(13,25,54,0.96)', bgBot: 'rgba(5,9,24,0.97)',
            accent: 'rgba(104,208,255,1)', accentSoft: 'rgba(104,208,255,0.4)', glow: 'rgba(64,190,255,0.10)',
            borderA: 'rgba(0,215,255,0.55)', borderB: 'rgba(88,158,255,0.42)',
            textTop: 'rgba(236,249,255,1)', textBot: 'rgba(138,200,255,1)',
            emBorder: 'rgba(90,220,255,0.55)', emBracket: 'rgba(120,230,255,0.5)', emDot: 'rgba(140,235,255,0.7)',
            sideColor: 0x0e3a7a, sideEmissive: 0x00d8ff, pattern: 'diagonal'
        },
        {
            id: 'ember', name: '熔金琥珀', desc: '暗黑破坏神·地狱熔炉',
            bgTop: 'rgba(48,20,8,0.95)', bgMid: 'rgba(36,13,16,0.96)', bgBot: 'rgba(22,7,10,0.97)',
            accent: 'rgba(255,176,80,1)', accentSoft: 'rgba(255,176,80,0.4)', glow: 'rgba(255,170,80,0.10)',
            borderA: 'rgba(255,168,68,0.55)', borderB: 'rgba(255,218,158,0.4)',
            textTop: 'rgba(255,238,202,1)', textBot: 'rgba(255,168,88,1)',
            emBorder: 'rgba(255,180,90,0.55)', emBracket: 'rgba(255,190,110,0.5)', emDot: 'rgba(255,200,120,0.7)',
            sideColor: 0x4a1c10, sideEmissive: 0xff8c40, pattern: 'hex'
        },
        {
            id: 'neon', name: '赛博霓虹', desc: '赛博朋克2077·夜之城',
            bgTop: 'rgba(16,6,24,0.95)', bgMid: 'rgba(30,8,34,0.96)', bgBot: 'rgba(8,4,16,0.97)',
            accent: 'rgba(255,64,180,1)', accentSoft: 'rgba(255,64,180,0.4)', glow: 'rgba(255,80,200,0.10)',
            borderA: 'rgba(255,64,180,0.55)', borderB: 'rgba(0,240,255,0.4)',
            textTop: 'rgba(255,235,250,1)', textBot: 'rgba(255,120,220,1)',
            emBorder: 'rgba(255,90,200,0.55)', emBracket: 'rgba(120,240,255,0.5)', emDot: 'rgba(255,120,220,0.7)',
            sideColor: 0x2a0a2e, sideEmissive: 0xff2fa0, pattern: 'scanlines'
        },
        {
            id: 'emerald', name: '翡翠圣林', desc: '艾尔登法环·黄金树',
            bgTop: 'rgba(6,24,18,0.95)', bgMid: 'rgba(10,40,28,0.96)', bgBot: 'rgba(4,16,12,0.97)',
            accent: 'rgba(90,230,160,1)', accentSoft: 'rgba(90,230,160,0.4)', glow: 'rgba(80,240,170,0.10)',
            borderA: 'rgba(80,230,150,0.55)', borderB: 'rgba(200,240,180,0.35)',
            textTop: 'rgba(235,255,240,1)', textBot: 'rgba(140,230,170,1)',
            emBorder: 'rgba(90,235,160,0.55)', emBracket: 'rgba(160,245,190,0.5)', emDot: 'rgba(140,240,180,0.7)',
            sideColor: 0x0a3a22, sideEmissive: 0x3ddc84, pattern: 'rings'
        },
        {
            id: 'crimson', name: '猩红暗影', desc: '巫师·血与酒',
            bgTop: 'rgba(30,8,12,0.95)', bgMid: 'rgba(48,12,18,0.96)', bgBot: 'rgba(18,4,8,0.97)',
            accent: 'rgba(255,96,96,1)', accentSoft: 'rgba(255,96,96,0.4)', glow: 'rgba(255,80,80,0.10)',
            borderA: 'rgba(230,70,70,0.55)', borderB: 'rgba(255,190,120,0.38)',
            textTop: 'rgba(255,235,235,1)', textBot: 'rgba(255,150,130,1)',
            emBorder: 'rgba(255,110,100,0.55)', emBracket: 'rgba(255,180,130,0.5)', emDot: 'rgba(255,130,110,0.7)',
            sideColor: 0x3a0e14, sideEmissive: 0xff4a4a, pattern: 'diagonal'
        },
        {
            id: 'frost', name: '冰霜极地', desc: '冰与火之歌·凛冬将至',
            bgTop: 'rgba(8,18,32,0.95)', bgMid: 'rgba(14,32,52,0.96)', bgBot: 'rgba(6,12,24,0.97)',
            accent: 'rgba(190,235,255,1)', accentSoft: 'rgba(190,235,255,0.4)', glow: 'rgba(160,225,255,0.10)',
            borderA: 'rgba(160,220,255,0.55)', borderB: 'rgba(255,255,255,0.4)',
            textTop: 'rgba(255,235,235,1)', textBot: 'rgba(170,215,245,1)',
            emBorder: 'rgba(190,235,255,0.55)', emBracket: 'rgba(220,245,255,0.5)', emDot: 'rgba(200,240,255,0.7)',
            sideColor: 0x12283e, sideEmissive: 0x9fd8ff, pattern: 'dots'
        },
        {
            id: 'void', name: '虚空紫罗兰', desc: '星际争霸·虚空之遗',
            bgTop: 'rgba(16,8,32,0.95)', bgMid: 'rgba(28,12,48,0.96)', bgBot: 'rgba(10,4,20,0.97)',
            accent: 'rgba(190,140,255,1)', accentSoft: 'rgba(190,140,255,0.4)', glow: 'rgba(170,120,255,0.10)',
            borderA: 'rgba(170,120,255,0.55)', borderB: 'rgba(90,220,255,0.38)',
            textTop: 'rgba(245,240,255,1)', textBot: 'rgba(190,160,255,1)',
            emBorder: 'rgba(180,130,255,0.55)', emBracket: 'rgba(110,230,255,0.5)', emDot: 'rgba(190,150,255,0.7)',
            sideColor: 0x1c0e30, sideEmissive: 0x9a5cff, pattern: 'hex'
        },
        {
            id: 'tactical', name: '战术军绿', desc: '使命召唤·现代战争',
            bgTop: 'rgba(20,24,12,0.95)', bgMid: 'rgba(32,36,16,0.96)', bgBot: 'rgba(12,14,8,0.97)',
            accent: 'rgba(200,220,90,1)', accentSoft: 'rgba(200,220,90,0.4)', glow: 'rgba(190,210,80,0.10)',
            borderA: 'rgba(180,200,70,0.55)', borderB: 'rgba(240,240,180,0.32)',
            textTop: 'rgba(245,250,225,1)', textBot: 'rgba(190,205,110,1)',
            emBorder: 'rgba(195,215,85,0.55)', emBracket: 'rgba(230,235,160,0.5)', emDot: 'rgba(205,220,100,0.7)',
            sideColor: 0x2a2e12, sideEmissive: 0xa8b83a, pattern: 'grid'
        },
        {
            id: 'nebula', name: '星云幻彩', desc: '银河护卫队·星云',
            bgTop: 'rgba(24,10,40,0.95)', bgMid: 'rgba(40,12,48,0.96)', bgBot: 'rgba(14,6,28,0.97)',
            accent: 'rgba(255,140,220,1)', accentSoft: 'rgba(255,140,220,0.4)', glow: 'rgba(200,120,255,0.10)',
            borderA: 'rgba(240,110,220,0.55)', borderB: 'rgba(110,140,255,0.4)',
            textTop: 'rgba(250,240,255,1)', textBot: 'rgba(230,150,240,1)',
            emBorder: 'rgba(250,130,230,0.55)', emBracket: 'rgba(140,160,255,0.5)', emDot: 'rgba(240,150,235,0.7)',
            sideColor: 0x2a1040, sideEmissive: 0xe86ad0, pattern: 'nebula'
        },
        {
            id: 'gilded', name: '黄金圣殿', desc: '战神·奥林匹斯圣殿',
            bgTop: 'rgba(34,24,8,0.95)', bgMid: 'rgba(52,36,10,0.96)', bgBot: 'rgba(22,14,6,0.97)',
            accent: 'rgba(255,210,110,1)', accentSoft: 'rgba(255,210,110,0.4)', glow: 'rgba(255,200,100,0.10)',
            borderA: 'rgba(240,190,80,0.55)', borderB: 'rgba(255,240,200,0.42)',
            textTop: 'rgba(255,248,230,1)', textBot: 'rgba(230,190,120,1)',
            emBorder: 'rgba(245,200,100,0.55)', emBracket: 'rgba(255,230,170,0.5)', emDot: 'rgba(250,215,130,0.7)',
            sideColor: 0x3a2a0e, sideEmissive: 0xd4af37, pattern: 'rings'
        },
        {
            id: 'huaxia', name: '华夏·墨金', desc: '古代中国·青铜与朱砂',
            bgTop: 'rgba(28,20,14,0.96)', bgMid: 'rgba(48,34,20,0.96)', bgBot: 'rgba(18,12,8,0.97)',
            accent: 'rgba(230,180,90,1)', accentSoft: 'rgba(230,180,90,0.35)', glow: 'rgba(200,150,80,0.10)',
            borderA: 'rgba(210,170,100,0.6)', borderB: 'rgba(180,60,50,0.45)',
            textTop: 'rgba(255,244,220,1)', textBot: 'rgba(220,180,120,1)',
            emBorder: 'rgba(230,190,110,0.55)', emBracket: 'rgba(200,70,60,0.5)', emDot: 'rgba(230,200,130,0.7)',
            sideColor: 0x3a2410, sideEmissive: 0xd4a13a, pattern: 'huaxia'
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

    DEFAULT_BRIGHTNESS_ON_LOAD: 0.7,
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

    ORBIT_CARDS_PER_RING: 20,
    ORBIT_LANE_COUNT_MIN: 3,
    ORBIT_LANE_COUNT_MAX: 40,
    ORBIT_SWITCH_INTERVAL_MIN: 18,
    ORBIT_SWITCH_INTERVAL_MAX: 38,
    ORBIT_LANE_SPEED_FACTOR_MIN: 0.55,
    ORBIT_LANE_SPEED_FACTOR_MAX: 1.55,

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
    orbitLanes: [], orbitLaneCount: 0, orbitSwitchInterval: 20, lastOrbitSwitchTime: 0,
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
    
    currentCardStyleId: 'huaxia',
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
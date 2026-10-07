/**
 * 3D单词宇宙 - Web Speech TTS 语音合成引擎
 * 针对移动端 iOS/Android 音频限制提供手势解锁与唤醒队列
 */

let ttsUnlocked = false;
let isTTSAwake = false;

const AppAudio = {
    init() {
        if ('speechSynthesis' in window) {
            appState.ttsSynth = window.speechSynthesis;
            appState.ttsSynth.onvoiceschanged = () => this.populateVoices();
            this.populateVoices();
        } else {
            console.warn('当前浏览器环境不支持 SpeechSynthesis API');
            document.querySelectorAll('#voiceSelect, #rateInput, #timesInput, #volumeInput, #speakDetailWordBtn')
                .forEach(el => el.disabled = true);
        }

        // 移动端用户主动手势首次解锁音频上下文
        const unlockHandler = () => this.unlockTTS();
        document.addEventListener('click', unlockHandler, { once: true });
        document.addEventListener('touchstart', unlockHandler, { once: true });
    },

    unlockTTS() {
        if (ttsUnlocked) return;
        if ('speechSynthesis' in window) {
            try {
                const dummy = new SpeechSynthesisUtterance('');
                dummy.volume = 0;
                window.speechSynthesis.speak(dummy);
                ttsUnlocked = true;
            } catch (e) {
                console.warn('音频激活初始化失败:', e);
            }
        }
    },

    populateVoices() {
        if (!appState.ttsSynth) return;
        appState.ttsVoices = appState.ttsSynth.getVoices();
        if (!appState.ttsVoices.length) return;

        const voiceSelect = document.getElementById('voiceSelect');
        const voiceSelectDetail = document.getElementById('voiceSelectDetail');
        const selects = [voiceSelect, voiceSelectDetail].filter(Boolean);
        const saved = appState.ttsSettings.voice;

        selects.forEach(select => {
            select.innerHTML = '';
            appState.ttsVoices.forEach(voice => {
                const opt = document.createElement('option');
                opt.textContent = `${voice.name} (${voice.lang})`;
                opt.value = voice.name;
                select.appendChild(opt);
            });

            if ([...select.options].some(o => o.value === saved)) {
                select.value = saved;
            } else {
                const defaultVoice = appState.ttsVoices.find(v => v.name.includes('David')) ||
                    appState.ttsVoices.find(v => v.lang.startsWith('en'));
                if (defaultVoice) select.value = defaultVoice.name;
            }
        });

        if (selects[0]) {
            appState.ttsSettings.voice = selects[0].value;
        }
    },

    speakWord(text, times) {
        if (!('speechSynthesis' in window) || !text) return;
        window.speechSynthesis.cancel();

        const playActual = () => {
            let count = 0;
            const totalTimes = times || appState.ttsSettings.times || 1;

            const loop = () => {
                if (count < totalTimes) {
                    count++;
                    const utterance = new SpeechSynthesisUtterance(text);

                    if (appState.ttsVoices && appState.ttsVoices.length > 0) {
                        const voice = appState.ttsVoices.find(v => v.name === appState.ttsSettings.voice);
                        if (voice) utterance.voice = voice;
                    }

                    utterance.rate = appState.ttsSettings.rate || 1.0;
                    utterance.pitch = appState.ttsSettings.pitch || 1.0;
                    utterance.volume = appState.ttsSettings.volume !== undefined ? appState.ttsSettings.volume : 1.0;

                    utterance.onend = () => {
                        if (count < totalTimes) {
                            setTimeout(loop, 80);
                        }
                    };
                    utterance.onerror = () => {
                        console.warn('TTS 发音播放中断或异常');
                    };

                    window.speechSynthesis.speak(utterance);
                }
            };
            loop();
        };

        // 移动端冷启动无声唤醒保护
        if (!isTTSAwake) {
            const wakeUtter = new SpeechSynthesisUtterance('a');
            wakeUtter.volume = 0.01;
            wakeUtter.rate = 3.0;
            wakeUtter.onend = () => { isTTSAwake = true; playActual(); };
            wakeUtter.onerror = () => { isTTSAwake = true; playActual(); };
            window.speechSynthesis.speak(wakeUtter);
        } else {
            playActual();
        }
    },

    syncFromDOM() {
        const rateInput = document.getElementById('rateInput');
        const timesInput = document.getElementById('timesInput');
        const volumeInput = document.getElementById('volumeInput');
        const voiceSelect = document.getElementById('voiceSelect');

        if (rateInput) appState.ttsSettings.rate = safeParseFloat(rateInput.value, 1.0);
        if (timesInput) appState.ttsSettings.times = safeParseInt(timesInput.value, 1);
        if (volumeInput) appState.ttsSettings.volume = safeParseFloat(volumeInput.value, 1.0);
        if (voiceSelect) appState.ttsSettings.voice = voiceSelect.value;
    }
};

window.AppAudio = AppAudio;
window.speakWord = (text, times) => AppAudio.speakWord(text, times);
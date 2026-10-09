/**
 * 3D单词宇宙 - Web Speech & 本地 Edge-TTS 双模语音合成引擎 (发音人修复版)
 */
(function() {
    let ttsUnlocked = false;

    const AppAudio = {
        init() {
            if ('speechSynthesis' in window) {
                appState.ttsSynth = window.speechSynthesis;
                appState.ttsSynth.onvoiceschanged = () => this.populateVoices();
                this.populateVoices();
            } else {
                console.warn('当前浏览器环境不支持 SpeechSynthesis API');
            }

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
                } catch (e) {}
            }
        },

        populateVoices() {
            if (!appState.ttsSynth) return;
            appState.ttsVoices = appState.ttsSynth.getVoices();
            if (!appState.ttsVoices || !appState.ttsVoices.length) return;

            const voiceSelect = document.getElementById('voiceSelect');
            if (!voiceSelect) return;

            const currentSaved = appState.ttsSettings.voice;
            voiceSelect.innerHTML = '';

            appState.ttsVoices.forEach(voice => {
                const opt = document.createElement('option');
                opt.textContent = `${voice.name} (${voice.lang})`;
                opt.value = voice.name;
                voiceSelect.appendChild(opt);
            });

            if (currentSaved && [...voiceSelect.options].some(o => o.value === currentSaved)) {
                voiceSelect.value = currentSaved;
            } else {
                const defaultVoice = appState.ttsVoices.find(v => v.lang.startsWith('en')) || appState.ttsVoices[0];
                if (defaultVoice) {
                    voiceSelect.value = defaultVoice.name;
                    appState.ttsSettings.voice = defaultVoice.name;
                }
            }
        },

        speakWord(text, times) {
            if (!text) return;
            const textToSpeak = text.trim();
            const voiceName = appState.ttsSettings.voice;
            const rate = safeParseFloat(appState.ttsSettings.rate, 1.0);
            const volume = safeParseFloat(appState.ttsSettings.volume, 1.0);
            const totalTimes = times || appState.ttsSettings.times || 1;

            // 优先检测本地 Edge-TTS 串流代理接口
            if (voiceName && voiceName.includes('Neural')) {
                const audio = new Audio(`/api/tts?voice=${encodeURIComponent(voiceName)}&rate=${rate}&volume=${volume}&text=${encodeURIComponent(textToSpeak)}`);
                let count = 0;
                audio.onended = () => {
                    count++;
                    if (count < totalTimes) audio.play();
                };
                audio.play().catch(() => this._speakLocal(textToSpeak, totalTimes));
                return;
            }

            this._speakLocal(textToSpeak, totalTimes);
        },

        _speakLocal(text, totalTimes) {
            if (!('speechSynthesis' in window)) return;
            window.speechSynthesis.cancel();

            let count = 0;
            const loop = () => {
                if (count >= totalTimes) return;
                count++;
                const utterance = new SpeechSynthesisUtterance(text);

                if (appState.ttsVoices && appState.ttsVoices.length > 0) {
                    const matchedVoice = appState.ttsVoices.find(v => v.name === appState.ttsSettings.voice);
                    if (matchedVoice) utterance.voice = matchedVoice;
                }

                utterance.rate = safeParseFloat(appState.ttsSettings.rate, 1.0);
                utterance.pitch = safeParseFloat(appState.ttsSettings.pitch, 1.0);
                utterance.volume = safeParseFloat(appState.ttsSettings.volume, 1.0);

                utterance.onend = () => {
                    if (count < totalTimes) setTimeout(loop, 70);
                };
                window.speechSynthesis.speak(utterance);
            };
            loop();
        }
    };

    window.AppAudio = AppAudio;
    window.speakWord = (text, times) => AppAudio.speakWord(text, times);
})();
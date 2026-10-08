/**
 * 3D单词宇宙 - 全功能 UI 交互控制器与启动总装中枢
 * 100% 对齐老版本 handleQuickTap 判定机制：确保右上角 4 个功能按钮精准响应、多维视角预设与巡航修改
 */
(function() {
    let _persistTimer = null;
    let _sphereRebuildTimer = null;

    function schedulePersist() {
        clearTimeout(_persistTimer);
        _persistTimer = setTimeout(() => {
            _persistTimer = null;
            AppUI.saveSettings();
            AppUI.saveLastState();
        }, 200);
    }

    function scheduleSphereRebuild(delay = 380) {
        clearTimeout(_sphereRebuildTimer);
        _sphereRebuildTimer = setTimeout(() => {
            _sphereRebuildTimer = null;
            if (appState.currentBatchWords.length > 0 || appState.wordObjects.length > 0) {
                AppSphereEngine.createWordSphere(appState.currentBatchWords);
            }
        }, delay);
    }

    function selectLocalFile(accept, callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = (e) => {
            if (e.target.files && e.target.files[0]) {
                callback(e.target.files[0]);
            }
            document.body.removeChild(input);
        };
        input.click();
        setTimeout(() => {
            if (document.body.contains(input)) {
                document.body.removeChild(input);
            }
        }, 30000);
    }

    const AppUI = {
        async init() {
            await AppStorage.init();

            AppScene.init();
            AppAudio.init();
            AppParticles.initClickBurstParticles();
            AppParticles.initCoreSphere();
            AppParticles.initStarfield();
            AppParticles.initDynamicBackground();
            AppParticles.initNebulaColors();
            AppParticles.initCardEmbers();
            AppSphereEngine.initGrapple();

            appState.hoverOverlayCard = AppCardFactory.initPremiumHoverCard();
            this.initAllButtonsAndEvents();
            this.initDetailedSettingsListeners();
            this.init3DCardChamberListeners();
            this.enhanceSlidersWithSteppers();
            this.initMobileTouchHandlers();
            this.initClock();
            this.initFocusCruiseHud();
            this.initSystemViews();
            this.loadCustomViews();
            this.initStudyLog();

            this.loadSettings();
            await this.loadWordDataAndBoot();
            this.loadAllPersistentStates();

            setTimeout(() => {
                appState.isInitializing = false;
                this.refreshRuntimeCache();
                this.updateFocusCruiseVisuals();
                this.updateCardPresetDescription();
                appState.needsRender = true;
                console.log('3D 单词宇宙与老版本高灵敏查词卡片交互装配完毕！');
            }, 300);
        },

        async loadWordDataAndBoot() {
            const words = await AppStorage.loadLibrary();
            appState.shieldedWords = AppStorage.loadShieldedWords();

            appState.allWords = words.filter(w => w && typeof w === 'object' && !appState.shieldedWords.has(getWordKey(w)));
            appState.filteredWords = [...appState.allWords];
            appState.currentBatchIndex = 0;

            const totalWordsDisplay = document.getElementById('totalWords');
            if (totalWordsDisplay) totalWordsDisplay.textContent = appState.allWords.length;

            this.displayCurrentBatch();
            this.updateStats();
            this.updateClearShieldedBtnLabel();
            this.updateStudyCounterDisplay();
        },

        displayCurrentBatch() {
            this.hideImmersiveDetailPanel();
            appState.activeCardObject = null;
            const list = appState.isWordStormActive ? appState.wordStormProcessedWords : appState.filteredWords;

            if (!list || !list.length) {
                appState.currentBatchWords = [];
                AppSphereEngine.createWordSphere([]);
                this.updateBatchControls();
                this.updateStats();
                return;
            }

            const size = Math.max(1, parseInt(appState.batchSize, 10) || 1);
            const total = Math.ceil(list.length / size);
            appState.currentBatchIndex = Math.max(0, Math.min(appState.currentBatchIndex, total - 1));
            appState.currentBatchWords = list.slice(appState.currentBatchIndex * size, (appState.currentBatchIndex + 1) * size);

            AppSphereEngine.createWordSphere(appState.currentBatchWords);

            if (appState.focusCruise) {
                appState.focusCruise.visitedIndices = new Set();
                appState.focusCruise.currentSpotlightIndices.clear();
                appState.focusCruise.lastSwitchTime = performance.now();
            }

            this.updateBatchControls();
            this.updateStats();
            appState.needsRender = true;
        },

        updateBatchControls() {
            const list = appState.isWordStormActive ? appState.wordStormProcessedWords : appState.filteredWords;
            const size = Math.max(1, parseInt(appState.batchSize, 10) || 1);
            const batchInfo = document.getElementById('batchInfo');
            const prevBtn = document.getElementById('prevBatchBtn');
            const nextBtn = document.getElementById('nextBatchBtn');

            if (!list || list.length === 0) {
                appState.totalBatches = 0;
                if (batchInfo) batchInfo.textContent = '0 / 0';
                if (prevBtn) prevBtn.disabled = true;
                if (nextBtn) nextBtn.disabled = true;
                return;
            }

            appState.totalBatches = Math.ceil(list.length / size);
            if (batchInfo) batchInfo.textContent = `${appState.currentBatchIndex + 1} / ${appState.totalBatches}`;
            if (prevBtn) prevBtn.disabled = appState.currentBatchIndex === 0;
            if (nextBtn) nextBtn.disabled = appState.currentBatchIndex >= appState.totalBatches - 1;
        },

        updateStats() {
            const list = appState.isWordStormActive ? appState.wordStormProcessedWords : appState.filteredWords;
            const filDisplay = document.getElementById('filteredWords');
            const curDisplay = document.getElementById('currentBatchWords');
            const viewedDisplay = document.getElementById('viewedCount');

            if (filDisplay) filDisplay.textContent = list.length;
            if (curDisplay) curDisplay.textContent = appState.currentBatchWords.length;
            if (viewedDisplay) {
                const viewedSet = AppStorage.loadViewedWords();
                const viewedInList = list.filter(w => viewedSet.has(getWordKey(w))).length;
                viewedDisplay.textContent = viewedInList;
            }
        },

        initClock() {
            const clockEl = document.getElementById('clockHud');
            const update = () => {
                if (!clockEl) return;
                const now = new Date();
                const str = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
                if (clockEl.textContent !== str) clockEl.textContent = str;
            };
            update();
            setInterval(update, 1000);
        },

        enhanceSlidersWithSteppers() {
            const sliders = document.querySelectorAll('#controlsOverlay input[type="range"]');
            sliders.forEach(slider => {
                if (slider.closest('.slider-stepper-wrap')) return;

                const parent = slider.parentElement;
                const wrap = document.createElement('div');
                wrap.className = 'slider-stepper-wrap';

                let existingInput = parent.querySelector(`input[type="number"]#${slider.id}Input`);

                const downBtn = document.createElement('button');
                downBtn.type = 'button';
                downBtn.className = 'stepper-btn down-btn';
                downBtn.textContent = '▼';

                const upBtn = document.createElement('button');
                upBtn.type = 'button';
                upBtn.className = 'stepper-btn up-btn';
                upBtn.textContent = '▲';

                let numInput = existingInput;
                if (!numInput) {
                    numInput = document.createElement('input');
                    numInput.type = 'number';
                    numInput.className = 'stepper-num-input';
                    numInput.id = slider.id + '_autoNumInput';
                    numInput.step = slider.step || '1';
                    numInput.min = slider.min !== '' ? slider.min : '0';
                    numInput.max = slider.max !== '' ? slider.max : '100';
                    numInput.value = slider.value;
                }

                slider.parentNode.insertBefore(wrap, slider);
                wrap.appendChild(downBtn);
                wrap.appendChild(slider);
                wrap.appendChild(upBtn);
                wrap.appendChild(numInput);

                const stepValue = (delta) => {
                    const step = parseFloat(slider.step) || 1;
                    const min = slider.min !== '' ? parseFloat(slider.min) : -Infinity;
                    const max = slider.max !== '' ? parseFloat(slider.max) : Infinity;
                    let cur = parseFloat(slider.value) || 0;
                    let next = cur + delta * step;
                    next = Math.max(min, Math.min(max, next));

                    const stepDecimals = (slider.step && slider.step.includes('.')) ? slider.step.split('.')[1].length : 0;
                    slider.value = next.toFixed(stepDecimals);
                    numInput.value = slider.value;

                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                };

                downBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); stepValue(-1); });
                upBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); stepValue(1); });

                numInput.addEventListener('input', () => {
                    slider.value = numInput.value;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                });
                numInput.addEventListener('change', () => {
                    slider.value = numInput.value;
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                });

                slider.addEventListener('input', () => {
                    numInput.value = slider.value;
                });
            });
        },

        init3DCardChamberListeners() {
            const presetSelect = document.getElementById('cardStylePresetSelect');
            if (presetSelect) {
                presetSelect.addEventListener('change', (e) => {
                    const presetId = e.target.value;
                    if (window.CardStyleManager) {
                        const p = window.CardStyleManager.getPreset(presetId);
                        if (p) {
                            const lightPosSelect = document.getElementById('cardLightPositionSelect');
                            const lightBrightRange = document.getElementById('cardLightBrightnessRange');
                            const lightSpreadRange = document.getElementById('cardLightSpreadRange');
                            const lightColorInput = document.getElementById('cardLightColor');
                            const textStyleSelect = document.getElementById('cardTextStyleSelect');
                            const fontColorInput = document.getElementById('sphereCardFontColor');

                            if (lightPosSelect) lightPosSelect.value = p.defaultLightPosition;
                            if (lightBrightRange) lightBrightRange.value = p.defaultLightBrightness;
                            if (lightSpreadRange) lightSpreadRange.value = p.defaultLightSpread;
                            if (lightColorInput) lightColorInput.value = p.defaultLightColor;
                            if (textStyleSelect) textStyleSelect.value = p.textStyle;
                            if (fontColorInput) fontColorInput.value = p.textColor;

                            this.updateCardPresetDescription();
                            this.showToast(`🎴 已应用风格: ${p.name}`);
                        }
                    }
                    scheduleSphereRebuild(10);
                    schedulePersist();
                });
            }

            const opacityRange = document.getElementById('cardOpacityRange');
            if (opacityRange) {
                opacityRange.addEventListener('input', (e) => {
                    const op = parseFloat(e.target.value);
                    AppCardFactory.updateCardsMaterialsFast({ opacity: op });
                    schedulePersist();
                });
            }

            const heavyInputs = [
                'cardChamberDepthRange', 'cardLightPositionSelect',
                'cardLightBrightnessRange', 'cardLightSpreadRange', 'cardLightColor',
                'cardTextStyleSelect', 'sphereCardFontColor', 'sphereCardFontFamily'
            ];

            heavyInputs.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('input', () => {
                    scheduleSphereRebuild(380);
                    schedulePersist();
                });
                el.addEventListener('change', () => {
                    scheduleSphereRebuild(10);
                    schedulePersist();
                });
            });

            document.getElementById('hoverCardStyleModeSelect')?.addEventListener('change', () => {
                if (appState.hoveredObject && appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                    this.triggerCardDisplay(appState.hoveredObject);
                }
                schedulePersist();
            });
        },

        updateCardPresetDescription() {
            const descLabel = document.getElementById('cardPresetDescLabel');
            const select = document.getElementById('cardStylePresetSelect');
            if (!descLabel || !select || !window.CardStyleManager) return;
            const p = window.CardStyleManager.getPreset(select.value);
            if (p) descLabel.textContent = `💡 ${p.desc}`;
        },

        initDetailedSettingsListeners() {
            const bindSync = (sliderId, numId, callback) => {
                const slider = document.getElementById(sliderId);
                const num = document.getElementById(numId);
                if (!slider || !num) return;
                slider.addEventListener('input', () => {
                    num.value = slider.value;
                    if (callback) callback(slider.value);
                    schedulePersist();
                });
                num.addEventListener('change', () => {
                    slider.value = num.value;
                    if (callback) callback(num.value);
                    schedulePersist();
                });
            };

            bindSync('rotationSpeed', 'rotationSpeedInput', (v) => {
                appState.actualDisplayRotationSpeed = safeParseFloat(v, 1.0) * appState.currentRotationSpeedBase;
                appState.needsRender = true;
            });

            document.getElementById('rotationModelSelect')?.addEventListener('change', (e) => {
                appState.rotationModel = e.target.value;
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('cardRotationSpeed')?.addEventListener('input', (e) => {
                appState.rt.cardRotationSpeed = safeParseFloat(e.target.value, 2) * 0.00115;
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('cardSelfRotation')?.addEventListener('change', (e) => {
                appState.rt.cardSelfRotation = e.target.checked;
                appState.needsRender = true;
                schedulePersist();
            });

            ['rotateX', 'rotateY', 'rotateZ'].forEach(axisId => {
                document.getElementById(axisId)?.addEventListener('change', () => {
                    this.refreshRuntimeCache();
                    appState.needsRender = true;
                    schedulePersist();
                });
            });

            document.getElementById('grappleEnabled')?.addEventListener('change', (e) => {
                appState.rt.grappleEnabled = e.target.checked;
                schedulePersist();
            });

            document.getElementById('batchSize')?.addEventListener('change', (e) => {
                const newSize = safeParseInt(e.target.value, 500);
                if (newSize > 0) {
                    appState.batchSize = newSize;
                    appState.currentBatchIndex = 0;
                    this.displayCurrentBatch();
                    schedulePersist();
                }
            });

            document.getElementById('focusCruiseEnabled')?.addEventListener('change', (e) => {
                appState.focusCruise.enabled = e.target.checked;
                if (!e.target.checked) appState.focusCruise.currentSpotlightIndices.clear();
                else appState.focusCruise.lastSwitchTime = performance.now();
                this.updateFocusCruiseVisuals();
                appState.needsRender = true;
                schedulePersist();
            });

            bindSync('focusCruiseIntervalRange', 'focusCruiseIntervalInput', (sec) => {
                appState.focusCruise.interval = parseInt(sec, 10);
                appState.focusCruise.lastSwitchTime = performance.now();
                this.updateFocusCruiseVisuals();
            });

            bindSync('focusCruiseRatioRange', 'focusCruiseRatioInput', (ratio) => {
                appState.focusCruise.ratioPercent = parseFloat(ratio);
                appState.focusCruise.visitedIndices = new Set();
                appState.focusCruise.currentSpotlightIndices.clear();
                appState.focusCruise.lastSwitchTime = performance.now();
                this.updateFocusCruiseVisuals();
                appState.needsRender = true;
            });

            bindSync('focusCruiseScaleRange', 'focusCruiseScaleInput', (scale) => {
                appState.focusCruise.scaleFactor = parseFloat(scale);
                this.updateFocusCruiseVisuals();
                appState.needsRender = true;
            });

            ['coreSphereRadius', 'coreSphereColor', 'coreSphereEmissive', 'coreSphereEmissiveIntensity', 'coreSphereOpacity'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const updateFn = () => {
                    AppParticles.updateCoreSphereSettings();
                    appState.needsRender = true;
                    schedulePersist();
                };
                el.addEventListener('input', updateFn);
                el.addEventListener('change', updateFn);
            });

            document.getElementById('visualEffectsEnabled')?.addEventListener('change', (e) => {
                appState.rt.visualFxEnabled = e.target.checked;
                AppParticles.updateVisualEffects();
                appState.needsRender = true;
                schedulePersist();
            });

            ['bloomThreshold', 'bloomStrength', 'bloomRadius'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const updateFn = () => {
                    AppParticles.updateBloomSettings();
                    appState.needsRender = true;
                    schedulePersist();
                };
                el.addEventListener('input', updateFn);
                el.addEventListener('change', updateFn);
            });

            ['dynamicBgHueStart', 'dynamicBgHueEnd', 'dynamicBgLightness'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => {
                    AppParticles.updateDynamicBackgroundCSS();
                    appState.needsRender = true;
                    schedulePersist();
                });
            });

            ['hoverOverlayCardScale', 'hoverCardBrightness', 'hoverCardTextMainWordColor', 'hoverCardTextLabelColor', 'hoverCardTextValueColor'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('input', () => {
                    if (appState.hoveredObject && appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                        this.triggerCardDisplay(appState.hoveredObject);
                    }
                    schedulePersist();
                });
            });
        },

        refreshRuntimeCache() {
            const rt = appState.rt;
            const getChk = (id, fb = false) => {
                const el = document.getElementById(id);
                return el ? el.checked : fb;
            };

            rt.rotateX = getChk('rotateX', true);
            rt.rotateY = getChk('rotateY', true);
            rt.rotateZ = getChk('rotateZ', false);
            rt.cardSelfRotation = getChk('cardSelfRotation', true);
            rt.grappleEnabled = getChk('grappleEnabled', true);
            rt.visualFxEnabled = getChk('visualEffectsEnabled', false);

            const crs = document.getElementById('cardRotationSpeed');
            if (crs) rt.cardRotationSpeed = safeParseFloat(crs.value, 2) * 0.00115;
        },

        initAllButtonsAndEvents() {
            document.getElementById('settingsBtn')?.addEventListener('click', () => {
                document.getElementById('controlsOverlay')?.classList.toggle('visible');
            });
            document.getElementById('closeControlsOverlayBtn')?.addEventListener('click', () => {
                document.getElementById('controlsOverlay')?.classList.remove('visible');
            });

            document.getElementById('uploadBtn')?.addEventListener('click', () => this.handleFileUpload());
            document.getElementById('appendUploadBtn')?.addEventListener('click', () => this.handleAppendUpload());
            document.getElementById('exportJSONBtn')?.addEventListener('click', () => this.exportJSON());
            document.getElementById('exportSettingsBtn')?.addEventListener('click', () => this.exportSettings());
            document.getElementById('importSettingsBtn')?.addEventListener('click', () => this.importSettings());

            const pasteModal = document.getElementById('pasteDataModalBackdrop');
            document.getElementById('openPasteModalBtn')?.addEventListener('click', () => {
                if (pasteModal) pasteModal.classList.add('visible');
            });
            document.getElementById('closePasteModalBtn')?.addEventListener('click', () => {
                if (pasteModal) pasteModal.classList.remove('visible');
            });
            document.getElementById('submitPasteDataBtn')?.addEventListener('click', () => this.submitPasteData());

            document.getElementById('filterBtn')?.addEventListener('click', () => this.showModeAndFilterModal());
            document.getElementById('applyFilterBtn')?.addEventListener('click', () => this.applyFiltersAndDisplay());
            document.getElementById('closeFilterModalBtn')?.addEventListener('click', () => {
                document.getElementById('filterModalBackdrop')?.classList.remove('visible');
            });
            document.getElementById('closeFilterModalTopBtn')?.addEventListener('click', () => {
                document.getElementById('filterModalBackdrop')?.classList.remove('visible');
            });

            document.getElementById('rotateToggle')?.addEventListener('click', () => {
                appState.autoRotate = !appState.autoRotate;
                document.getElementById('rotateToggle').textContent = appState.autoRotate ? '🔁' : '⏹️';
                appState.needsRender = true;
            });

            document.getElementById('toggleLanguage')?.addEventListener('click', () => {
                appState.showEnglish = !appState.showEnglish;
                document.getElementById('toggleLanguage').textContent = appState.showEnglish ? '中' : '英';
                appState.batchSize = appState.showEnglish ? APP_CONFIG.DEFAULT_BATCH_SIZE_EN : APP_CONFIG.DEFAULT_BATCH_SIZE_CN;
                const batchSizeInput = document.getElementById('batchSize');
                if (batchSizeInput) batchSizeInput.value = appState.batchSize;
                this.displayCurrentBatch();
                scheduleSphereRebuild(10);
                schedulePersist();
            });

            document.getElementById('randomShuffleBtn')?.addEventListener('click', () => {
                const list = appState.isWordStormActive ? appState.wordStormProcessedWords : appState.filteredWords;
                if (!list || !list.length) return;
                appState.currentBatchWords = [...list].sort(() => Math.random() - 0.5).slice(0, appState.batchSize);
                AppSphereEngine.createWordSphere(appState.currentBatchWords);
                if (navigator.vibrate) navigator.vibrate(40);
                this.showToast('🎲 已随机更换球面卡片');
            });

            document.getElementById('zoomInBtn')?.addEventListener('click', () => AppScene.zoomSphere(0.85));
            document.getElementById('zoomOutBtn')?.addEventListener('click', () => AppScene.zoomSphere(1.15));

            document.getElementById('speedUpBtn')?.addEventListener('click', () => this.changeViewAwareSpeed(1.25));
            document.getElementById('speedDownBtn')?.addEventListener('click', () => this.changeViewAwareSpeed(0.80));

            document.getElementById('focusCruiseToggleBtn')?.addEventListener('click', () => {
                appState.focusCruise.enabled = !appState.focusCruise.enabled;
                if (!appState.focusCruise.enabled) {
                    appState.focusCruise.currentSpotlightIndices.clear();
                } else {
                    appState.focusCruise.lastSwitchTime = performance.now();
                }
                this.updateFocusCruiseVisuals();
                appState.needsRender = true;
                this.showToast(appState.focusCruise.enabled ? `✨ 局部巡航已开启` : '💤 局部巡航已关闭');
                schedulePersist();
            });

            document.getElementById('prevBatchBtn')?.addEventListener('click', () => {
                if (appState.currentBatchIndex > 0) {
                    appState.currentBatchIndex--;
                    this.displayCurrentBatch();
                }
            });
            document.getElementById('nextBatchBtn')?.addEventListener('click', () => {
                if (appState.currentBatchIndex < appState.totalBatches - 1) {
                    appState.currentBatchIndex++;
                    this.displayCurrentBatch();
                }
            });

            document.getElementById('closeDetailBtn')?.addEventListener('click', () => this.hideImmersiveDetailPanel());
            document.getElementById('togglePanelSideBtn')?.addEventListener('click', () => {
                document.getElementById('immersiveDetailPanel')?.classList.toggle('left-aligned');
                this.adjustSphereViewForPanel();
            });
            document.getElementById('speakDetailWordBtn')?.addEventListener('click', () => {
                if (appState.currentDetailWord?.words) AppAudio.speakWord(appState.currentDetailWord.words);
            });

            document.getElementById('viewsBtn')?.addEventListener('click', () => this.toggleManagementPanel('views'));
            document.getElementById('wordBanksBtn')?.addEventListener('click', () => this.toggleManagementPanel('wordBanks'));
            document.getElementById('rotationsBtn')?.addEventListener('click', () => this.toggleManagementPanel('rotations'));
            document.getElementById('hoverPosBtn')?.addEventListener('click', () => this.toggleManagementPanel('hoverPositions'));

            this.bindSystemViewButton(document.getElementById('viewInsideBtn'), 'inside');
            this.bindSystemViewButton(document.getElementById('viewSurfaceBtn'), 'surface');
            this.bindSystemViewButton(document.getElementById('viewOverallBtn'), 'overall');

            document.getElementById('layoutTopRowBtn')?.addEventListener('click', () => AppOrbit.arrangeCardsInLayout('top_row'));
            document.getElementById('layoutCenterRowBtn')?.addEventListener('click', () => AppOrbit.arrangeCardsInLayout('center_row'));
            document.getElementById('layoutBottomRowBtn')?.addEventListener('click', () => AppOrbit.arrangeCardsInLayout('bottom_row'));
            document.getElementById('layoutLeftColBtn')?.addEventListener('click', () => AppOrbit.arrangeCardsInLayout('left_col'));
            document.getElementById('layoutRightColBtn')?.addEventListener('click', () => AppOrbit.arrangeCardsInLayout('right_col'));

            document.getElementById('batchShieldToggleBtn')?.addEventListener('click', () => {
                if (appState.batchShieldMode) {
                    this.exitBatchShieldMode();
                } else {
                    appState.batchShieldMode = true;
                    appState.selectedShieldWords = new Set();
                    document.getElementById('shieldCountLabel').textContent = `已选择: 0 个单词`;
                    document.getElementById('batchShieldHUD')?.classList.remove('hidden');
                }
            });
            document.getElementById('cancelBatchShieldBtn')?.addEventListener('click', () => this.exitBatchShieldMode());
            document.getElementById('confirmBatchShieldBtn')?.addEventListener('click', () => {
                if (appState.selectedShieldWords.size === 0) {
                    alert('请点击选择球面上的卡片进行屏蔽。');
                    return;
                }
                if (confirm(`确定要将这 ${appState.selectedShieldWords.size} 个单词移入屏蔽词库吗？`)) {
                    appState.selectedShieldWords.forEach(key => appState.shieldedWords.add(key));
                    AppStorage.saveShieldedWords(appState.shieldedWords);
                    appState.allWords = appState.allWords.filter(w => !appState.shieldedWords.has(getWordKey(w)));
                    appState.filteredWords = appState.filteredWords.filter(w => !appState.shieldedWords.has(getWordKey(w)));
                    this.displayCurrentBatch();
                    this.updateClearShieldedBtnLabel();
                    this.exitBatchShieldMode();
                    this.updateStats();
                }
            });

            document.getElementById('detailSearchBtn')?.addEventListener('click', () => {
                const q = document.getElementById('detailSearchInput')?.value.trim();
                this.performAndDisplaySearch(q);
            });
            document.getElementById('closeSearchResultsModalBtn')?.addEventListener('click', () => {
                document.getElementById('searchResultsModalBackdrop')?.classList.remove('visible');
            });

            document.getElementById('helpBtn')?.addEventListener('click', () => {
                this.updateHelpModal();
                document.getElementById('helpModalBackdrop')?.classList.add('visible');
            });
            document.getElementById('closeHelpModalBtn')?.addEventListener('click', () => {
                document.getElementById('helpModalBackdrop')?.classList.remove('visible');
            });

            const masterBtn = document.getElementById('masterMenuToggleBtn');
            const viewControls = document.getElementById('viewControlsContainer');
            if (masterBtn && viewControls) {
                masterBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    viewControls.classList.toggle('expanded');
                    masterBtn.textContent = viewControls.classList.contains('expanded') ? '❌' : '🔮';
                });
                document.addEventListener('click', (e) => {
                    if (!viewControls.contains(e.target)) {
                        viewControls.classList.remove('expanded');
                        masterBtn.textContent = '🔮';
                    }
                });
            }

            document.addEventListener('keydown', (e) => {
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                if (e.key === 'Escape') {
                    this.hideImmersiveDetailPanel();
                    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('visible'));
                    document.getElementById('managementPanel')?.classList.add('hidden');
                } else if (e.key === ' ') {
                    e.preventDefault();
                    document.getElementById('rotateToggle')?.click();
                }
            });
        },

        showNumberPromptModal(options) {
            const backdrop = document.getElementById('numberPromptModalBackdrop');
            const titleEl = document.getElementById('promptModalTitle');
            const inputEl = document.getElementById('promptModalInput');
            const stepMinusBtn = document.getElementById('promptModalMinus');
            const stepPlusBtn = document.getElementById('promptModalPlus');
            const confirmBtn = document.getElementById('promptModalConfirm');
            const cancelBtn = document.getElementById('promptModalCancel');
            if (!backdrop || !inputEl) return;

            const { title, value, min = 1, max = 2000, step = 1, onConfirm } = options;
            titleEl.textContent = title;
            inputEl.value = value;
            inputEl.min = min;
            inputEl.max = max;
            inputEl.step = step;

            const updateVal = (delta) => {
                let cur = parseFloat(inputEl.value) || 0;
                cur = Math.max(min, Math.min(max, cur + delta));
                inputEl.value = (step < 1) ? cur.toFixed(1) : Math.round(cur);
            };

            stepMinusBtn.onclick = (e) => { e.stopPropagation(); updateVal(-step); };
            stepPlusBtn.onclick = (e) => { e.stopPropagation(); updateVal(step); };

            const close = () => {
                backdrop.classList.remove('visible');
                stepMinusBtn.onclick = null;
                stepPlusBtn.onclick = null;
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
                inputEl.onkeydown = null;
            };

            const doConfirm = () => {
                const val = parseFloat(inputEl.value);
                if (!isNaN(val) && val >= min && val <= max) {
                    if (onConfirm) onConfirm(val);
                }
                close();
            };

            cancelBtn.onclick = (e) => { e.stopPropagation(); close(); };
            confirmBtn.onclick = (e) => { e.stopPropagation(); doConfirm(); };

            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    doConfirm();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    close();
                }
            };

            backdrop.classList.add('visible');
            setTimeout(() => { inputEl.focus(); inputEl.select(); }, 100);
        },

        initFocusCruiseHud() {
            const hud = document.getElementById('focusCruiseHud');
            const trigger = document.getElementById('focusCruiseTrigger');
            const statusTag = document.getElementById('focusCruiseStatusTag');
            const intervalPill = document.getElementById('focusCruiseIntervalPill');
            const ratioPill = document.getElementById('focusCruiseRatioPill');
            const scalePill = document.getElementById('focusCruiseScalePill');
            if (!hud) return;

            trigger?.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = hud.classList.contains('expanded');
                hud.classList.toggle('expanded', !isExpanded);
                hud.classList.toggle('collapsed', isExpanded);
            });

            hud.addEventListener('click', () => {
                if (!hud.classList.contains('expanded')) {
                    hud.classList.remove('collapsed');
                    hud.classList.add('expanded');
                }
            });

            statusTag?.addEventListener('click', (e) => {
                e.stopPropagation();
                appState.focusCruise.enabled = !appState.focusCruise.enabled;
                if (!appState.focusCruise.enabled) {
                    appState.focusCruise.currentSpotlightIndices.clear();
                } else {
                    appState.focusCruise.lastSwitchTime = performance.now();
                }
                this.updateFocusCruiseVisuals();
                appState.needsRender = true;
                this.showToast(appState.focusCruise.enabled ? `✨ 局部巡航已开启` : '⏹️ 局部巡航已关闭');
                schedulePersist();
            });

            intervalPill?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showNumberPromptModal({
                    title: '⏱️ 修改巡航轮换周期 (秒)',
                    value: appState.focusCruise.interval || 50,
                    min: 2, max: 1200, step: 5,
                    onConfirm: (sec) => {
                        appState.focusCruise.interval = Math.round(sec);
                        appState.focusCruise.lastSwitchTime = performance.now();
                        this.updateFocusCruiseVisuals();
                        this.showToast(`⏱️ 巡航轮换周期已修改为: ${Math.round(sec)} 秒`);
                        schedulePersist();
                    }
                });
            });

            ratioPill?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showNumberPromptModal({
                    title: '🔍 抽取放大卡片数量占比 (%)',
                    value: appState.focusCruise.ratioPercent || 8,
                    min: 0.5, max: 100, step: 0.5,
                    onConfirm: (ratio) => {
                        appState.focusCruise.ratioPercent = ratio;
                        appState.focusCruise.visitedIndices = new Set();
                        appState.focusCruise.currentSpotlightIndices.clear();
                        appState.focusCruise.lastSwitchTime = performance.now();
                        this.updateFocusCruiseVisuals();
                        appState.needsRender = true;
                        this.showToast(`🔍 放大卡片数量占比已设为: ${ratio}%`);
                        schedulePersist();
                    }
                });
            });

            scalePill?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showNumberPromptModal({
                    title: '🔎 抽中卡片的放大倍率 (倍)',
                    value: appState.focusCruise.scaleFactor || 1.5,
                    min: 1.0, max: 12.0, step: 0.1,
                    onConfirm: (scale) => {
                        appState.focusCruise.scaleFactor = parseFloat(scale.toFixed(1));
                        this.updateFocusCruiseVisuals();
                        appState.needsRender = true;
                        this.showToast(`🔎 抽中卡片放大倍率已设为: ${scale} 倍`);
                        schedulePersist();
                    }
                });
            });

            document.addEventListener('pointerdown', (e) => {
                const modal = document.getElementById('numberPromptModalBackdrop');
                if (modal && (modal.contains(e.target) || modal.classList.contains('visible'))) {
                    return;
                }
                if (hud && !hud.contains(e.target)) {
                    hud.classList.remove('expanded');
                    hud.classList.add('collapsed');
                }
            });
        },

        updateFocusCruiseVisuals() {
            const enabled = appState.focusCruise.enabled;
            const interval = appState.focusCruise.interval;
            const ratioPercent = appState.focusCruise.ratioPercent || 8;
            const scaleFactor = appState.focusCruise.scaleFactor || 1.5;

            const toggleBtn = document.getElementById('focusCruiseToggleBtn');
            if (toggleBtn) {
                toggleBtn.classList.toggle('active-toggle', enabled);
                toggleBtn.classList.toggle('inactive-toggle', !enabled);
                toggleBtn.textContent = enabled ? '✨' : '💤';
            }

            const hud = document.getElementById('focusCruiseHud');
            const triggerIcon = document.getElementById('focusCruiseTriggerIcon');
            const triggerText = document.getElementById('focusCruiseTriggerText');
            const statusTag = document.getElementById('focusCruiseStatusTag');
            const intervalVal = document.getElementById('focusCruiseIntervalVal');
            const ratioVal = document.getElementById('focusCruiseRatioVal');
            const scaleVal = document.getElementById('focusCruiseScaleVal');

            if (hud) {
                hud.classList.toggle('enabled', enabled);
                hud.classList.toggle('disabled', !enabled);
            }
            if (triggerIcon) triggerIcon.textContent = enabled ? '✨' : '💤';
            if (triggerText) triggerText.textContent = enabled ? '巡航' : '巡航(关)';
            if (statusTag) statusTag.textContent = enabled ? '开' : '关';
            if (intervalVal) intervalVal.textContent = String(interval);
            if (ratioVal) ratioVal.textContent = String(ratioPercent);
            if (scaleVal) scaleVal.textContent = String(scaleFactor);

            const cb = document.getElementById('focusCruiseEnabled');
            const badge = document.getElementById('focusCruiseStatusBadge');
            const intRange = document.getElementById('focusCruiseIntervalRange');
            const ratRange = document.getElementById('focusCruiseRatioRange');
            const scaRange = document.getElementById('focusCruiseScaleRange');

            if (cb) cb.checked = enabled;
            if (badge) {
                badge.textContent = enabled ? '已开启' : '已关闭';
                badge.className = `status-badge ${enabled ? 'on' : 'off'}`;
            }
            if (intRange) intRange.value = String(interval);
            if (ratRange) ratRange.value = String(ratioPercent);
            if (scaRange) scaRange.value = String(scaleFactor);
        },

        initStudyLog() {
            const counterHud = document.getElementById('studyCounterHud');
            const counterValEl = document.getElementById('studyCounterValue');
            const goalValEl = document.getElementById('studyGoalValue');
            const settleModal = document.getElementById('studySettleModalBackdrop');

            counterValEl?.addEventListener('click', (e) => {
                e.stopPropagation();
                const curCount = AppStorage.getTodayStudiedCount();
                this.showNumberPromptModal({
                    title: '📖 修改今日复习单词数 (设为0重置)',
                    value: curCount, min: 0, max: 5000, step: 1,
                    onConfirm: (n) => {
                        const log = AppStorage.loadStudyLog();
                        const dayKey = getDateKey();
                        if (!log[dayKey]) log[dayKey] = { cards: {} };
                        const targetN = Math.round(n);
                        if (targetN === 0) {
                            log[dayKey].cards = {};
                        } else {
                            const keys = Object.keys(log[dayKey].cards);
                            if (targetN < keys.length) {
                                keys.slice(targetN).forEach(k => delete log[dayKey].cards[k]);
                            } else if (targetN > keys.length) {
                                for (let i = keys.length; i < targetN; i++) {
                                    log[dayKey].cards[`manual_word_${i+1}`] = {
                                        words: `Word_${i+1}`,
                                        chinese: '手动调整',
                                        clickTimes: 1,
                                        lastAt: timeHHMM()
                                    };
                                }
                            }
                        }
                        AppStorage.saveStudyLog(log);
                        this.updateStudyCounterDisplay();
                        this.showToast(`📖 今日已复习单词数已更新为: ${targetN}`);
                    }
                });
            });

            goalValEl?.addEventListener('click', (e) => {
                e.stopPropagation();
                const curGoal = AppStorage.getStudyGoal();
                this.showNumberPromptModal({
                    title: '🎯 修改每日学习目标 (单词数)',
                    value: curGoal, min: 1, max: 2000, step: 5,
                    onConfirm: (n) => {
                        const targetGoal = Math.round(n);
                        AppStorage.setStudyGoal(targetGoal);
                        this.updateStudyCounterDisplay();
                        this.showToast(`🎯 今日学习目标已更新为: ${targetGoal} 个单词`);
                        schedulePersist();
                    }
                });
            });

            counterHud?.addEventListener('click', () => {
                this.renderStudySettlement();
                settleModal?.classList.add('visible');
            });

            document.getElementById('closeStudySettleBtn')?.addEventListener('click', () => {
                settleModal?.classList.remove('visible');
            });
            document.getElementById('closeStudyCompareBtn2')?.addEventListener('click', () => {
                settleModal?.classList.remove('visible');
            });
        },

        updateStudyCounterDisplay() {
            const valEl = document.getElementById('studyCounterValue');
            const goalEl = document.getElementById('studyGoalValue');
            if (valEl) valEl.textContent = String(AppStorage.getTodayStudiedCount());
            if (goalEl) goalEl.textContent = String(AppStorage.getStudyGoal());
        },

        renderStudySettlement() {
            const body = document.getElementById('studySettleBody');
            if (!body) return;
            const log = AppStorage.loadStudyLog();
            const todayKey = getDateKey();
            const day = log[todayKey] || { cards: {} };
            const entries = Object.values(day.cards || {});
            body.innerHTML = `
                <div class="study-summary-grid">
                    <div class="study-summary-item"><div class="v">${entries.length}</div><div class="l">今日有效复习</div></div>
                    <div class="study-summary-item"><div class="v">${entries.reduce((s, e) => s + (e.clickTimes || 1), 0)}</div><div class="l">总点击量</div></div>
                    <div class="study-summary-item"><div class="v">${AppStorage.getStudyGoal()}</div><div class="l">设定目标</div></div>
                    <div class="study-summary-item"><div class="v">${entries.length >= AppStorage.getStudyGoal() ? '已达成 🏆' : '进行中'}</div><div class="l">达成状态</div></div>
                </div>
                <div class="study-list">
                    ${entries.map(e => `
                        <div class="study-word-row">
                            <span class="study-time">${e.lastAt || ''}</span>
                            <span class="study-word">${e.words || ''}</span>
                            <span class="study-phon">${e.phonetic || ''}</span>
                            <span class="study-mean">${e.chinese || ''}</span>
                            <span class="study-repeat-badge">×${e.clickTimes || 1}</span>
                        </div>
                    `).join('') || '<p style="text-align:center; padding:20px; color:#aaa;">今日暂无点击记录，快去球面上轻触单词吧！</p>'}
                </div>
            `;
        },

        toggleManagementPanel(panelType) {
            const panel = document.getElementById('managementPanel');
            if (!panel) return;
            if (appState.activePanel === panelType && !panel.classList.contains('hidden')) {
                panel.classList.add('hidden');
                appState.activePanel = null;
                return;
            }
            panel.classList.remove('hidden');
            appState.activePanel = panelType;

            if (panelType === 'views') {
                this.renderViewsManagementPanel();
            } else if (panelType === 'rotations') {
                this.renderRotationsManagementPanel();
            } else if (panelType === 'wordBanks') {
                this.renderWordBanksManagementPanel();
            } else {
                this.renderHoverPositionsManagementPanel();
            }
        },

        renderViewsManagementPanel() {
            const panel = document.getElementById('managementPanel');
            if (!panel) return;

            const customItems = (appState.customViews || []).map((v, idx) => `
                <div class="mgmt-list-item">
                    <span class="mgmt-item-name" onclick="AppUI.applyViewCameraPosition(${idx})" title="切换至视角">${v.name || `自定义视角 #${idx + 1}`}</span>
                    <button class="mgmt-item-btn" onclick="AppUI.deleteCustomView(${idx})" title="删除">🗑️</button>
                </div>
            `).join('');

            panel.innerHTML = `
                <div class="panel-header">
                    📸 视角预设与导入/导出
                    <button class="panel-header-close-btn" onclick="document.getElementById('managementPanel').classList.add('hidden')">&times;</button>
                </div>
                <div class="mgmt-action-row">
                    <button class="mgmt-action-btn" onclick="AppUI.saveCurrentViewPrompt()">📸 保存当前视角</button>
                    <button class="mgmt-action-btn" onclick="AppUI.exportViewsJSON()">📤 导出视角</button>
                    <button class="mgmt-action-btn" onclick="AppUI.importViewsJSON()">📥 导入视角</button>
                </div>
                <div style="font-size:0.75rem; color:#87cdff; margin-bottom:6px; font-weight:bold;">系统内置预设:</div>
                <div class="mgmt-list-item" onclick="AppUI.applySystemView('inside')">
                    <span class="mgmt-item-name">👁️‍🗨️ 球心全景视角</span>
                </div>
                <div class="mgmt-list-item" onclick="AppUI.applySystemView('surface')">
                    <span class="mgmt-item-name">👀 球面贴近视角</span>
                </div>
                <div class="mgmt-list-item" onclick="AppUI.applySystemView('overall')">
                    <span class="mgmt-item-name">🌎 整体宏观宇宙视角</span>
                </div>
                <div style="font-size:0.75rem; color:#ffd875; margin:10px 0 6px 0; font-weight:bold;">我的自定义视角 (${(appState.customViews || []).length}):</div>
                <div style="max-height: 220px; overflow-y: auto;">
                    ${customItems || '<div style="font-size:0.75rem; color:#7d94b2; text-align:center; padding:10px;">暂无自定义视角，可点击上方按钮保存当前观察角度</div>'}
                </div>
            `;
        },

        saveCurrentViewPrompt() {
            if (!appState.camera || !appState.controls) return;
            const defaultName = `视角_${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
            const name = prompt('请输入新视角的名称:', defaultName);
            if (!name) return;

            if (!appState.customViews) appState.customViews = [];
            appState.customViews.push({
                name: name.trim(),
                cameraPos: appState.camera.position.toArray(),
                controlsTarget: appState.controls.target.toArray()
            });

            localStorage.setItem(APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY, JSON.stringify(appState.customViews));
            this.renderViewsManagementPanel();
            this.showToast(`📸 成功保存视角: ${name}`);
        },

        deleteCustomView(idx) {
            if (!appState.customViews || !appState.customViews[idx]) return;
            if (confirm(`确定删除自定义视角 "${appState.customViews[idx].name}" 吗？`)) {
                appState.customViews.splice(idx, 1);
                localStorage.setItem(APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY, JSON.stringify(appState.customViews));
                this.renderViewsManagementPanel();
                this.showToast('🗑️ 视角已删除');
            }
        },

        applyViewCameraPosition(idx) {
            const v = appState.customViews ? appState.customViews[idx] : null;
            if (!v) return;
            this.animateCameraTo(v.cameraPos, v.controlsTarget, 650);
            this.showToast(`🎥 切换至: ${v.name}`);
        },

        applySystemView(key) {
            const r = appState.sphereRadius || 85;
            let targetPos = [0, 0, 165];
            let targetLook = [0, 0, 0];

            if (key === 'inside') {
                targetPos = [0, 0, 0.1];
                targetLook = [0, 0, r * 2.3];
            } else if (key === 'surface') {
                targetPos = [0, 0, r + 19];
                targetLook = [0, 0, 0];
            }
            this.animateCameraTo(targetPos, targetLook, 650);
            this.showToast(key === 'inside' ? '👁️‍🗨️ 切换至球心视角' : key === 'surface' ? '👀 切换至球面视角' : '🌎 切换至整体视角');
        },

        animateCameraTo(targetCamPos, targetControlsPos, duration = 600) {
            if (!appState.camera || !appState.controls) return;
            const startCam = appState.camera.position.clone();
            const startTarget = appState.controls.target.clone();
            const endCam = new THREE.Vector3().fromArray(targetCamPos);
            const endTarget = new THREE.Vector3().fromArray(targetControlsPos);

            const startTime = performance.now();
            function step(now) {
                const elapsed = now - startTime;
                const t = Math.min(1.0, elapsed / duration);
                const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

                appState.camera.position.lerpVectors(startCam, endCam, ease);
                appState.controls.target.lerpVectors(startTarget, endTarget, ease);
                appState.controls.update();
                appState.needsRender = true;

                if (t < 1.0) {
                    requestAnimationFrame(step);
                }
            }
            requestAnimationFrame(step);
        },

        exportViewsJSON() {
            if (!appState.customViews || appState.customViews.length === 0) {
                alert('暂无自定义视角可供导出，请先点击"保存当前视角"！');
                return;
            }
            const blob = new Blob([JSON.stringify(appState.customViews, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `3DWordUniverse_Views_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('📤 视角预设配置导出成功！');
        },

        importViewsJSON() {
            selectLocalFile('application/json,.json', (file) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const imported = JSON.parse(e.target.result);
                        if (!Array.isArray(imported)) throw new Error('数据必须是包含视角配置的 JSON 数组');
                        appState.customViews = imported;
                        localStorage.setItem(APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY, JSON.stringify(appState.customViews));
                        this.renderViewsManagementPanel();
                        alert(`成功导入 ${imported.length} 个自定义视角预设！`);
                    } catch (err) {
                        alert('视角文件解析失败: ' + err.message);
                    }
                };
                reader.readAsText(file);
            });
        },

        renderRotationsManagementPanel() {
            const panel = document.getElementById('managementPanel');
            if (!panel) return;
            panel.innerHTML = `
                <div class="panel-header">
                    🌪️ 自转速度预设
                    <button class="panel-header-close-btn" onclick="document.getElementById('managementPanel').classList.add('hidden')">&times;</button>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <button class="mgmt-action-btn" onclick="AppUI.setPresetRotationSpeed(0.02)">🐢 极慢微风 (0.02)</button>
                    <button class="mgmt-action-btn" onclick="AppUI.setPresetRotationSpeed(0.08)">🍃 舒适慢阅 (0.08)</button>
                    <button class="mgmt-action-btn" onclick="AppUI.setPresetRotationSpeed(0.135)">⭐ 经典恒速 (0.135)</button>
                    <button class="mgmt-action-btn" onclick="AppUI.setPresetRotationSpeed(0.50)">🚀 高速巡航 (0.50)</button>
                    <button class="mgmt-action-btn" onclick="AppUI.setPresetRotationSpeed(1.50)">⚡ 狂暴穿梭 (1.50)</button>
                </div>
            `;
        },

        setPresetRotationSpeed(spd) {
            appState.currentRotationSpeedBase = spd;
            appState.actualDisplayRotationSpeed = spd;
            const rotSlider = document.getElementById('rotationSpeed');
            if (rotSlider) rotSlider.value = 1.0;
            appState.needsRender = true;
            schedulePersist();
            this.showToast(`🌪️ 已切换自转速度: ${spd}`);
        },

        renderWordBanksManagementPanel() {
            const panel = document.getElementById('managementPanel');
            if (!panel) return;
            panel.innerHTML = `
                <div class="panel-header">
                    📚 词库管理与快速切换
                    <button class="panel-header-close-btn" onclick="document.getElementById('managementPanel').classList.add('hidden')">&times;</button>
                </div>
                <div style="padding:6px; font-size:0.82rem; color:#b0d8ff;">
                    当前库中总词数: <strong style="color:#68FFC0;">${appState.allWords.length}</strong><br>
                    已屏蔽单词数: <strong style="color:#ff8a8a;">${appState.shieldedWords.size}</strong><br>
                    当前激活批次: <strong>${appState.currentBatchIndex + 1} / ${appState.totalBatches || 1}</strong>
                </div>
                <div class="mgmt-action-row" style="margin-top:10px;">
                    <button class="mgmt-action-btn" onclick="document.getElementById('filterBtn').click()">🔍 打开筛选与模式</button>
                    <button class="mgmt-action-btn" onclick="document.getElementById('clearShieldedBtn').click()">🛡️ 清除屏蔽库</button>
                </div>
            `;
        },

        renderHoverPositionsManagementPanel() {
            const panel = document.getElementById('managementPanel');
            if (!panel) return;
            panel.innerHTML = `
                <div class="panel-header">
                    📍 悬浮卡片展示位置
                    <button class="panel-header-close-btn" onclick="document.getElementById('managementPanel').classList.add('hidden')">&times;</button>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <button class="mgmt-action-btn" onclick="AppUI.setHoverPosMode('default')">🎯 默认立体贴附 (跟随卡片视角)</button>
                    <button class="mgmt-action-btn" onclick="AppUI.setHoverPosMode('center')">📺 屏幕正中微缩展示</button>
                    <button class="mgmt-action-btn" onclick="AppUI.setHoverPosMode('top')">⬆️ 顶部天幕展示</button>
                </div>
            `;
        },

        setHoverPosMode(mode) {
            appState.hoverCardPositionMode = mode;
            this.showToast(`📍 悬浮卡片位置已设为: ${mode}`);
        },

        bindSystemViewButton(btn, key) {
            if (!btn) return;
            btn.addEventListener('click', () => this.applySystemView(key));
        },

        initSystemViews() {
            const r = appState.sphereRadius || 85;
            appState.systemViews = {
                'inside': { cameraPos: [0, 0, 0.1], controlsTarget: [0, 0, r * 2.3] },
                'surface': { cameraPos: [0, 0, r + 19], controlsTarget: [0, 0, 0] },
                'overall': { cameraPos: [0, 0, 165], controlsTarget: [0, 0, 0] }
            };
        },

        loadCustomViews() {
            const s = localStorage.getItem(APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY);
            if (s) appState.customViews = safeJSONParse(s, []);
        },

        handleFileUpload() {
            selectLocalFile('application/json,.json', async (file) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const words = JSON.parse(e.target.result);
                        if (!Array.isArray(words)) throw new Error('数据格式错误：根节点必须为数组');
                        await AppStorage.saveLibrary(words);
                        await this.loadWordDataAndBoot();
                        alert(`成功载入 ${words.length} 个词汇并完成持久化存储！`);
                    } catch (error) {
                        alert('数据解析失败: ' + error.message);
                    }
                };
                reader.readAsText(file);
            });
        },

        handleAppendUpload() {
            selectLocalFile('application/json,.json', async (file) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const newWords = JSON.parse(e.target.result);
                        if (!Array.isArray(newWords)) throw new Error('数据格式错误：必须为数组');
                        const existingKeys = new Set(appState.allWords.map(w => getWordKey(w)));
                        let added = 0;
                        newWords.forEach(w => {
                            const k = getWordKey(w);
                            if (!existingKeys.has(k)) {
                                appState.allWords.push(w);
                                existingKeys.add(k);
                                added++;
                            }
                        });
                        if (added > 0) {
                            await AppStorage.saveLibrary(appState.allWords);
                            this.displayCurrentBatch();
                            this.updateStats();
                            alert(`成功追加 ${added} 个全新单词！`);
                        } else {
                            alert('未检测到全新的非重复项。');
                        }
                    } catch (err) {
                        alert('追加失败: ' + err.message);
                    }
                };
                reader.readAsText(file);
            });
        },

        submitPasteData() {
            const textarea = document.getElementById('pasteDataTextArea');
            const text = textarea?.value.trim();
            const mode = document.querySelector('input[name="pasteImportMode"]:checked')?.value || 'replace';
            if (!text) {
                alert('请输入需要解析的内容！');
                return;
            }
            try {
                const words = JSON.parse(text);
                if (!Array.isArray(words)) throw new Error('数据根节点必须为数组格式 [ ... ]');
                if (mode === 'replace') {
                    AppStorage.saveLibrary(words);
                    this.loadWordDataAndBoot();
                    alert(`解析成功，已覆盖导入 ${words.length} 个单词。`);
                } else {
                    const existingKeys = new Set(appState.allWords.map(w => getWordKey(w)));
                    let added = 0;
                    words.forEach(w => {
                        const k = getWordKey(w);
                        if (!existingKeys.has(k)) {
                            appState.allWords.push(w);
                            existingKeys.add(k);
                            added++;
                        }
                    });
                    AppStorage.saveLibrary(appState.allWords);
                    this.displayCurrentBatch();
                    this.updateStats();
                    alert(`成功追加 ${added} 个单词。`);
                }
                document.getElementById('pasteDataModalBackdrop')?.classList.remove('visible');
                if (textarea) textarea.value = '';
            } catch (e) {
                alert('解析失败，请检查是否为标准 JSON 格式。\n错误信息: ' + e.message);
            }
        },

        exportJSON() {
            if (!appState.allWords || appState.allWords.length === 0) {
                alert('当前词库为空，无法导出。');
                return;
            }
            const blob = new Blob([JSON.stringify(appState.allWords, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `WordUniverse_Backup_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        exportSettings() {
            const fullBackup = {};
            const keysToBackup = [
                APP_CONFIG.SETTINGS_STORAGE_KEY,
                APP_CONFIG.LAST_STATE_STORAGE_KEY,
                APP_CONFIG.VIEWED_WORDS_STORAGE_KEY,
                APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY
            ];
            keysToBackup.forEach(key => {
                const data = localStorage.getItem(key);
                if (data) fullBackup[key] = safeJSONParse(data, null);
            });
            const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `WordUniverse_Settings_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('系统所有个性化设置参数已成功导出！');
        },

        importSettings() {
            selectLocalFile('application/json,.json', (file) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const imported = JSON.parse(e.target.result);
                        for (let key in imported) {
                            if (imported.hasOwnProperty(key)) {
                                localStorage.setItem(key, JSON.stringify(imported[key]));
                            }
                        }
                        alert('设置导入成功，页面即将刷新！');
                        location.reload();
                    } catch (err) {
                        alert('设置解析失败: ' + err.message);
                    }
                };
                reader.readAsText(file);
            });
        },

        showModeAndFilterModal() {
            const filterKeys = ['grade', 'term', 'unit', 'Source'];
            const container = document.getElementById('filterOptionsContainer');
            if (!container) return;
            container.innerHTML = '';

            filterKeys.forEach(key => {
                const uniqueValues = [...new Set(appState.allWords.map(w => w[key]).filter(Boolean).sort())];
                if (uniqueValues.length === 0) return;

                const groupDiv = document.createElement('div');
                groupDiv.style.marginBottom = '15px';
                groupDiv.innerHTML = `<label style="display:block; font-weight:bold; margin-bottom:8px; color:var(--accent-color-1);">${key}:</label>`;

                const wrap = document.createElement('div');
                wrap.style.display = 'flex';
                wrap.style.flexWrap = 'wrap';
                wrap.style.gap = '10px';
                wrap.dataset.filterKey = key;

                const allDiv = document.createElement('div');
                allDiv.innerHTML = `<label><input type="checkbox" id="filter-${key}-all" checked> 所有</label>`;
                wrap.appendChild(allDiv);

                uniqueValues.forEach(val => {
                    const itemDiv = document.createElement('div');
                    itemDiv.innerHTML = `<label><input type="checkbox" value="${val}" class="item-chk"> ${val}</label>`;
                    wrap.appendChild(itemDiv);
                });

                const allChk = allDiv.querySelector('input');
                const itemChks = wrap.querySelectorAll('.item-chk');

                allChk.addEventListener('change', () => {
                    if (allChk.checked) itemChks.forEach(c => c.checked = false);
                });
                itemChks.forEach(c => {
                    c.addEventListener('change', () => {
                        if (c.checked) allChk.checked = false;
                        else if (![...itemChks].some(x => x.checked)) allChk.checked = true;
                    });
                });

                groupDiv.appendChild(wrap);
                container.appendChild(groupDiv);
            });

            document.getElementById('filterModalBackdrop')?.classList.add('visible');
        },

        applyFiltersAndDisplay() {
            appState.filterCriteria = {};
            document.querySelectorAll('#filterOptionsContainer div[data-filter-key]').forEach(container => {
                const key = container.dataset.filterKey;
                const allChk = container.querySelector(`#filter-${key}-all`);
                if (allChk && !allChk.checked) {
                    const selected = Array.from(container.querySelectorAll('.item-chk:checked')).map(c => c.value);
                    if (selected.length > 0) appState.filterCriteria[key] = selected;
                }
            });

            appState.filteredWords = appState.allWords.filter(word => {
                return Object.entries(appState.filterCriteria).every(([k, vals]) => {
                    return vals.includes(String(word[k] || ''));
                });
            });

            if (appState.filteredWords.length === 0 && appState.allWords.length > 0) {
                appState.filteredWords = [...appState.allWords];
            }

            this.displayCurrentBatch();
            document.getElementById('filterModalBackdrop')?.classList.remove('visible');
        },

        performAndDisplaySearch(query) {
            if (!query || query.length < 2) {
                alert('请输入至少2个字符进行搜索。');
                return;
            }
            const lq = query.toLowerCase();
            const results = [];
            appState.allWords.forEach(word => {
                if ((word.words && word.words.toLowerCase().includes(lq)) ||
                    (word.chinese && word.chinese.toLowerCase().includes(lq)) ||
                    (word.method && word.method.toLowerCase().includes(lq))) {
                    results.push(word);
                }
            });

            const content = document.getElementById('searchResultsContent');
            if (!content) return;
            content.innerHTML = '';

            if (results.length === 0) {
                content.innerHTML = '<p style="text-align:center; padding:20px; color:#aaa;">未找到相关单词。</p>';
            } else {
                results.slice(0, 100).forEach(w => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML = `
                        <div class="search-result-header">
                            <span class="search-result-word">${w.words}</span>
                            <span class="search-result-phonetic">${w.phonetic || ''}</span>
                            <span class="search-result-meaning">${w.chinese}</span>
                        </div>
                    `;
                    item.onclick = () => {
                        this.showImmersiveDetailPanel(w);
                        document.getElementById('searchResultsModalBackdrop')?.classList.remove('visible');
                    };
                    content.appendChild(item);
                });
            }
            document.getElementById('searchResultsModalBackdrop')?.classList.add('visible');
        },

        initMobileTouchHandlers() {
            let pointerDownTime = 0;
            let pointerDownPos = new THREE.Vector2();

            dom.wordSphereContainer = document.getElementById('wordSphere');
            if (!dom.wordSphereContainer) return;

            dom.wordSphereContainer.addEventListener('pointerdown', (e) => {
                pointerDownTime = performance.now();
                pointerDownPos.set(e.clientX, e.clientY);
            });

            dom.wordSphereContainer.addEventListener('pointerup', (e) => {
                const duration = performance.now() - pointerDownTime;
                const dist = pointerDownPos.distanceTo(new THREE.Vector2(e.clientX, e.clientY));
                // 宽容点击判定，兼顾移动触控与鼠标轻点
                if (dist < 12 && duration < 450) {
                    this.handleQuickTap(e);
                }
            });
        },

        updateHoverCardPosition(pxWidth, pxHeight, scaleFactor, baseDivisor = 35) {
            if (!appState.overlayCardTargetPosition) {
                appState.overlayCardTargetPosition = new THREE.Vector3();
            }
            const aspect = appState.camera.aspect;
            const distance = 40;

            const fov = appState.camera.fov * (Math.PI / 180);
            const viewHeight3D = 2 * Math.tan(fov / 2) * distance;
            const viewWidth3D = viewHeight3D * aspect;

            const cardAspect = pxWidth / pxHeight;

            // 基于老版本计算公式：viewWidth3D * 0.55 * scaleFactor
            const targetWidth3D = viewWidth3D * 0.55 * scaleFactor;
            const targetHeight3D = targetWidth3D / cardAspect;

            if (appState.hoverOverlayCard) {
                appState.overlayCardTargetScale.set(targetWidth3D, targetHeight3D, 1);
            }

            const camDir = new THREE.Vector3().setFromMatrixColumn(appState.camera.matrix, 2).multiplyScalar(-1);
            const centerPoint = appState.camera.position.clone().add(camDir.multiplyScalar(distance));
            appState.overlayCardTargetPosition.copy(centerPoint);
            appState.needsRender = true;
        },

        triggerCardDisplay(card) {
            if (!card) return;
            const wordData = card.userData.word;
            appState.hoveredObject = card;

            const { texture, pxWidth, pxHeight } = AppCardFactory.createOverlayTexture(wordData);
            const screen = appState.hoverOverlayCard.getObjectByName("textScreen");
            if (screen) {
                if (screen.material.map) screen.material.map.dispose();
                screen.material.map = texture;
                screen.material.needsUpdate = true;
            }

            appState.hoverOverlayCard.userData.word = wordData;
            appState.hoverOverlayCard.visible = true;
            appState.overlayCardTargetOpacity = 1;

            const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
            const mobileScaleMultiplier = isMobile ? 1.5 : 1.0;
            const scaleInput = document.getElementById('hoverOverlayCardScale');
            const scaleFactor = (parseFloat(scaleInput ? scaleInput.value : 1.0) || 1.0) * mobileScaleMultiplier;

            this.updateHoverCardPosition(pxWidth, pxHeight, scaleFactor, 35);

            // 第一毫秒内将位置和四元数与视线同步，彻底消灭未到位时的点击盲区
            if (appState.hoverOverlayCard.scale.x < 0.1) {
                appState.hoverOverlayCard.position.copy(appState.overlayCardTargetPosition);
                appState.hoverOverlayCard.quaternion.copy(appState.camera.quaternion);
                appState.hoverOverlayCard.scale.copy(appState.overlayCardTargetScale);
            }
            appState.hoverOverlayCard.updateMatrixWorld(true);

            if (wordData && wordData.words) {
                AppAudio.speakWord(wordData.words, 1);
            }
            appState.needsRender = true;
        },

        /**
         * 100% 还原老版本 handleQuickTap 判定机制
         */
        handleQuickTap(e) {
            if (!appState.camera) return;
            const mouse = new THREE.Vector2(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, appState.camera);

            // 1. 优先对 3D 悬浮查词卡片进行全量深度判定
            if (appState.hoverOverlayCard && appState.hoverOverlayCard.visible && appState.overlayCardTargetOpacity > 0.05) {
                appState.hoverOverlayCard.updateMatrixWorld(true);
                const intersectsCard = raycaster.intersectObjects([appState.hoverOverlayCard], true);

                if (intersectsCard.length > 0) {
                    const intersect = intersectsCard[0];
                    const uv = intersect.uv;

                    const screenMesh = appState.hoverOverlayCard.getObjectByName("textScreen");
                    const texture = screenMesh ? screenMesh.material.map : null;

                    if (texture && texture.image && uv) {
                        const canvasWidth = texture.image.width;
                        const canvasHeight = texture.image.height;

                        const clickX = uv.x * canvasWidth;
                        const clickY = (1 - uv.y) * canvasHeight;

                        const wordData = appState.hoverOverlayCard.userData.word || appState.hoveredObject?.userData?.word;

                        if (wordData && wordData.hover_click_zones) {
                            for (const zone of wordData.hover_click_zones) {
                                if (clickX >= zone.xMin && clickX <= zone.xMax && clickY >= zone.yMin && clickY <= zone.yMax) {
                                    if (zone.type === 'speak' || zone.type === 'word') {
                                        AppAudio.speakWord(wordData.words, 1);
                                        this.showToast(`🔊 朗读: ${wordData.words}`, 1200);
                                    } else if (zone.type === 'fontSizeDown') {
                                        const scaleInput = document.getElementById('hoverOverlayCardScale');
                                        let currentScale = parseFloat(scaleInput ? scaleInput.value : 1.0);
                                        currentScale = Math.max(0.4, parseFloat((currentScale - 0.1).toFixed(2)));
                                        if (scaleInput) scaleInput.value = currentScale;
                                        const scaleOut = document.getElementById('hoverOverlayCardScaleOutput');
                                        if (scaleOut) scaleOut.textContent = currentScale.toFixed(2);
                                        this.saveSettings();
                                        this.saveLastState();
                                        this.triggerCardDisplay(appState.hoveredObject);
                                        this.showToast(`🔍 缩放: ${(currentScale * 100).toFixed(0)}%`, 1000);
                                    } else if (zone.type === 'fontSizeUp') {
                                        const scaleInput = document.getElementById('hoverOverlayCardScale');
                                        let currentScale = parseFloat(scaleInput ? scaleInput.value : 1.0);
                                        currentScale = Math.min(3.0, parseFloat((currentScale + 0.1).toFixed(2)));
                                        if (scaleInput) scaleInput.value = currentScale;
                                        const scaleOut = document.getElementById('hoverOverlayCardScaleOutput');
                                        if (scaleOut) scaleOut.textContent = currentScale.toFixed(2);
                                        this.saveSettings();
                                        this.saveLastState();
                                        this.triggerCardDisplay(appState.hoveredObject);
                                        this.showToast(`🔍 缩放: ${(currentScale * 100).toFixed(0)}%`, 1000);
                                    } else if (zone.type === 'shield') {
                                        if (confirm(`确定要将单词 "${wordData.words}" 移入屏蔽词库吗？`)) {
                                            const key = getWordKey(wordData);
                                            appState.shieldedWords.add(key);
                                            AppStorage.saveShieldedWords(appState.shieldedWords);
                                            appState.allWords = appState.allWords.filter(w => getWordKey(w) !== key);
                                            appState.filteredWords = appState.filteredWords.filter(w => getWordKey(w) !== key);
                                            appState.currentBatchWords = appState.currentBatchWords.filter(w => getWordKey(w) !== key);
                                            this.displayCurrentBatch();
                                            this.updateClearShieldedBtnLabel();
                                            this.updateStats();

                                            appState.hoveredObject = null;
                                            appState.overlayCardTargetOpacity = 0;
                                            appState.overlayCardTargetScale.set(0.001, 0.001, 0.001);
                                            this.saveLastState();
                                            this.showToast(`🛡️ 已屏蔽单词: ${wordData.words}`, 1500);
                                        }
                                    } else if (zone.type === 'card_body') {
                                        // 命中卡片主体腹地：保持展开
                                    }
                                    appState.needsRender = true;
                                    return; // 成功命中按钮或卡片，立即结束
                                }
                            }
                        }
                    }
                    // 点击卡片边缘/角括号，吞没事件不关闭
                    return;
                }
            }

            // 2. 判定球面单词卡片点击
            const intersectsSphere = raycaster.intersectObjects(appState.wordObjects, false);
            if (intersectsSphere.length > 0) {
                const card = intersectsSphere[0].object;
                this.triggerCardDisplay(card);

                const result = AppStorage.recordStudyClick(card.userData.word);
                this.updateStudyCounterDisplay();
                if (result.justReached) {
                    this.triggerDailyGoalAchievedToast();
                }
            } else {
                // 点击宇宙星空空白背景：淡出关闭查词卡
                if (appState.hoverOverlayCard) {
                    appState.hoveredObject = null;
                    appState.overlayCardTargetOpacity = 0;
                    appState.overlayCardTargetScale.set(0.001, 0.001, 0.001);
                }
            }
            appState.needsRender = true;
        },

        showImmersiveDetailPanel(word) {
            if (!word) return;
            appState.currentDetailWord = word;

            const result = AppStorage.recordStudyClick(word);
            this.updateStudyCounterDisplay();
            if (result.justReached) {
                this.triggerDailyGoalAchievedToast();
            }

            document.getElementById('overlayWordName').textContent = word.words || 'N/A';
            document.getElementById('overlayPhoneticDisplay').textContent = word.phonetic || 'N/A';
            document.getElementById('overlayMeaningDisplay').textContent = word.chinese || 'N/A';

            const grid = document.getElementById('overlayDataGrid');
            grid.innerHTML = '';

            const addField = (label, val) => {
                if (!val) return;
                const item = document.createElement('div');
                item.className = 'data-item';
                item.setAttribute('data-label', label);
                item.innerHTML = `<span class="value">${val}</span>`;
                grid.appendChild(item);
            };

            addField('词根形式', word.root_form);
            addField('记忆方法', word.method);
            addField('词性', word.part_of_speech);
            addField('年级大类', word.grade);
            addField('单元', word.unit);
            addField('来源', word.Source);

            document.getElementById('immersiveDetailPanel')?.classList.add('visible');
            appState.rotationMultiplier = 0.0;
            appState.needsRender = true;
        },

        hideImmersiveDetailPanel() {
            document.getElementById('immersiveDetailPanel')?.classList.remove('visible');
            appState.rotationMultiplier = 1.0;
            appState.needsRender = true;
        },

        adjustSphereViewForPanel() {
            const panel = document.getElementById('immersiveDetailPanel');
            const container = document.getElementById('wordSphere');
            if (!panel || !container) return;
            if (!panel.classList.contains('visible') || window.innerWidth < 768) {
                container.style.transform = 'translateX(0px)';
                return;
            }
            const shiftX = panel.classList.contains('left-aligned') ? (panel.offsetWidth / 2) : -(panel.offsetWidth / 2);
            container.style.transform = `translateX(${shiftX}px)`;
            appState.needsRender = true;
        },

        updateClearShieldedBtnLabel() {
            const btn = document.getElementById('clearShieldedBtn');
            if (btn) btn.textContent = `清除屏蔽词库 (${appState.shieldedWords.size})`;
        },

        exitBatchShieldMode() {
            appState.batchShieldMode = false;
            appState.selectedShieldWords.clear();
            document.getElementById('batchShieldHUD')?.classList.add('hidden');
            if (appState.wordObjects) {
                appState.wordObjects.forEach(card => {
                    if (card.userData && card.userData.originalMaterials) {
                        card.material = card.userData.originalMaterials;
                    }
                });
            }
            appState.needsRender = true;
        },

        showToast(text, duration = 2000) {
            let toast = document.getElementById('appDynamicToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'appDynamicToast';
                toast.style.cssText = `
                    position: fixed; top: 36px; left: 50%;
                    transform: translateX(-50%) translateY(-25px);
                    background: linear-gradient(135deg, rgba(16, 32, 70, 0.96), rgba(8, 18, 44, 0.96));
                    border: 1px solid rgba(0, 240, 255, 0.65);
                    color: #eaf6ff; padding: 12px 28px; border-radius: 999px;
                    font-size: 1rem; font-weight: 700;
                    box-shadow: 0 8px 30px rgba(0, 240, 255, 0.4);
                    backdrop-filter: blur(14px);
                    z-index: 10002; opacity: 0; pointer-events: none;
                    transition: opacity 0.25s, transform 0.25s;
                `;
                document.body.appendChild(toast);
            }
            toast.textContent = text;
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';

            if (toast._timer) clearTimeout(toast._timer);
            toast._timer = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(-20px)';
            }, duration);
        },

        triggerDailyGoalAchievedToast() {
            const toast = document.getElementById('dailyGoalToast');
            if (!toast) return;
            toast.textContent = `🎉 恭喜！您已完成今日复习目标 (${AppStorage.getStudyGoal()} 个单词)！`;
            toast.classList.add('show');
            setTimeout(() => { toast.classList.remove('show'); }, 3500);
        },

        changeViewAwareSpeed(multiplier) {
            appState.currentRotationSpeedBase *= multiplier;
            appState.currentRotationSpeedBase = Math.max(0.00001, Math.min(20.0, appState.currentRotationSpeedBase));
            appState.autoRotate = true;
            const toggle = document.getElementById('rotateToggle');
            if (toggle) toggle.textContent = '🔁';

            const rotSlider = document.getElementById('rotationSpeed');
            if (rotSlider && safeParseFloat(rotSlider.value, 1.0) <= 0) {
                rotSlider.value = 1.0;
            }
            const sliderVal = Math.max(0.001, safeParseFloat(rotSlider ? rotSlider.value : 1.0, 1.0));
            appState.actualDisplayRotationSpeed = sliderVal * appState.currentRotationSpeedBase;

            const rotInput = document.getElementById('rotationSpeedInput');
            if (rotInput) rotInput.value = appState.actualDisplayRotationSpeed.toFixed(4);

            this.showToast(multiplier > 1.0 ? `🚀 旋转加速: ${appState.actualDisplayRotationSpeed.toFixed(3)}` : `🐢 旋转减速: ${appState.actualDisplayRotationSpeed.toFixed(3)}`);
            appState.needsRender = true;
            schedulePersist();
        },

        updateHelpModal() {
            const hc = document.querySelector('#helpModalBackdrop .help-content');
            if (hc) {
                hc.innerHTML = `
                    <p><strong>3D 单词宇宙 - 经典 HUD 与微缩展舱版</strong></p>
                    <p>沉浸式三维词汇学习与联想记忆引擎。</p>
                    <h4>查词卡片控制指南</h4>
                    <ul>
                        <li><strong>发音朗读：</strong>点击卡片右上角 <code>[🔊]</code> 或直接点击主单词即可朗读。</li>
                        <li><strong>无级缩放：</strong>轻触 <code>[A-]</code> 缩小卡片，轻触 <code>[A+]</code> 放大卡片。</li>
                        <li><strong>智能屏蔽：</strong>轻触 <code>[屏蔽]</code> 即可将难记或已掌握词汇移入屏蔽库。</li>
                        <li><strong>纯黑无光模式：</strong>将查词卡片亮度拉至 0，卡片将呈现纯黑无光质感。</li>
                    </ul>
                `;
            }
        },

        loadAllPersistentStates() {
            const lastStateJSON = localStorage.getItem(APP_CONFIG.LAST_STATE_STORAGE_KEY);
            if (lastStateJSON) {
                const s = safeJSONParse(lastStateJSON, {});
                if (s.showEnglish !== undefined) {
                    appState.showEnglish = s.showEnglish;
                    const toggleLang = document.getElementById('toggleLanguage');
                    if (toggleLang) toggleLang.textContent = appState.showEnglish ? '中' : '英';
                }
                if (s.cardScaleMultiplier !== undefined) {
                    appState.cardScaleMultiplier = s.cardScaleMultiplier;
                }
                if (s.cameraPosition && appState.camera) {
                    appState.camera.position.fromArray(s.cameraPosition);
                }
                if (s.controlsTarget && appState.controls) {
                    appState.controls.target.fromArray(s.controlsTarget);
                    appState.controls.update();
                }
            }
        },

        saveSettings() {
            if (appState.isInitializing) return;
            const settings = {};
            const settingIds = [
                'rotationSpeed', 'rotationModelSelect', 'cardRotationSpeed',
                'rotateX', 'rotateY', 'rotateZ', 'cardSelfRotation', 'grappleEnabled', 'batchSize',
                'focusCruiseEnabled', 'focusCruiseIntervalRange', 'focusCruiseRatioRange', 'focusCruiseScaleRange',
                'coreSphereRadius', 'coreSphereColor', 'coreSphereEmissive', 'coreSphereEmissiveIntensity', 'coreSphereOpacity',
                'visualEffectsEnabled', 'vortexRotationModelSelect', 'vortexParticleCount', 'vortexColor', 'vortexSize',
                'vortexSpeed', 'vortexTightness', 'bloomThreshold', 'bloomStrength', 'bloomRadius',
                'dynamicBgHueStart', 'dynamicBgHueEnd', 'dynamicBgLightness', 'dynamicBgParticleCount', 'dynamicBgParticleSpeed',
                'starfieldEnabled', 'starCount', 'starColor', 'starSize',
                'cardStylePresetSelect', 'cardChamberDepthRange', 'cardOpacityRange',
                'cardLightPositionSelect', 'cardLightBrightnessRange', 'cardLightSpreadRange', 'cardLightColor',
                'cardTextStyleSelect', 'sphereCardFontColor', 'sphereCardFontFamily',
                'hoverCardStyleModeSelect', 'hoverOverlayCardScale', 'hoverCardBrightness',
                'hoverCardTextMainWordColor', 'hoverCardTextLabelColor', 'hoverCardTextValueColor',
                'hoverAppendedBgColor', 'hoverAppendedBgOpacity', 'hoverCardEmissiveColor', 'hoverCardGlowFrequency'
            ];

            settingIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    settings[id] = (el.type === 'checkbox') ? el.checked : el.value;
                }
            });

            settings.showEnglish = appState.showEnglish;
            settings.cardScaleMultiplier = appState.cardScaleMultiplier;
            localStorage.setItem(APP_CONFIG.SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        },

        loadSettings() {
            const raw = localStorage.getItem(APP_CONFIG.SETTINGS_STORAGE_KEY);
            if (!raw) return;
            const settings = safeJSONParse(raw, null);
            if (!settings) return;

            for (const key in settings) {
                const el = document.getElementById(key);
                if (el) {
                    if (el.type === 'checkbox') {
                        el.checked = !!settings[key];
                    } else {
                        el.value = settings[key];
                    }
                }
            }

            if (settings.cardScaleMultiplier) {
                appState.cardScaleMultiplier = settings.cardScaleMultiplier;
            }

            if (settings.showEnglish !== undefined) {
                appState.showEnglish = !!settings.showEnglish;
                const toggleLang = document.getElementById('toggleLanguage');
                if (toggleLang) toggleLang.textContent = appState.showEnglish ? '中' : '英';
            }

            AppParticles.updateCoreSphereSettings();
            AppParticles.updateVisualEffects();
            AppParticles.updateDynamicBackgroundCSS();
            AppParticles.initStarfield();
            this.updateCardPresetDescription();
        },

        saveLastState() {
            if (appState.isInitializing) return;
            const state = {
                currentBatchIndex: appState.currentBatchIndex,
                cameraPosition: appState.camera ? appState.camera.position.toArray() : [0, 0, 165],
                controlsTarget: appState.controls ? appState.controls.target.toArray() : [0, 0, 0],
                showEnglish: appState.showEnglish,
                cardScaleMultiplier: appState.cardScaleMultiplier
            };
            localStorage.setItem(APP_CONFIG.LAST_STATE_STORAGE_KEY, JSON.stringify(state));
        }
    };

    window.AppUI = AppUI;

    window.addEventListener('DOMContentLoaded', () => {
        AppUI.init().catch(err => console.error('系统引导异常:', err));
    });
})();
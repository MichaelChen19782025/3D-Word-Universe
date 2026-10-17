/**
 * 3D单词宇宙 - 全功能 UI 交互控制器与生命周期调度中心 (V8.6 增强版)
 * 1. 移动端触摸手势全面隔离保护：锁定视口并防止原生缩放触发 HUD / 控件漂移丢失
 * 2. 旋转速度调整 100% 写入持久化存储，下次启动默认生效
 * 3. 查词窗口呼出即时彻底刹停，窗口关闭/淡出后多阶段平缓渐进加速恢复旋转
 * 4. 智能响应式超宽裁剪放大：正常屏幕保持完整美学边距；超宽受限时贴近 2px 视口缓冲放大展现
 * 5. 智能多词共享备注系统：首行 NLP 提取、当前批次优先匹配、全选关联、缺词双卡片兜底命令
 * 6. 全景沉浸式备注阅读系统：50% 半透明悬浮控制岛、全屏阅读、分类/全量导出完整词元、自动轮播跳转
 * 7. ★ 新增 L 键一键提亮/恢复全局卡片亮度 40%
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
        }, 150);
    }

    function scheduleSphereRebuild(delay = 100) {
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
    }

    // 智能响应式视口自适应机制
    function updateHoverCardPosition(pxWidth, pxHeight, scaleFactor) {
        if (!appState.overlayCardTargetPosition) {
            appState.overlayCardTargetPosition = new THREE.Vector3();
        }
        if (!appState.overlayCardTargetScale) {
            appState.overlayCardTargetScale = new THREE.Vector3(1, 1, 1);
        }
        const camDist = appState.camera.position.length();
        const sphereR = appState.sphereRadius || 85;

        const distToFrontCard = Math.max(6, camDist - sphereR);
        const distance = Math.max(10, Math.min(30, distToFrontCard * 0.72));

        const aspect = appState.camera.aspect;
        const fov = appState.camera.fov * (Math.PI / 180);
        const viewHeight3D = 2 * Math.tan(fov / 2) * distance;
        const viewWidth3D = viewHeight3D * aspect;
        const cardAspect = (pxHeight > 0) ? (pxWidth / pxHeight) : 2.0;

        const userScale = Math.max(0.2, Math.min(5.0, scaleFactor || 1.0));

        const screenPxW = window.innerWidth || 390;
        const pad2pxIn3D = (2 / screenPxW) * viewWidth3D;
        const maxContentUsableWidth3D = Math.max(1, viewWidth3D - pad2pxIn3D * 2);
        const maxAllowedHeight3D = viewHeight3D * 0.88;

        const wordData = appState.hoveredObject?.userData?.word;
        const contentSafeRatio = wordData?.contentSafeRatio || appState.hoverOverlayCard?.userData?.contentSafeRatio || 0.916;
        const cornerOuterRatio = 1.12;

        const normalIdealWidth = viewWidth3D * (IS_MOBILE_DEVICE ? 0.88 : 0.65) * userScale;
        let targetWidth3D = normalIdealWidth;

        const isOverflowing = (normalIdealWidth * cornerOuterRatio > maxContentUsableWidth3D) || (IS_MOBILE_DEVICE && normalIdealWidth > maxContentUsableWidth3D * 0.82);

        if (isOverflowing) {
            const cropZoomWidth = maxContentUsableWidth3D / contentSafeRatio;
            targetWidth3D = cropZoomWidth;
        } else {
            targetWidth3D = Math.min(normalIdealWidth, maxContentUsableWidth3D / cornerOuterRatio);
        }

        let targetHeight3D = targetWidth3D / cardAspect;
        if (targetHeight3D > maxAllowedHeight3D) {
            targetHeight3D = maxAllowedHeight3D;
            targetWidth3D = targetHeight3D * cardAspect;
        }

        appState.overlayCardTargetScale.set(targetWidth3D, targetHeight3D, 1);

        const camDir = new THREE.Vector3();
        appState.camera.getWorldDirection(camDir);
        const centerPoint = appState.camera.position.clone().add(camDir.multiplyScalar(distance));
        appState.overlayCardTargetPosition.copy(centerPoint);
        appState.needsRender = true;
    }
    window.updateHoverCardPosition = updateHoverCardPosition;

    const AppUI = {
        async init() {
            await AppStorage.init();
            if (window.AppScene && typeof window.AppScene.init === 'function') {
                AppScene.init();
            }
            AppAudio.init();
            AppParticles.initCoreSphere();
            AppParticles.initStarfield();
            AppParticles.initNebulaColors();
            AppSphereEngine.initGrapple();

            this.initPreventBrowserZoom();
            this.initPremiumHoverCard();
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

            // 智能共享备注与阅读系统初始化
            this.initSmartNoteModalHandlers();
            this.initImmersiveNoteReader();

            this.loadSettings();
            await this.loadWordDataAndBoot();
            this.loadAllPersistentStates();

            // ★ 核心：监听键盘 L 键快捷键
            window.addEventListener('keydown', (e) => {
                // 如果用户正在输入框里打字，则忽略快捷键
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
                    return;
                }
                if (e.key === 'l' || e.key === 'L') {
                    e.preventDefault();
                    appState.isLightBoosted = !appState.isLightBoosted;
                    appState.needsRender = true;
                    
                    if (window.AppUI && typeof AppUI.showToast === 'function') {
                        AppUI.showToast(appState.isLightBoosted ? '💡 卡片群亮度已提亮 40%' : '💡 卡片群亮度已恢复');
                    }
                    if (navigator.vibrate) navigator.vibrate(20);
                }
            });

            setTimeout(() => {
                appState.isInitializing = false;
                this.refreshRuntimeCache();
                this.updateFocusCruiseVisuals();
                this.updateCardPresetDescription();
                appState.needsRender = true;
            }, 300);
        },

        initPreventBrowserZoom() {
            const prevent = (e) => {
                if (e.touches && e.touches.length > 1) {
                    e.preventDefault();
                }
            };
            document.addEventListener('touchstart', prevent, { passive: false });
            document.addEventListener('touchmove', prevent, { passive: false });
            window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
            window.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
            window.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
        },

        pauseMotionOnHover() {
            if (!appState.hoverMotion) return;
            appState.hoverMotion.isPaused = true;
            appState.hoverMotion.isResuming = false;
            appState.hoverMotion.currentMultiplier = 0.0;
            appState.needsRender = true;
        },

        resumeMotionAfterHover() {
            if (!appState.hoverMotion) return;
            if (!appState.hoverMotion.isPaused && !appState.hoverMotion.isResuming) return;
            appState.hoverMotion.isPaused = false;
            if (appState.hoverMotion.pauseEnabled) {
                appState.hoverMotion.isResuming = true;
                appState.hoverMotion.resumeStartTime = performance.now();
                appState.hoverMotion.currentMultiplier = 0.0;
            } else {
                appState.hoverMotion.isResuming = false;
                appState.hoverMotion.currentMultiplier = 1.0;
            }
            appState.needsRender = true;
        },

        copyToClipboard(text) {
            if (!text) return Promise.resolve(false);
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(text).then(() => true).catch(() => {
                    return this._fallbackCopyText(text);
                });
            }
            return Promise.resolve(this._fallbackCopyText(text));
        },

        _fallbackCopyText(text) {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.top = "-9999px";
                textArea.style.left = "-9999px";
                textArea.style.opacity = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);
                return success;
            } catch (e) {
                return false;
            }
        },

        async loadWordDataAndBoot() {
            const words = await AppStorage.loadLibrary();
            appState.shieldedWords = AppStorage.loadShieldedWords();

            appState.allWords = words.filter(w => w && typeof w === 'object' && !appState.shieldedWords.has(getWordKey(w)));
            appState.filteredWords = [...appState.allWords];
            appState.currentBatchIndex = 0;

            const totalWordsDisplay = document.getElementById('totalWords');
            if (totalWordsDisplay) totalWordsDisplay.textContent = appState.allWords.length;
            const entireCountEl = document.getElementById('entireLibTotalCount');
            if (entireCountEl) entireCountEl.textContent = appState.allWords.length;

            this.displayCurrentBatch();
            this.updateStats();
            this.updateClearShieldedBtnLabel();
            this.updateStudyCounterDisplay();
        },

        displayCurrentBatch() {
            this.hideImmersiveDetailPanel();
            appState.activeCardObject = null;
            const list = appState.filteredWords;

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
            const list = appState.filteredWords;
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
            const list = appState.filteredWords;
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

        initPremiumHoverCard() {
            const group = new THREE.Group();

            const backplate = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({
                    color: 0x0a1428,
                    transparent: true,
                    opacity: 0,
                    side: THREE.DoubleSide,
                    depthTest: false,
                    depthWrite: false
                })
            );
            backplate.name = "backplate";
            backplate.renderOrder = 999990;
            group.add(backplate);

            const glowCanvas = document.createElement('canvas');
            glowCanvas.width = 256;
            glowCanvas.height = 256;
            const glowCtx = glowCanvas.getContext('2d');
            const gradient = glowCtx.createRadialGradient(128, 128, 40, 128, 128, 128);
            gradient.addColorStop(0, "rgba(0, 200, 255, 0.32)");
            gradient.addColorStop(0.45, "rgba(20, 110, 220, 0.16)");
            gradient.addColorStop(0.85, "rgba(10, 40, 120, 0.04)");
            gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
            glowCtx.fillStyle = gradient;
            glowCtx.fillRect(0, 0, 256, 256);

            const glowTexture = new THREE.CanvasTexture(glowCanvas);
            const coreGlow = new THREE.Mesh(
                new THREE.PlaneGeometry(1.15, 1.15),
                new THREE.MeshBasicMaterial({
                    map: glowTexture,
                    blending: THREE.AdditiveBlending,
                    transparent: true,
                    opacity: 0,
                    depthTest: false,
                    depthWrite: false
                })
            );
            coreGlow.name = "coreGlow";
            coreGlow.position.z = 0.008;
            coreGlow.renderOrder = 999992;
            group.add(coreGlow);

            const screen = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({
                    transparent: true,
                    opacity: 0,
                    depthTest: false,
                    depthWrite: false,
                    side: THREE.DoubleSide
                })
            );
            screen.position.z = 0.02;
            screen.name = "textScreen";
            screen.renderOrder = 999995;
            group.add(screen);

            const cornerBracketsGroup = AppCardFactory.createCornerBrackets();
            cornerBracketsGroup.name = 'frameGroup';
            cornerBracketsGroup.position.z = 0.03;
            cornerBracketsGroup.renderOrder = 999998;
            cornerBracketsGroup.children.forEach(c => {
                c.renderOrder = 999998;
                if (c.material) {
                    c.material.depthTest = false;
                    c.material.depthWrite = false;
                }
            });
            group.add(cornerBracketsGroup);

            group.renderOrder = 999999;
            group.visible = false;
            group.userData.refs = { screen, backplate, coreGlow, frameGroup: cornerBracketsGroup };

            appState.hoverOverlayCard = group;
            appState.overlayCardTargetScale = new THREE.Vector3(1, 1, 1);
            appState.overlayCardTargetPosition = new THREE.Vector3(0, 0, 100);
            appState.scene.add(group);
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

            // 双击时钟快捷呼出智能备注系统
            clockEl?.addEventListener('dblclick', () => this.openSmartNoteModal(null));
        },

        enhanceSlidersWithSteppers() {
            const sliders = document.querySelectorAll('#controlsOverlay input[type="range"]');
            sliders.forEach(slider => {
                if (slider.closest('.slider-stepper-wrap')) return;

                const wrap = document.createElement('div');
                wrap.className = 'slider-stepper-wrap';

                const downBtn = document.createElement('button');
                downBtn.type = 'button';
                downBtn.className = 'stepper-btn down-btn';
                downBtn.textContent = '▼';

                const upBtn = document.createElement('button');
                upBtn.type = 'button';
                upBtn.className = 'stepper-btn up-btn';
                upBtn.textContent = '▲';

                const numInput = document.createElement('input');
                numInput.type = 'number';
                numInput.className = 'stepper-num-input';
                numInput.step = slider.step || '1';
                numInput.min = slider.min !== '' ? slider.min : '0';
                numInput.max = slider.max !== '' ? slider.max : '100';
                numInput.value = slider.value;

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
                    let next = Math.max(min, Math.min(max, cur + delta * step));

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
                slider.addEventListener('input', () => { numInput.value = slider.value; });
            });
        },

        init3DCardChamberListeners() {
            document.getElementById('cardStylePresetSelect')?.addEventListener('change', (e) => {
                const presetId = e.target.value;
                if (window.CardStyleManager) {
                    const p = window.CardStyleManager.getPreset(presetId);
                    if (p) {
                        const lightBrightRange = document.getElementById('cardLightBrightnessRange');
                        const lightColorInput = document.getElementById('cardLightColor');
                        const lightPosSelect = document.getElementById('cardLightPositionSelect');
                        const lightSpreadRange = document.getElementById('cardLightSpreadRange');
                        const textStyleSelect = document.getElementById('cardTextStyleSelect');
                        const fontColorInput = document.getElementById('sphereCardFontColor');
                        const baseColorInput = document.getElementById('cardBaseColor');
                        const depthRange = document.getElementById('cardChamberDepthRange');

                        if (lightBrightRange) lightBrightRange.value = p.defaultLightBrightness ?? 0.85;
                        if (lightColorInput) lightColorInput.value = p.defaultLightColor ?? '#00f0ff';
                        if (lightPosSelect) lightPosSelect.value = p.defaultLightPosition ?? 'center';
                        if (lightSpreadRange) lightSpreadRange.value = p.defaultLightSpread ?? 0.85;
                        if (textStyleSelect && p.textStyle) textStyleSelect.value = p.textStyle;
                        if (fontColorInput && p.textColor) fontColorInput.value = p.textColor;
                        if (baseColorInput && p.baseColor) baseColorInput.value = p.baseColor;
                        if (depthRange && p.defaultChamberDepth !== undefined) depthRange.value = p.defaultChamberDepth;

                        this.updateCardPresetDescription();
                        this.showToast('🎴 已应用风格: ' + p.name);
                    }
                }
                scheduleSphereRebuild(10);
                schedulePersist();
            });

            const opacityRange = document.getElementById('cardOpacityRange');
            if (opacityRange) {
                opacityRange.addEventListener('input', (e) => {
                    const op = parseFloat(e.target.value);
                    AppCardFactory.updateCardsMaterialsFast({ opacity: op });
                    schedulePersist();
                });
            }

            const sphereBrightRange = document.getElementById('sphereCardBrightnessRange');
            if (sphereBrightRange) {
                sphereBrightRange.addEventListener('input', (e) => {
                    const br = parseFloat(e.target.value);
                    AppCardFactory.updateCardsMaterialsFast({ brightness: br });
                    schedulePersist();
                });
            }

            const cardExposureRange = document.getElementById('cardExposureRange');
            if (cardExposureRange) {
                cardExposureRange.addEventListener('input', (e) => {
                    const exp = parseFloat(e.target.value);
                    AppCardFactory.updateCardsMaterialsFast({ exposure: exp });
                    schedulePersist();
                });
            }

            const cardSettingInputs = [
                'sphereCardFontSize',
                'cardBrightnessRange',
                'sphereCardFontColor',
                'cardTextStyleSelect',
                'sphereCardFontFamily',
                'cardBaseColor',
                'cardChamberDepthRange',
                'cardLightPositionSelect',
                'cardLightBrightnessRange',
                'cardLightSpreadRange',
                'cardLightColor'
            ];

            cardSettingInputs.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('input', () => {
                    scheduleSphereRebuild(60);
                    schedulePersist();
                });
                el.addEventListener('change', () => {
                    scheduleSphereRebuild(10);
                    schedulePersist();
                });
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
            document.getElementById('voiceSelect')?.addEventListener('change', (e) => {
                appState.ttsSettings.voice = e.target.value;
                schedulePersist();
            });
            document.getElementById('rateInput')?.addEventListener('input', (e) => {
                appState.ttsSettings.rate = safeParseFloat(e.target.value, 1.0);
                schedulePersist();
            });
            document.getElementById('timesInput')?.addEventListener('input', (e) => {
                appState.ttsSettings.times = safeParseInt(e.target.value, 1);
                schedulePersist();
            });
            document.getElementById('volumeInput')?.addEventListener('input', (e) => {
                appState.ttsSettings.volume = safeParseFloat(e.target.value, 1.0);
                schedulePersist();
            });

            document.getElementById('cardPauseOnHoverEnabled')?.addEventListener('change', (e) => {
                appState.hoverMotion.pauseEnabled = !!e.target.checked;
                schedulePersist();
                this.showToast(appState.hoverMotion.pauseEnabled ? '⏸️ 查词暂停已开启' : '▶️ 查词暂停已关闭');
            });
            document.getElementById('hoverResumeDurationRange')?.addEventListener('input', (e) => {
                appState.hoverMotion.resumeDuration = safeParseFloat(e.target.value, 2.0);
                schedulePersist();
            });
            document.getElementById('hoverResumeP1Range')?.addEventListener('input', (e) => {
                appState.hoverMotion.p1Percent = safeParseFloat(e.target.value, 20);
                schedulePersist();
            });
            document.getElementById('hoverResumeP2Range')?.addEventListener('input', (e) => {
                appState.hoverMotion.p2Percent = safeParseFloat(e.target.value, 70);
                schedulePersist();
            });

            const vortexBrightEl = document.getElementById('vortexBrightnessRange');
            if (vortexBrightEl) {
                vortexBrightEl.addEventListener('input', () => {
                    AppParticles.updateVisualEffects();
                    schedulePersist();
                });
            }
            const vortexCoreEl = document.getElementById('vortexCoreRadiusRange');
            if (vortexCoreEl) {
                vortexCoreEl.addEventListener('input', () => {
                    AppParticles.initVortex();
                    schedulePersist();
                });
            }

            const hoverDurEl = document.getElementById('hoverCardDurationRange');
            if (hoverDurEl) {
                hoverDurEl.addEventListener('input', () => {
                    schedulePersist();
                });
            }

            const hoverColorInputs = [
                'hoverCardMainWordColor',
                'hoverCardPhoneticColor',
                'hoverCardMeaningColor',
                'hoverCardMethodTitleColor',
                'hoverCardMethodContentColor'
            ];
            hoverColorInputs.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('input', () => {
                    if (appState.hoveredObject && appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                        AppUI.triggerCardDisplay(appState.hoveredObject);
                    }
                    schedulePersist();
                });
                el.addEventListener('change', () => schedulePersist());
            });

            document.getElementById('hoverCardBgOpacity')?.addEventListener('input', (e) => {
                const op = parseFloat(e.target.value || '0.78');
                appState.rt.hoverBgOpacity = op;
                if (appState.hoverOverlayCard) {
                    const backplate = appState.hoverOverlayCard.getObjectByName("backplate");
                    if (backplate) {
                        backplate.material.opacity = appState.overlayCardTargetOpacity * op;
                    }
                }
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('hoverOverlayCardScale')?.addEventListener('input', (e) => {
                const scaleVal = parseFloat(e.target.value || '1.0');
                if (appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                    const screen = appState.hoverOverlayCard.getObjectByName("textScreen");
                    const tex = screen?.material?.map;
                    if (tex && tex.image) {
                        updateHoverCardPosition(tex.image.width, tex.image.height, scaleVal);
                        appState.hoverOverlayCard.scale.copy(appState.overlayCardTargetScale);
                    }
                }
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('hoverCardBrightness')?.addEventListener('input', () => {
                if (appState.hoveredObject && appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                    AppUI.triggerCardDisplay(appState.hoveredObject);
                }
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('hoverCardStyleModeSelect')?.addEventListener('change', () => {
                if (appState.hoveredObject && appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                    AppUI.triggerCardDisplay(appState.hoveredObject);
                }
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('rotationSpeed')?.addEventListener('input', (e) => {
                const sliderVal = safeParseFloat(e.target.value, 1.0);
                appState.actualDisplayRotationSpeed = sliderVal * appState.currentRotationSpeedBase;
                appState.needsRender = true;
                schedulePersist();
            });

            ['rotateX', 'rotateY', 'rotateZ', 'cardSelfRotation'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', () => {
                    this.refreshRuntimeCache();
                    appState.needsRender = true;
                    schedulePersist();
                });
            });

            ['coreSphereRadius', 'coreSphereColor', 'coreSphereEmissive', 'coreSphereEmissiveIntensity', 'coreSphereOpacity'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const updateFn = () => { AppParticles.updateCoreSphereSettings(); schedulePersist(); };
                el.addEventListener('input', updateFn);
                el.addEventListener('change', updateFn);
            });

            document.getElementById('visualEffectsEnabled')?.addEventListener('change', (e) => {
                appState.rt.visualFxEnabled = e.target.checked;
                AppParticles.updateVisualEffects();
                schedulePersist();
            });

            document.getElementById('vortexSpeed')?.addEventListener('input', (e) => {
                const spd = safeParseFloat(e.target.value, 0.003);
                appState.rt.vortexSpeed = Math.max(0.001, Math.min(0.01, spd));
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('vortexSize')?.addEventListener('input', () => {
                AppParticles.updateVisualEffects();
                schedulePersist();
            });

            document.getElementById('vortexColor')?.addEventListener('input', () => {
                AppParticles.updateVisualEffects();
                schedulePersist();
            });

            ['vortexTightness', 'vortexParticleCount'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('change', () => {
                    AppParticles.initVortex();
                    schedulePersist();
                });
            });

            ['bloomThreshold', 'bloomStrength', 'bloomRadius'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('input', () => {
                    AppParticles.updateBloomSettings();
                    appState.needsRender = true;
                    schedulePersist();
                });
            });

            const starInputs = ['starfieldEnabled', 'starCount', 'starColor', 'starSize'];
            starInputs.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const triggerStarUpdate = () => {
                    AppParticles.initStarfield();
                    schedulePersist();
                };
                el.addEventListener('input', triggerStarUpdate);
                el.addEventListener('change', triggerStarUpdate);
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
            document.getElementById('exportNotesUnifiedBtn')?.addEventListener('click', () => this.exportAllNotesPrompt());
            document.getElementById('exportSettingsBtn')?.addEventListener('click', () => this.exportSettings());
            document.getElementById('importSettingsBtn')?.addEventListener('click', () => this.importSettings());

            document.getElementById('openSmartNoteBtnFromSettings')?.addEventListener('click', () => {
                document.getElementById('controlsOverlay')?.classList.remove('visible');
                this.openSmartNoteModal(null);
            });

            document.getElementById('rotateToggle')?.addEventListener('click', () => {
                appState.autoRotate = !appState.autoRotate;
                document.getElementById('rotateToggle').textContent = appState.autoRotate ? '🔁' : '⏹️';
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('toggleLanguage')?.addEventListener('click', () => {
                appState.showEnglish = !appState.showEnglish;
                document.getElementById('toggleLanguage').textContent = appState.showEnglish ? '中' : '英';
                this.displayCurrentBatch();
                this.saveSettings();
                this.saveLastState();
            });

            document.getElementById('randomShuffleBtn')?.addEventListener('click', () => {
                const list = appState.filteredWords;
                if (!list || !list.length) return;
                appState.currentBatchWords = [...list].sort(() => Math.random() - 0.5).slice(0, appState.batchSize);
                AppSphereEngine.createWordSphere(appState.currentBatchWords);
                this.showToast('🎲 已随机更换球面卡片');
            });

            document.getElementById('zoomInBtn')?.addEventListener('click', () => AppScene.zoomSphere(0.85));
            document.getElementById('zoomOutBtn')?.addEventListener('click', () => AppScene.zoomSphere(1.15));
            document.getElementById('speedUpBtn')?.addEventListener('click', () => this.changeViewAwareSpeed(1.25));
            document.getElementById('speedDownBtn')?.addEventListener('click', () => this.changeViewAwareSpeed(0.80));

            document.getElementById('panUpBtn')?.addEventListener('click', () => AppScene.panSphere(0, -15));
            document.getElementById('panDownBtn')?.addEventListener('click', () => AppScene.panSphere(0, 15));
            document.getElementById('panLeftBtn')?.addEventListener('click', () => AppScene.panSphere(-15, 0));
            document.getElementById('panRightBtn')?.addEventListener('click', () => AppScene.panSphere(15, 0));
            document.getElementById('panCenterResetBtn')?.addEventListener('click', () => AppScene.resetSpherePan());

            document.getElementById('viewsBtn')?.addEventListener('click', () => this.toggleManagementPanel('views'));
            this.bindSystemViewButton(document.getElementById('viewInsideBtn'), 'inside');
            this.bindSystemViewButton(document.getElementById('viewSurfaceBtn'), 'surface');
            this.bindSystemViewButton(document.getElementById('viewOverallBtn'), 'overall');

            document.getElementById('closeDetailBtn')?.addEventListener('click', () => this.hideImmersiveDetailPanel());
            document.getElementById('togglePanelSideBtn')?.addEventListener('click', () => {
                document.getElementById('immersiveDetailPanel')?.classList.toggle('left-aligned');
                this.adjustSphereViewForPanel();
            });
            document.getElementById('speakDetailWordBtn')?.addEventListener('click', () => {
                if (appState.currentDetailWord?.words) AppAudio.speakWord(appState.currentDetailWord.words);
            });
            document.getElementById('detailAddNoteBtn')?.addEventListener('click', () => {
                if (appState.currentDetailWord) this.openSmartNoteModal(appState.currentDetailWord, null);
            });

            // 右侧面板专属备注入口
            document.getElementById('openNoteSystemBtn')?.addEventListener('click', () => {
                this.openSmartNoteModal(null);
            });

            // 右下角总开关按钮双模手势：单击折叠/展开，长按 700ms 秒入备注
            const masterBtn = document.getElementById('masterMenuToggleBtn');
            const viewControls = document.getElementById('viewControlsContainer');
            if (masterBtn && viewControls) {
                let masterPressTimer = null;
                let masterDidLongPress = false;

                const startMasterPress = () => {
                    masterDidLongPress = false;
                    masterPressTimer = setTimeout(() => {
                        masterDidLongPress = true;
                        if (navigator.vibrate) navigator.vibrate([40, 30, 60]);
                        this.showToast('📝 长按激活：智能备注系统已呼出！', 1600);
                        this.openSmartNoteModal(null);
                    }, 700);
                };

                const cancelMasterPress = () => {
                    if (masterPressTimer) {
                        clearTimeout(masterPressTimer);
                        masterPressTimer = null;
                    }
                };

                masterBtn.addEventListener('pointerdown', startMasterPress);
                masterBtn.addEventListener('pointerup', cancelMasterPress);
                masterBtn.addEventListener('pointercancel', cancelMasterPress);

                masterBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (masterDidLongPress) {
                        masterDidLongPress = false;
                        return;
                    }
                    viewControls.classList.toggle('expanded');
                    masterBtn.textContent = viewControls.classList.contains('expanded') ? '❌' : '🔮';
                });
            }

            document.getElementById('helpBtn')?.addEventListener('click', () => {
                alert('3D单词宇宙使用指南：\n1. 点击卡片可呼出查词并立即静止；\n2. 长按右下角 🔮 按钮(700ms)或单击右侧 📝 按钮可进入智能多词备注系统；\n3. 在备注系统中输入首行单词，自动识别并关联球面卡片，多词共享同一份AI辨析；\n4. 沉浸式阅读器自带50%防打扰半透明控制岛，支持自动轮播与全量带词元导出！\n5. 按 L 键可一键提亮 40% 或恢复卡片群亮度！');
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

            const { title, value, min = 0, max = 5000, step = 1, onConfirm } = options;
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

        // ==================== 智能多词关联备注录入控制器 ====================
        initSmartNoteModalHandlers() {
            const modal = document.getElementById('wordNoteModalBackdrop');
            const titleInput = document.getElementById('noteInputTitle');
            const categoryInput = document.getElementById('noteInputCategory');
            const contentInput = document.getElementById('noteInputContent');
            const submitBtn = document.getElementById('saveNoteSubmitBtn');
            const cancelBtn = document.getElementById('closeNoteModalBtn');
            const closeXBtn = document.getElementById('closeNoteModalTopBtn');
            const selectAllBtn = document.getElementById('smartSelectAllBtn');
            const selectNoneBtn = document.getElementById('smartSelectNoneBtn');
            const openReaderBtn = document.getElementById('openReaderFromModalBtn');
            const searchAllLibCard = document.getElementById('searchInEntireLibraryCard');
            const searchExtFileCard = document.getElementById('searchInExternalFileCard');

            let titleDebounceTimer = null;
            let isComposing = false;
            let lastAutoCopiedTitle = "";

            const analyzeFirstLineAndMatch = (forceAllLib = false, customWordsPool = null) => {
                if (!titleInput) return;
                const fullText = titleInput.value;
                const firstLine = fullText.split('\n')[0].trim();
                const tokensBar = document.getElementById('smartExtractedTokensBar');
                const matchedListEl = document.getElementById('smartMatchedCardsList');
                const countLabel = document.getElementById('smartMatchedCountLabel');
                const fallbackGroup = document.getElementById('smartFallbackActionGroup');
                const statusLabel = document.getElementById('smartWordAnalyzeStatus');

                if (!firstLine) {
                    if (tokensBar) tokensBar.innerHTML = '';
                    if (matchedListEl) matchedListEl.innerHTML = '<div style="color:#7d94b2; font-size:0.8rem; padding:8px;">请输入或粘贴标题，系统将自动识别并匹配卡片...</div>';
                    if (countLabel) countLabel.textContent = '0';
                    if (fallbackGroup) fallbackGroup.classList.add('hidden');
                    return;
                }

                const rawTokens = firstLine.match(/[a-zA-Z]+(?:'[a-zA-Z]+)?/g) || [];
                const stopWords = new Set(['vs', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'the', 'a', 'an', 'between', 'difference', 'compare']);
                const validTokens = Array.from(new Set(rawTokens.map(t => t.toLowerCase()).filter(t => t.length >= 2 && !stopWords.has(t))));

                if (tokensBar) {
                    tokensBar.innerHTML = validTokens.map(tok => `<span class="smart-token-pill">${tok}</span>`).join('');
                }

                let candidatePool = appState.currentBatchWords || [];
                if (customWordsPool && Array.isArray(customWordsPool)) {
                    candidatePool = customWordsPool;
                } else if (forceAllLib) {
                    candidatePool = appState.allWords || [];
                }

                const matchedWords = [];
                const matchedKeys = new Set();

                validTokens.forEach(token => {
                    candidatePool.forEach(w => {
                        const wordText = (w.words || '').trim().toLowerCase();
                        const rootText = (w.root_form || '').trim().toLowerCase();
                        if (wordText === token || rootText === token) {
                            const k = getWordKey(w);
                            if (!matchedKeys.has(k)) {
                                matchedKeys.add(k);
                                matchedWords.push(w);
                            }
                        }
                    });
                });

                if (appState.activeNoteWord) {
                    const activeKey = getWordKey(appState.activeNoteWord);
                    if (!matchedKeys.has(activeKey)) {
                        matchedWords.unshift(appState.activeNoteWord);
                        matchedKeys.add(activeKey);
                    }
                }

                modal._currentMatchedWordsPool = matchedWords;

                if (countLabel) countLabel.textContent = String(matchedWords.length);

                if (matchedWords.length > 0) {
                    if (statusLabel) statusLabel.textContent = `成功匹配到 ${matchedWords.length} 个单词卡片`;
                    matchedListEl.innerHTML = matchedWords.map(w => {
                        const k = getWordKey(w);
                        return `
                            <div class="smart-word-card checked" data-key="${k}">
                                <input type="checkbox" checked id="chk_${k}" data-key="${k}">
                                <div class="smart-word-info">
                                    <span class="smart-word-title">${w.words || 'N/A'}</span>
                                    <span class="smart-word-sub">${w.phonetic || ''} ${w.chinese || ''}</span>
                                </div>
                            </div>
                        `;
                    }).join('');

                    matchedListEl.querySelectorAll('.smart-word-card').forEach(cardEl => {
                        cardEl.addEventListener('click', (e) => {
                            const chk = cardEl.querySelector('input[type="checkbox"]');
                            if (e.target !== chk) chk.checked = !chk.checked;
                            cardEl.classList.toggle('checked', chk.checked);
                        });
                    });

                    if (fallbackGroup) fallbackGroup.classList.add('hidden');
                } else {
                    if (statusLabel) statusLabel.textContent = '当前球面未找到记录';
                    matchedListEl.innerHTML = '<div style="color:#fca5a5; font-size:0.82rem; padding:10px; text-align:center;">⚠️ 当前球面显示的卡片中未匹配到相关单词。请选择下方两条命令之一：</div>';
                    if (fallbackGroup) fallbackGroup.classList.remove('hidden');
                }
            };

            const doAutoCopyTitle = () => {
                if (!titleInput) return;
                const text = titleInput.value.trim();
                if (!text || text === lastAutoCopiedTitle) return;

                AppUI.copyToClipboard(text).then((ok) => {
                    if (ok) {
                        lastAutoCopiedTitle = text;
                        AppUI.showToast(`📋 备注标题已自动复制到剪贴板，可直接向 AI 提问！`, 2500);
                    }
                });
            };

            const scheduleAutoAnalyzeAndCopy = () => {
                if (titleDebounceTimer) {
                    clearTimeout(titleDebounceTimer);
                    titleDebounceTimer = null;
                }
                if (isComposing) return;
                titleDebounceTimer = setTimeout(() => {
                    analyzeFirstLineAndMatch();
                    doAutoCopyTitle();
                }, 800);
            };

            titleInput?.addEventListener('compositionstart', () => { isComposing = true; });
            titleInput?.addEventListener('compositionend', () => {
                isComposing = false;
                scheduleAutoAnalyzeAndCopy();
            });

            titleInput?.addEventListener('input', () => {
                analyzeFirstLineAndMatch();
                scheduleAutoAnalyzeAndCopy();
            });

            titleInput?.addEventListener('blur', () => {
                if (titleDebounceTimer) clearTimeout(titleDebounceTimer);
                doAutoCopyTitle();
            });

            searchAllLibCard?.addEventListener('click', () => {
                analyzeFirstLineAndMatch(true);
                AppUI.showToast('🔍 已在当前完整大词库中完成全量深搜！', 1500);
            });

            searchExtFileCard?.addEventListener('click', () => {
                selectLocalFile('application/json,.json', (file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const extWords = JSON.parse(e.target.result);
                            if (!Array.isArray(extWords)) throw new Error('词库必须是数组结构');
                            analyzeFirstLineAndMatch(false, extWords);
                            AppUI.showToast(`📂 已从外部词库 (${extWords.length} 词) 完成匹配检索！`, 2000);
                        } catch (err) {
                            alert('外部词库解析失败: ' + err.message);
                        }
                    };
                    reader.readAsText(file);
                });
            });

            selectAllBtn?.addEventListener('click', () => {
                const matchedListEl = document.getElementById('smartMatchedCardsList');
                matchedListEl?.querySelectorAll('.smart-word-card').forEach(card => {
                    const chk = card.querySelector('input[type="checkbox"]');
                    if (chk) chk.checked = true;
                    card.classList.add('checked');
                });
            });

            selectNoneBtn?.addEventListener('click', () => {
                const matchedListEl = document.getElementById('smartMatchedCardsList');
                matchedListEl?.querySelectorAll('.smart-word-card').forEach(card => {
                    const chk = card.querySelector('input[type="checkbox"]');
                    if (chk) chk.checked = false;
                    card.classList.remove('checked');
                });
            });

            openReaderBtn?.addEventListener('click', () => {
                modal.classList.remove('visible');
                this.openNoteReader();
            });

            const closeModal = () => {
                modal.classList.remove('visible');
                appState.activeNoteWord = null;
                appState.editingNoteId = null;
                lastAutoCopiedTitle = "";
                if (titleDebounceTimer) clearTimeout(titleDebounceTimer);
            };

            cancelBtn?.addEventListener('click', closeModal);
            closeXBtn?.addEventListener('click', closeModal);

            submitBtn?.addEventListener('click', () => {
                const title = titleInput.value.trim();
                const content = contentInput.value.trim();
                const category = (categoryInput.value.trim()) || '近义辨析';

                if (!title) {
                    alert('请输入备注标题！');
                    return;
                }

                const matchedListEl = document.getElementById('smartMatchedCardsList');
                const checkedCheckboxes = matchedListEl ? matchedListEl.querySelectorAll('input[type="checkbox"]:checked') : [];
                const checkedKeys = new Set(Array.from(checkedCheckboxes).map(c => c.getAttribute('data-key')));

                const pool = modal._currentMatchedWordsPool || [];
                const selectedWords = pool.filter(w => checkedKeys.has(getWordKey(w)));

                if (selectedWords.length === 0 && appState.activeNoteWord) {
                    selectedWords.push(appState.activeNoteWord);
                }

                const noteEntity = {
                    id: appState.editingNoteId || ('snote_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
                    title: title,
                    content: content,
                    category: category,
                    date: getTodayYMD(),
                    linkedWordKeys: selectedWords.map(w => getWordKey(w))
                };

                AppStorage.saveUnifiedSharedNote(noteEntity, selectedWords);
                this.showToast(`🎉 成功保存！已将辨析材料同步共享至 ${selectedWords.length} 个单词！`, 2500);

                closeModal();

                if (appState.currentDetailWord) {
                    this.renderDetailNotesList(appState.currentDetailWord);
                }
                if (appState.hoveredObject && appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                    this.triggerCardDisplay(appState.hoveredObject);
                }
            });
        },

        openSmartNoteModal(targetWord = null, existingNote = null) {
            appState.activeNoteWord = targetWord;
            appState.editingNoteId = existingNote ? existingNote.id : null;

            const modal = document.getElementById('wordNoteModalBackdrop');
            const header = document.getElementById('noteModalHeaderTitle');
            const titleInput = document.getElementById('noteInputTitle');
            const categoryInput = document.getElementById('noteInputCategory');
            const contentInput = document.getElementById('noteInputContent');

            header.textContent = existingNote 
                ? `✏️ 编辑 AI 知识辨析 - ${existingNote.title}` 
                : (targetWord ? `📝 为 [${targetWord.words}] 录入共享备注` : `📝 智能多词关联 AI 备注系统`);

            titleInput.value = existingNote ? existingNote.title : (targetWord ? `辨析 ${targetWord.words} 与 ` : '');
            categoryInput.value = existingNote ? (existingNote.category || '近义辨析') : '近义辨析';
            contentInput.value = existingNote ? existingNote.content : '';

            modal.classList.add('visible');

            setTimeout(() => {
                titleInput.focus();
                const titleChangeEvent = new Event('input', { bubbles: true });
                titleInput.dispatchEvent(titleChangeEvent);
            }, 100);
        },

        // ==================== 沉浸式高级备注阅读系统控制器 ====================
        initImmersiveNoteReader() {
            const backdrop = document.getElementById('immersiveNoteReaderBackdrop');
            const closeBtn = document.getElementById('closeNoteReaderBtn');
            const prevBtn = document.getElementById('readerPrevNoteBtn');
            const nextBtn = document.getElementById('readerNextNoteBtn');
            const cruiseBtn = document.getElementById('readerAutoCruiseToggleBtn');
            const cruiseIntervalSelect = document.getElementById('readerCruiseIntervalSelect');
            const cruiseStatusText = document.getElementById('readerCruiseStatusText');
            const progressFill = document.getElementById('readerCruiseProgressFill');
            const categorySelect = document.getElementById('readerCategorySelect');
            const searchInput = document.getElementById('readerSearchInput');
            const exportCategoryBtn = document.getElementById('readerExportCurrentCategoryBtn');
            const exportAllBtn = document.getElementById('readerExportAllNotesBtn');
            const fullscreenBtn = document.getElementById('readerToggleFullscreenBtn');
            const addNewBtn = document.getElementById('readerAddNewNoteBtn');
            const editBtn = document.getElementById('readerEditCurrentNoteBtn');
            const delBtn = document.getElementById('readerDeleteCurrentNoteBtn');
            const speakBtn = document.getElementById('readerSpeakNoteBtn');

            const sn = appState.smartNotes;

            const stopCruise = () => {
                sn.isAutoCruising = false;
                if (sn.cruiseTimer) clearInterval(sn.cruiseTimer);
                if (sn.progressTimer) clearInterval(sn.progressTimer);
                sn.cruiseTimer = null;
                sn.progressTimer = null;
                if (cruiseStatusText) cruiseStatusText.textContent = '关';
                if (progressFill) progressFill.style.width = '0%';
            };

            const startCruise = () => {
                stopCruise();
                sn.isAutoCruising = true;
                if (cruiseStatusText) cruiseStatusText.textContent = '开';
                const intervalSec = parseInt(cruiseIntervalSelect?.value || '6', 10);
                let elapsedMs = 0;
                const totalMs = intervalSec * 1000;

                sn.progressTimer = setInterval(() => {
                    elapsedMs += 100;
                    const pct = Math.min(100, (elapsedMs / totalMs) * 100);
                    if (progressFill) progressFill.style.width = pct + '%';
                    if (elapsedMs >= totalMs) {
                        elapsedMs = 0;
                        this.navigateReaderNote(1);
                    }
                }, 100);
            };

            cruiseBtn?.addEventListener('click', () => {
                if (sn.isAutoCruising) stopCruise();
                else startCruise();
            });

            cruiseIntervalSelect?.addEventListener('change', () => {
                if (sn.isAutoCruising) startCruise();
            });

            closeBtn?.addEventListener('click', () => {
                stopCruise();
                backdrop.classList.remove('visible');
            });

            prevBtn?.addEventListener('click', () => {
                this.navigateReaderNote(-1);
            });

            nextBtn?.addEventListener('click', () => {
                this.navigateReaderNote(1);
            });

            window.addEventListener('keydown', (e) => {
                if (!backdrop.classList.contains('visible')) return;
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
                if (e.key === 'ArrowLeft') {
                    this.navigateReaderNote(-1);
                } else if (e.key === 'ArrowRight') {
                    this.navigateReaderNote(1);
                } else if (e.key === 'Escape') {
                    stopCruise();
                    backdrop.classList.remove('visible');
                }
            });

            categorySelect?.addEventListener('change', () => {
                this.filterReaderNotes();
            });

            searchInput?.addEventListener('input', () => {
                this.filterReaderNotes();
            });

            fullscreenBtn?.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    backdrop.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            });

            addNewBtn?.addEventListener('click', () => {
                this.openSmartNoteModal(null);
            });

            editBtn?.addEventListener('click', () => {
                const cur = sn.readerFilteredList[sn.currentReaderIndex];
                if (cur) {
                    this.openSmartNoteModal(null, cur);
                }
            });

            delBtn?.addEventListener('click', () => {
                const cur = sn.readerFilteredList[sn.currentReaderIndex];
                if (!cur) return;
                if (confirm(`确定要彻底删除笔记 "${cur.title}" 吗？此操作将解除所有关联单词的引用。`)) {
                    AppStorage.deleteUnifiedSharedNote(cur.id);
                    this.showToast('🗑️ 共享笔记已彻底删除');
                    this.filterReaderNotes();
                }
            });

            speakBtn?.addEventListener('click', () => {
                const cur = sn.readerFilteredList[sn.currentReaderIndex];
                if (!cur || !cur.linkedWordKeys || cur.linkedWordKeys.length === 0) return;
                const textToSpeak = cur.linkedWordKeys.map(k => k.split('_')[0]).join(', ');
                AppAudio.speakWord(textToSpeak, 1);
                this.showToast(`🔊 朗读词群: ${textToSpeak}`);
            });

            exportCategoryBtn?.addEventListener('click', () => {
                const cat = categorySelect?.value || 'ALL';
                this.exportAllNotesPrompt(cat);
            });

            exportAllBtn?.addEventListener('click', () => {
                this.exportAllNotesPrompt('ALL');
            });
        },

        openNoteReader(startNoteId = null) {
            const backdrop = document.getElementById('immersiveNoteReaderBackdrop');
            if (!backdrop) return;
            this.pauseMotionOnHover();
            this.populateReaderCategories();
            this.filterReaderNotes(startNoteId);
            backdrop.classList.add('visible');
        },

        populateReaderCategories() {
            const select = document.getElementById('readerCategorySelect');
            if (!select) return;
            const notes = AppStorage.loadSharedNotes();
            const categories = Array.from(new Set(notes.map(n => n.category || '近义辨析'))).filter(Boolean);

            const curVal = select.value;
            select.innerHTML = '<option value="ALL">全部知识分类</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
            if (categories.includes(curVal)) select.value = curVal;
        },

        filterReaderNotes(targetNoteId = null) {
            const sn = appState.smartNotes;
            const notes = AppStorage.loadSharedNotes();
            const cat = document.getElementById('readerCategorySelect')?.value || 'ALL';
            const kw = (document.getElementById('readerSearchInput')?.value || '').trim().toLowerCase();

            sn.readerFilteredList = notes.filter(n => {
                const matchCat = (cat === 'ALL' || (n.category || '近义辨析') === cat);
                let matchKw = true;
                if (kw) {
                    const inTitle = (n.title || '').toLowerCase().includes(kw);
                    const inContent = (n.content || '').toLowerCase().includes(kw);
                    const inWords = (n.linkedWordKeys || []).some(k => k.toLowerCase().includes(kw));
                    matchKw = inTitle || inContent || inWords;
                }
                return matchCat && matchKw;
            });

            if (targetNoteId) {
                const idx = sn.readerFilteredList.findIndex(n => n.id === targetNoteId);
                sn.currentReaderIndex = (idx >= 0) ? idx : 0;
            } else {
                sn.currentReaderIndex = 0;
            }

            this.renderCurrentReaderNote();
        },

        navigateReaderNote(step) {
            const sn = appState.smartNotes;
            if (!sn.readerFilteredList || sn.readerFilteredList.length === 0) return;
            sn.currentReaderIndex = (sn.currentReaderIndex + step + sn.readerFilteredList.length) % sn.readerFilteredList.length;
            this.renderCurrentReaderNote();
        },

        renderCurrentReaderNote() {
            const sn = appState.smartNotes;
            const counterTag = document.getElementById('readerNoteCounterTag');
            const categoryTag = document.getElementById('readerCardCategoryTag');
            const dateTag = document.getElementById('readerCardDateTag');
            const wordsCountTag = document.getElementById('readerCardWordsCountTag');
            const titleEl = document.getElementById('readerCardTitle');
            const contentEl = document.getElementById('readerCardText');
            const pillsContainer = document.getElementById('readerLinkedWordsPills');

            if (!sn.readerFilteredList || sn.readerFilteredList.length === 0) {
                if (counterTag) counterTag.textContent = '0 / 0';
                if (titleEl) titleEl.textContent = '暂无符合条件的笔记';
                if (contentEl) contentEl.textContent = '点击下方“➕ 录入新辨析”开始整理知识材料吧！';
                if (pillsContainer) pillsContainer.innerHTML = '';
                return;
            }

            const cur = sn.readerFilteredList[sn.currentReaderIndex];
            if (counterTag) counterTag.textContent = `${sn.currentReaderIndex + 1} / ${sn.readerFilteredList.length}`;
            if (categoryTag) categoryTag.textContent = cur.category || '近义辨析';
            if (dateTag) dateTag.textContent = cur.date || getTodayYMD();
            if (wordsCountTag) wordsCountTag.textContent = `共享 ${cur.linkedWordKeys?.length || 0} 词`;
            if (titleEl) titleEl.textContent = cur.title || '无标题辨析';
            if (contentEl) contentEl.textContent = cur.content || '(该笔记暂无详细正文)';

            if (pillsContainer) {
                const wordsList = cur.linkedWordKeys || [];
                pillsContainer.innerHTML = wordsList.map(k => {
                    const rawName = k.split('_')[0] || k;
                    return `<span class="linked-word-pill" data-word="${rawName}" title="点击朗读该单词">🔊 ${rawName}</span>`;
                }).join('');

                pillsContainer.querySelectorAll('.linked-word-pill').forEach(pill => {
                    pill.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const wd = pill.getAttribute('data-word');
                        if (wd) {
                            AppAudio.speakWord(wd, 1);
                            AppUI.showToast(`🔊 朗读: ${wd}`);
                        }
                    });
                });
            }
        },

        exportAllNotesPrompt(category = 'ALL') {
            const data = AppStorage.exportNotesWithFullWordPayload(category);
            if (!data) {
                alert('所选分类下暂无任何可供导出的笔记！');
                return;
            }

            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const catLabel = category === 'ALL' ? '全部全量' : category;
            a.download = `3DWordUniverse_Notes_${catLabel}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast(`📦 成功导出 ${data.metadata.totalNotes} 条笔记 (已携带完整单词全要素词元数据)！`, 3000);
        },

        renderDetailNotesList(word) {
            const container = document.getElementById('detailNotesList');
            const countEl = document.getElementById('detailNotesCount');
            if (!container) return;

            const notes = Array.isArray(word.notes) ? word.notes : [];
            if (countEl) countEl.textContent = notes.length;

            if (notes.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:15px; color:#8fa0b5; font-size:0.8rem;">暂无备注，点击右上角“添加新备注”可粘贴 AI 拓展知识。</div>';
                return;
            }

            container.innerHTML = notes.map(note => `
                <div class="note-item-card" id="noteCard_${note.id}">
                    <div class="note-item-head" onclick="document.getElementById('noteCard_${note.id}').classList.toggle('expanded')">
                        <span class="note-item-tag">📅 ${note.date || '2026'}</span>
                        <span class="note-item-title">${note.title}</span>
                        <div class="note-item-ops" onclick="event.stopPropagation()">
                            <button class="note-op-btn" title="在阅读系统中全屏精读" onclick="AppUI.openNoteReader('${note.id}')">📖</button>
                            <button class="note-op-btn" title="编辑" onclick="AppUI.openSmartNoteModal(AppUI.getCurrentWord(), ${JSON.stringify(note).replace(/"/g, '&quot;')})">✏️</button>
                            <button class="note-op-btn del" title="删除" onclick="AppUI.deleteNote(AppUI.getCurrentWord(), '${note.id}')">🗑️</button>
                        </div>
                    </div>
                    <div class="note-item-content">${note.content || '(无正文内容)'}</div>
                </div>
            `).join('');
        },

        deleteNote(word, noteId) {
            if (!word || !Array.isArray(word.notes)) return;
            if (confirm('确定要删除这条备注吗？')) {
                AppStorage.deleteUnifiedSharedNote(noteId);
                this.renderDetailNotesList(word);
                if (appState.hoveredObject && getWordKey(appState.hoveredObject.userData.word) === getWordKey(word)) {
                    this.triggerCardDisplay(appState.hoveredObject);
                }
                this.showToast('🗑️ 备注已删除');
            }
        },

        getCurrentWord() {
            return appState.currentDetailWord;
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
            this.renderViewsManagementPanel();
        },

        renderViewsManagementPanel() {
            const panel = document.getElementById('managementPanel');
            if (!panel) return;

            const customItems = (appState.customViews || []).map((v, idx) => `
                <div class="mgmt-list-item" id="mgmtViewItem_${idx}" data-idx="${idx}">
                    <span class="mgmt-item-name" style="cursor:pointer;" onclick="AppUI.applyViewCameraPosition(${idx})" title="点击切换视角；长按750ms覆盖更新参数">
                        📍 ${v.name || `自定义视角 #${idx + 1}`}
                    </span>
                    <button class="mgmt-item-btn" onclick="AppUI.deleteCustomView(${idx})" title="删除">🗑️</button>
                </div>
            `).join('');

            panel.innerHTML = `
                <div class="panel-header" style="text-align:center; font-weight:bold; color:var(--accent-color-1); padding-bottom:8px; margin-bottom:10px; border-bottom:1px solid var(--border-color);">
                    📸 视角预设与管理
                    <button style="float:right; background:none; border:none; color:#a2d8ff; font-size:1.4rem; cursor:pointer;" onclick="document.getElementById('managementPanel').classList.add('hidden')">&times;</button>
                </div>
                <div class="mgmt-banner-tip">
                    💡 提示：点击即可切换视角；<strong>长按视角标签 (750ms)</strong> 可把该视角的所有参数一键覆盖更新为当前画面视角！
                </div>
                <div class="mgmt-action-row">
                    <button class="mgmt-action-btn" onclick="AppUI.saveCurrentViewPrompt()">📸 保存当前视角</button>
                    <button class="mgmt-action-btn" onclick="AppUI.exportViewsJSON()">📤 导出视角</button>
                    <button class="mgmt-action-btn" onclick="AppUI.importViewsJSON()">📥 导入视角</button>
                </div>
                <div style="font-size:0.75rem; color:#87cdff; margin-bottom:6px; font-weight:bold;">系统内置视角:</div>
                <div class="mgmt-list-item" onclick="AppUI.applySystemView('inside')"><span class="mgmt-item-name">👁️‍🗨️ 球心全景视角</span></div>
                <div class="mgmt-list-item" onclick="AppUI.applySystemView('surface')"><span class="mgmt-item-name">👀 球面贴近视角</span></div>
                <div class="mgmt-list-item" onclick="AppUI.applySystemView('overall')"><span class="mgmt-item-name">🌎 整体宏观宇宙视角</span></div>
                <div style="font-size:0.75rem; color:#ffd875; margin:10px 0 6px 0; font-weight:bold;">我的自定义视角 (${(appState.customViews || []).length}):</div>
                <div style="max-height: 220px; overflow-y: auto;">
                    ${customItems || '<div style="font-size:0.75rem; color:#7d94b2; text-align:center; padding:10px;">暂无自定义视角，可点击上方按钮保存当前视角</div>'}
                </div>
            `;

            this.bindCustomViewsLongPress();
        },

        bindCustomViewsLongPress() {
            const items = document.querySelectorAll('#managementPanel .mgmt-list-item[data-idx]');
            items.forEach(el => {
                const idx = parseInt(el.getAttribute('data-idx'), 10);
                let pressTimer = null;

                const startPress = () => {
                    pressTimer = setTimeout(() => {
                        this.overwriteViewWithCurrentCamera(idx, el);
                    }, 750);
                };

                const cancelPress = () => {
                    if (pressTimer) clearTimeout(pressTimer);
                };

                el.addEventListener('mousedown', startPress);
                el.addEventListener('mouseup', cancelPress);
                el.addEventListener('mouseleave', cancelPress);
                el.addEventListener('touchstart', startPress, { passive: true });
                el.addEventListener('touchend', cancelPress);
            });
        },

        overwriteViewWithCurrentCamera(idx, element) {
            if (!appState.customViews || !appState.customViews[idx]) return;
            const targetView = appState.customViews[idx];

            targetView.cameraPos = appState.camera.position.toArray();
            targetView.controlsTarget = appState.controls.target.toArray();
            localStorage.setItem(APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY, JSON.stringify(appState.customViews));

            if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
            if (element) {
                element.classList.add('long-pressed');
                setTimeout(() => element.classList.remove('long-pressed'), 600);
            }
            this.showToast(`✨ 已长按更新！视角 [${targetView.name}] 已设为当前画面参数`);
        },

        saveCurrentViewPrompt() {
            const modal = document.getElementById('textPromptModalBackdrop');
            const input = document.getElementById('textPromptInput');
            const confirmBtn = document.getElementById('textPromptConfirmBtn');
            const cancelBtn = document.getElementById('textPromptCancelBtn');

            input.value = `视角_${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
            modal.classList.add('visible');

            const doSave = () => {
                const name = input.value.trim();
                if (name) {
                    if (!appState.customViews) appState.customViews = [];
                    appState.customViews.push({
                        name: name,
                        cameraPos: appState.camera.position.toArray(),
                        controlsTarget: appState.controls.target.toArray()
                    });
                    localStorage.setItem(APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY, JSON.stringify(appState.customViews));
                    this.renderViewsManagementPanel();
                    this.showToast(`📸 成功保存视角: ${name}`);
                }
                modal.classList.remove('visible');
                confirmBtn.onclick = null;
            };

            confirmBtn.onclick = doSave;
            cancelBtn.onclick = () => { modal.classList.remove('visible'); confirmBtn.onclick = null; };
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
            this.showToast(key === 'inside' ? '👁️‍🗨️ 球心视角' : key === 'surface' ? '👀 球面视角' : '🌎 整体视角');
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
                if (t < 1.0) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        },

        exportViewsJSON() {
            if (!appState.customViews || appState.customViews.length === 0) {
                alert('暂无自定义视角可供导出！');
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
                        if (!Array.isArray(imported)) throw new Error('数据必须是数组');
                        appState.customViews = imported;
                        localStorage.setItem(APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY, JSON.stringify(appState.customViews));
                        this.renderViewsManagementPanel();
                        this.showToast(`📥 成功导入 ${imported.length} 个视角预设！`);
                    } catch (err) {
                        alert('解析失败: ' + err.message);
                    }
                };
                reader.readAsText(file);
            });
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

        initMobileTouchHandlers() {
            const canvasEl = appState.renderer?.domElement || document.getElementById('wordSphere');
            if (!canvasEl) return;

            let hoverTimer = null;
            let longPressTimer = null;
            let didLongPress = false;
            let downTime = 0;
            let downPos = new THREE.Vector2();
            let isMoving = false;
            let currentHoverCard = null;

            let lastClientX = -9999;
            let lastClientY = -9999;

            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();

            const isPointerOverHoverCard = (clientX, clientY) => {
                if (!appState.hoverOverlayCard || !appState.hoverOverlayCard.visible || appState.overlayCardTargetOpacity < 0.05) {
                    return false;
                }
                mouse.x = (clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(clientY / window.innerHeight) * 2 + 1;
                raycaster.setFromCamera(mouse, appState.camera);
                const hits = raycaster.intersectObjects([appState.hoverOverlayCard], true);
                return hits.length > 0;
            };

            const getRaycastCard = (clientX, clientY) => {
                mouse.x = (clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(clientY / window.innerHeight) * 2 + 1;
                raycaster.setFromCamera(mouse, appState.camera);
                const hits = raycaster.intersectObjects(appState.wordObjects || [], false);
                return hits.length > 0 ? hits[0].object : null;
            };

            const checkOrScheduleDismiss = () => {
                if (appState.hoverCardDismissTimer) {
                    clearTimeout(appState.hoverCardDismissTimer);
                    appState.hoverCardDismissTimer = null;
                }
                if (!appState.hoverOverlayCard || !appState.hoverOverlayCard.visible || appState.overlayCardTargetOpacity < 0.05) {
                    return;
                }

                if (appState.isHoverCardPinned) {
                    return;
                }

                const now = performance.now();
                const shownTime = appState.hoverCardShownTime || 0;
                const timeSinceShow = now - shownTime;
                const isOver = isPointerOverHoverCard(lastClientX, lastClientY);

                if (isOver) {
                    return;
                }

                const stayDurationSec = parseFloat(document.getElementById('hoverCardDurationRange')?.value || '5.0');
                const stayDurationMs = Math.max(800, stayDurationSec * 1000);

                const remainingLock = Math.max(0, stayDurationMs - timeSinceShow);
                const delay = Math.max(200, remainingLock);

                appState.hoverCardDismissTimer = setTimeout(() => {
                    if (!appState.isHoverCardPinned && !isPointerOverHoverCard(lastClientX, lastClientY)) {
                        appState.hoveredObject = null;
                        appState.overlayCardTargetOpacity = 0;
                        AppUI.resumeMotionAfterHover();
                        appState.needsRender = true;
                    }
                }, delay);
            };

            appState.scheduleHoverCardAutoDismiss = checkOrScheduleDismiss;

            window.addEventListener('pointermove', (e) => {
                if (e.pointerType !== 'touch') {
                    lastClientX = e.clientX;
                    lastClientY = e.clientY;
                }
            }, { passive: true });

            canvasEl.addEventListener('pointermove', (e) => {
                const curPos = new THREE.Vector2(e.clientX, e.clientY);
                if (downPos.distanceTo(curPos) > 8) {
                    isMoving = true;
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                }

                if (e.pointerType !== 'touch') {
                    lastClientX = e.clientX;
                    lastClientY = e.clientY;

                    if (isPointerOverHoverCard(e.clientX, e.clientY)) {
                        if (hoverTimer) clearTimeout(hoverTimer);
                        if (appState.hoverCardDismissTimer) {
                            clearTimeout(appState.hoverCardDismissTimer);
                            appState.hoverCardDismissTimer = null;
                        }
                        return;
                    }

                    if (appState.isHoverCardPinned) {
                        return;
                    }

                    const hitCard = getRaycastCard(e.clientX, e.clientY);
                    if (hitCard) {
                        if (hitCard !== currentHoverCard) {
                            currentHoverCard = hitCard;
                            if (hoverTimer) clearTimeout(hoverTimer);
                            hoverTimer = setTimeout(() => {
                                AppUI.triggerCardDisplay(hitCard);
                            }, 200);
                        }
                    } else {
                        currentHoverCard = null;
                        if (hoverTimer) clearTimeout(hoverTimer);
                    }

                    checkOrScheduleDismiss();
                }
            });

            canvasEl.addEventListener('pointerdown', (e) => {
                downTime = performance.now();
                downPos.set(e.clientX, e.clientY);
                isMoving = false;
                didLongPress = false;

                if (e.pointerType === 'touch') {
                    if (longPressTimer) clearTimeout(longPressTimer);
                    const touchedCard = getRaycastCard(e.clientX, e.clientY);
                    if (touchedCard) {
                        longPressTimer = setTimeout(() => {
                            if (!isMoving && touchedCard.userData?.word) {
                                didLongPress = true;
                                if (navigator.vibrate) {
                                    navigator.vibrate([40, 30, 40]);
                                }
                                AppUI.showImmersiveDetailPanel(touchedCard.userData.word);
                                longPressTimer = null;
                            }
                        }, 750);
                    }
                }
            });

            canvasEl.addEventListener('pointerup', (e) => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }

                if (didLongPress) {
                    didLongPress = false;
                    return;
                }

                const duration = performance.now() - downTime;
                const dist = downPos.distanceTo(new THREE.Vector2(e.clientX, e.clientY));

                if (dist < 8 && duration < 750 && !isMoving) {
                    // 立即响应单击（点击卡片弹出查词，点击空白处关闭查词）
                    this.handleQuickTap(e);

                    // 检测是否点在卡片外部的空白区域
                    const mouse = new THREE.Vector2(
                        (e.clientX / window.innerWidth) * 2 - 1,
                        -(e.clientY / window.innerHeight) * 2 + 1
                    );
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(mouse, appState.camera);
                    const intersects = raycaster.intersectObjects(appState.wordObjects || [], false);

                    // 只有空白处双击才触发提亮（鼠标和手机均已支持）
                    if (intersects.length === 0) {
                        if (!this._lastTapTime) this._lastTapTime = 0;
                        const now = performance.now();
                        if (now - this._lastTapTime < 350) {
                            appState.isLightBoosted = !appState.isLightBoosted;
                            appState.needsRender = true;
                            if (window.AppUI && typeof AppUI.showToast === 'function') {
                                AppUI.showToast(appState.isLightBoosted ? '💡 卡片群亮度已提亮' : '💡 卡片群亮度已恢复');
                            }
                            if (navigator.vibrate) navigator.vibrate(20);
                            this._lastTapTime = 0;
                        } else {
                            this._lastTapTime = now;
                        }
                    } else {
                        // 如果点到了卡片，重置计时
                        this._lastTapTime = 0;
                    }
                }
            });
        },

        handleQuickTap(e) {
            const mouse = new THREE.Vector2(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, appState.camera);

            if (appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                const intersectsCard = raycaster.intersectObjects([appState.hoverOverlayCard], true);
                if (intersectsCard.length > 0) {
                    const intersect = intersectsCard[0];
                    const uv = intersect.uv;
                    const screenMesh = appState.hoverOverlayCard.getObjectByName("textScreen") || appState.hoverOverlayCard.userData.refs?.screen;
                    const texture = screenMesh?.material?.map;

                    if (texture && uv) {
                        const canvasWidth = texture.image.width;
                        const canvasHeight = texture.image.height;
                        const clickX = uv.x * canvasWidth;
                        const clickY = (1 - uv.y) * canvasHeight;

                        const wordData = appState.hoveredObject?.userData?.word;
                        const zones = wordData?.hover_click_zones || appState.hoverOverlayCard.userData.hover_click_zones || [];

                        if (wordData && zones.length > 0) {
                            for (const zone of zones) {
                                if (clickX >= zone.xMin && clickX <= zone.xMax && clickY >= zone.yMin && clickY <= zone.yMax) {
                                    if (zone.type === 'speak') {
                                        AppAudio.speakWord(wordData.words, 1);
                                        this.showToast('🔊 朗读: ' + wordData.words);
                                    } else if (zone.type === 'fontSizeDown') {
                                        const scaleInput = document.getElementById('hoverOverlayCardScale');
                                        let currentScale = Math.max(0.3, parseFloat(scaleInput?.value || 1.0) - 0.15);
                                        if (scaleInput) {
                                            scaleInput.value = currentScale.toFixed(2);
                                            scaleInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        }
                                    } else if (zone.type === 'fontSizeUp') {
                                        const scaleInput = document.getElementById('hoverOverlayCardScale');
                                        let currentScale = Math.min(4.0, parseFloat(scaleInput?.value || 1.0) + 0.15);
                                        if (scaleInput) {
                                            scaleInput.value = currentScale.toFixed(2);
                                            scaleInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        }
                                    } else if (zone.type === 'togglePin') {
                                        if (!appState.isHoverCardPinned) {
                                            appState.isHoverCardPinned = true;
                                            const wordText = (wordData.words || '').trim();
                                            this.copyToClipboard(wordText).then((ok) => {
                                                if (ok) {
                                                    this.showToast('📌 已锁定常驻，单词已复制至剪贴板', 2500);
                                                } else {
                                                    this.showToast('📌 已锁定卡片常驻', 2000);
                                                }
                                            });
                                            this.triggerCardDisplay(appState.hoveredObject);
                                        } else {
                                            appState.isHoverCardPinned = false;
                                            appState.hoveredObject = null;
                                            appState.overlayCardTargetOpacity = 0;
                                            AppUI.resumeMotionAfterHover();
                                            appState.needsRender = true;
                                            this.showToast('📝 卡片已关闭，正在打开 AI 智能备注系统...', 2000);
                                            setTimeout(() => {
                                                this.openSmartNoteModal(wordData, null);
                                            }, 150);
                                        }
                                    } else if (zone.type === 'note') {
                                        this.openSmartNoteModal(wordData, null);
                                    } else if (zone.type === 'shield') {
                                        if (confirm('确定要将单词 "' + wordData.words + '" 移入屏蔽词库吗？')) {
                                            const key = getWordKey(wordData);
                                            appState.shieldedWords.add(key);
                                            AppStorage.saveShieldedWords(appState.shieldedWords);
                                            appState.allWords = appState.allWords.filter(w => getWordKey(w) !== key);
                                            appState.filteredWords = appState.filteredWords.filter(w => getWordKey(w) !== key);
                                            appState.currentBatchWords = appState.currentBatchWords.filter(w => getWordKey(w) !== key);
                                            this.displayCurrentBatch();
                                            this.updateClearShieldedBtnLabel();
                                            this.updateStats();

                                            appState.isHoverCardPinned = false;
                                            appState.hoveredObject = null;
                                            appState.overlayCardTargetOpacity = 0;
                                            AppUI.resumeMotionAfterHover();
                                            this.showToast('🛡️ 已屏蔽单词: ' + wordData.words);
                                        }
                                    } else if (zone.type === 'card_body') {
                                        this.showImmersiveDetailPanel(wordData);
                                    }
                                    appState.needsRender = true;
                                    return;
                                }
                            }
                        }
                    }
                    return;
                }
            }

            const intersects = raycaster.intersectObjects(appState.wordObjects || [], false);
            if (intersects.length > 0) {
                const card = intersects[0].object;
                const wordData = card.userData.word;

                if (appState.hoveredObject === card && appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                    if (!appState.isHoverCardPinned) {
                        appState.hoveredObject = null;
                        appState.overlayCardTargetOpacity = 0;
                        AppUI.resumeMotionAfterHover();
                    }
                } else {
                    appState.isHoverCardPinned = false;
                    this.triggerCardDisplay(card);
                }

                const result = AppStorage.recordStudyClick(wordData);
                this.updateStudyCounterDisplay();
                if (result.justReached) {
                    this.triggerDailyGoalAchievedToast();
                }
            } else {
                if (!appState.isHoverCardPinned) {
                    appState.hoveredObject = null;
                    appState.overlayCardTargetOpacity = 0;
                    AppUI.resumeMotionAfterHover();
                }
            }
            appState.needsRender = true;
        },

        triggerCardDisplay(card) {
            if (!card) return;
            const word = card.userData.word;
            appState.hoveredObject = card;

            this.pauseMotionOnHover();

            const { texture, pxWidth, pxHeight } = AppCardFactory.createOverlayTexture(word);
            const screen = appState.hoverOverlayCard.getObjectByName("textScreen") || appState.hoverOverlayCard.userData.refs?.screen;
            if (screen.material.map) screen.material.map.dispose();
            screen.material.map = texture;
            screen.material.needsUpdate = true;

            appState.hoverOverlayCard.userData.word = word;
            appState.hoverOverlayCard.visible = true;
            appState.overlayCardTargetOpacity = 1;

            const scaleVal = parseFloat(document.getElementById('hoverOverlayCardScale')?.value || 1.0);
            updateHoverCardPosition(pxWidth, pxHeight, scaleVal);

            appState.hoverOverlayCard.position.copy(appState.overlayCardTargetPosition);
            appState.hoverOverlayCard.quaternion.copy(appState.camera.quaternion);
            appState.hoverOverlayCard.scale.copy(appState.overlayCardTargetScale);

            if (word && word.words) {
                AppAudio.speakWord(word.words, 1);
            }
            appState.needsRender = true;

            appState.hoverCardShownTime = performance.now();
            if (appState.hoverCardDismissTimer) {
                clearTimeout(appState.hoverCardDismissTimer);
                appState.hoverCardDismissTimer = null;
            }

            if (typeof appState.scheduleHoverCardAutoDismiss === 'function') {
                appState.scheduleHoverCardAutoDismiss();
            }
        },

        showImmersiveDetailPanel(word) {
            if (!word) return;
            appState.currentDetailWord = word;

            this.pauseMotionOnHover();

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

            this.renderDetailNotesList(word);

            document.getElementById('immersiveDetailPanel')?.classList.add('visible');
            appState.rotationMultiplier = 0.0;
            this.adjustSphereViewForPanel();
            appState.needsRender = true;
        },

        hideImmersiveDetailPanel() {
            document.getElementById('immersiveDetailPanel')?.classList.remove('visible');
            appState.rotationMultiplier = 1.0;
            this.resumeMotionAfterHover();
            this.adjustSphereViewForPanel();
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

        triggerDailyGoalAchievedToast() {
            const toast = document.getElementById('dailyGoalToast');
            if (!toast) return;
            toast.textContent = `🎉 恭喜！您已完成今日复习目标 (${AppStorage.getStudyGoal()} 个单词)！`;
            toast.classList.add('show');
            setTimeout(() => { toast.classList.remove('show'); }, 3500);
        },

        showToast(text, duration = 2000) {
            let toast = document.getElementById('appDynamicToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'appDynamicToast';
                toast.style.cssText = `
                    position: fixed; top: 36px; left: 50%; transform: translateX(-50%) translateY(-25px);
                    background: linear-gradient(135deg, rgba(16, 32, 70, 0.96), rgba(8, 18, 44, 0.96));
                    border: 1px solid rgba(0, 240, 255, 0.65); color: #eaf6ff; padding: 12px 28px; border-radius: 999px;
                    font-size: 1rem; font-weight: 700; box-shadow: 0 8px 30px rgba(0, 240, 255, 0.4);
                    backdrop-filter: blur(14px); z-index: 10002; opacity: 0; pointer-events: none;
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

        changeViewAwareSpeed(multiplier) {
            appState.currentRotationSpeedBase *= multiplier;
            appState.currentRotationSpeedBase = Math.max(0.0001, Math.min(20.0, appState.currentRotationSpeedBase));
            appState.autoRotate = true;
            const toggle = document.getElementById('rotateToggle');
            if (toggle) toggle.textContent = '🔁';

            const rotSlider = document.getElementById('rotationSpeed');
            const sliderVal = Math.max(0.001, safeParseFloat(rotSlider ? rotSlider.value : 1.0, 1.0));
            appState.actualDisplayRotationSpeed = sliderVal * appState.currentRotationSpeedBase;

            this.showToast(multiplier > 1.0 ? ('🚀 旋转速度已加速并保存: ' + appState.actualDisplayRotationSpeed.toFixed(3)) : ('🐢 旋转速度已减速并保存: ' + appState.actualDisplayRotationSpeed.toFixed(3)));
            appState.needsRender = true;
            schedulePersist();
        },

        updateClearShieldedBtnLabel() {
            const btn = document.getElementById('clearShieldedBtn');
            if (btn) btn.textContent = `清除屏蔽词库 (${appState.shieldedWords.size})`;
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
                hud.classList.toggle('expanded');
                hud.classList.toggle('collapsed');
            });

            statusTag?.addEventListener('click', (e) => {
                e.stopPropagation();
                appState.focusCruise.enabled = !appState.focusCruise.enabled;
                if (!appState.focusCruise.enabled) appState.focusCruise.currentSpotlightIndices.clear();
                else appState.focusCruise.lastSwitchTime = performance.now();
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
                    min: 2, max: 600, step: 5,
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
                    min: 1.0, max: 8.0, step: 0.1,
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
                if (modal && modal.classList.contains('visible')) return;
                if (hud && !hud.contains(e.target)) {
                    hud.classList.remove('expanded');
                    hud.classList.add('collapsed');
                }
            });
        },

        updateFocusCruiseVisuals() {
            const enabled = appState.focusCruise.enabled;
            const toggleBtn = document.getElementById('focusCruiseToggleBtn');
            if (toggleBtn) {
                toggleBtn.classList.toggle('active-toggle', enabled);
                toggleBtn.textContent = enabled ? '✨' : '💤';
            }
            const hud = document.getElementById('focusCruiseHud');
            const statusTag = document.getElementById('focusCruiseStatusTag');
            const intervalVal = document.getElementById('focusCruiseIntervalVal');
            const ratioVal = document.getElementById('focusCruiseRatioVal');
            const scaleVal = document.getElementById('focusCruiseScaleVal');

            if (hud) hud.classList.toggle('enabled', enabled);
            if (statusTag) statusTag.textContent = enabled ? '开' : '关';
            if (intervalVal) intervalVal.textContent = String(appState.focusCruise.interval || 50);
            if (ratioVal) ratioVal.textContent = String(appState.focusCruise.ratioPercent || 8);
            if (scaleVal) scaleVal.textContent = String(appState.focusCruise.scaleFactor || 1.5);
        },

        initStudyLog() {
            const counterHud = document.getElementById('studyCounterHud');
            const counterValEl = document.getElementById('studyCounterValue');
            const goalValEl = document.getElementById('studyGoalValue');
            const settleModal = document.getElementById('studySettleModalBackdrop');

            // 长按学习计数器快速呼出智能备注系统
            let counterHudPressTimer = null;
            counterHud?.addEventListener('pointerdown', () => {
                counterHudPressTimer = setTimeout(() => {
                    this.openSmartNoteModal(null);
                    this.showToast('📝 学习面板长按：打开智能备注系统！');
                }, 750);
            });
            const cancelCounterPress = () => { if (counterHudPressTimer) clearTimeout(counterHudPressTimer); };
            counterHud?.addEventListener('pointerup', cancelCounterPress);
            counterHud?.addEventListener('pointercancel', cancelCounterPress);

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
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:14px; background:rgba(255,255,255,0.04); padding:10px; border-radius:8px;">
                    <div>今日有效复习: <strong style="color:#68FFC0;">${entries.length}</strong></div>
                    <div>设定学习目标: <strong style="color:#ffd875;">${AppStorage.getStudyGoal()}</strong></div>
                    <div>累计点击次数: <strong>${entries.reduce((s, e) => s + (e.clickTimes || 1), 0)}</strong></div>
                    <div>目标状态: <strong>${entries.length >= AppStorage.getStudyGoal() ? '已达成 🏆' : '进行中'}</strong></div>
                </div>
                <div style="max-height:220px; overflow-y:auto;">
                    ${entries.map(e => `
                        <div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px dashed rgba(255,255,255,0.1); font-size:0.85rem;">
                            <span>${e.lastAt || ''} <strong>${e.words || ''}</strong></span>
                            <span style="color:#87cdff;">${e.chinese || ''}</span>
                            <span style="color:#ffd875;">×${e.clickTimes || 1}</span>
                        </div>
                    `).join('') || '<p style="text-align:center; padding:15px; color:#aaa;">今日暂无记录，快去球面上点击单词学习吧！</p>'}
                </div>
            `;
        },

        handleFileUpload() {
            selectLocalFile('application/json,.json', async (file) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const words = JSON.parse(e.target.result);
                        if (!Array.isArray(words)) throw new Error('数据必须是数组');
                        words.forEach(w => {
                            if (!Array.isArray(w.notes)) w.notes = [];
                        });
                        await AppStorage.saveLibrary(words);
                        await this.loadWordDataAndBoot();
                        alert(`成功载入 ${words.length} 个词汇 (已完整同步各词 AI 备注)！`);
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
                        if (!Array.isArray(newWords)) throw new Error('数据必须是数组');
                        const existingKeys = new Set(appState.allWords.map(w => getWordKey(w)));
                        let added = 0;
                        newWords.forEach(w => {
                            if (!Array.isArray(w.notes)) w.notes = [];
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
                            alert(`成功追加 ${added} 个新单词 (保留备注)！`);
                        } else {
                            alert('未检测到新单词。');
                        }
                    } catch (err) {
                        alert('追加失败: ' + err.message);
                    }
                };
                reader.readAsText(file);
            });
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
            a.download = `WordUniverse_Library_WithNotes_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('📤 词库与 AI 知识备注已成功导出！');
        },

        exportSettings() {
            const fullBackup = {
                exportedAt: new Date().toISOString(),
                version: "V8.6"
            };

            this.saveSettings();
            const settingsRaw = localStorage.getItem(APP_CONFIG.SETTINGS_STORAGE_KEY);
            if (settingsRaw) fullBackup[APP_CONFIG.SETTINGS_STORAGE_KEY] = safeJSONParse(settingsRaw, {});

            this.saveLastState();
            const lastStateRaw = localStorage.getItem(APP_CONFIG.LAST_STATE_STORAGE_KEY);
            if (lastStateRaw) fullBackup[APP_CONFIG.LAST_STATE_STORAGE_KEY] = safeJSONParse(lastStateRaw, {});

            fullBackup[APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY] = appState.customViews || [];
            fullBackup[APP_CONFIG.STUDY_GOAL_STORAGE_KEY] = AppStorage.getStudyGoal();
            fullBackup[APP_CONFIG.STUDY_LOG_STORAGE_KEY] = AppStorage.loadStudyLog();
            fullBackup[APP_CONFIG.VIEWED_WORDS_STORAGE_KEY] = Array.from(AppStorage.loadViewedWords());
            fullBackup['shieldedWordsV8'] = Array.from(AppStorage.loadShieldedWords());
            fullBackup[APP_CONFIG.SHARED_NOTES_STORAGE_KEY] = AppStorage.loadSharedNotes();

            const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `WordUniverse_FullConfigBackup_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('⚙️ 系统全量配置(含共享知识库、视角与参数)已成功导出！');
        },

        importSettings() {
            selectLocalFile('application/json,.json', (file) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const imported = JSON.parse(e.target.result);
                        if (!imported || typeof imported !== 'object') {
                            throw new Error('导入文件内容不是合法的 JSON 对象');
                        }

                        const settingsData = imported[APP_CONFIG.SETTINGS_STORAGE_KEY] || imported;
                        if (settingsData && typeof settingsData === 'object') {
                            localStorage.setItem(APP_CONFIG.SETTINGS_STORAGE_KEY, JSON.stringify(settingsData));
                        }

                        if (imported[APP_CONFIG.LAST_STATE_STORAGE_KEY]) {
                            localStorage.setItem(APP_CONFIG.LAST_STATE_STORAGE_KEY, JSON.stringify(imported[APP_CONFIG.LAST_STATE_STORAGE_KEY]));
                        }

                        if (imported[APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY]) {
                            appState.customViews = imported[APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY];
                            localStorage.setItem(APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY, JSON.stringify(appState.customViews));
                        }

                        if (imported[APP_CONFIG.STUDY_GOAL_STORAGE_KEY]) {
                            AppStorage.setStudyGoal(imported[APP_CONFIG.STUDY_GOAL_STORAGE_KEY]);
                        }
                        if (imported[APP_CONFIG.STUDY_LOG_STORAGE_KEY]) {
                            AppStorage.saveStudyLog(imported[APP_CONFIG.STUDY_LOG_STORAGE_KEY]);
                        }

                        if (imported[APP_CONFIG.VIEWED_WORDS_STORAGE_KEY]) {
                            AppStorage.saveViewedWords(new Set(imported[APP_CONFIG.VIEWED_WORDS_STORAGE_KEY]));
                        }
                        if (imported['shieldedWordsV8']) {
                            AppStorage.saveShieldedWords(new Set(imported['shieldedWordsV8']));
                        }
                        if (imported[APP_CONFIG.SHARED_NOTES_STORAGE_KEY]) {
                            AppStorage.saveSharedNotes(imported[APP_CONFIG.SHARED_NOTES_STORAGE_KEY]);
                        }

                        alert('全量系统配置已成功恢复导入！即将刷新页面以应用所有新参数。');
                        location.reload();
                    } catch (err) {
                        alert('设置解析失败: ' + err.message);
                    }
                };
                reader.readAsText(file);
            });
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
                if (s.cardScaleMultiplier !== undefined) appState.cardScaleMultiplier = s.cardScaleMultiplier;
                if (s.currentRotationSpeedBase !== undefined) appState.currentRotationSpeedBase = safeParseFloat(s.currentRotationSpeedBase, APP_CONFIG.DEFAULT_ROTATION_SPEED);
                if (s.actualDisplayRotationSpeed !== undefined) appState.actualDisplayRotationSpeed = safeParseFloat(s.actualDisplayRotationSpeed, appState.currentRotationSpeedBase);
                if (s.autoRotate !== undefined) appState.autoRotate = !!s.autoRotate;
                if (s.cameraPosition && appState.camera) appState.camera.position.fromArray(s.cameraPosition);
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
                'rotationSpeed', 'cardRotationSpeed', 'rotateX', 'rotateY', 'rotateZ', 'cardSelfRotation', 'batchSize',
                'cardPauseOnHoverEnabled', 'hoverResumeDurationRange', 'hoverResumeP1Range', 'hoverResumeP2Range',
                'focusCruiseEnabled', 'focusCruiseIntervalRange', 'focusCruiseRatioRange', 'focusCruiseScaleRange',
                'coreSphereRadius', 'coreSphereColor', 'coreSphereEmissive', 'coreSphereEmissiveIntensity', 'coreSphereOpacity',
                'visualEffectsEnabled', 'vortexParticleCount', 'vortexColor', 'vortexSize', 'vortexSpeed', 'vortexTightness',
                'vortexBrightnessRange', 'vortexCoreRadiusRange',
                'bloomThreshold', 'bloomStrength', 'bloomRadius',
                'starfieldEnabled', 'starCount', 'starColor', 'starSize',
                'cardStylePresetSelect', 'sphereCardFontSize', 'cardExposureRange', 'sphereCardBrightnessRange', 'cardBrightnessRange', 'sphereCardFontColor', 'cardTextStyleSelect', 'sphereCardFontFamily',
                'cardBaseColor', 'cardChamberDepthRange', 'cardOpacityRange',
                'cardLightPositionSelect', 'cardLightBrightnessRange', 'cardLightSpreadRange', 'cardLightColor',
                'hoverCardStyleModeSelect', 'hoverCardDurationRange', 'hoverOverlayCardScale', 'hoverCardBrightness', 'hoverCardBgOpacity',
                'hoverCardMainWordColor', 'hoverCardPhoneticColor', 'hoverCardMeaningColor', 'hoverCardMethodTitleColor', 'hoverCardMethodContentColor',
                'voiceSelect', 'rateInput', 'timesInput', 'volumeInput'
            ];

            settingIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    settings[id] = (el.type === 'checkbox') ? el.checked : el.value;
                }
            });

            settings.currentRotationSpeedBase = appState.currentRotationSpeedBase;
            settings.actualDisplayRotationSpeed = appState.actualDisplayRotationSpeed;
            settings.autoRotate = appState.autoRotate;
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
                    if (el.type === 'checkbox') el.checked = !!settings[key];
                    else el.value = settings[key];
                }
            }

            if (settings.cardPauseOnHoverEnabled !== undefined) {
                appState.hoverMotion.pauseEnabled = !!settings.cardPauseOnHoverEnabled;
            }
            if (settings.hoverResumeDurationRange !== undefined) {
                appState.hoverMotion.resumeDuration = safeParseFloat(settings.hoverResumeDurationRange, 2.0);
            }
            if (settings.hoverResumeP1Range !== undefined) {
                appState.hoverMotion.p1Percent = safeParseFloat(settings.hoverResumeP1Range, 20);
            }
            if (settings.hoverResumeP2Range !== undefined) {
                appState.hoverMotion.p2Percent = safeParseFloat(settings.hoverResumeP2Range, 70);
            }

            if (settings.currentRotationSpeedBase !== undefined) {
                appState.currentRotationSpeedBase = safeParseFloat(settings.currentRotationSpeedBase, APP_CONFIG.DEFAULT_ROTATION_SPEED);
            }
            if (settings.actualDisplayRotationSpeed !== undefined) {
                appState.actualDisplayRotationSpeed = safeParseFloat(settings.actualDisplayRotationSpeed, appState.currentRotationSpeedBase);
            } else {
                const rotSlider = document.getElementById('rotationSpeed');
                const sliderVal = safeParseFloat(rotSlider ? rotSlider.value : 1.0, 1.0);
                appState.actualDisplayRotationSpeed = sliderVal * appState.currentRotationSpeedBase;
            }

            if (settings.autoRotate !== undefined) {
                appState.autoRotate = !!settings.autoRotate;
                const rotateToggle = document.getElementById('rotateToggle');
                if (rotateToggle) rotateToggle.textContent = appState.autoRotate ? '🔁' : '⏹️';
            }

            if (settings.cardScaleMultiplier) appState.cardScaleMultiplier = settings.cardScaleMultiplier;
            if (settings.showEnglish !== undefined) {
                appState.showEnglish = !!settings.showEnglish;
                const toggleLang = document.getElementById('toggleLanguage');
                if (toggleLang) toggleLang.textContent = appState.showEnglish ? '中' : '英';
            }

            if (settings.hoverCardBgOpacity !== undefined) {
                appState.rt.hoverBgOpacity = parseFloat(settings.hoverCardBgOpacity);
            }

            if (window.AppCardFactory) {
                const br = settings.sphereCardBrightnessRange !== undefined ? parseFloat(settings.sphereCardBrightnessRange) : 0.50;
                const exp = settings.cardExposureRange !== undefined ? parseFloat(settings.cardExposureRange) : 0.35;
                AppCardFactory.updateCardsMaterialsFast({ brightness: br, exposure: exp });
            }

            if (settings.voiceSelect) appState.ttsSettings.voice = settings.voiceSelect;
            if (settings.rateInput) appState.ttsSettings.rate = safeParseFloat(settings.rateInput, 1.0);
            if (settings.timesInput) appState.ttsSettings.times = safeParseInt(settings.timesInput, 1);
            if (settings.volumeInput) appState.ttsSettings.volume = safeParseFloat(settings.volumeInput, 1.0);

            AppParticles.updateCoreSphereSettings();
            AppParticles.updateVisualEffects();
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
                cardScaleMultiplier: appState.cardScaleMultiplier,
                currentRotationSpeedBase: appState.currentRotationSpeedBase,
                actualDisplayRotationSpeed: appState.actualDisplayRotationSpeed,
                autoRotate: appState.autoRotate
            };
            localStorage.setItem(APP_CONFIG.LAST_STATE_STORAGE_KEY, JSON.stringify(state));
        }
    };

    window.AppUI = AppUI;
    window.addEventListener('DOMContentLoaded', () => {
        AppUI.init().catch(err => console.error('引导异常:', err));
    });
})();
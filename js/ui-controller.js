/**
 * 3D单词宇宙 - 全功能 UI 交互控制器与启动总装中枢
 * 修复学习日志达标提示、侧边放大缩小卡片按钮与局部巡航放大模式
 */
(function() {
    let fontScale = 1.0;
    let _persistTimer = null;
    let _sphereRebuildRaf = 0;

    function schedulePersist() {
        clearTimeout(_persistTimer);
        _persistTimer = setTimeout(() => {
            _persistTimer = null;
            AppUI.saveSettings();
            AppUI.saveLastState();
        }, 150);
    }

    function scheduleSphereRebuild() {
        if (_sphereRebuildRaf) return;
        _sphereRebuildRaf = requestAnimationFrame(() => {
            _sphereRebuildRaf = 0;
            if (appState.currentBatchWords.length > 0 || appState.wordObjects.length > 0) {
                AppSphereEngine.createWordSphere(appState.currentBatchWords);
            }
        });
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

            this.initPremiumHoverCard();
            this.initAllButtonsAndEvents();
            this.initDetailedSettingsListeners();
            this.initMobileTouchHandlers();
            this.initClock();
            this.initFocusCruiseHud();
            this.initSystemViews();
            this.loadCustomViews();
            this.loadCustomWordBanks();
            this.loadCustomRotations();
            this.loadCustomHoverPositions();
            this.initStudyLog();

            this.loadSettings();
            await this.loadWordDataAndBoot();
            this.loadAllPersistentStates();

            setTimeout(() => {
                appState.isInitializing = false;
                this.refreshRuntimeCache();
                appState.needsRender = true;
                console.log('3D 单词宇宙系统以全功能实时响应状态启动完毕！');
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

            // 重置焦点巡航轮换池
            if (appState.focusCruise) {
                appState.focusCruise.remainingPool = [];
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

        initPremiumHoverCard() {
            const group = new THREE.Group();

            const backplate = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({ color: 0x061126, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false, depthWrite: false })
            );
            backplate.name = "backplate";
            backplate.renderOrder = 9995;
            backplate.raycast = () => {};
            group.add(backplate);

            const glowCanvas = document.createElement('canvas');
            glowCanvas.width = 128; glowCanvas.height = 128;
            const glowCtx = glowCanvas.getContext('2d');
            const gradient = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
            gradient.addColorStop(0, "rgba(0, 200, 255, 0.22)");
            gradient.addColorStop(1, "rgba(0, 30, 80, 0.0)");
            glowCtx.fillStyle = gradient;
            glowCtx.fillRect(0, 0, 128, 128);

            const glowTexture = new THREE.CanvasTexture(glowCanvas);
            const coreGlow = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
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
            coreGlow.position.z = 0.01;
            coreGlow.renderOrder = 9996;
            coreGlow.raycast = () => {};
            group.add(coreGlow);

            const screen = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false })
            );
            screen.position.z = 0.02;
            screen.name = 'textScreen';
            screen.renderOrder = 9998;
            group.add(screen);

            const cornerBracketsGroup = this.createCornerBrackets();
            cornerBracketsGroup.name = 'frameGroup';
            cornerBracketsGroup.position.z = 0.03;
            cornerBracketsGroup.children.forEach(child => {
                child.renderOrder = 9997;
                child.material.depthTest = false;
                child.material.depthWrite = false;
                child.raycast = () => {};
            });
            group.add(cornerBracketsGroup);

            group.renderOrder = 9999;
            group.visible = false;
            group.userData.refs = { screen, backplate, coreGlow, frameGroup: cornerBracketsGroup };

            appState.hoverOverlayCard = group;
            appState.overlayCardTargetScale = new THREE.Vector3(0.001, 0.001, 0.001);
            appState.overlayCardTargetPosition = new THREE.Vector3(0, 0, 100);
            appState.scene.add(group);
        },

        createCornerBrackets() {
            const bracketGroup = new THREE.Group();
            const bracketCanvas = document.createElement('canvas');
            bracketCanvas.width = 64;
            bracketCanvas.height = 64;
            const ctx = bracketCanvas.getContext('2d');
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(6, 32);
            ctx.lineTo(6, 6);
            ctx.lineTo(32, 6);
            ctx.stroke();
            const bracketTexture = new THREE.CanvasTexture(bracketCanvas);

            const bracketMat = new THREE.MeshBasicMaterial({
                map: bracketTexture,
                color: 0x00ffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: false
            });

            const size = 0.25;
            const bracketGeo = new THREE.PlaneGeometry(size, size);

            for (let i = 0; i < 4; i++) {
                const bracket = new THREE.Mesh(bracketGeo, bracketMat.clone());
                const signX = (i % 2 === 0) ? -1 : 1;
                const signY = (i < 2) ? 1 : -1;
                bracket.position.set(signX * 0.5, signY * 0.5, 0.01);

                let rotation = 0;
                if (signX === 1 && signY === 1) rotation = -Math.PI / 2;
                else if (signX === -1 && signY === -1) rotation = Math.PI / 2;
                else if (signX === 1 && signY === -1) rotation = Math.PI;
                bracket.rotation.z = rotation;
                bracketGroup.add(bracket);
            }
            return bracketGroup;
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

        initFocusCruiseHud() {
            const hud = document.getElementById('focusCruiseHud');
            const intervalVal = document.getElementById('focusCruiseIntervalVal');
            if (!hud || !intervalVal) return;

            const updateHudUI = () => {
                hud.classList.toggle('disabled', !appState.focusCruise.enabled);
                intervalVal.textContent = String(appState.focusCruise.interval);
                const cb = document.getElementById('focusCruiseEnabled');
                if (cb) cb.checked = appState.focusCruise.enabled;
                const intInput = document.getElementById('focusCruiseIntervalInput');
                if (intInput) intInput.value = String(appState.focusCruise.interval);
            };

            hud.addEventListener('click', (e) => {
                if (e.target === intervalVal) return;
                appState.focusCruise.enabled = !appState.focusCruise.enabled;
                if (appState.focusCruise.enabled) {
                    appState.focusCruise.lastSwitchTime = performance.now();
                } else {
                    appState.focusCruise.currentSpotlightIndices.clear();
                }
                updateHudUI();
                appState.needsRender = true;
                this.showToast(appState.focusCruise.enabled ? `✨ 局部巡航模式已开启 (${appState.focusCruise.interval}s/轮)` : '⏹️ 局部巡航模式已关闭');
                schedulePersist();
            });

            intervalVal.addEventListener('click', (e) => {
                e.stopPropagation();
                const current = appState.focusCruise.interval;
                const input = prompt('请输入局部巡航轮换周期(秒):', String(current));
                if (input !== null) {
                    const sec = parseInt(input, 10);
                    if (!isNaN(sec) && sec >= 5 && sec <= 600) {
                        appState.focusCruise.interval = sec;
                        appState.focusCruise.lastSwitchTime = performance.now();
                        updateHudUI();
                        this.showToast(`⏱️ 巡航周期已修改为: ${sec} 秒`);
                        schedulePersist();
                    } else {
                        alert('请输入 5 到 600 之间的秒数');
                    }
                }
            });

            updateHudUI();
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
                    font-size: 1rem; font-weight: 700; letter-spacing: 0.5px;
                    box-shadow: 0 8px 30px rgba(0, 240, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25);
                    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
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
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 150]);
            setTimeout(() => { toast.classList.remove('show'); }, 3500);
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

            // 1. 旋转速度双向绑定
            bindSync('rotationSpeed', 'rotationSpeedInput', (v) => {
                appState.actualDisplayRotationSpeed = safeParseFloat(v, 1.0) * appState.currentRotationSpeedBase;
                appState.needsRender = true;
            });
            document.getElementById('rotationModelSelect')?.addEventListener('change', (e) => {
                appState.rotationModel = e.target.value;
                appState.needsRender = true;
                schedulePersist();
            });

            // 卡片自转速度与开关
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

            // 旋转轴控制 (X/Y/Z)
            ['rotateX', 'rotateY', 'rotateZ'].forEach(axisId => {
                document.getElementById(axisId)?.addEventListener('change', () => {
                    this.refreshRuntimeCache();
                    appState.needsRender = true;
                    schedulePersist();
                });
            });

            // 擒拿加速开关
            document.getElementById('grappleEnabled')?.addEventListener('change', (e) => {
                appState.rt.grappleEnabled = e.target.checked;
                schedulePersist();
            });

            // 每批显示数量
            document.getElementById('batchSize')?.addEventListener('change', (e) => {
                const newSize = safeParseInt(e.target.value, 500);
                if (newSize > 0) {
                    appState.batchSize = newSize;
                    appState.currentBatchIndex = 0;
                    this.displayCurrentBatch();
                    schedulePersist();
                }
            });

            // 局部焦点巡航设置监听
            document.getElementById('focusCruiseEnabled')?.addEventListener('change', (e) => {
                appState.focusCruise.enabled = e.target.checked;
                if (!e.target.checked) appState.focusCruise.currentSpotlightIndices.clear();
                else appState.focusCruise.lastSwitchTime = performance.now();
                const hud = document.getElementById('focusCruiseHud');
                if (hud) hud.classList.toggle('disabled', !e.target.checked);
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('focusCruiseIntervalInput')?.addEventListener('change', (e) => {
                const sec = parseInt(e.target.value, 10);
                if (!isNaN(sec) && sec >= 5 && sec <= 600) {
                    appState.focusCruise.interval = sec;
                    appState.focusCruise.lastSwitchTime = performance.now();
                    const valEl = document.getElementById('focusCruiseIntervalVal');
                    if (valEl) valEl.textContent = String(sec);
                    schedulePersist();
                }
            });

            // 2. 核心球体设置实时响应
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

            // 3. 视觉增强系统 (Vortex & Bloom)
            document.getElementById('visualEffectsEnabled')?.addEventListener('change', (e) => {
                appState.rt.visualFxEnabled = e.target.checked;
                AppParticles.updateVisualEffects();
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('vortexRotationModelSelect')?.addEventListener('change', (e) => {
                appState.rt.vortexModel = e.target.value;
                appState.needsRender = true;
                schedulePersist();
            });

            ['vortexParticleCount', 'vortexTightness'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const updateFn = () => {
                    AppParticles.initVortex();
                    appState.needsRender = true;
                    schedulePersist();
                };
                el.addEventListener('input', updateFn);
                el.addEventListener('change', updateFn);
            });

            ['vortexColor', 'vortexSize'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const updateFn = () => {
                    AppParticles.updateVisualEffects();
                    appState.needsRender = true;
                    schedulePersist();
                };
                el.addEventListener('input', updateFn);
                el.addEventListener('change', updateFn);
            });

            bindSync('vortexSpeed', 'vortexSpeedInput', (v) => {
                appState.rt.vortexSpeed = safeParseFloat(v, 0.02);
                appState.needsRender = true;
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

            // 4. 动态背景设置
            ['dynamicBgHueStart', 'dynamicBgHueEnd', 'dynamicBgLightness'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => {
                    AppParticles.updateDynamicBackgroundCSS();
                    appState.needsRender = true;
                    schedulePersist();
                });
            });

            document.getElementById('dynamicBgParticleCount')?.addEventListener('change', () => {
                AppParticles.initDynamicBackground();
                appState.needsRender = true;
                schedulePersist();
            });

            document.getElementById('dynamicBgParticleSpeed')?.addEventListener('input', (e) => {
                appState.rt.particleSpeed = safeParseFloat(e.target.value, 1);
                appState.needsRender = true;
                schedulePersist();
            });

            // 5. 星空背景设置
            ['starfieldEnabled', 'starCount', 'starColor', 'starSize', 'starVelocityFactor', 'starDensityFalloff', 'starMinAlpha', 'starMaxAlpha', 'starTwinkleSpeed'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const updateFn = () => {
                    AppParticles.initStarfield();
                    appState.needsRender = true;
                    schedulePersist();
                };
                el.addEventListener('input', updateFn);
                el.addEventListener('change', updateFn);
            });

            // 6. 灯光与补光系统设置
            ['hemiSkyColor', 'hemiGroundColor', 'hemiIntensity'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('input', () => {
                    AppScene.updateHemiLightSettings();
                    schedulePersist();
                });
            });

            ['rect1Color', 'rect1Intensity'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => {
                    AppScene.updateRectAreaLight1Settings();
                    schedulePersist();
                });
            });

            ['rect2Color', 'rect2Intensity'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => {
                    AppScene.updateRectAreaLight2Settings();
                    schedulePersist();
                });
            });

            ['directionalLight2Color', 'directionalLight2Intensity', 'directionalLight2PosX', 'directionalLight2PosY', 'directionalLight2PosZ'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => {
                    AppScene.updateDirectionalLight2Settings();
                    schedulePersist();
                });
            });

            // 7. 棚镜漫反射光源
            ['studioLightEnabled', 'studioLightDragActive', 'studioLightHelperVisible'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', () => {
                    if (id === 'studioLightDragActive') {
                        appState.studioLightDragActive = document.getElementById('studioLightDragActive').checked;
                        appState.controls.enabled = !appState.studioLightDragActive;
                    }
                    AppScene.updateStudioLightSettings();
                    schedulePersist();
                });
            });
            ['studioLightColor', 'studioLightIntensity', 'studioLightAngle'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => {
                    AppScene.updateStudioLightSettings();
                    schedulePersist();
                });
            });

            // 8. 自定义聚光灯与轨道
            ['customLightEnabled', 'customLightHelperVisible'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', () => {
                    AppScene.updateCustomLightSettings();
                    schedulePersist();
                });
            });

            ['customLightColor', 'customLightIntensity', 'customLightDistance', 'customLightAngle', 'customLightPenumbra',
             'customLightSourcePosX', 'customLightSourcePosY', 'customLightSourcePosZ',
             'customLightTargetPosX', 'customLightTargetPosY', 'customLightTargetPosZ'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => {
                    AppScene.updateCustomLightSettings();
                    schedulePersist();
                });
            });

            document.getElementById('guidelineSelect')?.addEventListener('change', (e) => {
                AppScene.setActiveGuideline(e.target.value);
                schedulePersist();
            });
            document.getElementById('guidelineRadius')?.addEventListener('input', () => {
                AppScene.updateGuidelineRadius();
                schedulePersist();
            });
            document.getElementById('guidelinePosition')?.addEventListener('input', () => {
                AppScene.updateLightOnGuideline();
                schedulePersist();
            });

            // 9. 卡片外观重绘响应
            const redrawProps = [
                'sphereCardFontColor', 'sphereCardFontFamily', 'sphereCardBgOpacity', 'sphereCardEmissiveColor',
                'sphereCardEmissiveIntensityFactor', 'sphereCardSideColor', 'sphereCardFontSizeFactorOverall',
                'sphereCardFontSizeFactorCloseUp', 'stormWordCardStyleEnabled', 'stormWordCardBgColor',
                'stormWordCardBgOpacity', 'stormWordCardFontColor', 'stormWordCardSideColor', 'stormWordCardEmissiveColor'
            ];
            redrawProps.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const evt = (el.type === 'range' || el.type === 'color') ? 'input' : 'change';
                el.addEventListener(evt, () => {
                    this.applyAppearanceSettings();
                    scheduleSphereRebuild();
                    schedulePersist();
                });
            });

            bindSync('defaultBrightnessOnLoad', 'defaultBrightnessOnLoadInput', (v) => {
                const mult = document.getElementById('sphereCardBaseColorMultiplier');
                if (mult) mult.value = v;
                scheduleSphereRebuild();
            });

            document.getElementById('sphereCardBaseColorMultiplier')?.addEventListener('input', () => {
                scheduleSphereRebuild();
                schedulePersist();
            });

            // 10. 悬浮大卡片样式调节
            ['hoverOverlayCardScale', 'hoverCardBrightness', 'hoverCardEmissiveColor', 'hoverCardGlowFrequency',
             'hoverAppendedBgColor', 'hoverAppendedBgOpacity', 'hoverAppendedFontColor', 'hoverAppendedFontSize',
             'hoverCardTextMainWordColor', 'hoverCardTextLabelColor', 'hoverCardTextValueColor',
             'hoverCardTextGlowColor', 'hoverCardTextGlowIntensity'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('input', () => {
                    this.applyAppearanceSettings();
                    if (appState.hoveredObject && appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                        this.triggerCardDisplay(appState.hoveredObject);
                    }
                    schedulePersist();
                });
            });
        },

        applyAppearanceSettings() {
            const root = document.documentElement.style;
            const getVal = (id, fallback = '') => document.getElementById(id)?.value || fallback;

            root.setProperty('--sphere-card-font-color', getVal('sphereCardFontColor', '#ffffff'));
            root.setProperty('--sphere-card-font-family', getVal('sphereCardFontFamily', "'Microsoft YaHei', sans-serif"));
            root.setProperty('--sphere-card-bg-opacity', getVal('sphereCardBgOpacity', '0.8'));
            root.setProperty('--sphere-card-emissive-color', getVal('sphereCardEmissiveColor', '#00b8ff'));
            root.setProperty('--sphere-card-emissive-intensity-factor', getVal('sphereCardEmissiveIntensityFactor', '1.0'));
            root.setProperty('--sphere-card-base-color-multiplier', getVal('sphereCardBaseColorMultiplier', '1.0'));
            root.setProperty('--sphere-card-side-color', getVal('sphereCardSideColor', '#1f3568'));
            root.setProperty('--storm-word-card-bg-color', getVal('stormWordCardBgColor', '#FFCC20'));
            root.setProperty('--hover-appended-bg-color', getVal('hoverAppendedBgColor', '#0A1E46'));
            root.setProperty('--hover-appended-bg-opacity', getVal('hoverAppendedBgOpacity', '0.75'));
            root.setProperty('--hover-appended-font-color', getVal('hoverAppendedFontColor', '#D0E8FF'));
            root.setProperty('--hover-appended-font-size', `${getVal('hoverAppendedFontSize', '12')}px`);

            this.refreshRuntimeCache();
            appState.needsRender = true;
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

            const vs = document.getElementById('vortexSpeed');
            if (vs) rt.vortexSpeed = safeParseFloat(vs.value, 0.02);

            const vm = document.getElementById('vortexRotationModelSelect');
            if (vm) rt.vortexModel = vm.value || 'linear';

            const hbo = document.getElementById('hoverAppendedBgOpacity');
            if (hbo) rt.hoverBgOpacity = safeParseFloat(hbo.value, 0.75);

            const gf = document.getElementById('hoverCardGlowFrequency');
            if (gf) rt.glowFrequency = safeParseFloat(gf.value, 1.0);

            const fOverall = document.getElementById('sphereCardFontSizeFactorOverall');
            if (fOverall) rt.fontSizeFactorOverall = safeParseFloat(fOverall.value, 1.0);

            const fClose = document.getElementById('sphereCardFontSizeFactorCloseUp');
            if (fClose) rt.fontSizeFactorCloseUp = safeParseFloat(fClose.value, 1.0);

            const eInt = document.getElementById('sphereCardEmissiveIntensityFactor');
            if (eInt) rt.cardEmissiveIntensity = safeParseFloat(eInt.value, 1.0);
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

            document.getElementById('showPromptTemplateBtn')?.addEventListener('click', () => this.showAIPromptModal());

            document.getElementById('filterBtn')?.addEventListener('click', () => this.showModeAndFilterModal());
            document.getElementById('applyFilterBtn')?.addEventListener('click', () => this.applyFiltersAndDisplay());
            document.getElementById('closeFilterModalBtn')?.addEventListener('click', () => {
                document.getElementById('filterModalBackdrop')?.classList.remove('visible');
            });
            document.getElementById('closeFilterModalTopBtn')?.addEventListener('click', () => {
                document.getElementById('filterModalBackdrop')?.classList.remove('visible');
            });

            document.getElementById('clearShieldedBtn')?.addEventListener('click', () => {
                if (appState.shieldedWords.size === 0) {
                    alert('当前屏蔽词库为空。');
                    return;
                }
                if (confirm(`确定要彻底清空屏蔽词库 (${appState.shieldedWords.size} 个词) 吗？这会恢复所有的单词卡片。`)) {
                    appState.shieldedWords.clear();
                    AppStorage.saveShieldedWords(appState.shieldedWords);
                    location.reload();
                }
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
                this.applyAppearanceSettings();
                scheduleSphereRebuild();
                schedulePersist();
            });

            document.getElementById('randomShuffleBtn')?.addEventListener('click', () => {
                const list = appState.isWordStormActive ? appState.wordStormProcessedWords : appState.filteredWords;
                if (!list || !list.length) return;
                appState.currentBatchWords = [...list].sort(() => Math.random() - 0.5).slice(0, appState.batchSize);
                AppSphereEngine.createWordSphere(appState.currentBatchWords);
                if (navigator.vibrate) navigator.vibrate(40);
                this.showToast('🎲 已手动随机更换球面卡片');
            });

            // 侧栏放大缩小按钮事件响应
            document.getElementById('zoomInBtn')?.addEventListener('click', () => {
                AppScene.zoomSphere(0.85);
            });
            document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
                AppScene.zoomSphere(1.15);
            });

            // 侧栏局部焦点巡航模式开关
            document.getElementById('focusCruiseToggleBtn')?.addEventListener('click', () => {
                appState.focusCruise.enabled = !appState.focusCruise.enabled;
                if (!appState.focusCruise.enabled) {
                    appState.focusCruise.currentSpotlightIndices.clear();
                } else {
                    appState.focusCruise.lastSwitchTime = performance.now();
                }
                const hud = document.getElementById('focusCruiseHud');
                if (hud) hud.classList.toggle('disabled', !appState.focusCruise.enabled);
                const cb = document.getElementById('focusCruiseEnabled');
                if (cb) cb.checked = appState.focusCruise.enabled;
                appState.needsRender = true;
                this.showToast(appState.focusCruise.enabled ? `✨ 局部巡航模式已开启 (${appState.focusCruise.interval}s/轮)` : '⏹️ 局部巡航模式已关闭');
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
            document.getElementById('detailFontDownBtn')?.addEventListener('click', () => {
                fontScale = Math.max(0.7, fontScale - 0.1);
                document.documentElement.style.setProperty('--detail-panel-font-scale', fontScale);
            });
            document.getElementById('detailFontUpBtn')?.addEventListener('click', () => {
                fontScale = Math.min(1.6, fontScale + 0.1);
                document.documentElement.style.setProperty('--detail-panel-font-scale', fontScale);
            });
            document.getElementById('togglePanelSideBtn')?.addEventListener('click', () => {
                document.getElementById('immersiveDetailPanel')?.classList.toggle('left-aligned');
                this.adjustSphereViewForPanel();
            });
            document.getElementById('speakDetailWordBtn')?.addEventListener('click', () => {
                if (appState.currentDetailWord?.words) AppAudio.speakWord(appState.currentDetailWord.words);
            });
            document.getElementById('shieldSingleWordBtn')?.addEventListener('click', () => {
                if (!appState.currentDetailWord) return;
                const key = getWordKey(appState.currentDetailWord);
                if (confirm(`确定要将单词 "${appState.currentDetailWord.words}" 移入屏蔽词库吗？`)) {
                    appState.shieldedWords.add(key);
                    AppStorage.saveShieldedWords(appState.shieldedWords);
                    appState.allWords = appState.allWords.filter(w => getWordKey(w) !== key);
                    appState.filteredWords = appState.filteredWords.filter(w => getWordKey(w) !== key);
                    this.displayCurrentBatch();
                    this.updateClearShieldedBtnLabel();
                    this.hideImmersiveDetailPanel();
                    this.updateStats();
                }
            });

            document.getElementById('viewsBtn')?.addEventListener('click', () => this.toggleManagementPanel('views'));
            document.getElementById('wordBanksBtn')?.addEventListener('click', () => this.toggleManagementPanel('wordBanks'));
            document.getElementById('rotationsBtn')?.addEventListener('click', () => this.toggleManagementPanel('rotations'));
            document.getElementById('hoverPosBtn')?.addEventListener('click', () => this.toggleManagementPanel('hoverPositions'));

            this.bindSystemViewButton(document.getElementById('viewInsideBtn'), 'inside');
            this.bindSystemViewButton(document.getElementById('viewSurfaceBtn'), 'surface');
            this.bindSystemViewButton(document.getElementById('viewOverallBtn'), 'overall');

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
            document.getElementById('detailSearchInput')?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.performAndDisplaySearch(e.target.value.trim());
                }
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
                alert('解析失败，请检查是否为标准 JSON 数组格式。\n错误信息: ' + e.message);
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
                APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY,
                '3DWordUniverseSystemViewsV8',
                APP_CONFIG.CUSTOM_WORDBANKS_STORAGE_KEY,
                APP_CONFIG.CUSTOM_ROTATIONS_STORAGE_KEY,
                APP_CONFIG.CUSTOM_HOVER_POSITIONS_STORAGE_KEY
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
                        alert('系统设置导入成功，页面即将自动刷新！');
                        location.reload();
                    } catch (err) {
                        alert('设置文件格式解析失败: ' + err.message);
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

        showAIPromptModal() {
            const promptText = `你是一个专业的英语词典编纂专家。请帮我生成一个完美的 JSON 单词数据包。
数据包格式规范：
1. 根节点必须是一个标准的 JSON 数组 [ ... ]。
2. 数据应当包含联想记忆方法（method）。
请严格按照以下 JSON 模板生成：
[
  {
    "num": "collins_1",
    "words": "example",
    "phonetic": "/ɪɡˈzɑːmpl/",
    "chinese": "n. 例子，范例，样本；榜样",
    "part_of_speech": "noun",
    "root_form": "ex- (out) + emere (take)",
    "method": "【联想记忆法】ex(出)+ample(大量) -> 拿出大量有代表性的东西 -> 例子",
    "grade": "高中/CET4",
    "term": "1",
    "unit": "Unit 2",
    "Source": "高级词典"
  }
]`;
            navigator.clipboard.writeText(promptText).then(() => {
                alert('AI 字典生成提示词模板已成功复制到剪贴板！可以直接发送给 AI 生成标准词库。');
            }).catch(() => {
                prompt('复制以下提示词模板发送给 AI：', promptText);
            });
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
            panel.innerHTML = `
                <div class="panel-header">
                    ${panelType === 'views' ? '视角预设' : panelType === 'wordBanks' ? '词库管理' : panelType === 'rotations' ? '自转速度' : '悬浮位置'}
                    <button class="panel-header-close-btn" onclick="document.getElementById('managementPanel').classList.add('hidden')">&times;</button>
                </div>
                <div style="padding:10px; color:#a2d8ff; font-size:0.9rem; text-align:center;">
                    当前项目在移动端和电脑端均支持全方位预设与数据热更新。
                </div>
            `;
        },

        initStudyLog() {
            const counterHud = document.getElementById('studyCounterHud');
            const settleModal = document.getElementById('studySettleModalBackdrop');
            if (counterHud && settleModal) {
                counterHud.onclick = () => {
                    this.renderStudySettlement();
                    settleModal.classList.add('visible');
                };
            }
            document.getElementById('closeStudySettleBtn')?.addEventListener('click', () => {
                settleModal?.classList.remove('visible');
            });
            document.getElementById('openCompareBtn')?.addEventListener('click', () => {
                settleModal?.classList.remove('visible');
                document.getElementById('studyCompareModalBackdrop')?.classList.add('visible');
            });
            document.getElementById('closeStudyCompareBtn')?.addEventListener('click', () => {
                document.getElementById('studyCompareModalBackdrop')?.classList.remove('visible');
            });
            document.getElementById('closeStudyCompareBtn2')?.addEventListener('click', () => {
                document.getElementById('studyCompareModalBackdrop')?.classList.remove('visible');
            });

            document.getElementById('studyGoalValue')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const cur = AppStorage.getStudyGoal();
                const input = prompt('请输入每日复习目标单词数:', String(cur));
                if (input !== null) {
                    const n = parseInt(input, 10);
                    if (!isNaN(n) && n > 0) {
                        AppStorage.setStudyGoal(n);
                        document.getElementById('studyGoalValue').textContent = String(n);
                        this.showToast(`🎯 今日学习目标已更新为: ${n} 个单词`);
                    }
                }
            });
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

        initMobileTouchHandlers() {
            const container = document.getElementById('wordSphere');
            if (!container) return;

            let downTime = 0;
            let downPos = new THREE.Vector2();
            let isMoving = false;
            let lastTapTime = 0;

            container.addEventListener('pointerdown', (e) => {
                downTime = performance.now();
                downPos.set(e.clientX, e.clientY);
                isMoving = false;
            });

            container.addEventListener('pointermove', (e) => {
                if (downPos.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > 8) {
                    isMoving = true;
                }
            });

            container.addEventListener('pointerup', (e) => {
                const dist = downPos.distanceTo(new THREE.Vector2(e.clientX, e.clientY));
                const duration = performance.now() - downTime;

                if (dist < 8 && duration < 400 && !isMoving) {
                    const now = performance.now();
                    const isDoubleTap = (now - lastTapTime < 350);
                    lastTapTime = now;

                    if (isDoubleTap) {
                        const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
                        const raycaster = new THREE.Raycaster();
                        raycaster.setFromCamera(mouse, appState.camera);
                        const hits = raycaster.intersectObjects(appState.wordObjects, false);
                        if (hits.length === 0) {
                            AppSphereEngine.triggerManualGrapple();
                            return;
                        }
                    }
                    this.handleQuickTap(e);
                }
            });
        },

        handleQuickTap(e) {
            if (!appState.camera) return;
            const rect = document.getElementById('wordSphere').getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, appState.camera);

            if (appState.hoverOverlayCard && appState.hoverOverlayCard.visible) {
                const screenMesh = appState.hoverOverlayCard.userData.refs?.screen;
                const hits = raycaster.intersectObjects([appState.hoverOverlayCard], true);
                const screenHit = hits.find(h => h.object === screenMesh);

                if (screenHit && screenHit.uv) {
                    const uv = screenHit.uv;
                    const tex = screenMesh.material.map;
                    if (tex && tex.image) {
                        const clickX = uv.x * tex.image.width;
                        const clickY = (1 - uv.y) * tex.image.height;
                        const word = appState.hoveredObject?.userData.word;

                        if (word && word.hover_click_zones) {
                            for (const zone of word.hover_click_zones) {
                                if (clickX >= zone.xMin && clickX <= zone.xMax && clickY >= zone.yMin && clickY <= zone.yMax) {
                                    if (zone.type === 'word') {
                                        AppAudio.speakWord(word.words, 1);
                                    } else if (zone.type === 'fontSizeDown') {
                                        let s = parseFloat(document.getElementById('hoverOverlayCardScale').value);
                                        s = Math.max(0.5, s - 0.1);
                                        document.getElementById('hoverOverlayCardScale').value = s;
                                        document.getElementById('hoverOverlayCardScaleOutput').textContent = s.toFixed(2);
                                        this.triggerCardDisplay(appState.hoveredObject);
                                    } else if (zone.type === 'fontSizeUp') {
                                        let s = parseFloat(document.getElementById('hoverOverlayCardScale').value);
                                        s = Math.min(2.5, s + 0.1);
                                        document.getElementById('hoverOverlayCardScale').value = s;
                                        document.getElementById('hoverOverlayCardScaleOutput').textContent = s.toFixed(2);
                                        this.triggerCardDisplay(appState.hoveredObject);
                                    } else if (zone.type === 'shield') {
                                        const key = getWordKey(word);
                                        appState.shieldedWords.add(key);
                                        AppStorage.saveShieldedWords(appState.shieldedWords);
                                        appState.allWords = appState.allWords.filter(w => getWordKey(w) !== key);
                                        appState.filteredWords = appState.filteredWords.filter(w => getWordKey(w) !== key);
                                        this.displayCurrentBatch();
                                        this.updateClearShieldedBtnLabel();
                                        this.updateStats();
                                        appState.hoverOverlayCard.visible = false;
                                    }
                                    appState.needsRender = true;
                                    return;
                                }
                            }
                        }
                    }
                }
            }

            const cardHits = raycaster.intersectObjects(appState.wordObjects, false);
            if (cardHits.length > 0) {
                const card = cardHits[0].object;
                this.triggerCardDisplay(card);

                // 核心复习计数与达标庆祝通知联动
                const result = AppStorage.recordStudyClick(card.userData.word);
                this.updateStudyCounterDisplay();
                if (result.justReached) {
                    this.triggerDailyGoalAchievedToast();
                }
            } else {
                if (appState.hoverOverlayCard) {
                    appState.overlayCardTargetOpacity = 0;
                }
            }
            appState.needsRender = true;
        },

        triggerCardDisplay(card) {
            if (!card) return;
            const word = card.userData.word;
            appState.hoveredObject = card;

            const { texture, pxWidth, pxHeight } = AppCardFactory.createOverlayTexture(word);
            const screen = appState.hoverOverlayCard.userData.refs.screen;
            if (screen.material.map) screen.material.map.dispose();
            screen.material.map = texture;
            screen.material.needsUpdate = true;

            appState.hoverOverlayCard.visible = true;
            appState.overlayCardTargetOpacity = 1;

            const scaleInput = document.getElementById('hoverOverlayCardScale');
            const scaleVal = safeParseFloat(scaleInput ? scaleInput.value : 1.0, 1.0);
            const aspect = pxWidth / pxHeight;
            const targetW = 28 * scaleVal;
            const targetH = targetW / aspect;

            appState.overlayCardTargetScale.set(targetW, targetH, 1);
            const camDir = new THREE.Vector3().setFromMatrixColumn(appState.camera.matrix, 2).multiplyScalar(-1);
            appState.overlayCardTargetPosition.copy(appState.camera.position).addScaledVector(camDir, 40);

            if (word && word.words) {
                AppAudio.speakWord(word.words, 1);
            }
            appState.needsRender = true;
        },

        showImmersiveDetailPanel(word) {
            if (!word) return;
            appState.currentDetailWord = word;

            // 详情展开同样计入有效复习，并同步检测目标达成
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

        updateStudyCounterDisplay() {
            const valEl = document.getElementById('studyCounterValue');
            const goalEl = document.getElementById('studyGoalValue');
            if (valEl) {
                valEl.textContent = String(AppStorage.getTodayStudiedCount());
            }
            if (goalEl) {
                goalEl.textContent = String(AppStorage.getStudyGoal());
            }
        },

        updateClearShieldedBtnLabel() {
            const btn = document.getElementById('clearShieldedBtn');
            if (btn) btn.textContent = `清除屏蔽词库 (${appState.shieldedWords.size})`;
        },

        exitBatchShieldMode() {
            appState.batchShieldMode = false;
            appState.selectedShieldWords.clear();
            document.getElementById('batchShieldHUD')?.classList.add('hidden');
            appState.wordObjects.forEach(card => {
                card.material = card.userData.originalMaterials;
            });
            appState.needsRender = true;
        },

        updateHelpModal() {
            const hc = document.querySelector('#helpModalBackdrop .help-content');
            if (hc) {
                hc.innerHTML = `
                    <p><strong>3D 单词宇宙 (V8 极致性能版)</strong></p>
                    <p>这是一个完全沉浸式的 3D 词汇学习平台，支持本地全量离线运行。</p>
                    <h4>操作说明</h4>
                    <ul>
                        <li><strong>拖拽旋转：</strong>滑动或鼠标拖拽自由旋转球体。</li>
                        <li><strong>双击空白：</strong>触发瞬间加速（手动擒拿）。</li>
                        <li><strong>点击卡片：</strong>显示 3D 发音弹窗与详细释义。</li>
                        <li><strong>放大/缩小卡片：</strong>使用侧栏 <code>➕ / ➖</code> 自由缩放卡片大小。</li>
                        <li><strong>局部焦点巡航：</strong>保持绝大多数卡片尺寸不变，仅抽取少量卡片单独放大 1.5 倍方便识读。</li>
                    </ul>
                `;
            }
        },

        bindSystemViewButton(btn, key) {
            if (!btn) return;
            btn.addEventListener('click', () => {
                if (key === 'inside') {
                    appState.camera.position.set(0, 0, 0.1);
                    appState.controls.target.set(0, 0, (appState.sphereRadius || 85) * 2.3);
                } else if (key === 'surface') {
                    appState.camera.position.set(0, 0, (appState.sphereRadius || 85) + 19);
                    appState.controls.target.set(0, 0, 0);
                } else {
                    appState.camera.position.set(0, 0, 165);
                    appState.controls.target.set(0, 0, 0);
                }
                appState.controls.update();
                appState.needsRender = true;
            });
        },

        initSystemViews() {
            const r = appState.sphereRadius || 85;
            appState.systemViews = {
                'system_inside': { cameraPos: [0, 0, 0.1], controlsTarget: [0, 0, r * 2.3] },
                'system_surface': { cameraPos: [0, 0, r + 19], controlsTarget: [0, 0, 0] },
                'system_overall': { cameraPos: [0, 0, 165], controlsTarget: [0, 0, 0] }
            };
        },

        loadCustomViews() {
            const s = localStorage.getItem(APP_CONFIG.CUSTOM_VIEWS_STORAGE_KEY);
            if (s) appState.customViews = safeJSONParse(s, []);
        },

        loadCustomWordBanks() {
            const s = localStorage.getItem(APP_CONFIG.CUSTOM_WORDBANKS_STORAGE_KEY);
            if (s) appState.customWordBanks = safeJSONParse(s, []);
        },

        loadCustomRotations() {
            const s = localStorage.getItem(APP_CONFIG.CUSTOM_ROTATIONS_STORAGE_KEY);
            if (s) appState.customRotations = safeJSONParse(s, []);
        },

        loadCustomHoverPositions() {
            const s = localStorage.getItem(APP_CONFIG.CUSTOM_HOVER_POSITIONS_STORAGE_KEY);
            if (s) appState.customHoverPositions = safeJSONParse(s, []);
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
                if (s.focusCruise !== undefined && typeof s.focusCruise === 'object') {
                    appState.focusCruise.enabled = !!s.focusCruise.enabled;
                    appState.focusCruise.interval = s.focusCruise.interval || 50;
                    const hud = document.getElementById('focusCruiseHud');
                    const valEl = document.getElementById('focusCruiseIntervalVal');
                    if (hud) hud.classList.toggle('disabled', !appState.focusCruise.enabled);
                    if (valEl) valEl.textContent = String(appState.focusCruise.interval);
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
            const settings = {
                cardStyleId: appState.currentCardStyleId,
                batchSize: appState.batchSize,
                showEnglish: appState.showEnglish,
                cardScaleMultiplier: appState.cardScaleMultiplier,
                focusCruise: {
                    enabled: appState.focusCruise.enabled,
                    interval: appState.focusCruise.interval
                }
            };
            localStorage.setItem(APP_CONFIG.SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        },

        loadSettings() {
            const raw = localStorage.getItem(APP_CONFIG.SETTINGS_STORAGE_KEY);
            if (!raw) return;
            const settings = safeJSONParse(raw, null);
            if (!settings) return;

            if (settings.focusCruise) {
                appState.focusCruise.enabled = settings.focusCruise.enabled !== undefined ? settings.focusCruise.enabled : true;
                appState.focusCruise.interval = settings.focusCruise.interval || 50;
            }

            if (settings.cardScaleMultiplier) {
                appState.cardScaleMultiplier = settings.cardScaleMultiplier;
            }

            if (settings.showEnglish !== undefined) {
                appState.showEnglish = !!settings.showEnglish;
                const toggleLang = document.getElementById('toggleLanguage');
                if (toggleLang) toggleLang.textContent = appState.showEnglish ? '中' : '英';
            }

            this.applyAppearanceSettings();
            AppParticles.updateCoreSphereSettings();
            AppParticles.updateVisualEffects();
            AppParticles.updateDynamicBackgroundCSS();
            AppParticles.initStarfield();
        },

        saveLastState() {
            if (appState.isInitializing) return;
            const state = {
                currentBatchIndex: appState.currentBatchIndex,
                cameraPosition: appState.camera ? appState.camera.position.toArray() : [0, 0, 165],
                controlsTarget: appState.controls ? appState.controls.target.toArray() : [0, 0, 0],
                showEnglish: appState.showEnglish,
                cardScaleMultiplier: appState.cardScaleMultiplier,
                focusCruise: {
                    enabled: appState.focusCruise.enabled,
                    interval: appState.focusCruise.interval
                }
            };
            localStorage.setItem(APP_CONFIG.LAST_STATE_STORAGE_KEY, JSON.stringify(state));
        }
    };

    window.AppUI = AppUI;

    window.addEventListener('DOMContentLoaded', () => {
        AppUI.init().catch(err => console.error('系统引导异常:', err));
    });
})();
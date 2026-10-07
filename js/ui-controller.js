/**
 * 3D单词宇宙 - 全局 UI 交互中枢、全功能面板、设置绑定与系统引导器
 * (IIFE 封闭作用域，杜绝全局变量污染与同名冲突)
 */
(function() {
    let fontScale = 1.0;
    let _persistTimer = null;

    function schedulePersist() {
        clearTimeout(_persistTimer);
        _persistTimer = setTimeout(() => {
            _persistTimer = null;
            AppUI.saveSettings();
            AppUI.saveLastState();
        }, 150);
    }

    const AppUI = {
        async init() {
            // 1. 初始化存储中枢（自动填入高频备用词库，防清缓存白屏变砖）
            await AppStorage.init();

            // 2. 初始化 3D 场景与音频
            AppScene.init();
            AppAudio.init();
            AppParticles.initClickBurstParticles();
            AppParticles.initCoreSphere();
            AppParticles.initStarfield();
            AppParticles.initDynamicBackground();
            AppParticles.initNebulaColors();
            AppOrbit.initGrapple();

            // 3. 构建 3D 悬浮详情大卡片骨架
            this.initPremiumHoverCard();

            // 4. 装载持久化配置并挂载所有 DOM 事件
            this.initDOMEventListeners();
            this.initSettingsAndSliders();
            this.initMobileTouchHandlers();
            this.initClock();
            this.initCardStyleSelector();

            // 5. 自动还原词库并构建 3D 球体
            await this.loadWordDataAndBoot();

            // 6. 标记准备就绪
            setTimeout(() => {
                appState.isInitializing = false;
                this.refreshRuntimeCache();
                appState.needsRender = true;
                console.log('3D 单词宇宙系统全量启动完毕！');
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
        },

        displayCurrentBatch() {
            this.hideImmersiveDetailPanel();
            appState.activeCardObject = null;
            const list = appState.isWordStormActive ? appState.wordStormProcessedWords : appState.filteredWords;

            if (!list || !list.length) {
                appState.currentBatchWords = [];
                AppOrbit.createWordSphere([]);
                this.updateBatchControls();
                this.updateStats();
                return;
            }

            const size = Math.max(1, parseInt(appState.batchSize, 10) || 1);
            const total = Math.ceil(list.length / size);
            appState.currentBatchIndex = Math.max(0, Math.min(appState.currentBatchIndex, total - 1));
            appState.currentBatchWords = list.slice(appState.currentBatchIndex * size, (appState.currentBatchIndex + 1) * size);

            AppOrbit.createWordSphere(appState.currentBatchWords);
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
                new THREE.MeshBasicMaterial({ color: 0x0a1428, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
            );
            backplate.renderOrder = 9995;
            backplate.raycast = () => {};
            group.add(backplate);

            const coreGlow = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({ color: 0x68d0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false })
            );
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

            group.renderOrder = 9999;
            group.visible = false;
            group.userData.refs = { screen, backplate, coreGlow };

            appState.hoverOverlayCard = group;
            appState.overlayCardTargetScale = new THREE.Vector3(0.001, 0.001, 0.001);
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
        },

        initCardStyleSelector() {
            const sel = document.getElementById('cardStyleSelect');
            if (!sel) return;
            sel.innerHTML = APP_CONFIG.CARD_STYLES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            sel.value = appState.currentCardStyleId;

            const updateDesc = () => {
                const desc = document.getElementById('cardStyleDesc');
                const s = APP_CONFIG.CARD_STYLES.find(x => x.id === sel.value) || APP_CONFIG.CARD_STYLES[0];
                if (desc) desc.textContent = `当前风格：${s.name} · ${s.desc}`;
            };

            sel.addEventListener('change', () => {
                appState.currentCardStyleId = sel.value;
                updateDesc();
                if (appState.currentBatchWords.length > 0) {
                    AppOrbit.createWordSphere(appState.currentBatchWords);
                }
                appState.needsRender = true;
            });
            updateDesc();
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
                            AppOrbit.triggerManualGrapple();
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

            // 1. 悬浮 3D 卡片内部按钮点击响应
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
                                    if (zone.type === 'speak' || zone.type === 'word') {
                                        AppAudio.speakWord(word.words, 1);
                                    } else if (zone.type === 'fontSizeDown') {
                                        let s = parseFloat(document.getElementById('hoverOverlayCardScale').value);
                                        s = Math.max(0.5, s - 0.15);
                                        document.getElementById('hoverOverlayCardScale').value = s;
                                        document.getElementById('hoverOverlayCardScaleOutput').textContent = s.toFixed(2);
                                        this.triggerCardDisplay(appState.hoveredObject);
                                    } else if (zone.type === 'fontSizeUp') {
                                        let s = parseFloat(document.getElementById('hoverOverlayCardScale').value);
                                        s = Math.min(2.5, s + 0.15);
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

            // 2. 拾取球面卡片
            const cardHits = raycaster.intersectObjects(appState.wordObjects, false);
            if (cardHits.length > 0) {
                const card = cardHits[0].object;
                this.triggerCardDisplay(card);
                AppStorage.recordStudyClick(card.userData.word);
                this.updateStudyCounterDisplay();
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
            addField('词性', word['part of speech']);
            addField('年级大类', word.grade);
            addField('单元', word.unit);
            addField('来源', word.Source);

            document.getElementById('immersiveDetailPanel').classList.add('visible');
            appState.rotationMultiplier = 0.0;
            appState.needsRender = true;
        },

        hideImmersiveDetailPanel() {
            const panel = document.getElementById('immersiveDetailPanel');
            if (panel) panel.classList.remove('visible');
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
            if (!valEl) return;
            const log = AppStorage.loadStudyLog();
            const day = log[getDateKey()];
            const count = (day && day.cards) ? Object.keys(day.cards).length : 0;
            valEl.textContent = String(count);
        },

        updateClearShieldedBtnLabel() {
            const btn = document.getElementById('clearShieldedBtn');
            if (btn) btn.textContent = `清除屏蔽词库 (${appState.shieldedWords.size})`;
        },

        showToast(text, duration = 1800) {
            let toast = document.getElementById('appDynamicToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'appDynamicToast';
                toast.style.cssText = `
                    position: fixed; top: 36px; left: 50%;
                    transform: translateX(-50%) translateY(-25px);
                    background: linear-gradient(135deg, rgba(16, 32, 70, 0.96), rgba(8, 18, 44, 0.96));
                    border: 1px solid rgba(0, 240, 255, 0.65); color: #eaf6ff;
                    padding: 12px 28px; border-radius: 999px; font-size: 1rem; font-weight: 700;
                    letter-spacing: 0.5px; box-shadow: 0 8px 30px rgba(0, 240, 255, 0.4);
                    backdrop-filter: blur(14px); z-index: 10002; opacity: 0; pointer-events: none;
                    transition: opacity 0.25s, transform 0.25s;
                `;
                document.body.appendChild(toast);
            }
            toast.textContent = text;
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
            clearTimeout(toast._timer);
            toast._timer = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(-20px)';
            }, duration);
        },

        refreshRuntimeCache() {
            const rt = appState.rt;
            const rx = document.getElementById('rotateX');
            const ry = document.getElementById('rotateY');
            const rz = document.getElementById('rotateZ');
            const csr = document.getElementById('cardSelfRotation');
            const grp = document.getElementById('grappleEnabled');
            const crs = document.getElementById('cardRotationSpeed');

            if (rx) rt.rotateX = rx.checked;
            if (ry) rt.rotateY = ry.checked;
            if (rz) rt.rotateZ = rz.checked;
            if (csr) rt.cardSelfRotation = csr.checked;
            if (grp) rt.grappleEnabled = grp.checked;
            if (crs) rt.cardRotationSpeed = safeParseFloat(crs.value, 0) * 0.00115;

            const ve = document.getElementById('visualEffectsEnabled');
            const vs = document.getElementById('vortexSpeed');
            const vm = document.getElementById('vortexRotationModelSelect');
            if (ve) rt.visualFxEnabled = ve.checked;
            if (vs) rt.vortexSpeed = safeParseFloat(vs.value, 0);
            if (vm) rt.vortexModel = vm.value;

            const hbo = document.getElementById('hoverAppendedBgOpacity');
            if (hbo) rt.hoverBgOpacity = safeParseFloat(hbo.value, 0.75);
        },

        initSettingsAndSliders() {
            // 滑块与数值联动监听
            const bindInputSync = (sliderId, numId, callback) => {
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

            bindInputSync('rotationSpeed', 'rotationSpeedInput', (v) => {
                appState.actualDisplayRotationSpeed = safeParseFloat(v, 1.0) * appState.currentRotationSpeedBase;
                appState.needsRender = true;
            });

            bindInputSync('defaultBrightnessOnLoad', 'defaultBrightnessOnLoadInput', (v) => {
                const mult = document.getElementById('sphereCardBaseColorMultiplier');
                if (mult) mult.value = v;
                if (appState.currentBatchWords.length > 0) AppOrbit.createWordSphere(appState.currentBatchWords);
            });

            bindInputSync('vortexSpeed', 'vortexSpeedInput', (v) => {
                appState.rt.vortexSpeed = safeParseFloat(v, 0);
            });

            // 监听所有通用设置变动
            document.querySelectorAll('#controlsOverlay input, #controlsOverlay select').forEach(input => {
                input.addEventListener('change', () => {
                    this.refreshRuntimeCache();
                    appState.needsRender = true;
                    schedulePersist();
                });
            });
        },

        initDOMEventListeners() {
            // 1. 右下角折叠控制菜单
            const masterToggle = document.getElementById('masterMenuToggleBtn');
            const viewGroup = document.getElementById('viewControlsContainer');
            if (masterToggle && viewGroup) {
                masterToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    viewGroup.classList.toggle('expanded');
                    masterToggle.textContent = viewGroup.classList.contains('expanded') ? '❌' : '🔮';
                });
                document.addEventListener('click', (e) => {
                    if (!viewGroup.contains(e.target)) {
                        viewGroup.classList.remove('expanded');
                        masterToggle.textContent = '🔮';
                    }
                });
            }

            // 2. 侧边设置开关
            document.getElementById('settingsBtn')?.addEventListener('click', () => {
                document.getElementById('controlsOverlay')?.classList.toggle('visible');
            });
            document.getElementById('closeControlsOverlayBtn')?.addEventListener('click', () => {
                document.getElementById('controlsOverlay')?.classList.remove('visible');
            });

            // 3. 基础旋转与语言切换
            document.getElementById('rotateToggle')?.addEventListener('click', () => {
                appState.autoRotate = !appState.autoRotate;
                document.getElementById('rotateToggle').textContent = appState.autoRotate ? '🔁' : '⏹️';
                appState.needsRender = true;
            });

            document.getElementById('toggleLanguage')?.addEventListener('click', () => {
                appState.showEnglish = !appState.showEnglish;
                document.getElementById('toggleLanguage').textContent = appState.showEnglish ? '中' : '英';
                appState.batchSize = appState.showEnglish ? APP_CONFIG.DEFAULT_BATCH_SIZE_EN : APP_CONFIG.DEFAULT_BATCH_SIZE_CN;
                this.displayCurrentBatch();
            });

            // 4. 随机卡片乱序
            document.getElementById('randomShuffleBtn')?.addEventListener('click', () => {
                const list = appState.isWordStormActive ? appState.wordStormProcessedWords : appState.filteredWords;
                if (!list || !list.length) return;
                appState.currentBatchWords = [...list].sort(() => Math.random() - 0.5).slice(0, appState.batchSize);
                AppOrbit.createWordSphere(appState.currentBatchWords);
                if (navigator.vibrate) navigator.vibrate(40);
            });

            // 5. 批次翻页
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

            // 6. 详情面板与字号缩放
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

            // 7. 语音播放
            document.getElementById('speakDetailWordBtn')?.addEventListener('click', () => {
                if (appState.currentDetailWord?.words) AppAudio.speakWord(appState.currentDetailWord.words);
            });

            // 8. 屏蔽与清空屏蔽
            document.getElementById('shieldSingleWordBtn')?.addEventListener('click', () => {
                if (!appState.currentDetailWord) return;
                const key = getWordKey(appState.currentDetailWord);
                if (confirm(`确定要将单词 "${appState.currentDetailWord.words}" 移入屏蔽库吗？`)) {
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

            document.getElementById('clearShieldedBtn')?.addEventListener('click', () => {
                if (appState.shieldedWords.size === 0) {
                    alert('当前屏蔽词库为空。');
                    return;
                }
                if (confirm('确定要清空屏蔽词库并恢复所有词汇吗？')) {
                    appState.shieldedWords.clear();
                    AppStorage.saveShieldedWords(appState.shieldedWords);
                    location.reload();
                }
            });

            // 9. 布局流按钮组
            document.getElementById('layoutTopRowBtn')?.addEventListener('click', () => AppOrbit.arrangeCardsInLayout('top_row'));
            document.getElementById('layoutCenterRowBtn')?.addEventListener('click', () => AppOrbit.arrangeCardsInLayout('center_row'));
            document.getElementById('layoutBottomRowBtn')?.addEventListener('click', () => AppOrbit.arrangeCardsInLayout('bottom_row'));
            document.getElementById('layoutLeftColBtn')?.addEventListener('click', () => AppOrbit.arrangeCardsInLayout('left_col'));
            document.getElementById('layoutRightColBtn')?.addEventListener('click', () => AppOrbit.arrangeCardsInLayout('right_col'));

            // 10. 视角预设快捷
            document.getElementById('viewInsideBtn')?.addEventListener('click', () => {
                appState.camera.position.set(0, 0, 0.1);
                appState.controls.target.set(0, 0, (appState.sphereRadius || 85) * 2.3);
                appState.controls.update();
                appState.needsRender = true;
            });
            document.getElementById('viewSurfaceBtn')?.addEventListener('click', () => {
                appState.camera.position.set(0, 0, (appState.sphereRadius || 85) + 19);
                appState.controls.target.set(0, 0, 0);
                appState.controls.update();
                appState.needsRender = true;
            });
            document.getElementById('viewOverallBtn')?.addEventListener('click', () => {
                appState.camera.position.set(0, 0, 165);
                appState.controls.target.set(0, 0, 0);
                appState.controls.update();
                appState.needsRender = true;
            });

            // 11. 帮助与提示模态窗
            document.getElementById('helpBtn')?.addEventListener('click', () => {
                document.getElementById('helpModalBackdrop')?.classList.add('visible');
            });
            document.getElementById('closeHelpModalBtn')?.addEventListener('click', () => {
                document.getElementById('helpModalBackdrop')?.classList.remove('visible');
            });

            // 12. 键盘快捷键
            document.addEventListener('keydown', (e) => {
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                if (e.key === 'Escape') {
                    this.hideImmersiveDetailPanel();
                    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('visible'));
                } else if (e.key === ' ') {
                    e.preventDefault();
                    document.getElementById('rotateToggle')?.click();
                }
            });

            this.updateStudyCounterDisplay();
        },

        saveSettings() {
            if (appState.isInitializing) return;
            const settings = {
                cardStyleId: appState.currentCardStyleId,
                batchSize: appState.batchSize,
                showEnglish: appState.showEnglish
            };
            localStorage.setItem(APP_CONFIG.SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        },

        saveLastState() {
            if (appState.isInitializing) return;
            const state = {
                currentBatchIndex: appState.currentBatchIndex,
                cameraPosition: appState.camera ? appState.camera.position.toArray() : [0, 0, 165],
                controlsTarget: appState.controls ? appState.controls.target.toArray() : [0, 0, 0]
            };
            localStorage.setItem(APP_CONFIG.LAST_STATE_STORAGE_KEY, JSON.stringify(state));
        }
    };

    window.AppUI = AppUI;

    // 页面加载完毕安全引导
    window.addEventListener('DOMContentLoaded', () => {
        AppUI.init().catch(err => console.error('系统引导异常:', err));
    });
})();
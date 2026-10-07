/**
 * 3D单词宇宙 - 全功能 UI 交互控制器与启动总装中枢
 * 彻底恢复所有设置按钮监听（导入导出、模态窗、测试系统、管理抽屉等）
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

    // 辅助本地文件选择器
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
            // 1. 初始化本地离线存储
            await AppStorage.init();

            // 2. 初始化 3D 渲染与场景
            AppScene.init();
            AppAudio.init();
            AppParticles.initClickBurstParticles();
            AppParticles.initCoreSphere();
            AppParticles.initStarfield();
            AppParticles.initDynamicBackground();
            AppParticles.initNebulaColors();
            AppParticles.initCardEmbers();
            AppSphereEngine.initGrapple();

            // 3. 构建 3D 悬浮详情卡片
            this.initPremiumHoverCard();

            // 4. 全量挂载所有按钮、滑块、手势和模态窗
            this.initAllButtonsAndEvents();
            this.initSettingsAndSliders();
            this.initMobileTouchHandlers();
            this.initClock();
            this.initSystemViews();
            this.loadCustomViews();
            this.loadCustomWordBanks();
            this.loadCustomRotations();
            this.loadCustomHoverPositions();
            this.initStudyLog();

            // 5. 加载数据并构建震撼魔法球
            await this.loadWordDataAndBoot();

            // 6. 恢复上次存储的全部界面与视角状态
            this.loadAllPersistentStates();

            setTimeout(() => {
                appState.isInitializing = false;
                this.refreshRuntimeCache();
                appState.needsRender = true;
                console.log('3D 单词宇宙系统以完整功能全量装配就绪！');
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
                new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false })
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

        // ==================== 全量事件挂载中枢 ====================
        initAllButtonsAndEvents() {
            // 1. 设置中心显示与关闭
            document.getElementById('settingsBtn')?.addEventListener('click', () => {
                document.getElementById('controlsOverlay')?.classList.toggle('visible');
            });
            document.getElementById('closeControlsOverlayBtn')?.addEventListener('click', () => {
                document.getElementById('controlsOverlay')?.classList.remove('visible');
            });

            // 2. 核心数据导入与导出按钮（修复用户指出的无响应问题）
            document.getElementById('uploadBtn')?.addEventListener('click', () => this.handleFileUpload());
            document.getElementById('appendUploadBtn')?.addEventListener('click', () => this.handleAppendUpload());
            document.getElementById('exportJSONBtn')?.addEventListener('click', () => this.exportJSON());
            document.getElementById('exportSettingsBtn')?.addEventListener('click', () => this.exportSettings());
            document.getElementById('importSettingsBtn')?.addEventListener('click', () => this.importSettings());

            // 3. 复制粘贴数据模态窗
            const pasteModal = document.getElementById('pasteDataModalBackdrop');
            document.getElementById('openPasteModalBtn')?.addEventListener('click', () => {
                if (pasteModal) pasteModal.classList.add('visible');
            });
            document.getElementById('closePasteModalBtn')?.addEventListener('click', () => {
                if (pasteModal) pasteModal.classList.remove('visible');
            });
            document.getElementById('submitPasteDataBtn')?.addEventListener('click', () => this.submitPasteData());

            // 4. AI 提示词模板弹窗
            document.getElementById('showPromptTemplateBtn')?.addEventListener('click', () => this.showAIPromptModal());

            // 5. 筛选与学习模式模态窗
            document.getElementById('filterBtn')?.addEventListener('click', () => this.showModeAndFilterModal());
            document.getElementById('applyFilterBtn')?.addEventListener('click', () => this.applyFiltersAndDisplay());
            document.getElementById('closeFilterModalBtn')?.addEventListener('click', () => {
                document.getElementById('filterModalBackdrop')?.classList.remove('visible');
            });
            document.getElementById('closeFilterModalTopBtn')?.addEventListener('click', () => {
                document.getElementById('filterModalBackdrop')?.classList.remove('visible');
            });

            // 6. 屏蔽与清空屏蔽词库
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

            // 7. 旋转开关、中英文切换、随机换词
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
            });

            document.getElementById('randomShuffleBtn')?.addEventListener('click', () => {
                const list = appState.isWordStormActive ? appState.wordStormProcessedWords : appState.filteredWords;
                if (!list || !list.length) return;
                appState.currentBatchWords = [...list].sort(() => Math.random() - 0.5).slice(0, appState.batchSize);
                AppSphereEngine.createWordSphere(appState.currentBatchWords);
                if (navigator.vibrate) navigator.vibrate(40);
            });

            // 8. 批次前后切换
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

            // 9. 详情面板操作
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

            // 10. 管理抽屉（词库、视角预设、自转速度、悬浮位置）
            document.getElementById('viewsBtn')?.addEventListener('click', () => this.toggleManagementPanel('views'));
            document.getElementById('wordBanksBtn')?.addEventListener('click', () => this.toggleManagementPanel('wordBanks'));
            document.getElementById('rotationsBtn')?.addEventListener('click', () => this.toggleManagementPanel('rotations'));
            document.getElementById('hoverPosBtn')?.addEventListener('click', () => this.toggleManagementPanel('hoverPositions'));

            // 11. 系统视角切换
            this.bindSystemViewButton(document.getElementById('viewInsideBtn'), 'inside');
            this.bindSystemViewButton(document.getElementById('viewSurfaceBtn'), 'surface');
            this.bindSystemViewButton(document.getElementById('viewOverallBtn'), 'overall');

            // 12. 批量屏蔽功能
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

            // 13. 搜索功能
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

            // 14. 帮助弹窗
            document.getElementById('helpBtn')?.addEventListener('click', () => {
                this.updateHelpModal();
                document.getElementById('helpModalBackdrop')?.classList.add('visible');
            });
            document.getElementById('closeHelpModalBtn')?.addEventListener('click', () => {
                document.getElementById('helpModalBackdrop')?.classList.remove('visible');
            });

            // 15. 右上角主菜单折叠与展开
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

            // 16. 键盘快捷键
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

        // ==================== 文件导入与导出处理 ====================
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

        // ==================== 筛选与学习模式 ====================
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

            const isPractice = document.querySelector('input[name="studyMode"]:checked')?.value === 'practice';
            if (isPractice) {
                this.startPracticeSession();
            } else {
                this.exitPracticeSession();
            }
        },

        // ==================== 词汇测试练习模式 ====================
        startPracticeSession() {
            const words = appState.currentBatchWords;
            if (!words || words.length < 4) {
                alert('当前批次单词数量过少（需至少4个词），无法开启测试。');
                this.exitPracticeSession();
                return;
            }
            appState.practiceSession.active = true;
            appState.practiceSession.shuffledWords = [...words].sort(() => Math.random() - 0.5);
            appState.practiceSession.currentIndex = 0;
            appState.practiceSession.correctCount = 0;

            appState.autoRotate = false;
            document.getElementById('rotateToggle').textContent = '⏹️';
            document.getElementById('practiceContainer')?.classList.remove('hidden');

            this.bindPracticeControls();
            this.showNextPracticeQuestion();
        },

        bindPracticeControls() {
            document.getElementById('nextPracticeQuestionBtn').onclick = () => {
                appState.practiceSession.currentIndex++;
                this.showNextPracticeQuestion();
            };
            document.getElementById('exitPracticeBtn').onclick = () => {
                if (confirm('确定要退出当前的词汇测试吗？')) this.exitPracticeSession();
            };
            document.getElementById('submitSpellingBtn').onclick = () => this.handleSpellingSubmit();
            const spInput = document.getElementById('practiceSpellingInput');
            if (spInput) {
                spInput.onkeydown = (e) => {
                    if (e.key === 'Enter') this.handleSpellingSubmit();
                };
            }
        },

        showNextPracticeQuestion() {
            const session = appState.practiceSession;
            session.hasAnswered = false;
            const feedback = document.getElementById('practiceFeedback');
            const nextBtn = document.getElementById('nextPracticeQuestionBtn');
            if (feedback) feedback.textContent = '';
            if (nextBtn) nextBtn.disabled = true;

            if (session.currentIndex >= session.shuffledWords.length) {
                const percentage = Math.round((session.correctCount / session.shuffledWords.length) * 100);
                alert(`测试结束！\n正确率: ${percentage}%\n正确个数: ${session.correctCount} / ${session.shuffledWords.length}`);
                this.exitPracticeSession();
                return;
            }

            const currentWord = session.shuffledWords[session.currentIndex];
            document.getElementById('practiceProgress').textContent = `${session.currentIndex + 1} / ${session.shuffledWords.length}`;
            document.getElementById('practiceScore').textContent = session.correctCount;

            const type = document.getElementById('practiceTypeSelect')?.value || 'multi-choice-en';
            const optGrid = document.getElementById('practiceOptionsGrid');
            const spBox = document.getElementById('practiceSpellingBox');

            if (type === 'spelling') {
                optGrid?.classList.add('hidden');
                spBox?.classList.remove('hidden');
                const input = document.getElementById('practiceSpellingInput');
                if (input) { input.value = ''; input.focus(); }
                document.getElementById('practiceQuestionText').textContent = (currentWord.chinese || '').split(/,|，/)[0];
                document.getElementById('practiceQuestionPhonetic').textContent = currentWord.phonetic || '';
            } else {
                optGrid?.classList.remove('hidden');
                spBox?.classList.add('hidden');

                const otherWords = appState.allWords.filter(w => getWordKey(w) !== getWordKey(currentWord));
                const shuffledOthers = [...otherWords].sort(() => Math.random() - 0.5);
                const options = [currentWord, ...shuffledOthers.slice(0, 3)].sort(() => Math.random() - 0.5);

                session.currentOptions = options;
                session.correctAnswerIdx = options.findIndex(o => getWordKey(o) === getWordKey(currentWord));

                optGrid.innerHTML = '';
                options.forEach((opt, idx) => {
                    const btn = document.createElement('button');
                    btn.className = 'practice-option-btn';
                    if (type === 'multi-choice-en') {
                        document.getElementById('practiceQuestionText').textContent = currentWord.words;
                        document.getElementById('practiceQuestionPhonetic').textContent = currentWord.phonetic || '';
                        btn.textContent = `${idx + 1}. ${(opt.chinese || '').split(/,|，/)[0]}`;
                    } else {
                        document.getElementById('practiceQuestionText').textContent = (currentWord.chinese || '').split(/,|，/)[0];
                        document.getElementById('practiceQuestionPhonetic').textContent = '';
                        btn.textContent = `${idx + 1}. ${opt.words}`;
                    }
                    btn.onclick = () => this.handleOptionClick(idx);
                    optGrid.appendChild(btn);
                });
            }
        },

        handleOptionClick(selectedIdx) {
            const session = appState.practiceSession;
            if (session.hasAnswered) return;
            session.hasAnswered = true;

            const correctIdx = session.correctAnswerIdx;
            const options = document.getElementById('practiceOptionsGrid')?.children;
            const currentWord = session.shuffledWords[session.currentIndex];
            const feedback = document.getElementById('practiceFeedback');

            if (selectedIdx === correctIdx) {
                if (options[selectedIdx]) options[selectedIdx].classList.add('correct');
                feedback.textContent = '🎉 回答正确！';
                feedback.style.color = '#68FFC0';
                session.correctCount++;
                if (navigator.vibrate) navigator.vibrate(30);
            } else {
                if (options[selectedIdx]) options[selectedIdx].classList.add('incorrect');
                if (options[correctIdx]) options[correctIdx].classList.add('correct');
                feedback.textContent = `❌ 回答错误！正确答案是: ${correctIdx + 1}`;
                feedback.style.color = '#FF6868';
                if (navigator.vibrate) navigator.vibrate([60, 50, 60]);
            }

            AppAudio.speakWord(currentWord.words, 1);
            document.getElementById('nextPracticeQuestionBtn').disabled = false;
        },

        handleSpellingSubmit() {
            const session = appState.practiceSession;
            if (session.hasAnswered) return;
            session.hasAnswered = true;

            const currentWord = session.shuffledWords[session.currentIndex];
            const input = document.getElementById('practiceSpellingInput')?.value.trim().toLowerCase();
            const correct = (currentWord.words || '').trim().toLowerCase();
            const feedback = document.getElementById('practiceFeedback');

            if (input === correct) {
                feedback.textContent = '🎉 拼写正确！';
                feedback.style.color = '#68FFC0';
                session.correctCount++;
                if (navigator.vibrate) navigator.vibrate(30);
            } else {
                feedback.textContent = `❌ 错误！正确拼写为: ${currentWord.words}`;
                feedback.style.color = '#FF6868';
                if (navigator.vibrate) navigator.vibrate([60, 50, 60]);
            }

            AppAudio.speakWord(currentWord.words, 1);
            document.getElementById('nextPracticeQuestionBtn').disabled = false;
        },

        exitPracticeSession() {
            appState.practiceSession.active = false;
            document.getElementById('practiceContainer')?.classList.add('hidden');
            appState.autoRotate = true;
            document.getElementById('rotateToggle').textContent = '🔁';
            appState.needsRender = true;
        },

        // ==================== 搜索与 AI 模板 ====================
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

        // ==================== 抽屉式管理面板 (Views, Banks, Rotations, Pos) ====================
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

        // ==================== 学习打卡与对比 ====================
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

        // ==================== 基础触控与面板微调 ====================
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
                    </ul>
                `;
            }
        },

        initSettingsAndSliders() {
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
                if (appState.currentBatchWords.length > 0) AppSphereEngine.createWordSphere(appState.currentBatchWords);
            });

            bindInputSync('vortexSpeed', 'vortexSpeedInput', (v) => {
                appState.rt.vortexSpeed = safeParseFloat(v, 0);
            });

            document.querySelectorAll('#controlsOverlay input, #controlsOverlay select').forEach(input => {
                input.addEventListener('change', () => {
                    this.refreshRuntimeCache();
                    appState.needsRender = true;
                    schedulePersist();
                });
            });
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

        initSystemViews() {},
        loadCustomViews() {},
        loadCustomWordBanks() {},
        loadCustomRotations() {},
        loadCustomHoverPositions() {},
        loadAllPersistentStates() {},
        saveSettings() {},
        saveLastState() {}
    };

    window.AppUI = AppUI;

    window.addEventListener('DOMContentLoaded', () => {
        AppUI.init().catch(err => console.error('系统引导异常:', err));
    });
})();
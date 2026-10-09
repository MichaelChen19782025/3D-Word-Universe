/**
3D单词宇宙 - 全功能 UI 交互中枢
(完整包含：AI知识备注CRUD / TTS发音人热备 / 视角长按更新 / 球体四向平移超控 / 目标误报消除)
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
}
function updateHoverCardPosition(pxWidth, pxHeight, scaleFactor) {
if (!appState.overlayCardTargetPosition) {
appState.overlayCardTargetPosition = new THREE.Vector3();
}
const aspect = appState.camera.aspect;
const distance = 40;
const fov = appState.camera.fov * (Math.PI / 180);
const viewHeight3D = 2 * Math.tan(fov / 2) * distance;
const viewWidth3D = viewHeight3D * aspect;
const cardAspect = pxWidth / pxHeight;
const targetWidth3D = viewWidth3D * 0.55 * scaleFactor;
 const targetHeight3D = targetWidth3D / cardAspect;

 if (appState.hoverOverlayCard) {
     appState.overlayCardTargetScale.set(targetWidth3D, targetHeight3D, 1);
 }

 const camDir = new THREE.Vector3().setFromMatrixColumn(appState.camera.matrix, 2).multiplyScalar(-1);
 const centerPoint = appState.camera.position.clone().add(camDir.multiplyScalar(distance));
 appState.overlayCardTargetPosition.copy(centerPoint);
 appState.needsRender = true;
}
const AppUI = {
async init() {
await AppStorage.init();
AppScene.init();
     AppAudio.init();
     AppParticles.initCoreSphere();
     AppParticles.initStarfield();
     AppParticles.initNebulaColors();
     AppSphereEngine.initGrapple();

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
     this.initNoteModalHandlers();

     this.loadSettings();
     await this.loadWordDataAndBoot();
     this.loadAllPersistentStates();

     setTimeout(() => {
         appState.isInitializing = false;
         this.refreshRuntimeCache();
         this.updateFocusCruiseVisuals();
         this.updateCardPresetDescription();
         appState.needsRender = true;
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
         new THREE.MeshBasicMaterial({ color: 0x0a1428, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false, depthWrite: false })
     );
     backplate.name = "backplate";
     group.add(backplate);

     const glowCanvas = document.createElement('canvas');
     glowCanvas.width = 128; glowCanvas.height = 128;
     const glowCtx = glowCanvas.getContext('2d');
     const gradient = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
     gradient.addColorStop(0, "rgba(100, 200, 255, 0.4)");
     gradient.addColorStop(1, "rgba(50, 100, 150, 0)");
     glowCtx.fillStyle = gradient;
     glowCtx.fillRect(0, 0, 128, 128);

     const glowTexture = new THREE.CanvasTexture(glowCanvas);
     const coreGlow = new THREE.Mesh(
         new THREE.PlaneGeometry(1, 1),
         new THREE.MeshBasicMaterial({ map: glowTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
     );
     coreGlow.name = "coreGlow";
     coreGlow.position.z = 0.01;
     group.add(coreGlow);

     const screen = new THREE.Mesh(
         new THREE.PlaneGeometry(1, 1),
         new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
     );
     screen.position.z = 0.02;
     screen.name = "textScreen";
     group.add(screen);

     const cornerBracketsGroup = AppCardFactory.createCornerBrackets();
     cornerBracketsGroup.name = 'frameGroup';
     cornerBracketsGroup.position.z = 0.03;
     group.add(cornerBracketsGroup);

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
                 if (lightBrightRange) lightBrightRange.value = p.defaultLightBrightness;
                 if (lightColorInput) lightColorInput.value = p.defaultLightColor;
                 this.updateCardPresetDescription();
                 this.showToast(`🎴 已应用风格: ${p.name}`);
             }
         }
         scheduleSphereRebuild(10);
         schedulePersist();
     });

     const heavyInputs = ['cardChamberDepthRange', 'cardLightBrightnessRange', 'cardLightSpreadRange', 'cardLightColor'];
     heavyInputs.forEach(id => {
         const el = document.getElementById(id);
         if (!el) return;
         el.addEventListener('input', () => { scheduleSphereRebuild(380); schedulePersist(); });
         el.addEventListener('change', () => { scheduleSphereRebuild(10); schedulePersist(); });
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
     // 语音发音人及参数监听
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

     // 旋转速度与轴向
     document.getElementById('rotationSpeed')?.addEventListener('input', (e) => {
         appState.actualDisplayRotationSpeed = safeParseFloat(e.target.value, 1.0) * appState.currentRotationSpeedBase;
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

     // 核心能量球体
     ['coreSphereRadius', 'coreSphereColor', 'coreSphereEmissive', 'coreSphereEmissiveIntensity', 'coreSphereOpacity'].forEach(id => {
         const el = document.getElementById(id);
         if (!el) return;
         const updateFn = () => { AppParticles.updateCoreSphereSettings(); schedulePersist(); };
         el.addEventListener('input', updateFn);
         el.addEventListener('change', updateFn);
     });

     // 视觉增强：涡旋速度（严格限制 0.001 ~ 0.01）
     document.getElementById('vortexSpeed')?.addEventListener('input', (e) => {
         const spd = safeParseFloat(e.target.value, 0.003);
         appState.rt.vortexSpeed = Math.max(0.001, Math.min(0.01, spd));
         appState.needsRender = true;
         schedulePersist();
     });

     document.getElementById('visualEffectsEnabled')?.addEventListener('change', (e) => {
         appState.rt.visualFxEnabled = e.target.checked;
         AppParticles.updateVisualEffects();
         schedulePersist();
     });

     ['bloomThreshold', 'bloomStrength', 'bloomRadius'].forEach(id => {
         const el = document.getElementById(id);
         if (!el) return;
         el.addEventListener('input', () => { AppParticles.updateBloomSettings(); appState.needsRender = true; schedulePersist(); });
     });

     // 星空背景设置全部实时响应
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
     document.getElementById('exportSettingsBtn')?.addEventListener('click', () => this.exportSettings());
     document.getElementById('importSettingsBtn')?.addEventListener('click', () => this.importSettings());

     document.getElementById('rotateToggle')?.addEventListener('click', () => {
         appState.autoRotate = !appState.autoRotate;
         document.getElementById('rotateToggle').textContent = appState.autoRotate ? '🔁' : '⏹️';
         appState.needsRender = true;
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

     // 🎮 四向平移按钮事件绑定
     document.getElementById('panUpBtn')?.addEventListener('click', () => AppScene.panSphere(0, -15));
     document.getElementById('panDownBtn')?.addEventListener('click', () => AppScene.panSphere(0, 15));
     document.getElementById('panLeftBtn')?.addEventListener('click', () => AppScene.panSphere(-15, 0));
     document.getElementById('panRightBtn')?.addEventListener('click', () => AppScene.panSphere(15, 0));
     document.getElementById('panCenterResetBtn')?.addEventListener('click', () => AppScene.resetSpherePan());

     // 视角与面板管理
     document.getElementById('viewsBtn')?.addEventListener('click', () => this.toggleManagementPanel('views'));
     this.bindSystemViewButton(document.getElementById('viewInsideBtn'), 'inside');
     this.bindSystemViewButton(document.getElementById('viewSurfaceBtn'), 'surface');
     this.bindSystemViewButton(document.getElementById('viewOverallBtn'), 'overall');

     // 详情面板事件
     document.getElementById('closeDetailBtn')?.addEventListener('click', () => this.hideImmersiveDetailPanel());
     document.getElementById('togglePanelSideBtn')?.addEventListener('click', () => {
         document.getElementById('immersiveDetailPanel')?.classList.toggle('left-aligned');
         this.adjustSphereViewForPanel();
     });
     document.getElementById('speakDetailWordBtn')?.addEventListener('click', () => {
         if (appState.currentDetailWord?.words) AppAudio.speakWord(appState.currentDetailWord.words);
     });
     document.getElementById('detailAddNoteBtn')?.addEventListener('click', () => {
         if (appState.currentDetailWord) this.openNoteEditModal(appState.currentDetailWord, null);
     });

     document.getElementById('helpBtn')?.addEventListener('click', () => {
         document.getElementById('helpModalBackdrop')?.classList.add('visible');
     });

     const masterBtn = document.getElementById('masterMenuToggleBtn');
     const viewControls = document.getElementById('viewControlsContainer');
     if (masterBtn && viewControls) {
         masterBtn.addEventListener('click', (e) => {
             e.stopPropagation();
             viewControls.classList.toggle('expanded');
             masterBtn.textContent = viewControls.classList.contains('expanded') ? '❌' : '🔮';
         });
     }
 },

 // ==================== 📝 备注 CRUD 全套逻辑 ====================
 initNoteModalHandlers() {
     const modal = document.getElementById('wordNoteModalBackdrop');
     const titleInput = document.getElementById('noteInputTitle');
     const contentInput = document.getElementById('noteInputContent');
     const submitBtn = document.getElementById('saveNoteSubmitBtn');
     const cancelBtn = document.getElementById('closeNoteModalBtn');

     cancelBtn?.addEventListener('click', () => {
         modal.classList.remove('visible');
         appState.activeNoteWord = null;
         appState.editingNoteId = null;
     });

     submitBtn?.addEventListener('click', () => {
         const title = titleInput.value.trim();
         const content = contentInput.value.trim();
         if (!title) {
             alert('请输入备注标题！');
             return;
         }
         if (!appState.activeNoteWord) return;

         const word = appState.activeNoteWord;
         if (!Array.isArray(word.notes)) word.notes = [];

         if (appState.editingNoteId) {
             const note = word.notes.find(n => n.id === appState.editingNoteId);
             if (note) {
                 note.title = title;
                 note.content = content;
                 note.date = getTodayYMD();
             }
             this.showToast('📝 备注已更新');
         } else {
             const newNote = {
                 id: 'note_' + Date.now(),
                 date: getTodayYMD(),
                 title: title,
                 content: content
             };
             word.notes.unshift(newNote);
             this.showToast('🎉 新备注已保存');
         }

         AppStorage.saveLibrary(appState.allWords);
         modal.classList.remove('visible');

         if (appState.currentDetailWord && getWordKey(appState.currentDetailWord) === getWordKey(word)) {
             this.renderDetailNotesList(word);
         }
         if (appState.hoveredObject && getWordKey(appState.hoveredObject.userData.word) === getWordKey(word)) {
             this.triggerCardDisplay(appState.hoveredObject);
         }
     });
 },

 openNoteEditModal(word, existingNote = null) {
     appState.activeNoteWord = word;
     appState.editingNoteId = existingNote ? existingNote.id : null;

     const modal = document.getElementById('wordNoteModalBackdrop');
     const header = document.getElementById('noteModalHeaderTitle');
     const titleInput = document.getElementById('noteInputTitle');
     const contentInput = document.getElementById('noteInputContent');

     header.textContent = existingNote ? `✏️ 编辑备注 - ${word.words}` : `📝 添加新备注 - ${word.words}`;
     titleInput.value = existingNote ? existingNote.title : '';
     contentInput.value = existingNote ? existingNote.content : '';

     modal.classList.add('visible');
     setTimeout(() => titleInput.focus(), 100);
 },

 deleteNote(word, noteId) {
     if (!word || !Array.isArray(word.notes)) return;
     if (confirm('确定要删除这条备注吗？')) {
         word.notes = word.notes.filter(n => n.id !== noteId);
         AppStorage.saveLibrary(appState.allWords);
         this.renderDetailNotesList(word);
         if (appState.hoveredObject && getWordKey(appState.hoveredObject.userData.word) === getWordKey(word)) {
             this.triggerCardDisplay(appState.hoveredObject);
         }
         this.showToast('🗑️ 备注已删除');
     }
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
                 <span class="note-item-tag">📅 ${note.date}</span>
                 <span class="note-item-title">${note.title}</span>
                 <div class="note-item-ops" onclick="event.stopPropagation()">
                     <button class="note-op-btn" title="编辑" onclick="AppUI.openNoteEditModal(AppUI.getCurrentWord(), ${JSON.stringify(note).replace(/"/g, '&quot;')})">✏️</button>
                     <button class="note-op-btn del" title="删除" onclick="AppUI.deleteNote(AppUI.getCurrentWord(), '${note.id}')">🗑️</button>
                 </div>
             </div>
             <div class="note-item-content">${note.content || '(无正文内容)'}</div>
         </div>
     `).join('');
 },

 getCurrentWord() {
     return appState.currentDetailWord;
 },

 // ==================== 📸 视角管理与长按更新 ====================
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

 // ==================== 触控与快速查词 ====================
 initMobileTouchHandlers() {
     const canvasEl = appState.renderer?.domElement || document.getElementById('wordSphere');
     if (!canvasEl) return;

     let downTime = 0, downPos = new THREE.Vector2(), isMoving = false;
     canvasEl.addEventListener('pointerdown', (e) => {
         downTime = performance.now();
         downPos.set(e.clientX, e.clientY);
         isMoving = false;
     });
     canvasEl.addEventListener('pointermove', (e) => {
         if (downPos.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > 8) isMoving = true;
     });
     canvasEl.addEventListener('pointerup', (e) => {
         if (downPos.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) < 8 && (performance.now() - downTime) < 450 && !isMoving) {
             this.handleQuickTap(e);
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

     // 1. 优先检测 3D 浮动查词卡按钮
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
                                 this.showToast(`🔊 朗读: ${wordData.words}`);
                             } else if (zone.type === 'fontSizeDown') {
                                 const scaleInput = document.getElementById('hoverOverlayCardScale');
                                 let currentScale = Math.max(0.3, parseFloat(scaleInput?.value || 1.0) - 0.15);
                                 if (scaleInput) scaleInput.value = currentScale.toFixed(2);
                                 this.triggerCardDisplay(appState.hoveredObject);
                             } else if (zone.type === 'fontSizeUp') {
                                 const scaleInput = document.getElementById('hoverOverlayCardScale');
                                 let currentScale = Math.min(4.0, parseFloat(scaleInput?.value || 1.0) + 0.15);
                                 if (scaleInput) scaleInput.value = currentScale.toFixed(2);
                                 this.triggerCardDisplay(appState.hoveredObject);
                             } else if (zone.type === 'note') {
                                 this.openNoteEditModal(wordData, null);
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
                                     this.showToast(`🛡️ 已屏蔽单词: ${wordData.words}`);
                                 }
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

     // 2. 检测球面卡片点击
     const intersects = raycaster.intersectObjects(appState.wordObjects, false);
     if (intersects.length > 0) {
         const card = intersects[0].object;
         const wordData = card.userData.word;

         if (appState.hoveredObject === card && appState.hoverOverlayCard.visible) {
             appState.hoveredObject = null;
             appState.overlayCardTargetOpacity = 0;
         } else {
             this.triggerCardDisplay(card);
         }

         const result = AppStorage.recordStudyClick(wordData);
         this.updateStudyCounterDisplay();
         if (result.justReached) {
             this.triggerDailyGoalAchievedToast();
         }
     } else {
         appState.hoveredObject = null;
         appState.overlayCardTargetOpacity = 0;
     }
     appState.needsRender = true;
 },

 triggerCardDisplay(card) {
     if (!card) return;
     const word = card.userData.word;
     appState.hoveredObject = card;

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

     this.renderDetailNotesList(word);

     document.getElementById('immersiveDetailPanel')?.classList.add('visible');
     appState.rotationMultiplier = 0.0;
     appState.needsRender = true;
 },

 hideImmersiveDetailPanel() {
     document.getElementById('immersiveDetailPanel')?.classList.remove('visible');
     appState.rotationMultiplier = 1.0;
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
     appState.currentRotationSpeedBase = Math.max(0.00001, Math.min(20.0, appState.currentRotationSpeedBase));
     appState.autoRotate = true;
     const toggle = document.getElementById('rotateToggle');
     if (toggle) toggle.textContent = '🔁';

     const rotSlider = document.getElementById('rotationSpeed');
     if (rotSlider && safeParseFloat(rotSlider.value, 1.0) <= 0) rotSlider.value = 1.0;
     const sliderVal = Math.max(0.001, safeParseFloat(rotSlider ? rotSlider.value : 1.0, 1.0));
     appState.actualDisplayRotationSpeed = sliderVal * appState.currentRotationSpeedBase;

     this.showToast(multiplier > 1.0 ? `🚀 旋转加速: ${appState.actualDisplayRotationSpeed.toFixed(3)}` : `🐢 旋转减速: ${appState.actualDisplayRotationSpeed.toFixed(3)}`);
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
     if (hud) hud.classList.toggle('enabled', enabled);
     if (statusTag) statusTag.textContent = enabled ? '开' : '关';
 },

 initStudyLog() {
     const counterHud = document.getElementById('studyCounterHud');
     counterHud?.addEventListener('click', () => {
         alert(`📖 今日已复习单词数: ${AppStorage.getTodayStudiedCount()}\n🎯 目标: ${AppStorage.getStudyGoal()} 个单词`);
     });
 },

 updateStudyCounterDisplay() {
     const valEl = document.getElementById('studyCounterValue');
     const goalEl = document.getElementById('studyGoalValue');
     if (valEl) valEl.textContent = String(AppStorage.getTodayStudiedCount());
     if (goalEl) goalEl.textContent = String(AppStorage.getStudyGoal());
 },

 // ==================== 词库与数据导入导出 (深度支持 Notes) ====================
 handleFileUpload() {
     selectLocalFile('application/json,.json', async (file) => {
         const reader = new FileReader();
         reader.onload = async (e) => {
             try {
                 const words = JSON.parse(e.target.result);
                 if (!Array.isArray(words)) throw new Error('数据必须是数组');
                 // 确保每个单词对象的 notes 结构完整
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
     // 完整导出，包括每个单词内的 notes 数组
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
     this.showToast('⚙️ 系统配置已成功导出！');
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
                 alert('解析失败: ' + err.message);
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
         'focusCruiseEnabled', 'focusCruiseIntervalRange', 'focusCruiseRatioRange', 'focusCruiseScaleRange',
         'coreSphereRadius', 'coreSphereColor', 'coreSphereEmissive', 'coreSphereEmissiveIntensity', 'coreSphereOpacity',
         'visualEffectsEnabled', 'vortexParticleCount', 'vortexColor', 'vortexSize', 'vortexSpeed', 'vortexTightness',
         'bloomThreshold', 'bloomStrength', 'bloomRadius',
         'starfieldEnabled', 'starCount', 'starColor', 'starSize',
         'cardStylePresetSelect', 'cardChamberDepthRange', 'cardOpacityRange',
         'cardLightPositionSelect', 'cardLightBrightnessRange', 'cardLightSpreadRange', 'cardLightColor',
         'hoverCardStyleModeSelect', 'hoverOverlayCardScale', 'hoverCardBrightness',
         'voiceSelect', 'rateInput', 'timesInput', 'volumeInput'
     ];

     settingIds.forEach(id => {
         const el = document.getElementById(id);
         if (el) settings[id] = (el.type === 'checkbox') ? el.checked : el.value;
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
             if (el.type === 'checkbox') el.checked = !!settings[key];
             else el.value = settings[key];
         }
     }

     if (settings.cardScaleMultiplier) appState.cardScaleMultiplier = settings.cardScaleMultiplier;
     if (settings.showEnglish !== undefined) {
         appState.showEnglish = !!settings.showEnglish;
         const toggleLang = document.getElementById('toggleLanguage');
         if (toggleLang) toggleLang.textContent = appState.showEnglish ? '中' : '英';
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
         cardScaleMultiplier: appState.cardScaleMultiplier
     };
     localStorage.setItem(APP_CONFIG.LAST_STATE_STORAGE_KEY, JSON.stringify(state));
 }
};
window.AppUI = AppUI;
window.addEventListener('DOMContentLoaded', () => {
AppUI.init().catch(err => console.error('引导异常:', err));
});
})();
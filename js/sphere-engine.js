/**
 * 3D单词宇宙 - 球体核心引擎 (Sphere Engine)
 * 100% 还原图 3 原版黄金螺旋斐波那契球面点阵排布 (Fibonacci Sphere Lattice)
 */
(function() {
    let grapple = {
        phase: 'idle',
        factor: 1.0,
        cruiseStart: 0,
        lastBatch: new Set(),
        shake: 0,
        dustBoost: 0,
        autoResumeTimer: null
    };

    const AppSphereEngine = {
        // 核心算法：斐波那契球面螺旋分布，完美复原图 3 密集饱满的立体球形
        createWordSphere(wordsToDisplay, isFlowMode = false) {
            if (!isFlowMode) {
                appState.isFlowMode = false;
            }

            while (appState.wordSphereGroup.children.length > 0) {
                const obj = appState.wordSphereGroup.children[0];
                appState.wordSphereGroup.remove(obj);
                disposeObject(obj);
            }
            appState.wordObjects = [];
            if (!wordsToDisplay || wordsToDisplay.length === 0) return;

            if (appState.isFlowMode) {
                wordsToDisplay.forEach((word) => {
                    const card = AppCardFactory.createIceCard(word);
                    appState.wordSphereGroup.add(card);
                    appState.wordObjects.push(card);
                });
                appState.needsRender = true;
                return;
            }

            const samples = wordsToDisplay.length;
            const phi = Math.PI * (3 - Math.sqrt(5)); // 黄金角 (约 137.5 度)

            if (samples > 0 && samples <= APP_CONFIG.HEMISPHERE_LAYOUT_THRESHOLD) {
                const maxAttempts = samples * 3;
                let cardsPlaced = 0;
                for (let i = 0; cardsPlaced < samples && i < maxAttempts; i++) {
                    const yPos = 1 - (i / maxAttempts) * 2;
                    const radiusAtY = Math.sqrt(Math.max(0, 1 - yPos * yPos));
                    const theta = phi * i;
                    const zPos = Math.sin(theta) * radiusAtY;
                    if (zPos > 0.02) {
                        const xPos = Math.cos(theta) * radiusAtY;
                        const card = AppCardFactory.createIceCard(wordsToDisplay[cardsPlaced]);
                        card.userData.latScale = 1.0 - 0.50 * (yPos * yPos);
                        card.position.set(
                            xPos * appState.sphereRadius,
                            yPos * appState.sphereRadius,
                            zPos * appState.sphereRadius
                        );
                        appState.wordSphereGroup.add(card);
                        appState.wordObjects.push(card);
                        cardsPlaced++;
                    }
                }
            } else {
                wordsToDisplay.forEach((word, i) => {
                    const yPos = (samples > 1) ? (1 - (i / (samples - 1)) * 2) : 0;
                    const radiusAtY = Math.sqrt(1 - yPos * yPos);
                    const theta = phi * i;
                    const card = AppCardFactory.createIceCard(word);
                    card.userData.latScale = 1.0 - 0.50 * (yPos * yPos);
                    card.position.set(
                        Math.cos(theta) * radiusAtY * appState.sphereRadius,
                        yPos * appState.sphereRadius,
                        Math.sin(theta) * radiusAtY * appState.sphereRadius
                    );
                    appState.wordSphereGroup.add(card);
                    appState.wordObjects.push(card);
                });
            }
            appState.needsRender = true;
        },

        arrangeCardsInLayout(mode) {
            if (!appState.currentBatchWords || appState.currentBatchWords.length === 0) return;

            appState.autoRotate = false;
            const rotateToggle = document.getElementById('rotateToggle');
            if (rotateToggle) rotateToggle.textContent = '⏹️';
            appState.wordSphereGroup.rotation.set(0, 0, 0);
            appState.controls.target.set(0, 0, 0);

            appState.isFlowMode = true;
            appState.flowModeType = mode;

            const MAX_FLOW_CARDS = IS_MOBILE_DEVICE ? 8 : 10;
            const batchWords = appState.currentBatchWords;
            const flowWords = batchWords.slice(0, Math.min(MAX_FLOW_CARDS, batchWords.length));

            this.createWordSphere(flowWords, true);
            appState.flowWordIndex = flowWords.length % batchWords.length;

            const fovRad = (appState.camera.fov * Math.PI) / 180;
            const dist = appState.camera.position.length() || 165;
            const visH = 2 * Math.tan(fovRad / 2) * dist * 0.82;
            const visW = visH * appState.camera.aspect;

            const screenH = window.innerHeight || 800;
            const minGapUnits = (visH / screenH) * 5;

            const total = appState.wordObjects.length;
            if (total === 0) return;

            const cardMult = appState.cardScaleMultiplier || 1.0;
            const baseCardW = 12 * cardMult;
            const baseCardH = 6 * cardMult;

            let boxY = 0, boxX = 0;
            if (mode === 'top_row') boxY = visH * 0.32;
            else if (mode === 'bottom_row') boxY = -visH * 0.32;
            else if (mode === 'center_row') boxY = 0;
            else if (mode === 'left_col') boxX = -visW * 0.30;
            else if (mode === 'right_col') boxX = visW * 0.30;

            const isHorizontal = (mode === 'top_row' || mode === 'center_row' || mode === 'bottom_row');

            if (isHorizontal) {
                const minStepX = baseCardW + minGapUnits;
                const spanX = Math.max(visW * 1.3, minStepX * total);
                const stepSize = spanX / total;

                appState.wordObjects.forEach((card, i) => {
                    card.quaternion.identity();
                    card.position.set(-spanX / 2 + (i + 0.5) * stepSize, boxY, 0);
                });
            } else {
                const minStepY = baseCardH + minGapUnits;
                const spanY = Math.max(visH * 1.3, minStepY * total);
                const stepSize = spanY / total;

                appState.wordObjects.forEach((card, i) => {
                    card.quaternion.identity();
                    card.position.set(boxX, -spanY / 2 + (i + 0.5) * stepSize, 0);
                });
            }

            appState.controls.update();
            appState.needsRender = true;
        },

        currentFrontKeys() {
            const keys = new Set();
            if (!appState.camera || !appState.wordObjects || appState.wordObjects.length === 0) return keys;
            appState.camera.getWorldPosition(AppMath.vecCamWorld);
            const radius = appState.sphereRadius || 85;
            const threshold = AppMath.vecCamWorld.length() - radius * 0.3;

            for (let i = 0; i < appState.wordObjects.length; i++) {
                const card = appState.wordObjects[i];
                card.getWorldPosition(AppMath.vecCardWorld);
                if (AppMath.vecCardWorld.distanceTo(AppMath.vecCamWorld) < threshold) {
                    keys.add(getWordKey(card.userData.word));
                }
            }
            return keys;
        },

        grappleHasFreshBatch() {
            const front = this.currentFrontKeys();
            if (front.size === 0) return false;
            let fresh = 0;
            front.forEach(k => { if (!grapple.lastBatch.has(k)) fresh++; });
            return fresh >= Math.max(1, Math.round(front.size * 0.35));
        },

        triggerManualGrapple() {
            if (appState.practiceSession && appState.practiceSession.active) return;
            if (appState.isFlowMode) {
                appState.isFlowMode = false;
                if (appState.currentBatchWords && appState.currentBatchWords.length > 0) {
                    this.createWordSphere(appState.currentBatchWords);
                }
            }

            appState.rt.grappleEnabled = true;
            const grappleCb = document.getElementById('grappleEnabled');
            if (grappleCb) grappleCb.checked = true;

            const rotSpeedInput = document.getElementById('rotationSpeed');
            if (rotSpeedInput && safeParseFloat(rotSpeedInput.value, 1.0) < 0.1) {
                rotSpeedInput.value = 1.0;
                appState.actualDisplayRotationSpeed = appState.currentRotationSpeedBase;
                const rotDisplay = document.getElementById('rotationSpeedInput');
                if (rotDisplay) rotDisplay.value = appState.actualDisplayRotationSpeed.toFixed(4);
            }

            if (grapple.autoResumeTimer) {
                clearTimeout(grapple.autoResumeTimer);
                grapple.autoResumeTimer = null;
            }

            grapple.lastBatch = this.currentFrontKeys();
            grapple.phase = 'cruise';
            grapple.factor = APP_CONFIG.GRAPPLE_MAX_SPEED;
            grapple.cruiseStart = performance.now();

            appState.autoRotate = true;
            const rotateToggle = document.getElementById('rotateToggle');
            if (rotateToggle) rotateToggle.textContent = '🔁';

            const grappleBtn = document.getElementById('grappleContinueBtn');
            if (grappleBtn) grappleBtn.classList.add('hidden');

            appState.needsRender = true;
        },

        tickGrapple(time) {
            if (!appState.rt.grappleEnabled || appState.isFlowMode) {
                grapple.factor = 1; grapple.phase = 'idle'; grapple.dustBoost = 0;
                return 1;
            }
            if (grapple.phase === 'idle') {
                grapple.factor = 1; grapple.dustBoost = 0;
                return 1;
            }
            if (appState.rotationMultiplier < 0.001) {
                grapple.dustBoost = 0;
                return grapple.factor;
            }
            if (!appState.autoRotate) {
                if (grapple.phase !== 'captured') {
                    grapple.phase = 'idle';
                    grapple.factor = 1;
                }
                grapple.dustBoost = 0;
                return grapple.factor;
            }
            if (grapple.phase === 'captured') {
                grapple.factor = 0; grapple.dustBoost = 0;
                return 0;
            }

            switch (grapple.phase) {
                case 'rampUp':
                    grapple.factor += (APP_CONFIG.GRAPPLE_MAX_SPEED - grapple.factor) * 0.10;
                    if (grapple.factor >= APP_CONFIG.GRAPPLE_MAX_SPEED - 0.5) {
                        grapple.factor = APP_CONFIG.GRAPPLE_MAX_SPEED;
                        grapple.phase = 'cruise';
                        grapple.cruiseStart = time;
                    }
                    break;
                case 'cruise':
                    grapple.factor = APP_CONFIG.GRAPPLE_MAX_SPEED;
                    if ((time - grapple.cruiseStart) > 300 && (this.grappleHasFreshBatch() || (time - grapple.cruiseStart) > 900)) {
                        grapple.phase = 'rampDown';
                    }
                    break;
                case 'rampDown':
                    grapple.factor += (0 - grapple.factor) * 0.12;
                    if (grapple.factor <= 0.05) {
                        grapple.factor = 0;
                        this.fireGrappleCapture();
                    }
                    break;
            }
            grapple.dustBoost = Math.max(0, Math.min(1, (grapple.factor - 1) / (APP_CONFIG.GRAPPLE_MAX_SPEED - 1)));
            return grapple.factor;
        },

        fireGrappleCapture() {
            grapple.lastBatch = this.currentFrontKeys();
            grapple.factor = 0;
            grapple.phase = 'captured';
            appState.autoRotate = false;
            const rotateToggle = document.getElementById('rotateToggle');
            if (rotateToggle) rotateToggle.textContent = '⏹️';
            grapple.shake = 1.0;

            if (navigator.vibrate) {
                try { navigator.vibrate([40, 30, 80, 30, 40]); } catch (e) {}
            }

            grapple.autoResumeTimer = setTimeout(() => {
                grapple.autoResumeTimer = null;
                if (grapple.phase === 'captured') {
                    this.resumeGrapple();
                }
            }, 700);

            appState.needsRender = true;
        },

        resumeGrapple() {
            if (grapple.autoResumeTimer) {
                clearTimeout(grapple.autoResumeTimer);
                grapple.autoResumeTimer = null;
            }
            grapple.phase = 'idle';
            grapple.factor = 1.0;
            appState.autoRotate = true;
            const rotateToggle = document.getElementById('rotateToggle');
            if (rotateToggle) rotateToggle.textContent = '🔁';
            const grappleBtn = document.getElementById('grappleContinueBtn');
            if (grappleBtn) grappleBtn.classList.add('hidden');
            appState.needsRender = true;
        },

        updateGrappleEffects() {
            if (grapple.shake > 0.001) {
                const amp = grapple.shake * 2.2;
                if (appState.wordSphereGroup) {
                    appState.wordSphereGroup.position.set(
                        (Math.random() - 0.5) * amp,
                        (Math.random() - 0.5) * amp,
                        (Math.random() - 0.5) * amp * 0.4
                    );
                }
                grapple.shake *= 0.88;
                appState.needsRender = true;
            } else if (grapple.shake > 0) {
                grapple.shake = 0;
                if (appState.wordSphereGroup) appState.wordSphereGroup.position.set(0, 0, 0);
            }
        },

        initGrapple() {
            const btn = document.getElementById('grappleContinueBtn');
            if (btn) btn.addEventListener('click', () => this.resumeGrapple());
        }
    };

    window.AppSphereEngine = AppSphereEngine;
    window.grapple = grapple;
    window.createWordSphere = (words, isFlow) => AppSphereEngine.createWordSphere(words, isFlow);
})();
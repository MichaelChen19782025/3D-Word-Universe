/**
 * 3D单词宇宙 - 多轨道编排、擒拿瞬间加速与流式传送带布局系统
 * (IIFE 封闭作用域，杜绝全局变量污染与同名冲突)
 */
(function() {
    const _Z_AXIS = new THREE.Vector3(0, 0, 1);
    const _scratchVecCamWorld = new THREE.Vector3();
    const _scratchVecCardWorld = new THREE.Vector3();
    let _orbitLaneOrder = [];

    // 擒拿状态机
    let grapple = {
        phase: 'idle', // 'idle' | 'rampUp' | 'cruise' | 'rampDown' | 'captured'
        factor: 1.0,
        cruiseStart: 0,
        lastBatch: new Set(),
        shake: 0,
        dustBoost: 0,
        autoResumeTimer: null
    };

    function generateOrbitNormals(count) {
        const normals = [];
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < count; i++) {
            const y = 1 - (2 * i + 1) / count;
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = goldenAngle * i;
            normals.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
        }
        const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        ));
        normals.forEach(n => n.applyQuaternion(rot));
        return normals;
    }

    function randomizeOrbitLane(lane, normal) {
        lane.axis.copy(normal);
        lane.group.quaternion.setFromUnitVectors(_Z_AXIS, lane.axis);
        lane.speedFactor = APP_CONFIG.ORBIT_LANE_SPEED_FACTOR_MIN + Math.random() * (APP_CONFIG.ORBIT_LANE_SPEED_FACTOR_MAX - APP_CONFIG.ORBIT_LANE_SPEED_FACTOR_MIN);
        lane.dir = (Math.random() < 0.5) ? -1 : 1;
        lane.phase = Math.random() * Math.PI * 2;
        lane.group.rotateZ(lane.phase);
    }

    function resetOrbitLaneSwitchTimer() {
        appState.orbitSwitchInterval = APP_CONFIG.ORBIT_SWITCH_INTERVAL_MIN + Math.random() * (APP_CONFIG.ORBIT_SWITCH_INTERVAL_MAX - APP_CONFIG.ORBIT_SWITCH_INTERVAL_MIN);
        appState.lastOrbitSwitchTime = performance.now();
    }

    const AppOrbit = {
        pickOrbitLaneCount(cardCount) {
            const target = APP_CONFIG.ORBIT_CARDS_PER_RING;
            const n = Math.ceil(cardCount / target);
            return Math.max(APP_CONFIG.ORBIT_LANE_COUNT_MIN, Math.min(APP_CONFIG.ORBIT_LANE_COUNT_MAX, n));
        },

        buildOrbitLanes(cardCount) {
            if (appState.orbitLanes) {
                appState.orbitLanes.forEach(lane => {
                    if (lane.group) {
                        while (lane.group.children.length) lane.group.remove(lane.group.children[0]);
                        if (lane.group.parent) lane.group.parent.remove(lane.group);
                    }
                });
            }
            appState.orbitLanes = [];
            appState.orbitLaneCount = this.pickOrbitLaneCount(cardCount);
            const normals = generateOrbitNormals(appState.orbitLaneCount);

            _orbitLaneOrder = Array.from({ length: appState.orbitLaneCount }, (_, i) => i);
            for (let i = _orbitLaneOrder.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [_orbitLaneOrder[i], _orbitLaneOrder[j]] = [_orbitLaneOrder[j], _orbitLaneOrder[i]];
            }

            for (let i = 0; i < appState.orbitLaneCount; i++) {
                const group = new THREE.Group();
                group.name = 'orbitLane' + i;
                appState.wordSphereGroup.add(group);
                const lane = { group, axis: new THREE.Vector3(0, 1, 0), speedFactor: 1, dir: 1, phase: 0 };
                randomizeOrbitLane(lane, normals[i]);
                appState.orbitLanes.push(lane);
            }
            resetOrbitLaneSwitchTimer();
        },

        placeCardOnRing(card, laneIndex, angle) {
            const r = appState.sphereRadius || 85;
            card.position.set(r * Math.cos(angle), r * Math.sin(angle), 0);
            card.userData.orbitLaneIndex = laneIndex;
            appState.orbitLanes[laneIndex].group.add(card);
            appState.wordObjects.push(card);
        },

        createWordSphere(wordsToDisplay, isFlowMode = false) {
            if (!isFlowMode) {
                appState.isFlowMode = false;
            }

            if (appState.wordObjects && appState.wordObjects.length) {
                appState.wordObjects.forEach(card => disposeObject(card));
            }
            appState.wordObjects = [];

            if (appState.orbitLanes) {
                appState.orbitLanes.forEach(lane => {
                    if (lane.group) {
                        while (lane.group.children.length) lane.group.remove(lane.group.children[0]);
                        if (lane.group.parent) lane.group.parent.remove(lane.group);
                    }
                });
            }
            appState.orbitLanes = [];

            while (appState.wordSphereGroup.children.length > 0) {
                const obj = appState.wordSphereGroup.children[0];
                appState.wordSphereGroup.remove(obj);
                disposeObject(obj);
            }

            if (!wordsToDisplay || wordsToDisplay.length === 0) return;

            if (appState.isFlowMode) {
                wordsToDisplay.forEach((word) => {
                    const card = AppCardFactory.createIceCard(word);
                    appState.wordSphereGroup.add(card);
                    appState.wordObjects.push(card);
                });
            } else {
                this.buildOrbitLanes(wordsToDisplay.length);
                const laneCount = appState.orbitLanes.length;
                const laneBatches = Array.from({ length: laneCount }, () => []);

                wordsToDisplay.forEach((word, i) => {
                    laneBatches[_orbitLaneOrder[i % _orbitLaneOrder.length]].push(word);
                });

                appState.orbitLanes.forEach((lane, laneIndex) => {
                    const laneWords = laneBatches[laneIndex];
                    const n = laneWords.length;
                    laneWords.forEach((word, k) => {
                        const angle = (k / n) * Math.PI * 2;
                        const card = AppCardFactory.createIceCard(word);
                        this.placeCardOnRing(card, laneIndex, angle);
                    });
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
            const minGapPx = 5;
            const minGapUnits = (visH / screenH) * minGapPx;

            const total = appState.wordObjects.length;
            if (total === 0) return;

            const cardMult = appState.cardScaleMultiplier || 1.0;
            const baseCardW = 12;
            const baseCardH = 6;
            const effectiveW = baseCardW * cardMult;
            const effectiveH = baseCardH * cardMult;

            let boxY = 0, boxX = 0;
            if (mode === 'top_row') boxY = visH * 0.32;
            else if (mode === 'bottom_row') boxY = -visH * 0.32;
            else if (mode === 'center_row') boxY = 0;
            else if (mode === 'left_col') boxX = -visW * 0.30;
            else if (mode === 'right_col') boxX = visW * 0.30;

            const isHorizontal = (mode === 'top_row' || mode === 'center_row' || mode === 'bottom_row');

            if (isHorizontal) {
                const minStepX = effectiveW + minGapUnits;
                const spanX = Math.max(visW * 1.3, minStepX * total);
                const stepSize = spanX / total;

                appState.wordObjects.forEach((card, i) => {
                    card.quaternion.identity();
                    card.position.set(-spanX / 2 + (i + 0.5) * stepSize, boxY, 0);
                });
            } else {
                const minStepY = effectiveH + minGapUnits;
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
            appState.camera.getWorldPosition(_scratchVecCamWorld);
            const radius = appState.sphereRadius || 85;
            const threshold = _scratchVecCamWorld.length() - radius * 0.3;

            for (let i = 0; i < appState.wordObjects.length; i++) {
                const card = appState.wordObjects[i];
                card.getWorldPosition(_scratchVecCardWorld);
                if (_scratchVecCardWorld.distanceTo(_scratchVecCamWorld) < threshold) {
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

    window.AppOrbit = AppOrbit;
    window.grapple = grapple;
})();
/**
 * 3D单词宇宙 - Three.js 核心场景管理与渲染管线
 * 1. 局部焦点巡航：平滑 Lerp 呼吸放大插值，并设立硬性绝对上限天花板，杜绝放大卡片递归膨胀
 * 2. 查词窗口居中面对镜头，屏幕边缘自适应防溢出
 * 3. 前后景深尺寸收敛平衡，让近处卡片体量自然优雅
 */
(function() {
    const AppScene = {
        init() {
            appState.scene = new THREE.Scene();
            appState.wordSphereGroup = new THREE.Group();
            appState.scene.add(appState.wordSphereGroup);

            appState.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
            appState.camera.position.set(0, 0, 165);

            appState.renderer = new THREE.WebGLRenderer({
                antialias: !IS_MOBILE_DEVICE,
                alpha: true,
                powerPreference: 'high-performance'
            });
            appState.renderer.physicallyCorrectLights = true;
            appState.renderer.setPixelRatio(IS_MOBILE_DEVICE ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio);
            appState.renderer.setSize(window.innerWidth, window.innerHeight);
            appState.renderer.setClearColor(0x000000, 0);
            appState.renderer.sortObjects = true;

            const container = document.getElementById('wordSphere');
            if (container) {
                container.appendChild(appState.renderer.domElement);
            }

            const renderScene = new THREE.RenderPass(appState.scene, appState.camera);
            appState.bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.25, 0.2, 0.88
            );
            appState.bloomPass.renderToScreen = true;

            appState.composer = new THREE.EffectComposer(appState.renderer);
            appState.composer.addPass(renderScene);
            appState.composer.addPass(appState.bloomPass);

            appState.controls = new THREE.OrbitControls(appState.camera, appState.renderer.domElement);
            appState.controls.enableDamping = true;
            appState.controls.dampingFactor = 0.035;
            appState.controls.autoRotate = false;
            appState.controls.minDistance = 0.1;
            appState.controls.maxDistance = 1500;
            appState.controls.zoomSpeed = 3.4;

            appState.controls.addEventListener('start', function() {
                if (appState.selectedLightControl) {
                    if (appState.selectedLightControl.material && appState.selectedLightControl.material.emissive) {
                        appState.selectedLightControl.material.emissive.setHex(0x000000);
                    }
                    appState.selectedLightControl = null;
                    if (appState.transformControls) appState.transformControls.detach();
                }
            });

            appState.controls.addEventListener('end', function() {
                if (window.AppUI && typeof AppUI.autoSaveActiveViewSettings === 'function') {
                    AppUI.autoSaveActiveViewSettings();
                }
                if (window.AppUI && typeof AppUI.saveLastState === 'function') {
                    AppUI.saveLastState();
                }
            });

            this.initLights();
            window.addEventListener('resize', () => this.onWindowResize());
            this.animate();
        },

        initLights() {
            appState.hemisphereLight = new THREE.HemisphereLight(0xadd8e6, 0x404040, 0.9);
            appState.scene.add(appState.hemisphereLight);
            appState.scene.add(appState.camera);

            appState.studioSpotLight = new THREE.SpotLight(0xffffff, 0);
            appState.studioSpotLight.decay = 0;
            appState.studioSpotLight.penumbra = 1.0;
            appState.camera.add(appState.studioSpotLight);

            appState.studioSpotLightTarget = new THREE.Object3D();
            appState.camera.add(appState.studioSpotLightTarget);
            appState.studioSpotLight.target = appState.studioSpotLightTarget;

            const ringGeo = new THREE.RingGeometry(19, 20, 48);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x00f0ff, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false
            });
            appState.studioLightHelperMesh = new THREE.Mesh(ringGeo, ringMat);
            appState.studioLightHelperMesh.position.set(0, 0, -100);
            appState.studioLightHelperMesh.renderOrder = 10000;
            appState.studioLightHelperMesh.visible = false;
            appState.camera.add(appState.studioLightHelperMesh);

            if (typeof THREE.RectAreaLightUniformsLib !== 'undefined' && THREE.RectAreaLightUniformsLib.init) {
                THREE.RectAreaLightUniformsLib.init();
            }

            appState.rectAreaLight1 = new THREE.RectAreaLight(0xffffff, 2.2, 200, 200);
            appState.rectAreaLight1.position.set(0, 150, 50);
            appState.rectAreaLight1.lookAt(0, 0, 0);
            appState.scene.add(appState.rectAreaLight1);

            appState.rectAreaLight2 = new THREE.RectAreaLight(0xffe0b3, 1.6, 250, 250);
            appState.rectAreaLight2.position.set(-180, 50, -50);
            appState.rectAreaLight2.lookAt(0, 0, 0);
            appState.scene.add(appState.rectAreaLight2);

            appState.directionalLight2 = new THREE.DirectionalLight(APP_CONFIG.DEFAULT_DIRECTIONAL_LIGHT_2_COLOR, 0.5);
            appState.directionalLight2.position.set(
                APP_CONFIG.DEFAULT_DIRECTIONAL_LIGHT_2_POSITION_X,
                APP_CONFIG.DEFAULT_DIRECTIONAL_LIGHT_2_POSITION_Y,
                APP_CONFIG.DEFAULT_DIRECTIONAL_LIGHT_2_POSITION_Z
            ).normalize();
            appState.scene.add(appState.directionalLight2);

            appState.customSpotLight = new THREE.SpotLight(APP_CONFIG.DEFAULT_CUSTOM_LIGHT_COLOR);
            appState.customSpotLight.decay = 0;
            appState.scene.add(appState.customSpotLight);
            appState.scene.add(appState.customSpotLight.target);

            appState.customSpotLightHelper = new THREE.SpotLightHelper(appState.customSpotLight);
            appState.customSpotLightHelper.visible = false;
            appState.scene.add(appState.customSpotLightHelper);

            const sourceGeo = new THREE.SphereGeometry(8, 32, 16);
            const sourceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000, transparent: true, opacity: 0.5 });
            appState.lightSourceMesh = new THREE.Mesh(sourceGeo, sourceMat);
            appState.lightSourceMesh.name = 'lightSource';
            appState.lightSourceMesh.visible = false;
            appState.scene.add(appState.lightSourceMesh);

            const targetGeo = new THREE.SphereGeometry(4, 16, 8);
            const targetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000, transparent: true, opacity: 0.5 });
            appState.lightTargetMesh = new THREE.Mesh(targetGeo, targetMat);
            appState.lightTargetMesh.name = 'lightTarget';
            appState.lightTargetMesh.visible = false;
            appState.scene.add(appState.lightTargetMesh);

            if (typeof THREE.TransformControls === 'function') {
                appState.transformControls = new THREE.TransformControls(appState.camera, appState.renderer.domElement);
                appState.transformControls.setMode('translate');
                appState.transformControls.setSpace('world');
                appState.scene.add(appState.transformControls);

                appState.transformControls.addEventListener('dragging-changed', function(event) {
                    appState.controls.enabled = !event.value;
                });
            } else {
                appState.transformControls = null;
            }

            this.initGuidelines();
        },

        initGuidelines() {
            appState.guidelineGroup = new THREE.Group();
            appState.scene.add(appState.guidelineGroup);
            const radius = APP_CONFIG.DEFAULT_GUIDELINE_RADIUS || 100;
            const guideConfigs = {
                'xy': { rotation: [0, 0, 0] },
                'yz': { rotation: [0, Math.PI / 2, 0] },
                'xz': { rotation: [Math.PI / 2, 0, 0] },
                'xy_45': { rotation: [0, 0, Math.PI / 4] },
                'yz_45': { rotation: [0, Math.PI / 4, 0] }
            };
            const material = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3 });
            if (!appState.guidelines) appState.guidelines = {};
            for (const name in guideConfigs) {
                const geo = new THREE.TorusGeometry(radius, 1, 8, 64);
                const mesh = new THREE.Mesh(geo, material);
                mesh.name = name;
                mesh.rotation.fromArray(guideConfigs[name].rotation);
                mesh.visible = false;
                appState.guidelines[name] = mesh;
                appState.guidelineGroup.add(mesh);
            }
        },

        updateHemiLightSettings() {
            if (!appState.hemisphereLight) return;
            const skyEl = document.getElementById('hemiSkyColor');
            const gndEl = document.getElementById('hemiGroundColor');
            const intEl = document.getElementById('hemiIntensity');
            const sky = skyEl ? skyEl.value : '#add8e6';
            const ground = gndEl ? gndEl.value : '#404040';
            const intensity = safeParseFloat(intEl ? intEl.value : 0.9, 0.9);
            appState.hemisphereLight.color.set(getColor(sky, 'three'));
            appState.hemisphereLight.groundColor.set(getColor(ground, 'three'));
            appState.hemisphereLight.intensity = intensity;
            appState.needsRender = true;
        },

        updateRectAreaLight1Settings() {
            if (!appState.rectAreaLight1) return;
            const cEl = document.getElementById('rect1Color');
            const iEl = document.getElementById('rect1Intensity');
            const color = cEl ? cEl.value : '#ffffff';
            const intensity = safeParseFloat(iEl ? iEl.value : 2.2, 2.2);
            appState.rectAreaLight1.color.set(getColor(color, 'three'));
            appState.rectAreaLight1.intensity = intensity;
            appState.needsRender = true;
        },

        updateRectAreaLight2Settings() {
            if (!appState.rectAreaLight2) return;
            const cEl = document.getElementById('rect2Color');
            const iEl = document.getElementById('rect2Intensity');
            const color = cEl ? cEl.value : '#ffe0b3';
            const intensity = safeParseFloat(iEl ? iEl.value : 1.6, 1.6);
            appState.rectAreaLight2.color.set(getColor(color, 'three'));
            appState.rectAreaLight2.intensity = intensity;
            appState.needsRender = true;
        },

        updateDirectionalLight2Settings() {
            if (!appState.directionalLight2) return;
            const cEl = document.getElementById('directionalLight2Color');
            const iEl = document.getElementById('directionalLight2Intensity');
            const xEl = document.getElementById('directionalLight2PosX');
            const yEl = document.getElementById('directionalLight2PosY');
            const zEl = document.getElementById('directionalLight2PosZ');
            const color = cEl ? cEl.value : '#ffc080';
            const intensity = safeParseFloat(iEl ? iEl.value : 0.5, 0.5);
            const px = safeParseFloat(xEl ? xEl.value : -11, -11);
            const py = safeParseFloat(yEl ? yEl.value : -6, -6);
            const pz = safeParseFloat(zEl ? zEl.value : -14, -14);
            appState.directionalLight2.color.set(getColor(color, 'three'));
            appState.directionalLight2.intensity = intensity;
            appState.directionalLight2.position.set(px, py, pz).normalize();
            appState.needsRender = true;
        },

        updateCustomLightSettings() {
            if (!appState.customSpotLight || !appState.lightSourceMesh) return;
            const enEl = document.getElementById('customLightEnabled');
            const hpEl = document.getElementById('customLightHelperVisible');
            const enabled = enEl ? enEl.checked : false;
            const helperVisible = hpEl ? hpEl.checked : false;
            appState.customSpotLight.visible = !!enabled;
            appState.lightSourceMesh.visible = !!(enabled && helperVisible);
            appState.lightTargetMesh.visible = !!(enabled && helperVisible);
            if (appState.customSpotLightHelper) {
                appState.customSpotLightHelper.visible = !!(enabled && helperVisible);
            }

            if (!enabled) {
                if (appState.transformControls) appState.transformControls.detach();
                appState.needsRender = true;
                return;
            }

            const cEl = document.getElementById('customLightColor');
            const iEl = document.getElementById('customLightIntensity');
            const dEl = document.getElementById('customLightDistance');
            const aEl = document.getElementById('customLightAngle');
            const pEl = document.getElementById('customLightPenumbra');

            const colorHex = cEl ? cEl.value : '#ffffff';
            const intensity = safeParseFloat(iEl ? iEl.value : 20, 20) / 1000;
            const distance = safeParseFloat(dEl ? dEl.value : 500, 500);
            const angle = safeParseFloat(aEl ? aEl.value : 0.8, 0.8);
            const penumbra = safeParseFloat(pEl ? pEl.value : 0.2, 0.2);

            appState.customSpotLight.color.set(colorHex);
            appState.customSpotLight.intensity = intensity;
            appState.customSpotLight.distance = distance;
            appState.customSpotLight.angle = angle;
            appState.customSpotLight.penumbra = penumbra;

            const sxEl = document.getElementById('customLightSourcePosX');
            const syEl = document.getElementById('customLightSourcePosY');
            const szEl = document.getElementById('customLightSourcePosZ');
            const txEl = document.getElementById('customLightTargetPosX');
            const tyEl = document.getElementById('customLightTargetPosY');
            const tzEl = document.getElementById('customLightTargetPosZ');

            const sx = safeParseFloat(sxEl ? sxEl.value : 0, 0);
            const sy = safeParseFloat(syEl ? syEl.value : 0, 0);
            const sz = safeParseFloat(szEl ? szEl.value : 150, 150);
            const tx = safeParseFloat(txEl ? txEl.value : 0, 0);
            const ty = safeParseFloat(tyEl ? tyEl.value : 0, 0);
            const tz = safeParseFloat(tzEl ? tzEl.value : 0, 0);

            appState.customSpotLight.position.set(sx, sy, sz);
            appState.customSpotLight.target.position.set(tx, ty, tz);
            appState.lightSourceMesh.position.set(sx, sy, sz);
            appState.lightTargetMesh.position.set(tx, ty, tz);
            if (appState.customSpotLightHelper) appState.customSpotLightHelper.update();
            appState.needsRender = true;
        },

        setActiveGuideline(name) {
            appState.activeGuideline = name;
            const selectEl = document.getElementById('guidelineSelect');
            if (selectEl) selectEl.value = name;
            if (appState.guidelines) {
                for (const key in appState.guidelines) {
                    appState.guidelines[key].visible = (key === name);
                }
            }
            const posInput = document.getElementById('guidelinePosition');
            if (posInput) posInput.disabled = (name === 'none');
            this.updateLightOnGuideline();
            appState.needsRender = true;
        },

        updateGuidelineRadius() {
            const radEl = document.getElementById('guidelineRadius');
            const radius = safeParseFloat(radEl ? radEl.value : (APP_CONFIG.DEFAULT_GUIDELINE_RADIUS || 100), (APP_CONFIG.DEFAULT_GUIDELINE_RADIUS || 100));
            if (appState.guidelineGroup) {
                appState.guidelineGroup.scale.setScalar(radius / (APP_CONFIG.DEFAULT_GUIDELINE_RADIUS || 100));
            }
            this.updateLightOnGuideline();
            appState.needsRender = true;
        },

        updateLightOnGuideline() {
            if (appState.activeGuideline === 'none') return;
            const radEl = document.getElementById('guidelineRadius');
            const posEl = document.getElementById('guidelinePosition');
            const radius = safeParseFloat(radEl ? radEl.value : (APP_CONFIG.DEFAULT_GUIDELINE_RADIUS || 100), (APP_CONFIG.DEFAULT_GUIDELINE_RADIUS || 100));
            const angle = THREE.MathUtils.degToRad(safeParseFloat(posEl ? posEl.value : 0, 0));
            let pos = new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0);
            if (appState.guidelines && appState.guidelines[appState.activeGuideline]) {
                const guide = appState.guidelines[appState.activeGuideline];
                pos.applyEuler(guide.rotation);
            }

            if (appState.customSpotLight) appState.customSpotLight.position.copy(pos);
            if (appState.lightSourceMesh) appState.lightSourceMesh.position.copy(pos);
            const sx = document.getElementById('customLightSourcePosX');
            const sy = document.getElementById('customLightSourcePosY');
            const sz = document.getElementById('customLightSourcePosZ');
            if (sx) sx.value = pos.x.toFixed(0);
            if (sy) sy.value = pos.y.toFixed(0);
            if (sz) sz.value = pos.z.toFixed(0);
            if (appState.customSpotLightHelper && appState.customSpotLightHelper.visible) {
                appState.customSpotLightHelper.update();
            }
            appState.needsRender = true;
        },

        onWindowResize() {
            if (!appState.camera || !appState.renderer) return;
            const width = window.innerWidth;
            const height = window.innerHeight;
            appState.camera.aspect = width / height;
            appState.camera.updateProjectionMatrix();
            appState.renderer.setSize(width, height);
            if (appState.composer) {
                appState.composer.setSize(width, height);
            }
            if (window.AppUI && typeof AppUI.adjustSphereViewForPanel === 'function') {
                AppUI.adjustSphereViewForPanel();
            }
            if (appState.hoverOverlayCard && appState.hoverOverlayCard.visible && appState.hoveredObject) {
                const screen = appState.hoverOverlayCard.getObjectByName('textScreen');
                const tex = (screen && screen.material && screen.material.map) ? screen.material.map : null;
                if (tex && tex.image && window.updateHoverCardPosition) {
                    const scEl = document.getElementById('hoverOverlayCardScale');
                    const scaleVal = parseFloat(scEl ? scEl.value : '1.0');
                    window.updateHoverCardPosition(tex.image.width, tex.image.height, scaleVal);
                }
            }
            appState.needsRender = true;
        },

        zoomSphere(factor) {
            if (!appState.cardScaleMultiplier) appState.cardScaleMultiplier = 1.0;
            const prev = appState.cardScaleMultiplier;
            if (factor < 1.0) {
                appState.cardScaleMultiplier = Math.min(5.0, appState.cardScaleMultiplier * 1.2);
            } else {
                appState.cardScaleMultiplier = Math.max(0.2, appState.cardScaleMultiplier * 0.8);
            }
            const ratio = appState.cardScaleMultiplier / prev;
            if (appState.wordObjects && appState.wordObjects.length > 0) {
                appState.wordObjects.forEach(card => card.scale.multiplyScalar(ratio));
            }
            if (window.AppUI && typeof AppUI.showToast === 'function') {
                AppUI.showToast('卡片大小: ' + Math.round(appState.cardScaleMultiplier * 100) + '%');
            }
            if (navigator.vibrate) navigator.vibrate(20);
            appState.needsRender = true;
            if (window.AppUI && typeof AppUI.saveLastState === 'function') {
                AppUI.saveLastState();
            }
        },

        panSphere(deltaX, deltaY) {
            if (!appState.controls || !appState.camera) return;
            const factor = (appState.camera.position.length() || 165) * 0.0022;
            const right = new THREE.Vector3().setFromMatrixColumn(appState.camera.matrix, 0);
            const up = new THREE.Vector3().setFromMatrixColumn(appState.camera.matrix, 1);
            
            const move = right.multiplyScalar(deltaX * factor).add(up.multiplyScalar(-deltaY * factor));
            appState.controls.target.add(move);
            appState.camera.position.add(move);
            appState.controls.update();
            appState.needsRender = true;
        },

        resetSpherePan() {
            if (!appState.controls || !appState.camera) return;
            const offset = appState.controls.target.clone();
            appState.camera.position.sub(offset);
            appState.controls.target.set(0, 0, 0);
            appState.controls.update();
            appState.needsRender = true;
            if (window.AppUI && typeof AppUI.showToast === 'function') {
                AppUI.showToast('球体已重置回正中央');
            }
        },

        updateStudioLightSettings() {
            const enEl = document.getElementById('studioLightEnabled');
            const hpEl = document.getElementById('studioLightHelperVisible');
            const cEl = document.getElementById('studioLightColor');
            const iEl = document.getElementById('studioLightIntensity');
            const aEl = document.getElementById('studioLightAngle');

            const enabled = enEl ? enEl.checked : false;
            const helperVisible = hpEl ? hpEl.checked : false;
            const colorHex = cEl ? cEl.value : '#ffffff';
            const intensity = parseFloat(iEl ? iEl.value : '3.5');
            const angle = parseFloat(aEl ? aEl.value : '0.7');

            if (appState.studioSpotLight) appState.studioSpotLight.visible = !!enabled;
            if (appState.studioLightHelperMesh) appState.studioLightHelperMesh.visible = !!(enabled && helperVisible);

            if (!enabled) {
                appState.needsRender = true;
                return;
            }
            if (appState.studioSpotLight) {
                appState.studioSpotLight.color.set(colorHex);
                appState.studioSpotLight.intensity = intensity;
                appState.studioSpotLight.angle = angle;
            }

            const lx = (appState.studioLight && appState.studioLight.localX) || 0;
            const ly = (appState.studioLight && appState.studioLight.localY) || 0;
            if (appState.studioSpotLight) appState.studioSpotLight.position.set(lx, ly, 50);
            if (appState.studioSpotLightTarget) appState.studioSpotLightTarget.position.set(lx, ly, -200);

            if (appState.studioLightHelperMesh) {
                appState.studioLightHelperMesh.position.set(lx, ly, -100);
                const ringScale = Math.tan(angle) * 100;
                appState.studioLightHelperMesh.scale.setScalar(ringScale / 20);
            }
            appState.needsRender = true;
        },

        handleStudioLightDrag(event) {
            if (!appState.studioLightDragActive || !appState.camera) return;
            const container = document.getElementById('wordSphere');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const normX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const normY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            const fovRad = (appState.camera.fov * Math.PI) / 180;
            const planeHeightAt100 = 2 * Math.tan(fovRad / 2) * 100;
            const planeWidthAt100 = planeHeightAt100 * appState.camera.aspect;

            if (!appState.studioLight) appState.studioLight = {};
            appState.studioLight.localX = (normX * planeWidthAt100) / 2;
            appState.studioLight.localY = (normY * planeHeightAt100) / 2;
            this.updateStudioLightSettings();
        },

        animate(time) {
            if (time === undefined || time === null) time = performance.now();
            requestAnimationFrame((t) => AppScene.animate(t));

            if (!appState.controls || !appState.renderer || !appState.scene || !appState.camera) return;

            if (IS_MOBILE_DEVICE) {
                if (!appState.lastRenderTime) appState.lastRenderTime = time;
                const delta = time - appState.lastRenderTime;
                if (delta < 33.33) return;
                appState.lastRenderTime = time - (delta % 33.33);
            }

            const controlsChanged = appState.controls.update();
            let mustRender = controlsChanged || appState.needsRender;

            if (appState.autoRotate && appState.actualDisplayRotationSpeed > 0 && appState.rotationMultiplier > 0.001) mustRender = true;
            if (appState.hoverOverlayCard && appState.hoverOverlayCard.visible) mustRender = true;
            if (appState.vortexParticles && appState.vortexParticles.visible) mustRender = true;
            if (appState.clickBurstParticles && appState.clickBurstParticles.visible) mustRender = true;
            if (appState.coreSphere && appState.coreSphere.visible) mustRender = true;

            const cardMult = appState.cardScaleMultiplier || 1.0;
            appState.camera.getWorldPosition(AppMath.vecCamWorld);
            const radius = appState.sphereRadius || 85;
            const camDist = AppMath.vecCamWorld.length();
            const maxDist = camDist + radius;
            const minDist = camDist - radius;
            const distRange = 2 * radius;

            // 局部焦点巡航算法：严格限定只在面向镜头正面 (t < 0.42) 区域随机抽取放大
            if (appState.focusCruise && appState.focusCruise.enabled && appState.wordObjects.length > 0) {
                const fc = appState.focusCruise;
                if (time - fc.lastSwitchTime >= fc.interval * 1000) {
                    fc.lastSwitchTime = time;

                    const frontCandidateIndices = [];
                    for (let i = 0; i < appState.wordObjects.length; i++) {
                        const card = appState.wordObjects[i];
                        card.getWorldPosition(AppMath.vecCardWorld);
                        const dist = AppMath.vecCardWorld.distanceTo(AppMath.vecCamWorld);
                        const t = (dist - minDist) / distRange;
                        if (t < 0.42) {
                            frontCandidateIndices.push(i);
                        }
                    }

                    if (frontCandidateIndices.length > 0) {
                        if (!fc.visitedIndices) fc.visitedIndices = new Set();

                        let available = frontCandidateIndices.filter(idx => !fc.visitedIndices.has(idx));
                        if (available.length === 0) {
                            fc.visitedIndices.clear();
                            available = frontCandidateIndices;
                        }

                        for (let i = available.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [available[i], available[j]] = [available[j], available[i]];
                        }

                        const ratio = Math.max(0.01, Math.min(0.5, (fc.ratioPercent || 8) / 100));
                        const batchCount = Math.max(1, Math.min(available.length, Math.round(appState.wordObjects.length * ratio)));

                        const selected = available.slice(0, batchCount);
                        selected.forEach(idx => fc.visitedIndices.add(idx));
                        fc.currentSpotlightIndices = new Set(selected);
                    } else {
                        fc.currentSpotlightIndices = new Set();
                    }
                    mustRender = true;
                }
            }

            if (!mustRender) return;
            appState.needsRender = false;

            if (appState.vortexParticles && appState.vortexParticles.visible) {
                const baseSpeed = appState.rt.vortexSpeed !== undefined ? appState.rt.vortexSpeed : 0.003;
                appState.vortexParticles.rotation.y += baseSpeed;
            }

            if (appState.coreSphere && appState.coreSphere.visible) {
                appState.coreSphere.rotation.y += 0.0008;
            }

            // 查词卡位置与朝向：恒定锁定在摄像机正前方居中
            if (appState.hoverOverlayCard) {
                const card = appState.hoverOverlayCard;
                const lerpFactor = 0.15;
                card.scale.lerp(appState.overlayCardTargetScale, lerpFactor);

                const screen = card.userData.refs && card.userData.refs.screen ? card.userData.refs.screen : card.getObjectByName('textScreen');
                if (screen) {
                    const currentOp = screen.material.opacity;
                    const newOp = THREE.MathUtils.lerp(currentOp, appState.overlayCardTargetOpacity, lerpFactor);
                    screen.material.opacity = newOp;
                    if (card.userData.refs && card.userData.refs.backplate) {
                        card.userData.refs.backplate.material.opacity = newOp * appState.rt.hoverBgOpacity;
                    }
                    if (card.userData.refs && card.userData.refs.coreGlow) {
                        card.userData.refs.coreGlow.material.opacity = newOp * 0.75;
                    }
                    const frameGroup = card.userData.refs && card.userData.refs.frameGroup ? card.userData.refs.frameGroup : null;
                    if (frameGroup) {
                        frameGroup.children.forEach(child => {
                            child.material.opacity = newOp * 0.9;
                        });
                    }
                    card.visible = (newOp > 0.01 && card.scale.x > 0.01);
                }

                if (appState.overlayCardTargetPosition && card.visible) {
                    const distToFrontCard = Math.max(6, camDist - radius);
                    const distance = Math.max(10, Math.min(30, distToFrontCard * 0.72));

                    const camDir = new THREE.Vector3();
                    appState.camera.getWorldDirection(camDir);
                    const centerPoint = appState.camera.position.clone().add(camDir.multiplyScalar(distance));
                    appState.overlayCardTargetPosition.copy(centerPoint);

                    card.position.lerp(appState.overlayCardTargetPosition, lerpFactor);
                    card.quaternion.slerp(appState.camera.quaternion, lerpFactor);
                }
            }

            const baseRotationSpeed = appState.actualDisplayRotationSpeed * 0.0058 * appState.rotationMultiplier * appState.rotationMultiplierTemporary;

            if (appState.autoRotate && baseRotationSpeed > 0 && appState.wordSphereGroup && !appState.isFlowMode) {
                const rx = appState.rt.rotateX !== undefined ? appState.rt.rotateX : true;
                const ry = appState.rt.rotateY !== undefined ? appState.rt.rotateY : true;
                const rz = appState.rt.rotateZ !== undefined ? appState.rt.rotateZ : false;
                if (rx) appState.wordSphereGroup.rotation.x += baseRotationSpeed;
                if (ry) appState.wordSphereGroup.rotation.y += baseRotationSpeed;
                if (rz) appState.wordSphereGroup.rotation.z += baseRotationSpeed;
            }

            const shouldCardsRotate = appState.rt.cardSelfRotation !== undefined ? appState.rt.cardSelfRotation : true;
            const cardMasterSpeed = (appState.rt.cardRotationSpeed !== undefined ? appState.rt.cardRotationSpeed : 2) * 0.00115;

            if (appState.wordSphereGroup) {
                appState.wordSphereGroup.updateMatrixWorld(true);
            }

            // 球面卡片布局与焦点巡航放大
            if (!appState.isFlowMode) {
                const basePulse = 0.20 + Math.sin(time * 0.0012) * 0.15;
                const glassBreath = 0.95 + Math.sin(time * 0.0012) * 0.05;

                appState.wordObjects.forEach((card, idx) => {
                    card.getWorldPosition(AppMath.vecCardWorld);
                    const dist = AppMath.vecCardWorld.distanceTo(AppMath.vecCamWorld);
                    const t = THREE.MathUtils.clamp((dist - minDist) / distRange, 0, 1);

                    // ★ 修复：收敛 depthScale，原 1.4~0.32 过度拉大前后差距，现调为 1.12~0.72 柔和透视
                    const depthScale = THREE.MathUtils.lerp(1.12, 0.72, t);
                    const normalizedY = card.position.y / radius;
                    const latScale = 1.0 - 0.35 * (normalizedY * normalizedY);

                    // ★ 巡航放大平滑插值与绝对上限保护：
                    // 确保每次放大的基数恒定为 1.0，绝不叠乘累加，并在帧间平滑呼吸缩放
                    if (!card.userData.spotlightLerp) card.userData.spotlightLerp = 1.0;
                    const isSpotlightTarget = (appState.focusCruise && appState.focusCruise.enabled && appState.focusCruise.currentSpotlightIndices.has(idx) && t < 0.48);
                    const targetSpotlightMult = isSpotlightTarget ? (appState.focusCruise.scaleFactor || 1.5) : 1.0;
                    
                    // 帧间平滑呼吸缩放 (lerp)
                    card.userData.spotlightLerp = THREE.MathUtils.lerp(card.userData.spotlightLerp, targetSpotlightMult, 0.08);

                    // 边缘防跳变消隐：离开正面视野时平滑衰减
                    const frontFade = THREE.MathUtils.clamp((0.50 - t) / 0.10, 0, 1);
                    const effectiveSpotlightScale = 1.0 + (card.userData.spotlightLerp - 1.0) * frontFade;

                    // ★ 绝对尺寸天花板封顶保护：即使离镜头极近，也绝不超过基准上限，杜绝巨无霸大卡片
                    const maxAllowedScale = cardMult * (appState.focusCruise.scaleFactor || 1.5) * 1.25;
                    const rawCalculatedScale = latScale * depthScale * cardMult * effectiveSpotlightScale;
                    const finalScale = Math.min(maxAllowedScale, rawCalculatedScale);

                    card.scale.set(finalScale, finalScale, finalScale);

                    const frontOpacity = THREE.MathUtils.lerp(0.95, 0.15, t) * glassBreath;
                    const sideOpacity = THREE.MathUtils.lerp(0.35, 0.05, t) * glassBreath;

                    if (Array.isArray(card.material)) {
                        if (card.material[0]) card.material[0].opacity = frontOpacity;
                        if (card.material[1]) {
                            card.material[1].opacity = sideOpacity;
                            const spotlightBoost = isSpotlightTarget ? 1.6 : 1.0;
                            card.material[1].emissiveIntensity = basePulse * (1.0 - t) * 1.5 * spotlightBoost;
                        }
                    } else if (card.material) {
                        card.material.opacity = frontOpacity;
                    }
                });

                AppMath.quadParentInv.copy(appState.wordSphereGroup.quaternion).invert();
                AppMath.quadParentInv.multiply(appState.camera.quaternion);

                appState.wordObjects.forEach(card => {
                    card.quaternion.copy(AppMath.quadParentInv);
                    if (shouldCardsRotate && cardMasterSpeed > 0) {
                        card.rotateOnAxis(card.userData.rotationAxis, card.userData.rotationSpeed * cardMasterSpeed);
                    }
                });
            }

            const vfEl = document.getElementById('visualEffectsEnabled');
            const isBloomActive = !!((vfEl && vfEl.checked) || (appState.rt && appState.rt.visualFxEnabled));
            if (isBloomActive && appState.composer) {
                appState.composer.render();
            } else {
                appState.renderer.render(appState.scene, appState.camera);
            }
        }
    };

    window.AppScene = AppScene;
})();
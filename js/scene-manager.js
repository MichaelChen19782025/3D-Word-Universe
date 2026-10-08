/**
 * 3D单词宇宙 - Three.js 核心场景管理与渲染管线
 * 局部焦点巡航：可调百分比抽取放大，运动中单词绝不擅自突变
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
            container.appendChild(appState.renderer.domElement);

            const renderScene = new THREE.RenderPass(appState.scene, appState.camera);
            appState.bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.5, 0.2, 0.8
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

            appState.controls.addEventListener('start', () => {
                if (appState.selectedLightControl) {
                    appState.selectedLightControl.material.emissive.setHex(0x000000);
                    appState.selectedLightControl = null;
                    if (appState.transformControls) appState.transformControls.detach();
                }
            });

            appState.controls.addEventListener('end', () => {
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
            appState.hemisphereLight = new THREE.HemisphereLight(0xadd8e6, 0x404040, 2.0);
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

            if (THREE.RectAreaLightUniformsLib) THREE.RectAreaLightUniformsLib.init();

            appState.rectAreaLight1 = new THREE.RectAreaLight(0xffffff, 8.0, 200, 200);
            appState.rectAreaLight1.position.set(0, 150, 50);
            appState.rectAreaLight1.lookAt(0, 0, 0);
            appState.scene.add(appState.rectAreaLight1);

            appState.rectAreaLight2 = new THREE.RectAreaLight(0xffe0b3, 5.0, 250, 250);
            appState.rectAreaLight2.position.set(-180, 50, -50);
            appState.rectAreaLight2.lookAt(0, 0, 0);
            appState.scene.add(appState.rectAreaLight2);

            appState.directionalLight2 = new THREE.DirectionalLight(APP_CONFIG.DEFAULT_DIRECTIONAL_LIGHT_2_COLOR, APP_CONFIG.DEFAULT_DIRECTIONAL_LIGHT_2_INTENSITY);
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

            appState.transformControls = new THREE.TransformControls(appState.camera, appState.renderer.domElement);
            appState.transformControls.setMode('translate');
            appState.transformControls.setSpace('world');
            appState.scene.add(appState.transformControls);

            appState.transformControls.addEventListener('dragging-changed', (event) => {
                appState.controls.enabled = !event.value;
            });

            this.initGuidelines();
        },

        initGuidelines() {
            appState.guidelineGroup = new THREE.Group();
            appState.scene.add(appState.guidelineGroup);
            const radius = APP_CONFIG.DEFAULT_GUIDELINE_RADIUS;
            const guideConfigs = {
                'xy': { rotation: [0, 0, 0] },
                'yz': { rotation: [0, Math.PI / 2, 0] },
                'xz': { rotation: [Math.PI / 2, 0, 0] },
                'xy_45': { rotation: [0, 0, Math.PI / 4] },
                'yz_45': { rotation: [0, Math.PI / 4, 0] }
            };
            const material = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3 });
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
            const sky = document.getElementById('hemiSkyColor')?.value || '#add8e6';
            const ground = document.getElementById('hemiGroundColor')?.value || '#404040';
            const intensity = safeParseFloat(document.getElementById('hemiIntensity')?.value, 2.0);
            appState.hemisphereLight.color.set(getColor(sky, 'three'));
            appState.hemisphereLight.groundColor.set(getColor(ground, 'three'));
            appState.hemisphereLight.intensity = intensity;
            appState.needsRender = true;
        },

        updateRectAreaLight1Settings() {
            if (!appState.rectAreaLight1) return;
            const color = document.getElementById('rect1Color')?.value || '#ffffff';
            const intensity = safeParseFloat(document.getElementById('rect1Intensity')?.value, 8.0);
            appState.rectAreaLight1.color.set(getColor(color, 'three'));
            appState.rectAreaLight1.intensity = intensity;
            appState.needsRender = true;
        },

        updateRectAreaLight2Settings() {
            if (!appState.rectAreaLight2) return;
            const color = document.getElementById('rect2Color')?.value || '#ffe0b3';
            const intensity = safeParseFloat(document.getElementById('rect2Intensity')?.value, 5.0);
            appState.rectAreaLight2.color.set(getColor(color, 'three'));
            appState.rectAreaLight2.intensity = intensity;
            appState.needsRender = true;
        },

        updateDirectionalLight2Settings() {
            if (!appState.directionalLight2) return;
            const color = document.getElementById('directionalLight2Color')?.value || '#ffc080';
            const intensity = safeParseFloat(document.getElementById('directionalLight2Intensity')?.value, 0.65);
            const px = safeParseFloat(document.getElementById('directionalLight2PosX')?.value, -11);
            const py = safeParseFloat(document.getElementById('directionalLight2PosY')?.value, -6);
            const pz = safeParseFloat(document.getElementById('directionalLight2PosZ')?.value, -14);
            appState.directionalLight2.color.set(getColor(color, 'three'));
            appState.directionalLight2.intensity = intensity;
            appState.directionalLight2.position.set(px, py, pz).normalize();
            appState.needsRender = true;
        },

        updateCustomLightSettings() {
            if (!appState.customSpotLight || !appState.lightSourceMesh) return;
            const enabled = document.getElementById('customLightEnabled')?.checked;
            const helperVisible = document.getElementById('customLightHelperVisible')?.checked;
            appState.customSpotLight.visible = !!enabled;
            appState.lightSourceMesh.visible = !!(enabled && helperVisible);
            appState.lightTargetMesh.visible = !!(enabled && helperVisible);
            appState.customSpotLightHelper.visible = !!(enabled && helperVisible);

            if (!enabled) {
                if (appState.transformControls) appState.transformControls.detach();
                appState.needsRender = true;
                return;
            }

            const colorHex = document.getElementById('customLightColor')?.value || '#ffffff';
            const intensity = safeParseFloat(document.getElementById('customLightIntensity')?.value, 20) / 1000;
            const distance = safeParseFloat(document.getElementById('customLightDistance')?.value, 500);
            const angle = safeParseFloat(document.getElementById('customLightAngle')?.value, 0.8);
            const penumbra = safeParseFloat(document.getElementById('customLightPenumbra')?.value, 0.2);

            appState.customSpotLight.color.set(colorHex);
            appState.customSpotLight.intensity = intensity;
            appState.customSpotLight.distance = distance;
            appState.customSpotLight.angle = angle;
            appState.customSpotLight.penumbra = penumbra;

            const sx = safeParseFloat(document.getElementById('customLightSourcePosX')?.value, 0);
            const sy = safeParseFloat(document.getElementById('customLightSourcePosY')?.value, 0);
            const sz = safeParseFloat(document.getElementById('customLightSourcePosZ')?.value, 150);
            const tx = safeParseFloat(document.getElementById('customLightTargetPosX')?.value, 0);
            const ty = safeParseFloat(document.getElementById('customLightTargetPosY')?.value, 0);
            const tz = safeParseFloat(document.getElementById('customLightTargetPosZ')?.value, 0);

            appState.customSpotLight.position.set(sx, sy, sz);
            appState.customSpotLight.target.position.set(tx, ty, tz);
            appState.lightSourceMesh.position.set(sx, sy, sz);
            appState.lightTargetMesh.position.set(tx, ty, tz);
            appState.customSpotLightHelper.update();
            appState.needsRender = true;
        },

        setActiveGuideline(name) {
            appState.activeGuideline = name;
            const selectEl = document.getElementById('guidelineSelect');
            if (selectEl) selectEl.value = name;
            for (const key in appState.guidelines) {
                appState.guidelines[key].visible = (key === name);
            }
            const posInput = document.getElementById('guidelinePosition');
            if (posInput) posInput.disabled = (name === 'none');
            this.updateLightOnGuideline();
            appState.needsRender = true;
        },

        updateGuidelineRadius() {
            const radius = safeParseFloat(document.getElementById('guidelineRadius')?.value, APP_CONFIG.DEFAULT_GUIDELINE_RADIUS);
            appState.guidelineGroup.scale.setScalar(radius / APP_CONFIG.DEFAULT_GUIDELINE_RADIUS);
            this.updateLightOnGuideline();
            appState.needsRender = true;
        },

        updateLightOnGuideline() {
            if (appState.activeGuideline === 'none') return;
            const radius = safeParseFloat(document.getElementById('guidelineRadius')?.value, APP_CONFIG.DEFAULT_GUIDELINE_RADIUS);
            const angle = THREE.MathUtils.degToRad(safeParseFloat(document.getElementById('guidelinePosition')?.value, 0));
            let pos = new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0);
            const guide = appState.guidelines[appState.activeGuideline];
            if (guide) pos.applyEuler(guide.rotation);

            appState.customSpotLight.position.copy(pos);
            appState.lightSourceMesh.position.copy(pos);
            const sx = document.getElementById('customLightSourcePosX');
            const sy = document.getElementById('customLightSourcePosY');
            const sz = document.getElementById('customLightSourcePosZ');
            if (sx) sx.value = pos.x.toFixed(0);
            if (sy) sy.value = pos.y.toFixed(0);
            if (sz) sz.value = pos.z.toFixed(0);
            if (appState.customSpotLightHelper.visible) appState.customSpotLightHelper.update();
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
                AppUI.showToast(`🪐 球面卡片大小: ${Math.round(appState.cardScaleMultiplier * 100)}%`);
            }
            if (navigator.vibrate) navigator.vibrate(20);
            appState.needsRender = true;
            if (window.AppUI && typeof AppUI.saveLastState === 'function') {
                AppUI.saveLastState();
            }
        },

        updateStudioLightSettings() {
            const enabled = document.getElementById('studioLightEnabled')?.checked;
            const helperVisible = document.getElementById('studioLightHelperVisible')?.checked;
            const colorHex = document.getElementById('studioLightColor')?.value || '#ffffff';
            const intensity = parseFloat(document.getElementById('studioLightIntensity')?.value || '3.5');
            const angle = parseFloat(document.getElementById('studioLightAngle')?.value || '0.7');

            appState.studioSpotLight.visible = !!enabled;
            appState.studioLightHelperMesh.visible = !!(enabled && helperVisible);

            if (!enabled) {
                appState.needsRender = true;
                return;
            }
            appState.studioSpotLight.color.set(colorHex);
            appState.studioSpotLight.intensity = intensity;
            appState.studioSpotLight.angle = angle;

            const lx = appState.studioLight.localX || 0;
            const ly = appState.studioLight.localY || 0;
            appState.studioSpotLight.position.set(lx, ly, 50);
            appState.studioSpotLightTarget.position.set(lx, ly, -200);

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
            const rect = container.getBoundingClientRect();
            const normX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const normY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            const fovRad = (appState.camera.fov * Math.PI) / 180;
            const planeHeightAt100 = 2 * Math.tan(fovRad / 2) * 100;
            const planeWidthAt100 = planeHeightAt100 * appState.camera.aspect;

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

            if (appState.cardEmbersLives) {
                for (let i = 0; i < appState.cardEmbersLives.length; i++) {
                    if (appState.cardEmbersLives[i] > 0) { mustRender = true; break; }
                }
            }

            const cardMult = appState.cardScaleMultiplier || 1.0;

            // ==================== 局部焦点巡航算法 ====================
            // 保持绝大多数卡片尺寸不变，按周期循环抽取 ratioPercent% 放大至 scaleFactor 倍
            if (appState.focusCruise && appState.focusCruise.enabled && appState.wordObjects.length > 0) {
                const fc = appState.focusCruise;
                if (time - fc.lastSwitchTime >= fc.interval * 1000) {
                    fc.lastSwitchTime = time;
                    if (!fc.remainingPool || fc.remainingPool.length === 0) {
                        fc.remainingPool = Array.from({ length: appState.wordObjects.length }, (_, i) => i);
                        for (let i = fc.remainingPool.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [fc.remainingPool[i], fc.remainingPool[j]] = [fc.remainingPool[j], fc.remainingPool[i]];
                        }
                    }
                    const ratio = Math.max(0.01, Math.min(0.5, (fc.ratioPercent || 8) / 100));
                    const batchCount = Math.max(1, Math.round(appState.wordObjects.length * ratio));
                    const newIndices = fc.remainingPool.splice(0, batchCount);
                    fc.currentSpotlightIndices = new Set(newIndices);
                    mustRender = true;
                }
            }

            // 传送带流滚动模式（完全移除动态换词逻辑，保证单词绝不自动乱变）
            if (appState.isFlowMode && appState.wordObjects && appState.wordObjects.length > 0) {
                const fovRad = (appState.camera.fov * Math.PI) / 180;
                const dist = appState.camera.position.length() || 165;
                const visH = 2 * Math.tan(fovRad / 2) * dist * 0.82;
                const visW = visH * appState.camera.aspect;

                const screenH = window.innerHeight || 800;
                const minGapUnits = (visH / screenH) * 5;

                const mode = appState.flowModeType;
                const isHorizontal = (mode === 'top_row' || mode === 'center_row' || mode === 'bottom_row');

                const baseCardW = 12 * cardMult;
                const baseCardH = 6 * cardMult;
                const total = appState.wordObjects.length;

                let minStep, span, halfSpan;
                if (isHorizontal) {
                    minStep = baseCardW + minGapUnits;
                    span = Math.max(visW * 1.3, minStep * total);
                } else {
                    minStep = baseCardH + minGapUnits;
                    span = Math.max(visH * 1.3, minStep * total);
                }
                halfSpan = span / 2;

                const baseSpeed = 0.06 * (appState.actualDisplayRotationSpeed / APP_CONFIG.DEFAULT_ROTATION_SPEED);
                const flowSpeed = baseSpeed * (appState.rotationMultiplier !== undefined ? appState.rotationMultiplier : 1.0) * (appState.rotationMultiplierTemporary !== undefined ? appState.rotationMultiplierTemporary : 1.0);

                appState.wordObjects.forEach((card, idx) => {
                    card.quaternion.identity();
                    const isSpotlight = appState.focusCruise && appState.focusCruise.enabled && appState.focusCruise.currentSpotlightIndices.has(idx);
                    const localScale = cardMult * (isSpotlight ? (appState.focusCruise.scaleFactor || 1.5) : 1.0);
                    card.scale.set(localScale, localScale, localScale);

                    if (isHorizontal) {
                        card.position.x += flowSpeed;
                        if (card.position.x > halfSpan) {
                            card.position.x -= span;
                        }
                    } else {
                        card.position.y += flowSpeed;
                        if (card.position.y > halfSpan) {
                            card.position.y -= span;
                        }
                    }
                });
                mustRender = true;
            }

            if (!mustRender) return;
            appState.needsRender = false;

            if (appState.vortexParticles && appState.vortexParticles.visible) {
                const baseSpeed = appState.rt.vortexSpeed !== undefined ? appState.rt.vortexSpeed : 0.02;
                let dynamicSpeed = baseSpeed;
                const model = appState.rt.vortexModel;
                switch(model) {
                    case 'sine-ease': dynamicSpeed = baseSpeed * (1 + 0.5 * Math.sin(time * 0.001)); break;
                    case 'pulse': dynamicSpeed = baseSpeed * (1 + 2 * Math.pow(Math.sin(time * 0.002), 8)); break;
                    case 'damped-oscillation': dynamicSpeed = baseSpeed * (1 + 0.5 * Math.sin(time * 0.005) * Math.exp(-0.0001 * time)); break;
                    default: break;
                }
                appState.vortexParticles.rotation.y += dynamicSpeed;
            }

            if (appState.coreSphere && appState.coreSphere.visible) {
                appState.coreSphere.rotation.y += 0.0008;
            }

            if (appState.hoverOverlayCard) {
                const card = appState.hoverOverlayCard;
                const lerpFactor = 0.1;
                card.scale.lerp(appState.overlayCardTargetScale, lerpFactor);

                const screen = card.userData.refs?.screen;
                if (screen) {
                    const currentOp = screen.material.opacity;
                    const newOp = THREE.MathUtils.lerp(currentOp, appState.overlayCardTargetOpacity, lerpFactor);
                    screen.material.opacity = newOp;
                    if (card.userData.refs.backplate) {
                        card.userData.refs.backplate.material.opacity = newOp * appState.rt.hoverBgOpacity;
                    }
                    if (card.userData.refs.coreGlow) {
                        card.userData.refs.coreGlow.material.opacity = newOp * 0.75;
                    }
                    const frameGroup = card.userData.refs.frameGroup;
                    if (frameGroup) {
                        frameGroup.children.forEach(child => {
                            child.material.opacity = newOp * 0.9;
                        });
                    }
                    card.visible = (newOp > 0.01 && card.scale.x > 0.01);
                }

                if (appState.overlayCardTargetPosition) {
                    card.position.lerp(appState.overlayCardTargetPosition, lerpFactor);
                    card.quaternion.slerp(appState.camera.quaternion, lerpFactor);
                }
            }

            const grappleFactor = (window.AppSphereEngine && typeof AppSphereEngine.tickGrapple === 'function') ? AppSphereEngine.tickGrapple(time) : 1.0;
            const baseRotationSpeed = appState.actualDisplayRotationSpeed * 0.0058 * appState.rotationMultiplier * appState.rotationMultiplierTemporary;

            if (appState.autoRotate && baseRotationSpeed > 0 && appState.wordSphereGroup && !appState.isFlowMode) {
                let dynamicSpeed = baseRotationSpeed * grappleFactor;
                if (appState.rotationModel === 'sine-ease') {
                    dynamicSpeed = baseRotationSpeed * grappleFactor * (1.25 + 0.75 * Math.sin(time * 0.0005));
                }
                const rx = appState.rt.rotateX !== undefined ? appState.rt.rotateX : true;
                const ry = appState.rt.rotateY !== undefined ? appState.rt.rotateY : true;
                const rz = appState.rt.rotateZ !== undefined ? appState.rt.rotateZ : false;
                if (rx) appState.wordSphereGroup.rotation.x += dynamicSpeed;
                if (ry) appState.wordSphereGroup.rotation.y += dynamicSpeed;
                if (rz) appState.wordSphereGroup.rotation.z += dynamicSpeed;
            }

            if (window.AppSphereEngine && typeof AppSphereEngine.updateGrappleEffects === 'function') {
                AppSphereEngine.updateGrappleEffects();
            }

            appState.camera.getWorldPosition(AppMath.vecCamWorld);
            const shouldCardsRotate = appState.rt.cardSelfRotation !== undefined ? appState.rt.cardSelfRotation : true;
            const cardMasterSpeed = (appState.rt.cardRotationSpeed !== undefined ? appState.rt.cardRotationSpeed : 2) * 0.00115;

            if (appState.wordSphereGroup) {
                appState.wordSphereGroup.updateMatrixWorld(true);
            }

            // 球面卡片布局与焦点巡航放大
            if (!appState.isFlowMode) {
                const radius = appState.sphereRadius || 85;
                const camDist = AppMath.vecCamWorld.length();
                const maxDist = camDist + radius;
                const minDist = camDist - radius;
                const distRange = 2 * radius;

                const basePulse = 0.20 + Math.sin(time * 0.0012) * 0.15;
                const glassBreath = 0.95 + Math.sin(time * 0.0012) * 0.05;

                appState.wordObjects.forEach((card, idx) => {
                    card.getWorldPosition(AppMath.vecCardWorld);
                    const dist = AppMath.vecCardWorld.distanceTo(AppMath.vecCamWorld);
                    const t = THREE.MathUtils.clamp((dist - minDist) / distRange, 0, 1);

                    const depthScale = THREE.MathUtils.lerp(1.4, 0.32, t);
                    const normalizedY = card.position.y / radius;
                    const latScale = 1.0 - 0.45 * (normalizedY * normalizedY);

                    const isSpotlight = appState.focusCruise && appState.focusCruise.enabled && appState.focusCruise.currentSpotlightIndices.has(idx);
                    const spotlightScale = isSpotlight ? (appState.focusCruise.scaleFactor || 1.5) : 1.0;

                    const finalScale = latScale * depthScale * cardMult * spotlightScale;
                    card.scale.set(finalScale, finalScale, finalScale);

                    const frontOpacity = THREE.MathUtils.lerp(0.95, 0.15, t) * glassBreath;
                    const sideOpacity = THREE.MathUtils.lerp(0.35, 0.05, t) * glassBreath;

                    if (Array.isArray(card.material)) {
                        if (card.material[0]) card.material[0].opacity = frontOpacity;
                        if (card.material[1]) {
                            card.material[1].opacity = sideOpacity;
                            const spotlightBoost = isSpotlight ? 1.8 : 1.0;
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

            if (appState.activeCardObject && appState.activeCardObject.userData.hoverSideMaterial) {
                appState.activeCardObject.userData.hoverSideMaterial.emissiveIntensity = 0.78 + Math.sin(time * 0.0043) * 0.68;
            }

            const isBloomActive = !!(document.getElementById('visualEffectsEnabled')?.checked || appState.rt.visualFxEnabled);
            if (isBloomActive && appState.composer) {
                appState.composer.render();
            } else {
                appState.renderer.render(appState.scene, appState.camera);
            }
        }
    };

    window.AppScene = AppScene;
})();
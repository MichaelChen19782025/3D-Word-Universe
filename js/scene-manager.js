/**
 * 3D单词宇宙 - Three.js 核心场景、相机、控制器、灯光组及按需节能渲染管线
 * (IIFE 封闭作用域，杜绝全局变量污染与同名冲突)
 */
(function() {
    const _scratchVecCamWorld = new THREE.Vector3();
    const _scratchVecCardWorld = new THREE.Vector3();
    const _scratchQuadParentInv = new THREE.Quaternion();

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

            // 后期处理辉光通道
            const renderScene = new THREE.RenderPass(appState.scene, appState.camera);
            appState.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
            appState.composer = new THREE.EffectComposer(appState.renderer);
            appState.composer.addPass(renderScene);
            appState.composer.addPass(appState.bloomPass);

            // 控制器
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

            // 初始化所有灯光
            this.initLights();

            // 窗口响应监听
            window.addEventListener('resize', () => this.onWindowResize());

            // 启动主渲染循环
            this.animate();
        },

        initLights() {
            appState.hemisphereLight = new THREE.HemisphereLight(0xadd8e6, 0x404040, 2.0);
            appState.scene.add(appState.hemisphereLight);
            appState.scene.add(appState.camera);

            // 棚镜补光聚光灯
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

            // 自定义聚光灯与目标
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

            // TransformControls
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

        onWindowResize() {
            if (!appState.camera || !appState.renderer) return;
            const width = window.innerWidth;
            const height = window.innerHeight;
            appState.camera.aspect = width / height;
            appState.camera.updateProjectionMatrix();
            appState.renderer.setSize(width, height);
            appState.composer.setSize(width, height);
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

            if (!enabled) return;
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

        // 核心渲染循环（支持按需节能与零功耗静止）
        animate(time) {
            if (time === undefined || time === null) time = performance.now();
            requestAnimationFrame((t) => AppScene.animate(t));

            if (!appState.controls || !appState.renderer || !appState.scene || !appState.camera) return;

            // 移动端帧率节流保护
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

            if (appState.cardEmbersLives) {
                for (let i = 0; i < appState.cardEmbersLives.length; i++) {
                    if (appState.cardEmbersLives[i] > 0) { mustRender = true; break; }
                }
            }

            const cardMult = appState.cardScaleMultiplier || 1.0;

            // 流式传送带模式滚动更新
            if (appState.isFlowMode && appState.wordObjects && appState.wordObjects.length > 0) {
                const fovRad = (appState.camera.fov * Math.PI) / 180;
                const dist = appState.camera.position.length() || 165;
                const visH = 2 * Math.tan(fovRad / 2) * dist * 0.82;
                const visW = visH * appState.camera.aspect;

                const mode = appState.flowModeType;
                const isHorizontal = (mode === 'top_row' || mode === 'center_row' || mode === 'bottom_row');
                const total = appState.wordObjects.length;
                const baseCardW = 12 * cardMult;
                const baseCardH = 6 * cardMult;

                let minStep, span, halfSpan;
                if (isHorizontal) {
                    minStep = baseCardW + (visH / window.innerHeight) * 5;
                    span = Math.max(visW * 1.3, minStep * total);
                } else {
                    minStep = baseCardH + (visH / window.innerHeight) * 5;
                    span = Math.max(visH * 1.3, minStep * total);
                }
                halfSpan = span / 2;

                const baseSpeed = 0.06 * (appState.actualDisplayRotationSpeed / APP_CONFIG.DEFAULT_ROTATION_SPEED);
                const flowSpeed = baseSpeed * appState.rotationMultiplier * appState.rotationMultiplierTemporary;
                const batchWords = appState.currentBatchWords;

                appState.wordObjects.forEach(card => {
                    card.quaternion.identity();
                    card.scale.set(cardMult, cardMult, cardMult);
                    if (isHorizontal) {
                        card.position.x += flowSpeed;
                        if (card.position.x > halfSpan) {
                            card.position.x -= span;
                            if (batchWords && batchWords.length > 0) {
                                const nextWord = batchWords[appState.flowWordIndex % batchWords.length];
                                appState.flowWordIndex++;
                                AppCardFactory.updateCardWordData(card, nextWord);
                            }
                        }
                    } else {
                        card.position.y += flowSpeed;
                        if (card.position.y > halfSpan) {
                            card.position.y -= span;
                            if (batchWords && batchWords.length > 0) {
                                const nextWord = batchWords[appState.flowWordIndex % batchWords.length];
                                appState.flowWordIndex++;
                                AppCardFactory.updateCardWordData(card, nextWord);
                            }
                        }
                    }
                });
                mustRender = true;
            }

            if (!mustRender) return;
            appState.needsRender = false;

            // 涡旋与核心发光球转动
            if (appState.vortexParticles && appState.vortexParticles.visible) {
                appState.vortexParticles.rotation.y += appState.rt.vortexSpeed;
            }
            if (appState.coreSphere) appState.coreSphere.rotation.y += 0.00035;

            // 悬浮 3D 卡片平滑动画插值
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
                        card.userData.refs.coreGlow.material.opacity = newOp * 1.5;
                    }
                    if (newOp > 0.01 && card.scale.x > 0.01) {
                        card.visible = true;
                    } else {
                        card.visible = false;
                    }
                }

                if (appState.overlayCardTargetPosition) {
                    card.position.lerp(appState.overlayCardTargetPosition, lerpFactor);
                    card.quaternion.slerp(appState.camera.quaternion, lerpFactor);
                }
            }

            appState.camera.getWorldPosition(_scratchVecCamWorld);

            // 擒拿与轨道自转
            const grappleFactor = AppOrbit.tickGrapple(time);
            const baseRotationSpeed = appState.actualDisplayRotationSpeed * 0.012 * appState.rotationMultiplier * appState.rotationMultiplierTemporary;

            if (appState.autoRotate && baseRotationSpeed > 0 && appState.wordSphereGroup && !appState.isFlowMode) {
                let dynamicSpeed = baseRotationSpeed * grappleFactor;
                if (appState.rotationModel === 'sine-ease') {
                    dynamicSpeed = baseRotationSpeed * grappleFactor * (1.25 + 0.75 * Math.sin(time * 0.0005));
                }
                const lanes = appState.orbitLanes;
                for (let i = 0; i < lanes.length; i++) {
                    lanes[i].group.rotateZ(dynamicSpeed * lanes[i].speedFactor * lanes[i].dir);
                }
            }

            AppOrbit.updateGrappleEffects();

            // 维持卡片正对屏幕
            if (!appState.isFlowMode && appState.wordSphereGroup) {
                const parentQuat = appState.wordSphereGroup.quaternion;
                const camQuat = appState.camera.quaternion;
                appState.orbitLanes.forEach(lane => {
                    _scratchQuadParentInv.copy(parentQuat).multiply(lane.group.quaternion).invert().multiply(camQuat);
                    const children = lane.group.children;
                    for (let i = 0; i < children.length; i++) {
                        const card = children[i];
                        card.quaternion.copy(_scratchQuadParentInv);
                        if (appState.rt.cardSelfRotation && appState.rt.cardRotationSpeed > 0) {
                            card.rotateOnAxis(card.userData.rotationAxis, card.userData.rotationSpeed * appState.rt.cardRotationSpeed);
                        }
                    }
                });
            }

            // 最终渲染
            if (appState.rt.visualFxEnabled && appState.composer) {
                appState.composer.render();
            } else {
                appState.renderer.render(appState.scene, appState.camera);
            }
        }
    };

    window.AppScene = AppScene;
})();
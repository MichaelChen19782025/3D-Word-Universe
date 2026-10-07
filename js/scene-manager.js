/**
 * 3D单词宇宙 - Three.js 核心场景管理与渲染管线
 * 核心还原：原版图 2 的立体球形纬度/深度缩放与呼吸透视
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
            appState.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
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

        // 核心渲染循环：完美复原图 2 的透视深度、球体弧度与呼吸光效
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

            if (appState.cardEmbersLives) {
                for (let i = 0; i < appState.cardEmbersLives.length; i++) {
                    if (appState.cardEmbersLives[i] > 0) { mustRender = true; break; }
                }
            }

            const cardMult = appState.cardScaleMultiplier || 1.0;

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

            if (appState.vortexParticles && appState.vortexParticles.visible) {
                appState.vortexParticles.rotation.y += appState.rt.vortexSpeed;
            }
            if (appState.coreSphere) appState.coreSphere.rotation.y += 0.00035;

            // 悬浮大卡片动画插值
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
                    card.visible = (newOp > 0.01 && card.scale.x > 0.01);
                }

                if (appState.overlayCardTargetPosition) {
                    card.position.lerp(appState.overlayCardTargetPosition, lerpFactor);
                    card.quaternion.slerp(appState.camera.quaternion, lerpFactor);
                }
            }

            // 球体自转与擒拿加速
            const grappleFactor = AppSphereEngine.tickGrapple(time);
            const baseRotationSpeed = appState.actualDisplayRotationSpeed * 0.0058 * appState.rotationMultiplier * appState.rotationMultiplierTemporary;

            if (appState.autoRotate && baseRotationSpeed > 0 && appState.wordSphereGroup && !appState.isFlowMode) {
                let dynamicSpeed = baseRotationSpeed * grappleFactor;
                if (appState.rotationModel === 'sine-ease') {
                    dynamicSpeed = baseRotationSpeed * grappleFactor * (1.25 + 0.75 * Math.sin(time * 0.0005));
                }
                const rx = document.getElementById('rotateX');
                const ry = document.getElementById('rotateY');
                const rz = document.getElementById('rotateZ');
                if (rx && rx.checked) appState.wordSphereGroup.rotation.x += dynamicSpeed;
                if (ry && ry.checked) appState.wordSphereGroup.rotation.y += dynamicSpeed;
                if (rz && rz.checked) appState.wordSphereGroup.rotation.z += dynamicSpeed;
            }

            AppSphereEngine.updateGrappleEffects();

            appState.camera.getWorldPosition(AppMath.vecCamWorld);
            const shouldCardsRotate = document.getElementById('cardSelfRotation')?.checked;
            const cardMasterSpeed = parseFloat(document.getElementById('cardRotationSpeed')?.value || '2') * 0.00115;

            if (appState.wordSphereGroup) {
                appState.wordSphereGroup.updateMatrixWorld(true);
            }

            // 💡 图 2 核心视觉：根据到相机的距离 t 和纬度 Y 进行自适应缩放，营造完美球体立体弧度
            if (!appState.isFlowMode) {
                const radius = appState.sphereRadius || 85;
                const camDist = AppMath.vecCamWorld.length();
                const maxDist = camDist + radius;
                const minDist = camDist - radius;
                const distRange = 2 * radius;

                const basePulse = 0.20 + Math.sin(time * 0.0012) * 0.15;
                const glassBreath = 0.95 + Math.sin(time * 0.0012) * 0.05;

                appState.wordObjects.forEach(card => {
                    card.getWorldPosition(AppMath.vecCardWorld);
                    const dist = AppMath.vecCardWorld.distanceTo(AppMath.vecCamWorld);
                    const t = THREE.MathUtils.clamp((dist - minDist) / distRange, 0, 1);

                    const depthScale = THREE.MathUtils.lerp(1.4, 0.32, t);
                    const normalizedY = card.position.y / radius;
                    const latScale = 1.0 - 0.45 * (normalizedY * normalizedY);

                    const finalScale = latScale * depthScale * cardMult;
                    card.scale.set(finalScale, finalScale, finalScale);

                    const frontOpacity = THREE.MathUtils.lerp(0.95, 0.15, t) * glassBreath;
                    const sideOpacity = THREE.MathUtils.lerp(0.35, 0.05, t) * glassBreath;

                    if (Array.isArray(card.material)) {
                        if (card.material[0]) card.material[0].opacity = frontOpacity;
                        if (card.material[1]) {
                            card.material[1].opacity = sideOpacity;
                            card.material[1].emissiveIntensity = basePulse * (1.0 - t) * 1.5;
                        }
                    } else if (card.material) {
                        card.material.opacity = frontOpacity;
                    }
                });

                // 让所有卡片保持正对相机
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

            if (appState.rt.visualFxEnabled && appState.composer) {
                appState.composer.render();
            } else {
                appState.renderer.render(appState.scene, appState.camera);
            }
        }
    };

    window.AppScene = AppScene;
})();
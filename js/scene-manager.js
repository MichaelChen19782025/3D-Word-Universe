/**
 * 3D单词宇宙 - Three.js 核心场景管理与渲染管线
 * 包含：3D 四角发光直角括号 (frameGroup) 呼吸动画、摄像机视口锁定与零光照纯黑处理
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

            this.initLights();
            window.addEventListener('resize', () => this.onWindowResize());
            this.animate();
        },

        initLights() {
            appState.hemisphereLight = new THREE.HemisphereLight(0xadd8e6, 0x404040, 2.0);
            appState.scene.add(appState.hemisphereLight);
            appState.scene.add(appState.camera);

            if (THREE.RectAreaLightUniformsLib) THREE.RectAreaLightUniformsLib.init();

            appState.rectAreaLight1 = new THREE.RectAreaLight(0xffffff, 8.0, 200, 200);
            appState.rectAreaLight1.position.set(0, 150, 50);
            appState.rectAreaLight1.lookAt(0, 0, 0);
            appState.scene.add(appState.rectAreaLight1);

            appState.rectAreaLight2 = new THREE.RectAreaLight(0xffe0b3, 5.0, 250, 250);
            appState.rectAreaLight2.position.set(-180, 50, -50);
            appState.rectAreaLight2.lookAt(0, 0, 0);
            appState.scene.add(appState.rectAreaLight2);
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
            appState.needsRender = true;
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

            const cardMult = appState.cardScaleMultiplier || 1.0;
            appState.camera.getWorldPosition(AppMath.vecCamWorld);
            const radius = appState.sphereRadius || 85;
            const camDist = AppMath.vecCamWorld.length();
            const minDist = camDist - radius;
            const distRange = 2 * radius;

            // 局部焦点巡航计算
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

                        const ratio = Math.max(0.005, Math.min(1.0, (fc.ratioPercent || 8) / 100));
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

            // ★ 3D 浮动查词卡片渲染管线：平滑透明度、四角发光括号呼吸与零光照纯黑处理
            if (appState.hoverOverlayCard) {
                const card = appState.hoverOverlayCard;
                const screen = card.getObjectByName("textScreen") || card.userData.refs?.screen;
                if (screen) {
                    const currentOp = screen.material.opacity;
                    const newOp = THREE.MathUtils.lerp(currentOp, appState.overlayCardTargetOpacity, 0.22);
                    screen.material.opacity = newOp;

                    const rawBrightness = parseFloat(document.getElementById('hoverCardBrightness')?.value || '1.0');
                    const isPitchBlack = (rawBrightness <= 0.001);

                    const backplate = card.getObjectByName("backplate") || card.userData.refs?.backplate;
                    if (backplate) {
                        if (isPitchBlack) {
                            backplate.material.color.setHex(0x000000);
                            backplate.material.opacity = newOp;
                        } else {
                            backplate.material.color.set(0x0a1428);
                            backplate.material.opacity = newOp * (appState.rt.hoverBgOpacity || 0.78);
                        }
                    }

                    const coreGlow = card.getObjectByName("coreGlow") || card.userData.refs?.coreGlow;
                    if (coreGlow) {
                        coreGlow.material.opacity = isPitchBlack ? 0 : (newOp * 0.85);
                    }

                    // 四角直角发光括号 (frameGroup) 呼吸特效
                    const frameGroup = card.getObjectByName("frameGroup") || card.userData.refs?.frameGroup;
                    if (frameGroup) {
                        const hoverStyleMode = document.getElementById('hoverCardStyleModeSelect')?.value || 'classic_hud';
                        if (hoverStyleMode === 'classic_hud' && !isPitchBlack) {
                            frameGroup.visible = true;
                            frameGroup.children.forEach((child, i) => {
                                child.material.opacity = newOp * (0.65 + Math.sin(time * 0.003 + i * 1.57) * 0.35);
                            });
                        } else {
                            frameGroup.visible = false;
                        }
                    }

                    card.visible = (newOp > 0.01 && card.scale.x > 0.01);
                }

                if (appState.overlayCardTargetPosition && card.visible) {
                    card.position.lerp(appState.overlayCardTargetPosition, 0.2);
                    card.quaternion.slerp(appState.camera.quaternion, 0.2);
                    card.scale.lerp(appState.overlayCardTargetScale, 0.2);
                }
            }

            const baseRotationSpeed = appState.actualDisplayRotationSpeed * 0.0058 * appState.rotationMultiplier * appState.rotationMultiplierTemporary;
            if (appState.autoRotate && baseRotationSpeed > 0 && appState.wordSphereGroup && !appState.isFlowMode) {
                let dynamicSpeed = baseRotationSpeed;
                if (appState.rotationModel === 'sine-ease') {
                    dynamicSpeed = baseRotationSpeed * (1.25 + 0.75 * Math.sin(time * 0.0005));
                }
                const rx = appState.rt.rotateX !== undefined ? appState.rt.rotateX : true;
                const ry = appState.rt.rotateY !== undefined ? appState.rt.rotateY : true;
                const rz = appState.rt.rotateZ !== undefined ? appState.rt.rotateZ : false;
                if (rx) appState.wordSphereGroup.rotation.x += dynamicSpeed;
                if (ry) appState.wordSphereGroup.rotation.y += dynamicSpeed;
                if (rz) appState.wordSphereGroup.rotation.z += dynamicSpeed;
            }

            const shouldCardsRotate = appState.rt.cardSelfRotation !== undefined ? appState.rt.cardSelfRotation : true;
            const cardMasterSpeed = (appState.rt.cardRotationSpeed !== undefined ? appState.rt.cardRotationSpeed : 2) * 0.00115;

            if (appState.wordSphereGroup) {
                appState.wordSphereGroup.updateMatrixWorld(true);
            }

            if (!appState.isFlowMode) {
                appState.wordObjects.forEach((card, idx) => {
                    card.getWorldPosition(AppMath.vecCardWorld);
                    const dist = AppMath.vecCardWorld.distanceTo(AppMath.vecCamWorld);
                    const t = THREE.MathUtils.clamp((dist - minDist) / distRange, 0, 1);

                    const depthScale = THREE.MathUtils.lerp(1.4, 0.32, t);
                    const normalizedY = card.position.y / radius;
                    const latScale = 1.0 - 0.45 * (normalizedY * normalizedY);

                    let spotlightScale = 1.0;
                    if (appState.focusCruise && appState.focusCruise.enabled && appState.focusCruise.currentSpotlightIndices.has(idx)) {
                        if (t < 0.5) {
                            const frontFade = THREE.MathUtils.clamp((0.5 - t) / 0.08, 0, 1);
                            spotlightScale = 1.0 + ((appState.focusCruise.scaleFactor || 1.5) - 1.0) * frontFade;
                        }
                    }

                    const finalScale = latScale * depthScale * cardMult * spotlightScale;
                    card.scale.set(finalScale, finalScale, finalScale);
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
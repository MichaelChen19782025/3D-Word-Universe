/**
 * 3D单词宇宙 - Three.js 核心场景管理与极速渲染管线 (低功耗降温版)
 * 1. 严格封顶设备像素比 (DPR)，杜绝 Retina/4K 屏幕过度渲染
 * 2. 精确脏标记检测，静止状态下 CPU/GPU 彻底归零
 * 3. 查词窗口与三阶段平滑阶梯渐快加速恢复
 * 4. 优化卡片深度衰减逻辑，背侧卡片不透明度与亮度衰减幅度控制在 10% 以内
 */
(function() {
    function computeHoverMotionMultiplier(time) {
        const hm = appState.hoverMotion;
        if (!hm || !hm.pauseEnabled) {
            return 1.0;
        }

        if (hm.isPaused) {
            hm.currentMultiplier = 0.0;
            hm.isResuming = false;
            return 0.0;
        }

        if (hm.isResuming) {
            const elapsed = (time - hm.resumeStartTime) / 1000;
            const totalDuration = Math.max(0.1, hm.resumeDuration || 2.0);

            if (elapsed >= totalDuration) {
                hm.isResuming = false;
                hm.currentMultiplier = 1.0;
                return 1.0;
            }

            const t1 = totalDuration * 0.25;
            const t2 = totalDuration * 0.50;
            const v1 = Math.max(0.01, Math.min(1.0, (hm.p1Percent || 20) / 100));
            const v2 = Math.max(v1, Math.min(1.0, (hm.p2Percent || 70) / 100));

            if (elapsed <= t1) {
                const progress = elapsed / t1;
                hm.currentMultiplier = v1 * progress;
            } else if (elapsed <= t2) {
                const progress = (elapsed - t1) / (t2 - t1);
                hm.currentMultiplier = v1 + (v2 - v1) * progress;
            } else {
                const progress = (elapsed - t2) / (totalDuration - t2);
                hm.currentMultiplier = v2 + (1.0 - v2) * progress;
            }

            return hm.currentMultiplier;
        }

        hm.currentMultiplier = 1.0;
        return 1.0;
    }

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

            const maxDPR = IS_MOBILE_DEVICE ? 1.25 : 1.5;
            appState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDPR));
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

            const hoverMotionFactor = computeHoverMotionMultiplier(time);
            const controlsChanged = appState.controls.update();

            let mustRender = controlsChanged || appState.needsRender;

            if (appState.autoRotate && appState.actualDisplayRotationSpeed > 0 && appState.rotationMultiplier > 0.001 && hoverMotionFactor > 0.0001) mustRender = true;
            if (appState.hoverMotion && appState.hoverMotion.isResuming) mustRender = true;
            if (appState.hoverOverlayCard && appState.hoverOverlayCard.visible) mustRender = true;
            if (appState.vortexParticles && appState.vortexParticles.visible) mustRender = true;
            if (appState.clickBurstParticles && appState.clickBurstParticles.visible) mustRender = true;
            if (appState.coreSphere && appState.coreSphere.visible) mustRender = true;

            if (!mustRender) return;
            appState.needsRender = false;

            const cardMult = appState.cardScaleMultiplier || 1.0;
            appState.camera.getWorldPosition(AppMath.vecCamWorld);
            const radius = appState.sphereRadius || 85;
            const camDist = AppMath.vecCamWorld.length();
            const maxDist = camDist + radius;
            const minDist = camDist - radius;
            const distRange = 2 * radius;

            if (appState.focusCruise && appState.focusCruise.enabled && appState.wordObjects.length > 0 && hoverMotionFactor > 0.001) {
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
                }
            }

            if (appState.vortexParticles && appState.vortexParticles.visible) {
                const baseSpeed = appState.rt.vortexSpeed !== undefined ? appState.rt.vortexSpeed : 0.003;
                appState.vortexParticles.rotation.y += baseSpeed;
            }

            if (appState.coreSphere && appState.coreSphere.visible) {
                appState.coreSphere.rotation.y += 0.0008;
            }

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

            const baseRotationSpeed = appState.actualDisplayRotationSpeed * 0.0058 * appState.rotationMultiplier * appState.rotationMultiplierTemporary * hoverMotionFactor;

            if (appState.autoRotate && baseRotationSpeed > 0 && appState.wordSphereGroup && !appState.isFlowMode) {
                const rx = appState.rt.rotateX !== undefined ? appState.rt.rotateX : true;
                const ry = appState.rt.rotateY !== undefined ? appState.rt.rotateY : true;
                const rz = appState.rt.rotateZ !== undefined ? appState.rt.rotateZ : false;
                if (rx) appState.wordSphereGroup.rotation.x += baseRotationSpeed;
                if (ry) appState.wordSphereGroup.rotation.y += baseRotationSpeed;
                if (rz) appState.wordSphereGroup.rotation.z += baseRotationSpeed;
            }

            const shouldCardsRotate = appState.rt.cardSelfRotation !== undefined ? appState.rt.cardSelfRotation : true;
            const cardMasterSpeed = (appState.rt.cardRotationSpeed !== undefined ? appState.rt.cardRotationSpeed : 2) * 0.00115 * hoverMotionFactor;

            if (appState.wordSphereGroup) {
                appState.wordSphereGroup.updateMatrixWorld(true);
            }

            // ★ 计算全局高亮倍率
            const lightBoost = appState.isLightBoosted ? 1.6 : 1.0;

            if (!appState.isFlowMode) {
                const basePulse = 0.20 + Math.sin(time * 0.0012) * 0.15;
                const glassBreath = 0.98 + Math.sin(time * 0.0012) * 0.02;

                appState.wordObjects.forEach((card, idx) => {
                    card.getWorldPosition(AppMath.vecCardWorld);
                    const dist = AppMath.vecCardWorld.distanceTo(AppMath.vecCamWorld);
                    const t = THREE.MathUtils.clamp((dist - minDist) / distRange, 0, 1);

                    const depthScale = THREE.MathUtils.lerp(1.12, 0.72, t);
                    const normalizedY = card.position.y / radius;
                    const latScale = 1.0 - 0.35 * (normalizedY * normalizedY);

                    if (!card.userData.spotlightLerp) card.userData.spotlightLerp = 1.0;
                    const isSpotlightTarget = (appState.focusCruise && appState.focusCruise.enabled && appState.focusCruise.currentSpotlightIndices.has(idx) && t < 0.48);
                    const targetSpotlightMult = isSpotlightTarget ? (appState.focusCruise.scaleFactor || 1.5) : 1.0;
                    
                    card.userData.spotlightLerp = THREE.MathUtils.lerp(card.userData.spotlightLerp, targetSpotlightMult, 0.08);

                    const frontFade = THREE.MathUtils.clamp((0.50 - t) / 0.10, 0, 1);
                    const effectiveSpotlightScale = 1.0 + (card.userData.spotlightLerp - 1.0) * frontFade;

                    const maxAllowedScale = cardMult * (appState.focusCruise.scaleFactor || 1.5) * 1.25;
                    const rawCalculatedScale = latScale * depthScale * cardMult * effectiveSpotlightScale;
                    const finalScale = Math.min(maxAllowedScale, rawCalculatedScale);

                    card.scale.set(finalScale, finalScale, finalScale);

                    // 亮度衰减极大幅缩减：正面0.96 -> 背面0.90，衰减仅6%左右
                    const frontOpacity = THREE.MathUtils.lerp(0.96, 0.90, t) * glassBreath;
                    const sideOpacity = THREE.MathUtils.lerp(0.38, 0.35, t) * glassBreath;

                    if (Array.isArray(card.material)) {
                        if (card.material[0]) {
                            card.material[0].opacity = frontOpacity;
                            // 光照补偿 + 全局高亮
                            if (card.userData && card.userData.baseEmissiveIntensity !== undefined) {
                                card.material[0].emissiveIntensity = card.userData.baseEmissiveIntensity * (1.0 + t * 1.5) * lightBoost;
                            }
                        }
                        if (card.material[1]) {
                            card.material[1].opacity = sideOpacity;
                            const spotlightBoost = isSpotlightTarget ? 1.6 : 1.0;
                            // 侧边厚度同步补偿 + 全局高亮
                            card.material[1].emissiveIntensity = basePulse * (1.0 + t * 1.0) * 1.5 * spotlightBoost * lightBoost;
                        }
                    } else if (card.material) {
                        card.material.opacity = frontOpacity;
                        if (card.userData && card.userData.baseEmissiveIntensity !== undefined) {
                            card.material.emissiveIntensity = card.userData.baseEmissiveIntensity * (1.0 + t * 1.5) * lightBoost;
                        }
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
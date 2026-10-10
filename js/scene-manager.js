/**
3D单词宇宙 - Three.js 核心场景管理与渲染管线
修复：平衡环境光、消灭中心过曝、支持四向平移
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
     // 平衡柔光，避免中心点眩光堆叠
     appState.hemisphereLight = new THREE.HemisphereLight(0xadd8e6, 0x141f36, 1.1);
     appState.scene.add(appState.hemisphereLight);

     appState.dirLight1 = new THREE.DirectionalLight(0xa5e5ff, 0.8);
     appState.dirLight1.position.set(0, 150, 200);
     appState.scene.add(appState.dirLight1);
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

 panSphere(deltaX, deltaY) {
     if (!appState.camera || !appState.controls) return;
     const factor = (appState.camera.position.length() || 165) * 0.0025;

     const right = new THREE.Vector3().setFromMatrixColumn(appState.camera.matrix, 0).multiplyScalar(deltaX * factor);
     const up = new THREE.Vector3().setFromMatrixColumn(appState.camera.matrix, 1).multiplyScalar(deltaY * factor);

     appState.camera.position.add(right).add(up);
     appState.controls.target.add(right).add(up);
     appState.controls.update();
     appState.needsRender = true;
 },

 resetSpherePan() {
     if (!appState.controls) return;
     const dist = appState.camera.position.distanceTo(appState.controls.target) || 165;
     appState.controls.target.set(0, 0, 0);
     appState.camera.position.set(0, 0, dist);
     appState.controls.update();
     appState.needsRender = true;
     if (window.AppUI) AppUI.showToast('🎯 球体已复位至正中');
 },

 animate(time) {
    if (time === undefined || time === null) time = performance.now();
    requestAnimationFrame((t) => AppScene.animate(t));

    if (!appState.controls || !appState.renderer || !appState.scene || !appState.camera) return;

    const controlsChanged = appState.controls.update();
    let mustRender = controlsChanged || appState.needsRender;

    if (appState.autoRotate && appState.actualDisplayRotationSpeed > 0 && appState.rotationMultiplier > 0.001) mustRender = true;
    if (appState.hoverOverlayCard && appState.hoverOverlayCard.visible) mustRender = true;
    if (appState.vortexParticles && appState.vortexParticles.visible) mustRender = true;

    // 宇宙涡旋平滑旋转
    if (appState.vortexParticles && appState.vortexParticles.visible) {
        const spd = appState.rt.vortexSpeed || 0.003;
        appState.vortexParticles.rotation.y += spd;
    }

    const cardMult = appState.cardScaleMultiplier || 1.0;
    appState.camera.getWorldPosition(AppMath.vecCamWorld);
    const radius = appState.sphereRadius || 85;
    const camDist = AppMath.vecCamWorld.length();
    const minDist = camDist - radius;
    const distRange = 2 * radius;

    if (!mustRender) return;
    appState.needsRender = false;

    // ★ 3D 浮动查词卡片：柔和全局同步呼吸光管线
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
                backplate.material.color.set(isPitchBlack ? 0x000000 : 0x0a1428);
                backplate.material.opacity = isPitchBlack ? newOp : (newOp * (appState.rt.hoverBgOpacity || 0.78));
            }

            // 计算平滑自然的人体舒缓呼吸波形（4秒/周期，0~1 平滑渐变）
            const breath = 0.5 + 0.5 * Math.sin(time * 0.0016);

            // 柔和环境光晕：同步膨胀收缩与透明度呼吸
            const coreGlow = card.getObjectByName("coreGlow") || card.userData.refs?.coreGlow;
            if (coreGlow) {
                const glowBaseOpacity = isPitchBlack ? 0 : (newOp * (0.20 + breath * 0.35));
                coreGlow.material.opacity = glowBaseOpacity;
                const glowPulse = 1.04 + 0.035 * breath;
                coreGlow.scale.set(glowPulse, glowPulse, 1);
            }

            // 四角科技边框：消除急速频闪，同步柔和呼吸，不刺激眼睛
            const frameGroup = card.getObjectByName("frameGroup") || card.userData.refs?.frameGroup;
            if (frameGroup) {
                if (!isPitchBlack) {
                    frameGroup.visible = true;
                    const frameOpacity = newOp * (0.35 + breath * 0.35);
                    frameGroup.children.forEach((child) => {
                        child.material.opacity = frameOpacity;
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
    if (appState.autoRotate && baseRotationSpeed > 0 && appState.wordSphereGroup) {
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

    const isBloomActive = !!(document.getElementById('visualEffectsEnabled')?.checked || appState.rt.visualFxEnabled);
    const bloomStrength = safeParseFloat(document.getElementById('bloomStrength')?.value, 0.5);
    if (isBloomActive && bloomStrength > 0.001 && appState.composer) {
        appState.composer.render();
    } else {
        appState.renderer.render(appState.scene, appState.camera);
    }
}
};
window.AppScene = AppScene;
})();
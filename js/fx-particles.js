/**
 * 3D单词宇宙 - 空间粒子特效、星空背景、宇宙涡旋与核心发光球系统
 */

const _scratchColor = new THREE.Color();
let _burstVelocities = null;

const AppParticles = {
    // 1. 核心能量发光球体
    initCoreSphere() {
        if (appState.coreSphere) appState.scene.remove(appState.coreSphere);
        const radiusInput = document.getElementById('coreSphereRadius');
        let radius = appState.sphereRadius * (safeParseFloat(radiusInput ? radiusInput.value : 80, 80) / 100);
        if (isNaN(radius) || radius <= 0.1) radius = 0.1;

        const geometry = new THREE.SphereGeometry(radius, 48, 48);
        const opacityInput = document.getElementById('coreSphereOpacity');
        const opacity = safeParseFloat(opacityInput ? opacityInput.value : 0.0, 0.0);
        const colorInput = document.getElementById('coreSphereColor');
        const emissiveInput = document.getElementById('coreSphereEmissive');
        const emissiveIntensityInput = document.getElementById('coreSphereEmissiveIntensity');

        const material = new THREE.MeshStandardMaterial({
            color: getColor(colorInput ? colorInput.value : '#80D0FF', 'three'),
            emissive: getColor(emissiveInput ? emissiveInput.value : '#30A0FF', 'three'),
            emissiveIntensity: safeParseFloat(emissiveIntensityInput ? emissiveIntensityInput.value : 0.5, 0.5),
            opacity: opacity,
            transparent: true,
            roughness: 0.7,
            metalness: 0.15,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        appState.coreSphere = new THREE.Mesh(geometry, material);
        appState.coreSphere.visible = opacity > 0.01 && radius > 0.1;
        appState.scene.add(appState.coreSphere);
        appState.needsRender = true;
    },

    updateCoreSphereSettings() {
        if (!appState.coreSphere) return;
        appState.coreSphere.geometry.dispose();
        const radiusInput = document.getElementById('coreSphereRadius');
        const r = Math.max(0.1, appState.sphereRadius * (safeParseFloat(radiusInput ? radiusInput.value : 80, 80) / 100));
        appState.coreSphere.geometry = new THREE.SphereGeometry(r, 48, 48);

        const colorInput = document.getElementById('coreSphereColor');
        const emissiveInput = document.getElementById('coreSphereEmissive');
        const emissiveIntensityInput = document.getElementById('coreSphereEmissiveIntensity');
        const opacityInput = document.getElementById('coreSphereOpacity');

        appState.coreSphere.material.color.set(getColor(colorInput ? colorInput.value : '#80D0FF', 'three'));
        appState.coreSphere.material.emissive.set(getColor(emissiveInput ? emissiveInput.value : '#30A0FF', 'three'));
        appState.coreSphere.material.emissiveIntensity = safeParseFloat(emissiveIntensityInput ? emissiveIntensityInput.value : 0.5, 0.5);
        const opacity = safeParseFloat(opacityInput ? opacityInput.value : 0.0, 0.0);
        appState.coreSphere.material.opacity = opacity;
        appState.coreSphere.visible = opacity > 0.01 && r > 0.1;
        appState.needsRender = true;
    },

    // 2. 宇宙涡旋 (Vortex Particles)
    initVortex() {
        const enabledCb = document.getElementById('visualEffectsEnabled');
        const enabled = enabledCb ? enabledCb.checked : false;

        if (appState.vortexParticles) {
            appState.scene.remove(appState.vortexParticles);
            appState.vortexParticles.geometry.dispose();
            appState.vortexParticles.material.dispose();
            appState.vortexParticles = null;
        }

        if (!enabled) {
            appState.needsRender = true;
            return;
        }

        const countInput = document.getElementById('vortexParticleCount');
        const defaultCount = IS_MOBILE_DEVICE ? 2000 : 50000;
        let particleCount = safeParseInt(countInput ? countInput.value : defaultCount, defaultCount);
        if (isNaN(particleCount) || particleCount <= 0) return;

        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const randoms = new Float32Array(particleCount);

        const numArms = 4;
        const radius = 800;
        const tightInput = document.getElementById('vortexTightness');
        let tightness = safeParseFloat(tightInput ? tightInput.value : 1.5, 1.5);

        const colorInput = document.getElementById('vortexColor');
        const color = _scratchColor.set(colorInput ? colorInput.value : '#5588ff');

        for (let i = 0; i < particleCount; i++) {
            const armIndex = i % numArms;
            const spinAngle = (i / particleCount) * tightness * 2 * Math.PI;
            const armAngle = (armIndex / numArms) * 2 * Math.PI;
            const randomRadius = Math.pow(Math.random(), 2) * radius;
            const angle = spinAngle + armAngle;

            positions[i * 3] = Math.cos(angle) * randomRadius;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 2] = Math.sin(angle) * randomRadius;

            const variation = Math.random() * 0.5 + 0.5;
            colors[i * 3] = color.r * variation;
            colors[i * 3 + 1] = color.g * variation;
            colors[i * 3 + 2] = color.b * variation;
            randoms[i] = Math.random();
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

        const sizeInput = document.getElementById('vortexSize');
        const material = new THREE.PointsMaterial({
            size: safeParseFloat(sizeInput ? sizeInput.value : 1.5, 1.5),
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
        });

        appState.vortexParticles = new THREE.Points(geometry, material);
        appState.scene.add(appState.vortexParticles);
        this.updateVisualEffects();
        appState.needsRender = true;
    },

    updateVisualEffects() {
        const enabledCb = document.getElementById('visualEffectsEnabled');
        const enabled = enabledCb ? enabledCb.checked : false;

        if (enabled && !appState.vortexParticles) {
            this.initVortex();
            if (!appState.vortexParticles) return;
        }
        if (!appState.vortexParticles || !appState.bloomPass) return;

        appState.vortexParticles.visible = enabled;
        appState.bloomPass.enabled = enabled;

        const bTh = document.getElementById('bloomThreshold');
        const bSt = document.getElementById('bloomStrength');
        const bRd = document.getElementById('bloomRadius');
        appState.bloomPass.threshold = safeParseFloat(bTh ? bTh.value : 0.8, 0.8);
        appState.bloomPass.strength = safeParseFloat(bSt ? bSt.value : 0.5, 0.5);
        appState.bloomPass.radius = safeParseFloat(bRd ? bRd.value : 0.2, 0.2);

        const vColor = document.getElementById('vortexColor');
        const color = new THREE.Color(vColor ? vColor.value : '#5588ff');
        const colors = appState.vortexParticles.geometry.attributes.color;
        for (let i = 0; i < colors.count; i++) {
            const variation = Math.random() * 0.5 + 0.5;
            colors.setXYZ(i, color.r * variation, color.g * variation, color.b * variation);
        }
        colors.needsUpdate = true;

        const vSize = document.getElementById('vortexSize');
        appState.vortexParticles.material.size = safeParseFloat(vSize ? vSize.value : 1.5, 1.5);
        appState.needsRender = true;
    },

    // 3. 星空背景 (Starfield)
    initStarfield() {
        if (appState.starfield) {
            appState.scene.remove(appState.starfield);
            appState.starfield.geometry.dispose();
            appState.starfield.material.dispose();
        }

        const enabledCb = document.getElementById('starfieldEnabled');
        if (enabledCb && !enabledCb.checked) return;

        const countInput = document.getElementById('starCount');
        const defaultStarCount = IS_MOBILE_DEVICE ? 2000 : APP_CONFIG.DEFAULT_STAR_COUNT;
        let starCount = safeParseInt(countInput ? countInput.value : defaultStarCount, defaultStarCount);
        if (isNaN(starCount) || starCount <= 0) return;

        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const colorInput = document.getElementById('starColor');
        const color = _scratchColor.set(colorInput ? colorInput.value : '#ffffff');

        for (let i = 0; i < starCount; i++) {
            const distance = Math.cbrt(Math.random()) * 3000;
            const theta = Math.random() * Math.PI * 2;
            const rawVal = (Math.random() * 2) - 1;
            const acosVal = Math.min(Math.max(rawVal, -1), 1);
            const phi = Math.acos(acosVal);

            positions[i * 3] = distance * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = distance * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = distance * Math.cos(phi);

            const variation = 0.7 + Math.random() * 0.6;
            colors[i * 3] = Math.min(1, color.r * variation);
            colors[i * 3 + 1] = Math.min(1, color.g * variation);
            colors[i * 3 + 2] = Math.min(1, color.b * variation);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const sizeInput = document.getElementById('starSize');
        const material = new THREE.PointsMaterial({
            size: safeParseFloat(sizeInput ? sizeInput.value : 0.8, 0.8),
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true
        });

        appState.starfield = new THREE.Points(geometry, material);
        appState.starfield.matrixAutoUpdate = false;
        appState.scene.add(appState.starfield);
        appState.needsRender = true;
    },

    // 4. 动态漂浮背景粒子
    initDynamicBackground() {
        if (appState.dynamicBgParticles) {
            appState.scene.remove(appState.dynamicBgParticles);
            appState.dynamicBgParticles.geometry.dispose();
            appState.dynamicBgParticles.material.dispose();
        }

        const countInput = document.getElementById('dynamicBgParticleCount');
        const defaultBgCount = IS_MOBILE_DEVICE ? 40 : 300;
        let particleCount = safeParseInt(countInput ? countInput.value : defaultBgCount, defaultBgCount);
        if (isNaN(particleCount) || particleCount <= 0) return;

        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        const c = _scratchColor;
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = THREE.MathUtils.randFloatSpread(3000);
            positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(3000);
            positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(3000) - 1500;

            c.setHSL(Math.random() * 0.3 + 0.55, 0.8, Math.random() * 0.3 + 0.4);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
            sizes[i] = Math.random() * 3 + 1;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 15,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.6,
            depthTest: false,
            depthWrite: false,
            sizeAttenuation: true
        });

        appState.dynamicBgParticles = new THREE.Points(geometry, material);
        appState.dynamicBgParticles.renderOrder = -2;
        if (IS_MOBILE_DEVICE) {
            appState.dynamicBgParticles.matrixAutoUpdate = false;
        }

        appState.scene.add(appState.dynamicBgParticles);
        this.updateDynamicBackgroundCSS();
        appState.needsRender = true;
    },

    updateDynamicBackgroundSettings() {
        this.initDynamicBackground();
        this.updateDynamicBackgroundCSS();
        appState.needsRender = true;
    },

    updateDynamicBackgroundCSS() {
        const hueStart = document.getElementById('dynamicBgHueStart')?.value || '230';
        const hueEnd = document.getElementById('dynamicBgHueEnd')?.value || '270';
        const lightness = document.getElementById('dynamicBgLightness')?.value || '10';
        document.documentElement.style.setProperty('--dynamic-bg-hue-start', hueStart);
        document.documentElement.style.setProperty('--dynamic-bg-hue-end', hueEnd);
        document.documentElement.style.setProperty('--dynamic-bg-lightness', `${lightness}%`);
    },

    // 5. 点击能量爆发粒子
    initClickBurstParticles() {
        const count = 80;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const baseSizes = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const c = new THREE.Color();
            c.setHSL(Math.random() * 0.23 + 0.47, 0.9, 0.8);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
            baseSizes[i] = Math.random() * 1.7 + 0.7;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('baseSize', new THREE.Float32BufferAttribute(baseSizes, 1));

        const material = new THREE.PointsMaterial({
            vertexColors: true, size: 1, transparent: true,
            opacity: 0.94, blending: THREE.AdditiveBlending, depthWrite: false
        });

        appState.clickBurstParticles = new THREE.Points(geometry, material);
        appState.clickBurstParticles.visible = false;
        appState.scene.add(appState.clickBurstParticles);
    },

    triggerClickBurst(position, customColorHSL = null) {
        if (!appState.clickBurstParticles) return;

        const geometry = appState.clickBurstParticles.geometry;
        const particles = geometry.attributes.position;
        const colorsAttr = geometry.attributes.color;
        const count = particles.count;

        if (!_burstVelocities || _burstVelocities.length < count * 3) {
            _burstVelocities = new Float32Array(count * 3);
        }

        const c = _scratchColor;
        for (let i = 0; i < count; i++) {
            particles.setXYZ(i, position.x, position.y, position.z);
            _burstVelocities[i * 3] = (Math.random() - 0.5) * 0.7;
            _burstVelocities[i * 3 + 1] = (Math.random() - 0.13) * 0.7;
            _burstVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.7;

            if (customColorHSL) {
                c.setHSL(customColorHSL.h, customColorHSL.s, customColorHSL.l + (Math.random() * 0.15 - 0.07));
                colorsAttr.setXYZ(i, c.r, c.g, c.b);
            }
        }

        particles.needsUpdate = true;
        if (customColorHSL) colorsAttr.needsUpdate = true;
        appState.clickBurstParticles.visible = true;
        let startTime = performance.now();

        function run() {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > 1.4) {
                appState.clickBurstParticles.visible = false;
                appState.needsRender = true;
                return;
            }

            const posArray = particles.array;
            for (let i = 0; i < count; i++) {
                const idx = i * 3;
                posArray[idx] += _burstVelocities[idx];
                posArray[idx + 1] += _burstVelocities[idx + 1];
                posArray[idx + 2] += _burstVelocities[idx + 2];
            }

            particles.needsUpdate = true;
            appState.clickBurstParticles.material.opacity = 0.97 - (elapsed / 1.4);
            appState.needsRender = true;
            requestAnimationFrame(run);
        }
        run();
    },

    // 6. 卡片漂浮碎屑 (Embers)
    initCardEmbers() {
        const count = IS_MOBILE_DEVICE ? 20 : 350;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const baseColors = new Float32Array(count * 3);
        const lives = new Float32Array(count);
        const velocities = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = 99999;
            positions[i * 3 + 1] = 99999;
            positions[i * 3 + 2] = 99999;
            lives[i] = 0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: IS_MOBILE_DEVICE ? 5.0 : 8.0,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            sizeAttenuation: true
        });

        appState.cardEmbers = new THREE.Points(geometry, material);
        appState.cardEmbersGeometry = geometry;
        appState.cardEmbersLives = lives;
        appState.cardEmbersVelocities = velocities;
        appState.cardEmbersBaseColors = baseColors;
        appState.scene.add(appState.cardEmbers);
    },

    initNebulaColors() {
        const neb1 = document.querySelector('.nebula-1');
        const neb2 = document.querySelector('.nebula-2');
        let h1 = 260, h2 = 210;
        function update() {
            h1 = (h1 + 0.035) % 360;
            h2 = (h2 + 0.055) % 360;
            if (neb1) neb1.style.background = `radial-gradient(circle, hsla(${h1}, 80%, 60%, 0.8) 0%, transparent 70%)`;
            if (neb2) neb2.style.background = `radial-gradient(circle, hsla(${h2}, 70%, 65%, 0.7) 0%, transparent 70%)`;
            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }
};

window.AppParticles = AppParticles;
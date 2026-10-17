/**
 * 3D单词宇宙 - 空间粒子特效体系 (极速降耗架构版)
 * 1. 彻底移除 JS 驱动每帧改写 DOM 背景造成的 CPU 100% 满载元凶
 * 2. 优化星空与旋臂默认粒子缓冲区，大幅减轻 CPU 调度与移动端发热
 * 3. 增加安全防御机制，防止场景未初始化时的意外崩溃
 */
(function() {
    let _burstVelocities = null;
    const AppParticles = {
        // ==================== 1. 核心能量球体 ====================
        initCoreSphere() {
            if (!appState.scene) return; // ★ 防御性编程，防止场景未加载时报错

            if (appState.coreSphere) {
                appState.scene.remove(appState.coreSphere);
                if (appState.coreSphere.geometry) appState.coreSphere.geometry.dispose();
                if (appState.coreSphere.material) appState.coreSphere.material.dispose();
                appState.coreSphere = null;
            }
            const radiusPercent = safeParseFloat(document.getElementById('coreSphereRadius')?.value, 80);
            let radius = appState.sphereRadius * (radiusPercent / 100);
            if (isNaN(radius) || radius <= 0.1) radius = 0.1;

            const geometry = new THREE.SphereGeometry(radius, 32, 32);
            const opacity = safeParseFloat(document.getElementById('coreSphereOpacity')?.value, 0.35);
            const color = getColor(document.getElementById('coreSphereColor')?.value || '#80D0FF', 'three');
            const emissive = getColor(document.getElementById('coreSphereEmissive')?.value || '#30A0FF', 'three');
            const emissiveIntensity = safeParseFloat(document.getElementById('coreSphereEmissiveIntensity')?.value, 0.25);

            const material = new THREE.MeshStandardMaterial({
                color: color,
                emissive: emissive,
                emissiveIntensity: emissiveIntensity,
                opacity: opacity,
                transparent: true,
                roughness: 0.8,
                metalness: 0.1,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });

            appState.coreSphere = new THREE.Mesh(geometry, material);
            appState.coreSphere.visible = (opacity > 0.005 && radius > 0.1);
            appState.scene.add(appState.coreSphere);
            appState.needsRender = true;
        },

        updateCoreSphereSettings() {
            if (!appState.scene) return;
            if (!appState.coreSphere) {
                this.initCoreSphere();
                return;
            }
            const radiusPercent = safeParseFloat(document.getElementById('coreSphereRadius')?.value, 80);
            const r = Math.max(0.1, appState.sphereRadius * (radiusPercent / 100));

            appState.coreSphere.geometry.dispose();
            appState.coreSphere.geometry = new THREE.SphereGeometry(r, 32, 32);

            const color = getColor(document.getElementById('coreSphereColor')?.value || '#80D0FF', 'three');
            const emissive = getColor(document.getElementById('coreSphereEmissive')?.value || '#30A0FF', 'three');
            const emissiveIntensity = safeParseFloat(document.getElementById('coreSphereEmissiveIntensity')?.value, 0.25);
            const opacity = safeParseFloat(document.getElementById('coreSphereOpacity')?.value, 0.35);

            appState.coreSphere.material.color.set(color);
            appState.coreSphere.material.emissive.set(emissive);
            appState.coreSphere.material.emissiveIntensity = emissiveIntensity;
            appState.coreSphere.material.opacity = opacity;
            appState.coreSphere.material.needsUpdate = true;
            appState.coreSphere.visible = (opacity > 0.005 && r > 0.1);
            appState.needsRender = true;
        },

        // ==================== 2. 宇宙涡旋 (Vortex - 6000粒子清爽版) ====================
        initVortex() {
            if (!appState.scene) return; // ★ 防御

            const enabled = document.getElementById('visualEffectsEnabled')?.checked || false;

            if (appState.vortexParticles) {
                appState.scene.remove(appState.vortexParticles);
                if (appState.vortexParticles.geometry) appState.vortexParticles.geometry.dispose();
                if (appState.vortexParticles.material) appState.vortexParticles.material.dispose();
                appState.vortexParticles = null;
            }

            if (!enabled) {
                appState.needsRender = true;
                return;
            }

            const brightness = safeParseFloat(document.getElementById('vortexBrightnessRange')?.value, 0.55);
            if (brightness <= 0.001) {
                appState.needsRender = true;
                return;
            }

            const coreRadius = safeParseFloat(document.getElementById('vortexCoreRadiusRange')?.value, 70);
            const defaultCount = IS_MOBILE_DEVICE ? 1500 : 6000;
            let particleCount = safeParseInt(document.getElementById('vortexParticleCount')?.value, defaultCount);
            if (isNaN(particleCount) || particleCount <= 0) particleCount = defaultCount;

            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            const randoms = new Float32Array(particleCount);

            const numArms = 4;
            const radius = 800;
            let tightness = safeParseFloat(document.getElementById('vortexTightness')?.value, 1.5);
            if (isNaN(tightness)) tightness = 1.5;

            const color = AppMath.color.set(document.getElementById('vortexColor')?.value || '#5588ff');

            for (let i = 0; i < particleCount; i++) {
                const armIndex = i % numArms;
                const spinAngle = (i / particleCount) * tightness * 2 * Math.PI;
                const armAngle = (armIndex / numArms) * 2 * Math.PI;

                const randomRadius = coreRadius + Math.pow(Math.random(), 1.35) * (radius - coreRadius);
                const angle = spinAngle + armAngle;

                positions[i * 3] = Math.cos(angle) * randomRadius;
                positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
                positions[i * 3 + 2] = Math.sin(angle) * randomRadius;

                const variation = (Math.random() * 0.4 + 0.6) * Math.min(1.0, brightness);
                colors[i * 3] = color.r * variation;
                colors[i * 3 + 1] = color.g * variation;
                colors[i * 3 + 2] = color.b * variation;
                randoms[i] = Math.random();
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

            const size = safeParseFloat(document.getElementById('vortexSize')?.value, 1.2);
            const material = new THREE.PointsMaterial({
                size: size,
                vertexColors: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                opacity: Math.max(0.0, Math.min(1.0, brightness))
            });

            appState.vortexParticles = new THREE.Points(geometry, material);
            appState.scene.add(appState.vortexParticles);
            appState.vortexParticles.visible = (brightness > 0.005);
            this.updateBloomSettings();
            appState.needsRender = true;
        },

        updateBloomSettings() {
            const enabled = document.getElementById('visualEffectsEnabled')?.checked || false;
            if (appState.bloomPass) {
                appState.bloomPass.enabled = enabled;
                appState.bloomPass.threshold = safeParseFloat(document.getElementById('bloomThreshold')?.value, 0.88);
                appState.bloomPass.strength = safeParseFloat(document.getElementById('bloomStrength')?.value, 0.25);
                appState.bloomPass.radius = safeParseFloat(document.getElementById('bloomRadius')?.value, 0.2);
            }
        },

        updateVisualEffects() {
            if (!appState.scene) return; // ★ 防御
            const enabled = document.getElementById('visualEffectsEnabled')?.checked || false;
            appState.rt.visualFxEnabled = enabled;

            if (enabled && !appState.vortexParticles) {
                this.initVortex();
            } else if (appState.vortexParticles) {
                const brightness = safeParseFloat(document.getElementById('vortexBrightnessRange')?.value, 0.55);
                appState.vortexParticles.visible = enabled && (brightness > 0.005);
                if (appState.vortexParticles.material) {
                    appState.vortexParticles.material.opacity = Math.max(0.0, Math.min(1.0, brightness));
                    appState.vortexParticles.material.needsUpdate = true;
                }
            }

            this.updateBloomSettings();
            appState.needsRender = true;
        },

        // ==================== 3. 星空背景 ====================
        initStarfield() {
            if (!appState.scene) return; // ★ 防御

            if (appState.starfield) {
                appState.scene.remove(appState.starfield);
                if (appState.starfield.geometry) appState.starfield.geometry.dispose();
                if (appState.starfield.material) appState.starfield.material.dispose();
                appState.starfield = null;
            }

            const enabled = document.getElementById('starfieldEnabled')?.checked;
            if (!enabled) {
                appState.needsRender = true;
                return;
            }

            const defaultCount = IS_MOBILE_DEVICE ? 600 : APP_CONFIG.DEFAULT_STAR_COUNT;
            let starCount = safeParseInt(document.getElementById('starCount')?.value, defaultCount);
            if (isNaN(starCount) || starCount <= 0) starCount = defaultCount;

            const positions = new Float32Array(starCount * 3);
            const colors = new Float32Array(starCount * 3);
            const colorHex = document.getElementById('starColor')?.value || '#ffffff';
            const color = AppMath.color.set(colorHex);

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

            const size = safeParseFloat(document.getElementById('starSize')?.value, 0.8);
            const material = new THREE.PointsMaterial({
                size: size,
                vertexColors: true,
                blending: THREE.AdditiveBlending,
                transparent: true
            });

            appState.starfield = new THREE.Points(geometry, material);
            appState.starfield.matrixAutoUpdate = false;
            appState.scene.add(appState.starfield);
            appState.needsRender = true;
        },

        // ==================== 4. 动态背景粒子 ====================
        initDynamicBackground() {
            if (!appState.scene) return; // ★ 防御

            if (appState.dynamicBgParticles) {
                appState.scene.remove(appState.dynamicBgParticles);
                if (appState.dynamicBgParticles.geometry) appState.dynamicBgParticles.geometry.dispose();
                if (appState.dynamicBgParticles.material) appState.dynamicBgParticles.material.dispose();
                appState.dynamicBgParticles = null;
            }

            const defaultCount = IS_MOBILE_DEVICE ? 20 : 80;
            let particleCount = safeParseInt(document.getElementById('dynamicBgParticleCount')?.value, defaultCount);
            if (isNaN(particleCount) || particleCount <= 0) return;

            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            const sizes = new Float32Array(particleCount);

            const c = AppMath.color;
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
            appState.dynamicBgParticles.matrixAutoUpdate = false;

            appState.scene.add(appState.dynamicBgParticles);
            appState.needsRender = true;
        },

        // ==================== 5. 点击爆发粒子 ====================
        initClickBurstParticles() {
            if (!appState.scene) return; // ★ 防御

            const count = 40;
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

            const c = AppMath.color;
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

        initNebulaColors() {}
    };
    window.AppParticles = AppParticles;
})();
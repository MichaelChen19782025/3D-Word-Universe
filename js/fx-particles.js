/**
 * 3D单词宇宙 - 空间粒子特效体系 (精准限速与消光优化版)
 */
(function() {
    let _burstVelocities = null;

    const AppParticles = {
        initCoreSphere() {
            if (appState.coreSphere) {
                appState.scene.remove(appState.coreSphere);
                if (appState.coreSphere.geometry) appState.coreSphere.geometry.dispose();
                if (appState.coreSphere.material) appState.coreSphere.material.dispose();
                appState.coreSphere = null;
            }
            const radiusPercent = safeParseFloat(document.getElementById('coreSphereRadius')?.value, 80);
            let radius = appState.sphereRadius * (radiusPercent / 100);
            if (isNaN(radius) || radius <= 0.1) radius = 0.1;

            const geometry = new THREE.SphereGeometry(radius, 48, 48);
            const opacity = safeParseFloat(document.getElementById('coreSphereOpacity')?.value, 0.5);
            const color = getColor(document.getElementById('coreSphereColor')?.value || '#80D0FF', 'three');
            const emissive = getColor(document.getElementById('coreSphereEmissive')?.value || '#30A0FF', 'three');
            const emissiveIntensity = safeParseFloat(document.getElementById('coreSphereEmissiveIntensity')?.value, 0.5);

            const material = new THREE.MeshStandardMaterial({
                color: color,
                emissive: emissive,
                emissiveIntensity: emissiveIntensity,
                opacity: opacity,
                transparent: true,
                roughness: 0.7,
                metalness: 0.15,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });

            appState.coreSphere = new THREE.Mesh(geometry, material);
            appState.coreSphere.visible = (opacity > 0.005 && radius > 0.1 && emissiveIntensity > 0.001);
            appState.scene.add(appState.coreSphere);
            appState.needsRender = true;
        },

        updateCoreSphereSettings() {
            if (!appState.coreSphere) {
                this.initCoreSphere();
                return;
            }
            const radiusPercent = safeParseFloat(document.getElementById('coreSphereRadius')?.value, 80);
            const r = Math.max(0.1, appState.sphereRadius * (radiusPercent / 100));

            appState.coreSphere.geometry.dispose();
            appState.coreSphere.geometry = new THREE.SphereGeometry(r, 48, 48);

            const color = getColor(document.getElementById('coreSphereColor')?.value || '#80D0FF', 'three');
            const emissive = getColor(document.getElementById('coreSphereEmissive')?.value || '#30A0FF', 'three');
            const emissiveIntensity = safeParseFloat(document.getElementById('coreSphereEmissiveIntensity')?.value, 0.5);
            const opacity = safeParseFloat(document.getElementById('coreSphereOpacity')?.value, 0.5);

            appState.coreSphere.material.color.set(color);
            appState.coreSphere.material.emissive.set(emissive);
            appState.coreSphere.material.emissiveIntensity = emissiveIntensity;
            appState.coreSphere.material.opacity = opacity;
            appState.coreSphere.material.needsUpdate = true;
            appState.coreSphere.visible = (opacity > 0.005 && r > 0.1 && emissiveIntensity > 0.001);
            appState.needsRender = true;
        },

        initVortex() {
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

            const defaultCount = IS_MOBILE_DEVICE ? 6000 : 50000;
            let particleCount = safeParseInt(document.getElementById('vortexParticleCount')?.value, defaultCount);

            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);

            const numArms = 4;
            const radius = 800;
            let tightness = safeParseFloat(document.getElementById('vortexTightness')?.value, 1.5);
            const color = AppMath.color.set(document.getElementById('vortexColor')?.value || '#5588ff');

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
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const size = safeParseFloat(document.getElementById('vortexSize')?.value, 1.5);
            const material = new THREE.PointsMaterial({
                size: size, vertexColors: true, blending: THREE.AdditiveBlending,
                depthWrite: false, transparent: true
            });

            appState.vortexParticles = new THREE.Points(geometry, material);
            appState.scene.add(appState.vortexParticles);
            appState.vortexParticles.visible = true;

            const spd = safeParseFloat(document.getElementById('vortexSpeed')?.value, 0.003);
            appState.rt.vortexSpeed = Math.max(0.001, Math.min(0.01, spd));

            this.updateBloomSettings();
            appState.needsRender = true;
        },

        updateBloomSettings() {
            const enabled = document.getElementById('visualEffectsEnabled')?.checked || false;
            const strength = safeParseFloat(document.getElementById('bloomStrength')?.value, 0.5);

            if (appState.bloomPass) {
                // 当辉光强度归零时，彻底停用辉光通道
                appState.bloomPass.enabled = (enabled && strength > 0.001);
                appState.bloomPass.threshold = safeParseFloat(document.getElementById('bloomThreshold')?.value, 0.8);
                appState.bloomPass.strength = strength;
                appState.bloomPass.radius = safeParseFloat(document.getElementById('bloomRadius')?.value, 0.2);
            }
        },

        updateVisualEffects() {
            const enabled = document.getElementById('visualEffectsEnabled')?.checked || false;
            appState.rt.visualFxEnabled = enabled;

            if (enabled && !appState.vortexParticles) {
                this.initVortex();
            } else if (appState.vortexParticles) {
                appState.vortexParticles.visible = enabled;
            }

            const spd = safeParseFloat(document.getElementById('vortexSpeed')?.value, 0.003);
            appState.rt.vortexSpeed = Math.max(0.001, Math.min(0.01, spd));

            this.updateBloomSettings();
            appState.needsRender = true;
        },

        // 星空背景设置完全响应重构
        initStarfield() {
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

            const defaultCount = IS_MOBILE_DEVICE ? 2000 : APP_CONFIG.DEFAULT_STAR_COUNT;
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
                const phi = Math.acos(Math.min(Math.max(rawVal, -1), 1));

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
                size: size, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true
            });

            appState.starfield = new THREE.Points(geometry, material);
            appState.scene.add(appState.starfield);
            appState.needsRender = true;
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
})();
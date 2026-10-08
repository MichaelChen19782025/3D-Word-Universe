/**
 * 3D单词宇宙 - 卡片样机、内腔纵深透视与柔和泛光引擎 (Card Styles & 3D Lighting Engine)
 * 支持 0~8x 超宽泛光调节、内腔零光亮纯黑状态、经典 HUD 查词卡样式与角括号
 */
(function() {
    const CARD_PRESETS = {
        'cyber_blue': {
            id: 'cyber_blue',
            name: '赛博深舱透视 (太空幽蓝)',
            desc: '深舱透视内壁，底部微光地台，幽蓝大气泛光 (图3/5/8)',
            frameColorA: '#1a3a68',
            frameColorB: '#0b1d3a',
            outerBevelColor: 'rgba(0, 240, 255, 0.55)',
            innerBevelColor: 'rgba(0, 30, 80, 0.95)',
            backWallColor: '#050f24',
            sideWallColor: '#0a1a36',
            ceilingColor: '#06132b',
            floorColor: '#0d2347',
            gridColor: 'rgba(0, 220, 255, 0.18)',
            defaultLightColor: '#00f0ff',
            defaultLightPosition: 'center',
            defaultLightBrightness: 0.85,
            defaultLightSpread: 0.85,
            textColor: '#ffffff',
            textDepthColor: '#020917',
            textHighlightColor: '#b0f5ff',
            textStyle: 'relief_metal'
        },
        'titanium_plaque': {
            id: 'titanium_plaque',
            name: '暗黑钛金按键 (精密工业)',
            desc: '磨砂枪黑金属，双层精密倒角外框，重工业立体按键 (图14-19)',
            frameColorA: '#383d44',
            frameColorB: '#1a1c20',
            outerBevelColor: 'rgba(230, 240, 255, 0.65)',
            innerBevelColor: 'rgba(5, 5, 8, 0.95)',
            backWallColor: '#17191d',
            sideWallColor: '#1e2126',
            ceilingColor: '#24272e',
            floorColor: '#131518',
            gridColor: 'transparent',
            defaultLightColor: '#d6e4ff',
            defaultLightPosition: 'top',
            defaultLightBrightness: 0.65,
            defaultLightSpread: 0.70,
            textColor: '#e6edf5',
            textDepthColor: '#07080a',
            textHighlightColor: '#ffffff',
            textStyle: 'chiseled_bevel'
        },
        'matrix_grid': {
            id: 'matrix_grid',
            name: '全息科技光廊 (透视网格)',
            desc: '透视延伸网格，高能光轨腔体，极具纵深空间感 (图16)',
            frameColorA: '#202b3c',
            frameColorB: '#0c121d',
            outerBevelColor: 'rgba(0, 255, 200, 0.50)',
            innerBevelColor: 'rgba(0, 0, 0, 0.95)',
            backWallColor: '#040911',
            sideWallColor: '#081324',
            ceilingColor: '#07101e',
            floorColor: '#091629',
            gridColor: 'rgba(0, 255, 200, 0.28)',
            defaultLightColor: '#00ffc4',
            defaultLightPosition: 'center',
            defaultLightBrightness: 0.90,
            defaultLightSpread: 0.90,
            textColor: '#ffffff',
            textDepthColor: '#010f0c',
            textHighlightColor: '#a8ffeb',
            textStyle: 'neon_glow'
        },
        'frost_ice': {
            id: 'frost_ice',
            name: '极地玄冰暗室 (冰晶微光)',
            desc: '幽蓝冰魄冻结质感，透亮冰壁与晶莹内腔 (图20)',
            frameColorA: '#3c5a78',
            frameColorB: '#16283b',
            outerBevelColor: 'rgba(180, 230, 255, 0.75)',
            innerBevelColor: 'rgba(8, 24, 45, 0.95)',
            backWallColor: '#0c1b2d',
            sideWallColor: '#162e49',
            ceilingColor: '#1f3d60',
            floorColor: '#10243b',
            gridColor: 'rgba(160, 230, 255, 0.18)',
            defaultLightColor: '#8ee5ff',
            defaultLightPosition: 'center',
            defaultLightBrightness: 1.05,
            defaultLightSpread: 0.85,
            textColor: '#ffffff',
            textDepthColor: '#061a30',
            textHighlightColor: '#e0f8ff',
            textStyle: 'ice_chiseled'
        },
        'magma_forge': {
            id: 'magma_forge',
            name: '熔岩地心殿堂 (炽热暗焰)',
            desc: '黑曜石腔体，深处地热熔岩地台暗红泛光 (图7)',
            frameColorA: '#4a1e1e',
            frameColorB: '#1d0b0b',
            outerBevelColor: 'rgba(255, 100, 30, 0.70)',
            innerBevelColor: 'rgba(20, 3, 3, 0.95)',
            backWallColor: '#120505',
            sideWallColor: '#1e0909',
            ceilingColor: '#1a0707',
            floorColor: '#2b0c0c',
            gridColor: 'rgba(255, 80, 20, 0.20)',
            defaultLightColor: '#ff4d15',
            defaultLightPosition: 'bottom',
            defaultLightBrightness: 0.95,
            defaultLightSpread: 0.90,
            textColor: '#ffebdc',
            textDepthColor: '#1a0300',
            textHighlightColor: '#ffb599',
            textStyle: 'relief_metal'
        },
        'steampunk_brass': {
            id: 'steampunk_brass',
            name: '黄铜复古机械 (齿轮工坊)',
            desc: '重型黄铜古铜质感，暖色复古泛光，重工机械箱 (图21)',
            frameColorA: '#6b4d24',
            frameColorB: '#2d1f0d',
            outerBevelColor: 'rgba(255, 200, 100, 0.65)',
            innerBevelColor: 'rgba(15, 10, 4, 0.95)',
            backWallColor: '#140e07',
            sideWallColor: '#25190c',
            ceilingColor: '#2c1e0e',
            floorColor: '#1d1308',
            gridColor: 'rgba(255, 190, 80, 0.16)',
            defaultLightColor: '#ffba42',
            defaultLightPosition: 'top',
            defaultLightBrightness: 0.85,
            defaultLightSpread: 0.80,
            textColor: '#fff5e0',
            textDepthColor: '#170b02',
            textHighlightColor: '#ffe5a8',
            textStyle: 'chiseled_bevel'
        },
        'luxury_leather': {
            id: 'luxury_leather',
            name: '轻奢典雅皮质 (手工暗盒)',
            desc: '沉稳马鞍棕皮质内敛质感，尊贵展示托盘 (图11)',
            frameColorA: '#4a2c1d',
            frameColorB: '#24140c',
            outerBevelColor: 'rgba(230, 175, 130, 0.50)',
            innerBevelColor: 'rgba(10, 6, 4, 0.95)',
            backWallColor: '#180d07',
            sideWallColor: '#25150c',
            ceilingColor: '#2d190e',
            floorColor: '#1a0e08',
            gridColor: 'transparent',
            defaultLightColor: '#ffd2a6',
            defaultLightPosition: 'top',
            defaultLightBrightness: 0.60,
            defaultLightSpread: 0.75,
            textColor: '#f9eee5',
            textDepthColor: '#120703',
            textHighlightColor: '#ffffff',
            textStyle: 'chiseled_bevel'
        },
        'minimal_studio': {
            id: 'minimal_studio',
            name: '现代极简展厅 (顶部天幕)',
            desc: '极简建筑级展示方盒，大面积顶部柔和天幕泛光 (图4/6)',
            frameColorA: '#40454f',
            frameColorB: '#1e2126',
            outerBevelColor: 'rgba(255, 255, 255, 0.60)',
            innerBevelColor: 'rgba(10, 12, 16, 0.95)',
            backWallColor: '#1c1f24',
            sideWallColor: '#272b32',
            ceilingColor: '#3d434d',
            floorColor: '#23262c',
            gridColor: 'transparent',
            defaultLightColor: '#ffffff',
            defaultLightPosition: 'top',
            defaultLightBrightness: 0.90,
            defaultLightSpread: 0.85,
            textColor: '#ffffff',
            textDepthColor: '#0b0d10',
            textHighlightColor: '#ffffff',
            textStyle: 'relief_metal'
        }
    };

    function hexToRgb(hex) {
        let clean = hex.replace('#', '').trim();
        if (clean.length === 3) {
            clean = clean.split('').map(c => c + c).join('');
        }
        const num = parseInt(clean, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    const CardStyleManager = {
        presets: CARD_PRESETS,

        getPreset(presetId) {
            return CARD_PRESETS[presetId] || CARD_PRESETS['cyber_blue'];
        },

        getAllPresets() {
            return Object.values(CARD_PRESETS);
        },

        /**
         * 绘制拥有内腔纵深、倾斜透视墙壁与柔和泛光的 3D 展示盒底板
         * 核心规则：若 lightBrightness <= 0.001，确保呈现 100% 漆黑无光暗室
         */
        drawPerspectiveChamber(ctx, width, height, cfg) {
            ctx.save();

            const rawDepth = cfg.depthFactor !== undefined ? cfg.depthFactor : 0.65;
            const normalizedDepth = Math.max(0.0, Math.min(2.8, rawDepth));
            const shrinkRatio = 1 - Math.min(0.85, normalizedDepth * 0.32);

            const frameThickness = Math.max(2, Math.round(Math.min(width, height) * 0.055));
            const cornerRadius = Math.max(3, Math.round(frameThickness * 1.6));

            this.drawRoundedRectPath(ctx, 0, 0, width, height, cornerRadius);
            ctx.clip();

            const lightBrightness = cfg.lightBrightness !== undefined ? cfg.lightBrightness : 0.85;
            const isPitchBlack = (lightBrightness <= 0.001);

            // 外边框底色：若亮度为0则全黑
            if (isPitchBlack) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, width, height);
            } else {
                const frameGrad = ctx.createLinearGradient(0, 0, width, height);
                frameGrad.addColorStop(0, cfg.frameColorA || '#1a3a68');
                frameGrad.addColorStop(1, cfg.frameColorB || '#0b1d3a');
                ctx.fillStyle = frameGrad;
                ctx.fillRect(0, 0, width, height);
            }

            const innerLeft = frameThickness;
            const innerTop = frameThickness;
            const innerRight = width - frameThickness;
            const innerBottom = height - frameThickness;
            const innerW = innerRight - innerLeft;
            const innerH = innerBottom - innerTop;

            const backW = innerW * shrinkRatio;
            const backH = innerH * shrinkRatio;
            const backLeft = innerLeft + (innerW - backW) / 2;
            const backTop = innerTop + (innerH - backH) / 2;
            const backRight = backLeft + backW;
            const backBottom = backTop + backH;

            if (isPitchBlack) {
                // 零光照下内壁完全黑透
                ctx.fillStyle = '#000000';
                ctx.fillRect(innerLeft, innerTop, innerW, innerH);
            } else {
                if (normalizedDepth > 0.02) {
                    // 顶壁
                    const ceilingGrad = ctx.createLinearGradient(0, innerTop, 0, backTop);
                    ceilingGrad.addColorStop(0, cfg.ceilingColor || '#06132b');
                    ceilingGrad.addColorStop(1, cfg.backWallColor || '#050f24');
                    ctx.fillStyle = ceilingGrad;
                    ctx.beginPath();
                    ctx.moveTo(innerLeft, innerTop);
                    ctx.lineTo(innerRight, innerTop);
                    ctx.lineTo(backRight, backTop);
                    ctx.lineTo(backLeft, backTop);
                    ctx.closePath();
                    ctx.fill();

                    // 底壁
                    const floorGrad = ctx.createLinearGradient(0, backBottom, 0, innerBottom);
                    floorGrad.addColorStop(0, cfg.backWallColor || '#050f24');
                    floorGrad.addColorStop(1, cfg.floorColor || '#0d2347');
                    ctx.fillStyle = floorGrad;
                    ctx.beginPath();
                    ctx.moveTo(innerLeft, innerBottom);
                    ctx.lineTo(innerRight, innerBottom);
                    ctx.lineTo(backRight, backBottom);
                    ctx.lineTo(backLeft, backBottom);
                    ctx.closePath();
                    ctx.fill();

                    // 左壁
                    const leftGrad = ctx.createLinearGradient(innerLeft, 0, backLeft, 0);
                    leftGrad.addColorStop(0, cfg.sideWallColor || '#0a1a36');
                    leftGrad.addColorStop(1, cfg.backWallColor || '#050f24');
                    ctx.fillStyle = leftGrad;
                    ctx.beginPath();
                    ctx.moveTo(innerLeft, innerTop);
                    ctx.lineTo(backLeft, backTop);
                    ctx.lineTo(backLeft, backBottom);
                    ctx.lineTo(innerLeft, innerBottom);
                    ctx.closePath();
                    ctx.fill();

                    // 右壁
                    const rightGrad = ctx.createLinearGradient(innerRight, 0, backRight, 0);
                    rightGrad.addColorStop(0, cfg.sideWallColor || '#0a1a36');
                    rightGrad.addColorStop(1, cfg.backWallColor || '#050f24');
                    ctx.fillStyle = rightGrad;
                    ctx.beginPath();
                    ctx.moveTo(innerRight, innerTop);
                    ctx.lineTo(backRight, backTop);
                    ctx.lineTo(backRight, backBottom);
                    ctx.lineTo(innerRight, innerBottom);
                    ctx.closePath();
                    ctx.fill();
                }

                // 后背景墙
                ctx.fillStyle = cfg.backWallColor || '#050f24';
                ctx.fillRect(backLeft, backTop, backW, backH);

                // 透视网格
                if (cfg.gridColor && cfg.gridColor !== 'transparent' && normalizedDepth > 0.05) {
                    ctx.save();
                    ctx.strokeStyle = cfg.gridColor;
                    ctx.lineWidth = Math.max(1, Math.round(width * 0.0035));

                    const gridSteps = 5;
                    for (let i = 1; i < gridSteps; i++) {
                        const stepRatio = i / gridSteps;
                        const xFront = innerLeft + innerW * stepRatio;
                        const xBack = backLeft + backW * stepRatio;
                        ctx.beginPath();
                        ctx.moveTo(xFront, innerBottom);
                        ctx.lineTo(xBack, backBottom);
                        ctx.stroke();
                    }

                    for (let j = 1; j <= 3; j++) {
                        const t = j / 4;
                        const y = backBottom + (innerBottom - backBottom) * t;
                        const xl = backLeft - (backLeft - innerLeft) * t;
                        const xr = backRight + (innerRight - backRight) * t;
                        ctx.beginPath();
                        ctx.moveTo(xl, y);
                        ctx.lineTo(xr, y);
                        ctx.stroke();
                    }
                    ctx.restore();
                }

                // 柔和体积泛光
                this.drawInternalDiffuseGlow(ctx, width, height, {
                    innerLeft, innerTop, innerRight, innerBottom,
                    backLeft, backTop, backRight, backBottom,
                    lightColor: cfg.lightColor || '#00f0ff',
                    lightPosition: cfg.lightPosition || 'center',
                    lightBrightness: lightBrightness,
                    lightSpread: cfg.lightSpread || 0.85
                });

                // 折痕阴影
                if (normalizedDepth > 0.05) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
                    ctx.lineWidth = Math.max(1, Math.round(width * 0.0045));
                    ctx.beginPath();
                    ctx.moveTo(innerLeft, innerTop); ctx.lineTo(backLeft, backTop);
                    ctx.moveTo(innerRight, innerTop); ctx.lineTo(backRight, backTop);
                    ctx.moveTo(innerLeft, innerBottom); ctx.lineTo(backLeft, backBottom);
                    ctx.moveTo(innerRight, innerBottom); ctx.lineTo(backRight, backBottom);
                    ctx.stroke();

                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
                    ctx.strokeRect(backLeft, backTop, backW, backH);
                    ctx.restore();
                }

                // 金属倒角边框高光
                ctx.save();
                ctx.strokeStyle = cfg.outerBevelColor || 'rgba(255, 255, 255, 0.45)';
                ctx.lineWidth = Math.max(1.2, Math.round(frameThickness * 0.22));
                this.drawRoundedRectPath(ctx, 1, 1, width - 2, height - 2, cornerRadius);
                ctx.stroke();

                ctx.strokeStyle = cfg.innerBevelColor || 'rgba(0, 0, 0, 0.85)';
                ctx.lineWidth = Math.max(1.0, Math.round(frameThickness * 0.20));
                ctx.strokeRect(innerLeft, innerTop, innerW, innerH);
                ctx.restore();
            }

            ctx.restore();
        },

        drawInternalDiffuseGlow(ctx, w, h, opts) {
            if (opts.lightBrightness <= 0.001) return;

            const rgb = hexToRgb(opts.lightColor || '#00f0ff');
            const pos = opts.lightPosition || 'center';
            const b = Math.max(0.0, opts.lightBrightness);
            const spread = Math.max(0.1, opts.lightSpread || 0.85);

            let cx = w / 2;
            let cy = h / 2;
            let maxRadius = Math.max(w, h) * 0.65 * spread;

            if (pos === 'top') {
                cx = w / 2;
                cy = opts.innerTop + (opts.backTop - opts.innerTop) * 0.4;
            } else if (pos === 'bottom') {
                cx = w / 2;
                cy = opts.backBottom + (opts.innerBottom - opts.backBottom) * 0.6;
            } else if (pos === 'front') {
                cx = w / 2;
                cy = h / 2;
                maxRadius = Math.max(w, h) * 0.95 * spread;
            } else {
                cx = (opts.backLeft + opts.backRight) / 2;
                cy = (opts.backTop + opts.backBottom) / 2;
            }

            ctx.save();
            ctx.globalCompositeOperation = 'screen';

            const radGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, maxRadius);
            const peakAlpha = Math.min(0.92, 0.35 * Math.sqrt(b));
            const midAlpha = Math.min(0.60, 0.18 * Math.sqrt(b));

            radGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${peakAlpha.toFixed(3)})`);
            radGrad.addColorStop(0.35, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midAlpha.toFixed(3)})`);
            radGrad.addColorStop(0.70, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(midAlpha * 0.35).toFixed(3)})`);
            radGrad.addColorStop(1.0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.0)`);

            ctx.fillStyle = radGrad;
            ctx.fillRect(opts.innerLeft, opts.innerTop, opts.innerRight - opts.innerLeft, opts.innerBottom - opts.innerTop);

            if (pos === 'top' || pos === 'bottom') {
                const stripY = (pos === 'top') ? opts.backTop : opts.backBottom;
                const stripGrad = ctx.createLinearGradient(0, stripY - 15, 0, stripY + 25);
                stripGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(peakAlpha * 0.5).toFixed(3)})`);
                stripGrad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
                ctx.fillStyle = stripGrad;
                ctx.fillRect(opts.backLeft, stripY - 15, opts.backRight - opts.backLeft, 40);
            }

            ctx.restore();
        },

        draw3DText(ctx, text, x, y, options) {
            ctx.save();
            const fontSize = options.fontSize || 32;
            const textStyle = options.textStyle || 'relief_metal';
            const textColor = options.textColor || '#ffffff';
            const depthColor = options.textDepthColor || '#070a12';
            const highlightColor = options.textHighlightColor || '#b5f5ff';
            const lightPos = options.lightPosition || 'center';
            const lightBrightness = options.lightBrightness !== undefined ? options.lightBrightness : 0.85;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (lightBrightness > 0.05 && options.lightColor) {
                const rgb = hexToRgb(options.lightColor);
                ctx.save();
                ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(0.9, 0.40 * Math.sqrt(lightBrightness)).toFixed(2)})`;
                ctx.shadowBlur = Math.round(fontSize * 0.45);
                ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(0.3, 0.12 * Math.sqrt(lightBrightness)).toFixed(2)})`;
                ctx.fillText(text, x, y);
                ctx.restore();
            }

            const extrudeSteps = Math.max(1, Math.round(fontSize * 0.08));
            const yOffsetDir = (lightPos === 'top') ? 1 : ((lightPos === 'bottom') ? -1 : 1);

            for (let i = extrudeSteps; i >= 1; i--) {
                const layerOffset = i * 1.0 * yOffsetDir;
                ctx.fillStyle = depthColor;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = layerOffset;
                ctx.fillText(text, x, y + layerOffset);
            }

            if (textStyle === 'relief_metal' || textStyle === 'chiseled_bevel') {
                const metalGrad = ctx.createLinearGradient(0, y - fontSize * 0.5, 0, y + fontSize * 0.5);
                metalGrad.addColorStop(0, highlightColor);
                metalGrad.addColorStop(0.3, textColor);
                metalGrad.addColorStop(0.85, textColor);
                metalGrad.addColorStop(1, '#a6b8cc');

                ctx.fillStyle = metalGrad;
                ctx.shadowColor = 'transparent';
                ctx.fillText(text, x, y);

                ctx.strokeStyle = 'rgba(10, 18, 30, 0.85)';
                ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.045));
                ctx.strokeText(text, x, y);

                ctx.save();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.lineWidth = Math.max(0.8, Math.round(fontSize * 0.025));
                ctx.strokeText(text, x, y - 0.7);
                ctx.restore();

            } else if (textStyle === 'neon_glow') {
                ctx.fillStyle = textColor;
                ctx.shadowColor = options.lightColor || '#00f0ff';
                ctx.shadowBlur = 12;
                ctx.fillText(text, x, y);

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.035));
                ctx.strokeText(text, x, y);

            } else {
                ctx.fillStyle = textColor;
                ctx.strokeStyle = depthColor;
                ctx.lineWidth = Math.max(1.5, Math.round(fontSize * 0.12));
                ctx.lineJoin = 'round';
                ctx.strokeText(text, x, y);
                ctx.fillText(text, x, y);
            }

            ctx.restore();
        },

        /**
         * 绘制四角赛博科技发光角括号 (100% 还原附件参考图中的四角发光框)
         */
        drawCyberCornerBrackets(ctx, x, y, width, height, len = 42, color = '#00f0ff') {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 4.5;
            ctx.lineCap = 'square';
            ctx.shadowColor = color;
            ctx.shadowBlur = 14;

            // 1. 左上角 ┌
            ctx.beginPath();
            ctx.moveTo(x, y + len);
            ctx.lineTo(x, y);
            ctx.lineTo(x + len, y);
            ctx.stroke();

            // 2. 右上角 ┐
            ctx.beginPath();
            ctx.moveTo(x + width - len, y);
            ctx.lineTo(x + width, y);
            ctx.lineTo(x + width, y + len);
            ctx.stroke();

            // 3. 左下角 └
            ctx.beginPath();
            ctx.moveTo(x, y + height - len);
            ctx.lineTo(x, y + height);
            ctx.lineTo(x + len, y + height);
            ctx.stroke();

            // 4. 右下角 ┘
            ctx.beginPath();
            ctx.moveTo(x + width - len, y + height);
            ctx.lineTo(x + width, y + height);
            ctx.lineTo(x + width, y + height - len);
            ctx.stroke();

            ctx.restore();
        },

        drawRoundedRectPath(ctx, x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        }
    };

    window.CardStyleManager = CardStyleManager;
})();
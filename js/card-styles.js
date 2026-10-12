/**
 * 3D单词宇宙 - 卡片视觉风格与 3D 展舱渲染引擎 (Card Style Manager)
 * 提供 8 种高拟真材质内腔透视样机与 3D 文字浮雕/霓虹渲染算法
 */
(function() {
    const PRESETS = {
        cyber_blue: {
            id: 'cyber_blue',
            name: '赛博深舱透视',
            desc: '经典赛博电竞深舱，中央核芯漫反射泛光，未来科技感十足',
            defaultLightColor: '#00f0ff',
            defaultLightPosition: 'center',
            defaultLightBrightness: 0.85,
            defaultLightSpread: 0.85,
            defaultChamberDepth: 0.65,
            textStyle: 'neon_glow',
            textColor: '#ffffff',
            textHighlightColor: '#b5f5ff',
            textDepthColor: '#061328',
            baseColor: '#06122a'
        },
        titanium_plaque: {
            id: 'titanium_plaque',
            name: '暗黑钛金按键',
            desc: '钛金哑光按键倒角，金属浮雕立体文字，硬朗沉稳',
            defaultLightColor: '#a0b8d0',
            defaultLightPosition: 'top',
            defaultLightBrightness: 0.75,
            defaultLightSpread: 0.70,
            defaultChamberDepth: 0.50,
            textStyle: 'relief_metal',
            textColor: '#f0f4f8',
            textHighlightColor: '#ffffff',
            textDepthColor: '#101620',
            baseColor: '#12161f'
        },
        matrix_grid: {
            id: 'matrix_grid',
            name: '全息科技光廊',
            desc: '矩阵网格纵深透视廊道，绿色荧光边缘反射，黑客全息质感',
            defaultLightColor: '#00ff66',
            defaultLightPosition: 'center',
            defaultLightBrightness: 0.90,
            defaultLightSpread: 0.90,
            defaultChamberDepth: 0.80,
            textStyle: 'neon_glow',
            textColor: '#eafff0',
            textHighlightColor: '#80ffaa',
            textDepthColor: '#031408',
            baseColor: '#021206'
        },
        frost_ice: {
            id: 'frost_ice',
            name: '极地玄冰暗室',
            desc: '晶莹剔透的极地玄冰，透出清冽幽蓝的地台漫射冷光',
            defaultLightColor: '#80d0ff',
            defaultLightPosition: 'bottom',
            defaultLightBrightness: 0.80,
            defaultLightSpread: 0.80,
            defaultChamberDepth: 0.60,
            textStyle: 'relief_metal',
            textColor: '#ffffff',
            textHighlightColor: '#cceeff',
            textDepthColor: '#06162a',
            baseColor: '#05162c'
        },
        magma_forge: {
            id: 'magma_forge',
            name: '熔岩地心殿堂',
            desc: '地心熔岩烘炉殿堂，底部赤焰火光向上漫射，极具视觉冲击力',
            defaultLightColor: '#ff4d00',
            defaultLightPosition: 'bottom',
            defaultLightBrightness: 0.95,
            defaultLightSpread: 0.85,
            defaultChamberDepth: 0.75,
            textStyle: 'neon_glow',
            textColor: '#fff2e0',
            textHighlightColor: '#ff9966',
            textDepthColor: '#260600',
            baseColor: '#1f0702'
        },
        steampunk_brass: {
            id: 'steampunk_brass',
            name: '黄铜复古机械',
            desc: '蒸汽朋克经典复古黄铜，重度金属倒角包边，典雅机械韵味',
            defaultLightColor: '#e6b800',
            defaultLightPosition: 'top',
            defaultLightBrightness: 0.80,
            defaultLightSpread: 0.75,
            defaultChamberDepth: 0.55,
            textStyle: 'relief_metal',
            textColor: '#fffbe6',
            textHighlightColor: '#ffe680',
            textDepthColor: '#261d00',
            baseColor: '#1f1806'
        },
        luxury_leather: {
            id: 'luxury_leather',
            name: '轻奢典雅皮质',
            desc: '奢华典雅深色皮质底蕴，顶部温润聚光漫射，精致高雅',
            defaultLightColor: '#d4af37',
            defaultLightPosition: 'top',
            defaultLightBrightness: 0.70,
            defaultLightSpread: 0.65,
            defaultChamberDepth: 0.45,
            textStyle: 'plain_bold',
            textColor: '#fdfbf7',
            textHighlightColor: '#eedc82',
            textDepthColor: '#141008',
            baseColor: '#14110d'
        },
        minimal_studio: {
            id: 'minimal_studio',
            name: '现代极简展厅',
            desc: '现代艺术展馆极简设计，正面纯粹无影漫射投光，文字清晰高对比',
            defaultLightColor: '#ffffff',
            defaultLightPosition: 'front',
            defaultLightBrightness: 0.85,
            defaultLightSpread: 0.80,
            defaultChamberDepth: 0.35,
            textStyle: 'plain_bold',
            textColor: '#ffffff',
            textHighlightColor: '#ffffff',
            textDepthColor: '#11141a',
            baseColor: '#0d1117'
        }
    };

    const CardStyleManager = {
        getPreset(presetId) {
            return PRESETS[presetId] || PRESETS.cyber_blue;
        },

        getAllPresets() {
            return PRESETS;
        },

        // 在 2D Canvas 上高保真绘制 3D 展舱透视内腔与光源
        drawPerspectiveChamber(ctx, w, h, cfg) {
            const depth = Math.max(0.1, Math.min(3.0, cfg.depthFactor !== undefined ? cfg.depthFactor : 0.65));
            const insetX = Math.round(w * 0.13 * Math.min(depth, 1.35));
            const insetY = Math.round(h * 0.13 * Math.min(depth, 1.35));

            const x0 = 0, y0 = 0;
            const x1 = w, y1 = h;
            const ix0 = insetX, iy0 = insetY;
            const ix1 = w - insetX, iy1 = h - insetY;

            const lightColor = cfg.lightColor || '#00f0ff';
            const lightBrightness = Math.max(0.0, cfg.lightBrightness !== undefined ? cfg.lightBrightness : 0.85);
            const lightSpread = Math.max(0.1, cfg.lightSpread !== undefined ? cfg.lightSpread : 0.85);
            const pos = cfg.lightPosition || 'center';

            ctx.save();

            // 1. 底层背墙
            ctx.fillStyle = cfg.baseColor || '#06122a';
            ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);

            // 2. 绘制 4 块斜坡透视墙壁
            // 顶壁 (Ceiling)
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y0);
            ctx.lineTo(ix1, iy0);
            ctx.lineTo(ix0, iy0);
            ctx.closePath();
            const topGrad = ctx.createLinearGradient(0, y0, 0, iy0);
            topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
            topGrad.addColorStop(1, 'rgba(0, 0, 0, 0.20)');
            ctx.fillStyle = topGrad;
            ctx.fill();

            // 底壁 (Floor)
            ctx.beginPath();
            ctx.moveTo(x0, y1);
            ctx.lineTo(x1, y1);
            ctx.lineTo(ix1, iy1);
            ctx.lineTo(ix0, iy1);
            ctx.closePath();
            const btmGrad = ctx.createLinearGradient(0, y1, 0, iy1);
            btmGrad.addColorStop(0, 'rgba(0, 0, 0, 0.80)');
            btmGrad.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
            ctx.fillStyle = btmGrad;
            ctx.fill();

            // 左壁 (Left Wall)
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(ix0, iy0);
            ctx.lineTo(ix0, iy1);
            ctx.lineTo(x0, y1);
            ctx.closePath();
            const leftGrad = ctx.createLinearGradient(x0, 0, ix0, 0);
            leftGrad.addColorStop(0, 'rgba(0, 0, 0, 0.60)');
            leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
            ctx.fillStyle = leftGrad;
            ctx.fill();

            // 右壁 (Right Wall)
            ctx.beginPath();
            ctx.moveTo(x1, y0);
            ctx.lineTo(ix1, iy0);
            ctx.lineTo(ix1, iy1);
            ctx.lineTo(x1, y1);
            ctx.closePath();
            const rightGrad = ctx.createLinearGradient(x1, 0, ix1, 0);
            rightGrad.addColorStop(0, 'rgba(0, 0, 0, 0.60)');
            rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
            ctx.fillStyle = rightGrad;
            ctx.fill();

            // 3. 展舱透视内腔灯光渲染
            ctx.globalCompositeOperation = 'lighter';
            let lightGrad;
            const effAlpha = Math.min(1.0, lightBrightness * 0.75);

            if (pos === 'top') {
                lightGrad = ctx.createLinearGradient(w / 2, y0, w / 2, y1);
                lightGrad.addColorStop(0, lightColor);
                lightGrad.addColorStop(Math.min(1.0, 0.50 * lightSpread), 'rgba(0, 0, 0, 0)');
            } else if (pos === 'bottom') {
                lightGrad = ctx.createLinearGradient(w / 2, y1, w / 2, y0);
                lightGrad.addColorStop(0, lightColor);
                lightGrad.addColorStop(Math.min(1.0, 0.50 * lightSpread), 'rgba(0, 0, 0, 0)');
            } else if (pos === 'front') {
                lightGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75 * lightSpread);
                lightGrad.addColorStop(0, lightColor);
                lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            } else {
                // 默认核芯中央泛光 (center)
                const rad = Math.max(w, h) * 0.55 * lightSpread;
                lightGrad = ctx.createRadialGradient(w / 2, h / 2, rad * 0.08, w / 2, h / 2, rad);
                lightGrad.addColorStop(0, lightColor);
                lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            }

            ctx.globalAlpha = effAlpha;
            ctx.fillStyle = lightGrad;
            ctx.fillRect(0, 0, w, h);

            // 4. 内边框细线透视勾勒
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.min(1.0, lightBrightness * 0.5 + 0.2);
            ctx.strokeStyle = lightColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(ix0 + 0.5, iy0 + 0.5, ix1 - ix0 - 1, iy1 - iy0 - 1);

            ctx.beginPath();
            ctx.moveTo(x0, y0); ctx.lineTo(ix0, iy0);
            ctx.moveTo(x1, y0); ctx.lineTo(ix1, iy0);
            ctx.moveTo(x0, y1); ctx.lineTo(ix0, iy1);
            ctx.moveTo(x1, y1); ctx.lineTo(ix1, iy1);
            ctx.stroke();

            ctx.restore();
        },

        // 3D 浮雕、高对比度与全息霓虹文字渲染
        draw3DText(ctx, text, x, y, options) {
            const style = options.textStyle || 'plain_bold';
            const fontSize = options.fontSize || 36;
            const textColor = options.textColor || '#ffffff';

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (style === 'plain_bold') {
                ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.16));
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
                ctx.strokeText(text, x, y);

                ctx.fillStyle = textColor;
                ctx.fillText(text, x, y);
            } else if (style === 'relief_metal') {
                const depthOffset = Math.max(1.5, fontSize * 0.05);
                const shadowColor = options.textDepthColor || '#070a12';
                const highlightColor = options.textHighlightColor || '#ffffff';

                ctx.fillStyle = shadowColor;
                ctx.fillText(text, x + depthOffset, y + depthOffset);

                ctx.fillStyle = highlightColor;
                ctx.globalAlpha = 0.65;
                ctx.fillText(text, x - depthOffset * 0.6, y - depthOffset * 0.6);

                ctx.globalAlpha = 1.0;
                ctx.fillStyle = textColor;
                ctx.fillText(text, x, y);
            } else if (style === 'neon_glow') {
                const glowColor = options.lightColor || options.textHighlightColor || '#00f0ff';
                
                ctx.save();
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = Math.round(fontSize * 0.5);
                ctx.fillStyle = textColor;
                ctx.fillText(text, x, y);
                ctx.restore();

                ctx.save();
                ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.1));
                ctx.strokeStyle = glowColor;
                ctx.strokeText(text, x, y);
                ctx.fillStyle = textColor;
                ctx.fillText(text, x, y);
                ctx.restore();
            }

            ctx.restore();
        }
    };

    window.CardStyleManager = CardStyleManager;
})();
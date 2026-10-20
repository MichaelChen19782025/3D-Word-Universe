// 【关键点】不再使用 v8.5 这种手动版本号，直接使用固定名称
// 第一次运行此代码时，会自动清理掉你之前的 v8.5 旧缓存
const CACHE_NAME = 'word-universe-cache'; 

// 核心本地资源：必须全部缓存成功
const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/styles.css',
    './js/config.js',
    './js/storage.js',
    './js/audio-tts.js',
    './js/card-factory.js',
    './js/sphere-engine.js',
    './js/fx-particles.js',
    './js/scene-manager.js',
    './js/ui-controller.js'
];

// 外部 CDN 资源：允许个别失败，不阻塞核心资源缓存
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/lights/RectAreaLightUniformsLib.js'
];

// 安装阶段：分离核心与 CDN 资源缓存
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            // 1. 强制缓存本地核心文件
            await cache.addAll(CORE_ASSETS).catch(err => {
                console.error('[SW] 核心资源缓存失败', err);
            });

            // 2. 独立缓存 CDN 资源（允许某些 CDN 在国内网络下失败，不阻塞安装）
            const cdnPromises = CDN_ASSETS.map(url => {
                return cache.add(url).catch(err => {
                    console.warn(`[SW] CDN 资源缓存失败，跳过: ${url}`, err);
                });
            });
            await Promise.allSettled(cdnPromises);
        }).then(() => self.skipWaiting()) // 强制新 SW 立即接管
    );
});

// 激活阶段：清理所有不是当前 CACHE_NAME 的旧缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    // 关键：只要缓存名字不是 'word-universe-cache'，统统删掉！
                    // 这会自动清空你之前所有的 v8.5 等旧版本缓存
                    if (key !== CACHE_NAME) {
                        console.log('[SW] 发现旧缓存，正在清理:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim()) // 立即接管页面控制权
    );
});

// 拦截请求：Stale-While-Revalidate (SWR) 策略
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) return;

    event.respondWith(
        caches.open(CACHE_NAME).then(async cache => {
            // 1. 尝试从缓存中获取
            const cachedResponse = await cache.match(event.request);

            // 2. 发起网络请求（无论是否有缓存，都在后台去拉取最新数据）
            const fetchPromise = fetch(event.request)
                .then(networkResponse => {
                    // 如果请求成功，就把最新的网络响应存入缓存
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                        cache.put(event.request, networkResponse.clone()).catch(e => {
                            console.warn('[SW] 运行时缓存写入失败', e);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // 网络彻底断开时的兜底逻辑
                    // 如果是网页导航请求（HTML），返回离线的 index.html
                    if (event.request.headers.get('accept')?.includes('text/html')) {
                        return cache.match('./index.html');
                    }
                    return null;
                });

            // 核心逻辑：有缓存立刻秒开返回；没缓存则等待网络请求结果
            return cachedResponse || fetchPromise;
        })
    );
});
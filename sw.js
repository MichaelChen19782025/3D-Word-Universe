const CACHE_NAME = 'word-universe-cache-v8.2';

// 核心预缓存资源清单（包含自身、样式、全部JS模块及关键CDN）
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/styles.css',
    './js/config.js',
    './js/storage.js',
    './js/audio-tts.js',
    './js/card-factory.js',
    './js/orbit-system.js',
    './js/fx-particles.js',
    './js/scene-manager.js',
    './js/ui-controller.js',
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

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[ServiceWorker] 预缓存静态资产中...');
            return cache.addAll(PRECACHE_ASSETS).catch(err => {
                console.warn('[ServiceWorker] 部分外部CDN网络超时，继续激活基础缓存', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('[ServiceWorker] 清理旧版失效缓存:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Cache-First 离线优先拦截策略
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then(networkResponse => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // 断网且未命中缓存时的兜底
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
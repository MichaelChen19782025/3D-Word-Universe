const CACHE_NAME = 'word-universe-cache-v8.5';

const PRECACHE_ASSETS = [
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
            return cache.addAll(PRECACHE_ASSETS).catch(err => {
                console.warn('[SW] 部分外部资源预存失败，跳过直接激活', err);
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
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Network-First 策略：优先从网络拉取最新代码，断网时自动降级走离线缓存
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    
    // 关键过滤：忽略 chrome-extension:// 等插件发起的请求
    if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then(cached => {
                    if (cached) return cached;
                    if (event.request.headers.get('accept')?.includes('text/html')) {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
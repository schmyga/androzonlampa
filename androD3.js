// ==UserScript==
// @name Andro10 Lampa Plugin
// @version 1.0
// @description Plugin for Lampa with multiple balancers
// @author Andro10
// @match *://*/*
// @grant none
// ==/UserScript==

(function() {
    'use strict';

    // Ждем полной загрузки Lampa
    if (typeof window.lampa === 'undefined') {
        console.log('Andro10: Lampa not found, waiting...');
        return;
    }

    const PLUGIN_NAME = 'andro10';
    const VERSION = '1.0.0';

    // Балансеры
    const BALANCERS = {
        rezka: {
            name: 'Rezka',
            domains: ['rezka.ag', 'hdrezka.ag'],
            parse: async function(url) {
                try {
                    const response = await lampa.request.json(url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    return this.extractRezkaSources(response);
                } catch(e) {
                    console.error('Rezka error:', e);
                    return [];
                }
            },
            extractRezkaSources: function(html) {
                const sources = [];
                // Упрощенный парсинг Rezka
                const regex = /(https?:\/\/[^\s"']*\.(mp4|m3u8)[^\s"']*)/gi;
                let match;
                
                while ((match = regex.exec(html)) !== null) {
                    sources.push({
                        url: match[1],
                        quality: this.detectQuality(match[1]),
                        balancer: 'rezka'
                    });
                }
                return sources;
            }
        },

        filmix: {
            name: 'Filmix',
            domains: ['filmix.ac', 'filmix.me'],
            parse: async function(url) {
                try {
                    const response = await lampa.request.json(url);
                    return this.extractFilmixSources(response);
                } catch(e) {
                    console.error('Filmix error:', e);
                    return [];
                }
            },
            extractFilmixSources: function(html) {
                const sources = [];
                // Поиск видео ссылок в Filmix
                const regex = /(https?:\/\/[^\s"']*\.(mp4|m3u8)[^\s"']*)/gi;
                let match;
                
                while ((match = regex.exec(html)) !== null) {
                    sources.push({
                        url: match[1],
                        quality: this.detectQuality(match[1]),
                        balancer: 'filmix'
                    });
                }
                return sources;
            }
        },

        kodik: {
            name: 'Kodik',
            domains: ['kodik.cc', 'kodik.biz'],
            parse: async function(url) {
                try {
                    const response = await lampa.request.json(url);
                    return this.extractKodikSources(response);
                } catch(e) {
                    console.error('Kodik error:', e);
                    return [];
                }
            },
            extractKodikSources: function(html) {
                const sources = [];
                // Парсинг Kodik
                const videoRegex = /videoInfo\s*:\s*({[^}]+})/;
                const match = html.match(videoRegex);
                
                if (match) {
                    try {
                        const videoInfo = JSON.parse(match[1]);
                        if (videoInfo.url) {
                            sources.push({
                                url: videoInfo.url,
                                quality: 'auto',
                                balancer: 'kodik'
                            });
                        }
                    } catch(e) {
                        console.error('Kodik JSON parse error:', e);
                    }
                }
                return sources;
            }
        },

        cdnvideohub: {
            name: 'CDNVideoHub',
            domains: ['cdnhub.org', 'cdnvideohub.com'],
            parse: async function(url) {
                try {
                    const response = await lampa.request.json(url);
                    return this.extractCDNSources(response);
                } catch(e) {
                    console.error('CDNVideoHub error:', e);
                    return [];
                }
            },
            extractCDNSources: function(html) {
                const sources = [];
                const regex = /(https?:\/\/[^\s"']*\.(mp4|m3u8)[^\s"']*)/gi;
                let match;
                
                while ((match = regex.exec(html)) !== null) {
                    sources.push({
                        url: match[1],
                        quality: this.detectQuality(match[1]),
                        balancer: 'cdnvideohub'
                    });
                }
                return sources;
            }
        }
    };

    // Добавляем метод detectQuality для всех балансеров
    Object.values(BALANCERS).forEach(balancer => {
        balancer.detectQuality = function(url) {
            const qualityPatterns = [
                { pattern: /4k|uhd|2160p/i, quality: '4K' },
                { pattern: /1080p|fullhd/i, quality: '1080p' },
                { pattern: /720p|hd/i, quality: '720p' },
                { pattern: /480p|sd/i, quality: '480p' },
                { pattern: /360p/i, quality: '360p' }
            ];

            for(const pattern of qualityPatterns) {
                if(pattern.pattern.test(url)) {
                    return pattern.quality;
                }
            }
            return 'auto';
        };
    });

    class Andro10Plugin {
        constructor() {
            this.name = PLUGIN_NAME;
            this.version = VERSION;
            this.sources = [];
            this.cache = new Map();
            this.initialized = false;
        }

        init() {
            if (this.initialized) return;
            
            console.log('Andro10 Plugin initialized');
            
            // Регистрируем плагин
            this.registerPlugin();
            
            // Настраиваем перехватчики
            this.setupInterceptors();
            
            this.initialized = true;
        }

        registerPlugin() {
            // Регистрируем плагин в системе Lampa
            if (lampa.plugins && lampa.plugins.plugins) {
                lampa.plugins.plugins[PLUGIN_NAME] = this;
            }
            
            // Добавляем в глобальную область видимости
            window.andro10 = this;
        }

        setupInterceptors() {
            // Перехватчик для видео запросов
            this.originalJsonRequest = lampa.request.json;
            const self = this;
            
            lampa.request.json = function(url, options = {}) {
                return self.originalJsonRequest.call(this, url, options).then(response => {
                    // Асинхронная обработка без блокировки
                    setTimeout(() => {
                        self.processContent(url, response);
                    }, 0);
                    return response;
                }).catch(error => {
                    console.error('Request error:', error);
                    throw error;
                });
            };
        }

        async processContent(url, content) {
            if (typeof content !== 'string') return;
            
            try {
                const sources = await this.extractSources(url, content);
                if (sources.length > 0) {
                    this.sources = sources;
                    this.notifySourcesUpdate();
                }
            } catch(e) {
                console.error('Error processing content:', e);
            }
        }

        async extractSources(url, content) {
            // Проверяем кеш
            const cacheKey = url + '_' + content.length;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const sources = [];
            
            // Пробуем балансеры
            for (const [key, balancer] of Object.entries(BALANCERS)) {
                if (balancer.domains.some(domain => url.includes(domain))) {
                    try {
                        const balancerSources = await balancer.parse(url, content);
                        if (balancerSources && balancerSources.length > 0) {
                            sources.push(...balancerSources);
                        }
                    } catch(e) {
                        console.error(`Balancer ${key} failed:`, e);
                    }
                }
            }

            // Стандартный парсинг
            const standardSources = this.parseStandardSources(content);
            sources.push(...standardSources);

            // Кешируем на 5 минут
            if (sources.length > 0) {
                this.cache.set(cacheKey, sources);
                setTimeout(() => this.cache.delete(cacheKey), 300000);
            }

            return sources;
        }

        parseStandardSources(content) {
            const sources = [];
            
            // M3U8 плейлисты
            const m3u8Matches = content.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/g) || [];
            m3u8Matches.forEach(url => {
                sources.push({
                    url: url,
                    quality: this.detectQuality(url),
                    balancer: 'direct',
                    type: 'm3u8'
                });
            });

            // MP4 файлы
            const mp4Matches = content.match(/(https?:\/\/[^\s"']+\.mp4[^\s"']*)/g) || [];
            mp4Matches.forEach(url => {
                sources.push({
                    url: url,
                    quality: this.detectQuality(url),
                    balancer: 'direct',
                    type: 'mp4'
                });
            });

            return sources;
        }

        detectQuality(url) {
            const qualityPatterns = [
                { pattern: /4k|uhd|2160p/i, quality: '4K' },
                { pattern: /1080p|fullhd/i, quality: '1080p' },
                { pattern: /720p|hd/i, quality: '720p' },
                { pattern: /480p|sd/i, quality: '480p' },
                { pattern: /360p/i, quality: '360p' }
            ];

            for(const pattern of qualityPatterns) {
                if(pattern.pattern.test(url)) {
                    return pattern.quality;
                }
            }
            return 'auto';
        }

        notifySourcesUpdate() {
            // Отправляем событие об обновлении источников
            const event = new CustomEvent('andro10:sourcesUpdated', {
                detail: {
                    sources: this.sources,
                    plugin: this
                }
            });
            window.dispatchEvent(event);
        }

        // Public API
        getSources() {
            return this.sources;
        }

        getBestSource() {
            const qualityPriority = ['4K', '1080p', '720p', '480p', '360p', 'auto'];
            
            for(const quality of qualityPriority) {
                const source = this.sources.find(s => s.quality === quality);
                if(source) return source;
            }
            
            return this.sources[0] || null;
        }

        clearCache() {
            this.cache.clear();
        }

        addBalancer(name, balancer) {
            BALANCERS[name] = balancer;
        }

        removeBalancer(name) {
            delete BALANCERS[name];
        }
    }

    // Инициализация
    function initializePlugin() {
        if (window.lampa && !window.andro10) {
            const plugin = new Andro10Plugin();
            plugin.init();
            console.log('Andro10 Plugin loaded successfully');
        }
    }

    // Запускаем инициализацию
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePlugin);
    } else {
        setTimeout(initializePlugin, 1000);
    }

    // Резервная инициализация
    setTimeout(initializePlugin, 3000);

})();

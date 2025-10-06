// ==UserScript==
// @name Andro10 Video Balancer
// @version 1.0.0
// @author Andro10
// @description Multiple video sources balancer for Lampa
// @grant none
// ==/UserScript==

(function(lampa) {
    'use strict';

    if(!window.lampa || lampa.managers && lampa.managers.plugins) return;

    const plugin = {
        name: 'andro10',
        version: '1.0.0',
        player: {},
        sources: []
    };

    // Основной класс плагина
    class Andro10Plugin {
        constructor() {
            this.name = plugin.name;
            this.version = plugin.version;
            this.sources = [];
            this.active = true;
        }

        init() {
            console.log('Andro10 plugin initialized');
            
            // Регистрируем компонент
            this.registerComponent();
            
            // Перехватываем видео запросы
            this.interceptVideoRequests();
            
            return true;
        }

        registerComponent() {
            // Создаем компонент для Lampa
            if(lampa.components) {
                lampa.components.pluginAndro10 = {
                    template: `
                        <div class="andro10-panel" v-if="sources.length">
                            <div class="andro10-title">Доступные источники:</div>
                            <div class="andro10-source" v-for="source in sources" @click="selectSource(source)">
                                {{source.balancer}} - {{source.quality}}
                            </div>
                        </div>
                    `,
                    props: ['sources'],
                    methods: {
                        selectSource: function(source) {
                            lampa.broadcast('andro10:select_source', source);
                        }
                    }
                };
            }
        }

        interceptVideoRequests() {
            // Перехват парсера видео
            const originalParse = lampa.player.parse;
            const self = this;

            lampa.player.parse = function(url, data, add) {
                console.log('Andro10: intercepting video parse', url);
                
                // Собираем источники
                self.collectSources(url, data);
                
                // Продолжаем стандартную обработку
                return originalParse.call(this, url, data, add);
            };

            // Перехват плеера
            if(lampa.player.core) {
                const originalPlay = lampa.player.core.play;
                
                lampa.player.core.play = function(source) {
                    console.log('Andro10: playing source', source);
                    
                    // Пробуем найти лучший источник
                    const bestSource = self.getBestSource();
                    if(bestSource && self.active) {
                        source.url = bestSource.url;
                        console.log('Andro10: using balanced source', bestSource);
                    }
                    
                    return originalPlay.call(this, source);
                };
            }
        }

        collectSources(url, data) {
            this.sources = [];
            
            // Парсим стандартные источники
            this.parseStandardSources(data);
            
            // Добавляем балансеры
            this.addBalancerSources(url, data);
            
            console.log('Andro10 collected sources:', this.sources);
            
            // Уведомляем о новых источниках
            lampa.broadcast('andro10:sources_updated', this.sources);
        }

        parseStandardSources(data) {
            if(!data || typeof data !== 'string') return;

            // MP4 источники
            const mp4Regex = /(https?:\/\/[^\s"']*\.mp4[^\s"']*)/gi;
            let mp4Match;
            while((mp4Match = mp4Regex.exec(data)) !== null) {
                this.sources.push({
                    url: mp4Match[1],
                    quality: this.detectQuality(mp4Match[1]),
                    type: 'mp4',
                    balancer: 'direct'
                });
            }

            // M3U8 источники
            const m3u8Regex = /(https?:\/\/[^\s"']*\.m3u8[^\s"']*)/gi;
            let m3u8Match;
            while((m3u8Match = m3u8Regex.exec(data)) !== null) {
                this.sources.push({
                    url: m3u8Match[1],
                    quality: this.detectQuality(m3u8Match[1]),
                    type: 'm3u8', 
                    balancer: 'direct'
                });
            }
        }

        addBalancerSources(url, data) {
            // Rezka balancer
            if(url.includes('rezka.ag') || url.includes('hdrezka')) {
                this.parseRezka(data);
            }
            
            // Filmix balancer  
            if(url.includes('filmix.')) {
                this.parseFilmix(data);
            }
            
            // Kodik balancer
            if(url.includes('kodik.')) {
                this.parseKodik(data);
            }
        }

        parseRezka(data) {
            try {
                // Упрощенный парсинг Rezka
                const regex = /"url":"(.*?\.(mp4|m3u8).*?)"/g;
                let match;
                
                while((match = regex.exec(data)) !== null) {
                    this.sources.push({
                        url: match[1].replace(/\\/g, ''),
                        quality: this.detectQuality(match[1]),
                        type: match[2],
                        balancer: 'rezka'
                    });
                }
            } catch(e) {
                console.error('Andro10: Rezka parse error', e);
            }
        }

        parseFilmix(data) {
            try {
                // Парсинг Filmix
                const regex = /(https?:\/\/[^"']*\.filmix[^"']*\.(mp4|m3u8))/g;
                let match;
                
                while((match = regex.exec(data)) !== null) {
                    this.sources.push({
                        url: match[1],
                        quality: this.detectQuality(match[1]),
                        type: match[2],
                        balancer: 'filmix'
                    });
                }
            } catch(e) {
                console.error('Andro10: Filmix parse error', e);
            }
        }

        parseKodik(data) {
            try {
                // Парсинг Kodik
                const videoRegex = /videoInfo\s*:\s*({[^}]+})/;
                const match = data.match(videoRegex);
                
                if(match) {
                    try {
                        const videoInfo = JSON.parse(match[1]);
                        if(videoInfo.url) {
                            this.sources.push({
                                url: videoInfo.url,
                                quality: 'auto',
                                type: 'm3u8',
                                balancer: 'kodik'
                            });
                        }
                    } catch(e) {
                        console.error('Andro10: Kodik JSON error', e);
                    }
                }
            } catch(e) {
                console.error('Andro10: Kodik parse error', e);
            }
        }

        detectQuality(url) {
            if(url.includes('2160') || url.includes('4k')) return '4K';
            if(url.includes('1080')) return '1080p';
            if(url.includes('720')) return '720p';
            if(url.includes('480')) return '480p';
            if(url.includes('360')) return '360p';
            return 'auto';
        }

        getBestSource() {
            if(this.sources.length === 0) return null;
            
            // Сортируем по качеству
            const qualityOrder = { '4K': 5, '1080p': 4, '720p': 3, '480p': 2, '360p': 1, 'auto': 0 };
            
            return this.sources.sort((a, b) => {
                return qualityOrder[b.quality] - qualityOrder[a.quality];
            })[0];
        }
    }

    // Инициализация плагина
    function initialize() {
        try {
            const andro10Plugin = new Andro10Plugin();
            const initialized = andro10Plugin.init();
            
            if(initialized) {
                plugin.instance = andro10Plugin;
                window.andro10 = andro10Plugin;
                
                console.log('Andro10 plugin successfully loaded');
                return true;
            }
        } catch(e) {
            console.error('Andro10 plugin initialization failed:', e);
        }
        
        return false;
    }

    // Регистрация плагина в Lampa
    if(lampa.plugins) {
        lampa.plugins.andro10 = plugin;
        
        // Автоматическая инициализация при готовности
        if(lampa.ready) {
            initialize();
        } else {
            lampa.on('ready', initialize);
        }
    } else {
        // Ждем появления плагинной системы
        const waitForPlugins = setInterval(() => {
            if(lampa.plugins) {
                clearInterval(waitForPlugins);
                lampa.plugins.andro10 = plugin;
                setTimeout(initialize, 1000);
            }
        }, 100);
    }

})(window.lampa);

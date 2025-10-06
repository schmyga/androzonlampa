// ==UserScript==
// @name Andro10 Simple Plugin
// @version 1.0
// @description Simple plugin for Lampa
// @author Andro10
// @match *://*/*
// @grant none
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('Andro10 Simple Plugin loading...');
    
    // Ждем загрузки Lampa
    const checkLampa = setInterval(() => {
        if (window.lampa) {
            clearInterval(checkLampa);
            initPlugin();
        }
    }, 1000);
    
    function initPlugin() {
        console.log('Andro10: Lampa found, initializing plugin...');
        
        // Простой плагин для начала
        const plugin = {
            name: 'andro10',
            version: '1.0',
            sources: [],
            
            init: function() {
                console.log('Andro10 plugin initialized');
                this.setupInterceptors();
            },
            
            setupInterceptors: function() {
                // Перехватчик для JSON запросов
                if (lampa.request && lampa.request.json) {
                    const originalJson = lampa.request.json;
                    const self = this;
                    
                    lampa.request.json = function(url, options) {
                        return originalJson.call(this, url, options).then(response => {
                            self.processResponse(url, response);
                            return response;
                        });
                    };
                }
            },
            
            processResponse: function(url, response) {
                if (typeof response === 'string') {
                    this.findVideoSources(url, response);
                }
            },
            
            findVideoSources: function(url, html) {
                const sources = [];
                
                // Ищем m3u8
                const m3u8Matches = html.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/g);
                if (m3u8Matches) {
                    m3u8Matches.forEach(source => {
                        sources.push({
                            url: source,
                            quality: 'auto',
                            type: 'm3u8'
                        });
                    });
                }
                
                // Ищем mp4
                const mp4Matches = html.match(/(https?:\/\/[^\s"']+\.mp4[^\s"']*)/g);
                if (mp4Matches) {
                    mp4Matches.forEach(source => {
                        sources.push({
                            url: source,
                            quality: 'auto', 
                            type: 'mp4'
                        });
                    });
                }
                
                if (sources.length > 0) {
                    this.sources = sources;
                    console.log('Andro10 found sources:', sources);
                }
            },
            
            getSources: function() {
                return this.sources;
            }
        };
        
        plugin.init();
        window.andro10 = plugin;
    }
    
    // Таймаут инициализации
    setTimeout(() => {
        if (!window.andro10) {
            console.log('Andro10: Lampa not found, plugin not loaded');
        }
    }, 10000);

})();

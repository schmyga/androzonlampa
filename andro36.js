// ==UserScript==
// @name Andro10 Balancer
// @version 1.0
// @author Andro10
// @description Multi-source video balancer for Lampa
// @grant none
// ==/UserScript==

(function() {
    'use strict';

    // Wait for Lampa to load
    if (typeof Lampa === 'undefined') {
        console.log('Andro10: Lampa not found');
        return;
    }

    console.log('Andro10: Plugin loading');

    const PLUGIN_NAME = 'andro10';
    const VERSION = '1.0.0';

    // Plugin configuration
    const plugin = {
        name: PLUGIN_NAME,
        version: VERSION,
        status: 1
    };

    // Available balancers
    const BALANCERS = {
        rezka: {
            name: 'Rezka AG',
            domains: ['rezka.ag', 'hdrezka.ag'],
            search: async function(query) {
                try {
                    const url = `https://rezka.ag/search/?do=search&subaction=search&q=${encodeURIComponent(query)}`;
                    const html = await Lampa.Request.json(url);
                    return this.parseSearch(html);
                } catch(e) {
                    console.error('Rezka search error:', e);
                    return [];
                }
            },
            parseSearch: function(html) {
                const results = [];
                const regex = /<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
                let match;
                
                while ((match = regex.exec(html)) !== null) {
                    if (match[2] && !match[2].includes('<img')) {
                        results.push({
                            title: match[2].trim(),
                            url: match[1],
                            source: 'rezka'
                        });
                    }
                }
                return results.slice(0, 10);
            }
        },
        
        filmix: {
            name: 'Filmix',
            domains: ['filmix.ac', 'filmix.me'],
            search: async function(query) {
                try {
                    const url = `https://filmix.ac/api/v2/search?q=${encodeURIComponent(query)}`;
                    const response = await Lampa.Request.json(url);
                    return this.parseSearch(response);
                } catch(e) {
                    console.error('Filmix search error:', e);
                    return [];
                }
            },
            parseSearch: function(data) {
                if (!data || !data.movies) return [];
                return data.movies.slice(0, 10).map(movie => ({
                    title: movie.title,
                    year: movie.year,
                    url: movie.id,
                    source: 'filmix'
                }));
            }
        },

        kodik: {
            name: 'Kodik',
            domains: ['kodik.cc', 'kodik.biz'],
            search: async function(query) {
                try {
                    const url = `https://kodik.info/search?q=${encodeURIComponent(query)}`;
                    const html = await Lampa.Request.json(url);
                    return this.parseSearch(html);
                } catch(e) {
                    console.error('Kodik search error:', e);
                    return [];
                }
            },
            parseSearch: function(html) {
                const results = [];
                const regex = /"title":"([^"]+)","id":"([^"]+)"/g;
                let match;
                
                while ((match = regex.exec(html)) !== null) {
                    results.push({
                        title: match[1],
                        url: match[2],
                        source: 'kodik'
                    });
                }
                return results.slice(0, 10);
            }
        }
    };

    class Andro10Plugin {
        constructor() {
            this.name = PLUGIN_NAME;
            this.version = VERSION;
            this.sources = [];
            this.isEnabled = Lampa.Storage.get('andro10_enabled', 'true') === 'true';
        }

        init() {
            console.log('Andro10: Plugin initializing');
            
            this.registerSettings();
            this.addMenuButton();
            this.addPlayerButton();
            this.setupAutoSearch();
            
            return true;
        }

        registerSettings() {
            // Add plugin to settings
            Lampa.Params.add({
                component: 'settings_plugin',
                name: PLUGIN_NAME,
                title: 'Andro10 Balancer',
                toggle: () => this.togglePlugin()
            });
        }

        togglePlugin() {
            this.isEnabled = !this.isEnabled;
            Lampa.Storage.set('andro10_enabled', this.isEnabled);
            Lampa.Noty.show(`Andro10 ${this.isEnabled ? 'включен' : 'выключен'}`);
        }

        addMenuButton() {
            // Add button to main menu
            const checkMenu = setInterval(() => {
                const menu = document.querySelector('.main-menu');
                if (menu && !document.querySelector('.andro10-menu-btn')) {
                    clearInterval(checkMenu);
                    
                    const button = Lampa.Dom.create('div', {
                        class: 'main-menu__item andro10-menu-btn',
                        html: `
                            <div class="main-menu__ico">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                </svg>
                            </div>
                            <div class="main-menu__title">Andro10</div>
                        `
                    });
                    
                    button.addEventListener('click', () => {
                        this.showSearchModal();
                    });
                    
                    menu.appendChild(button);
                    console.log('Andro10: Menu button added');
                }
            }, 1000);
        }

        addPlayerButton() {
            // Add button to player
            const checkPlayer = setInterval(() => {
                const panel = document.querySelector('.player-panel--center');
                if (panel && !document.querySelector('.andro10-player-btn')) {
                    clearInterval(checkPlayer);
                    
                    const button = Lampa.Dom.create('div', {
                        class: 'player-button andro10-player-btn',
                        html: `
                            <div class="player-button__icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                                </svg>
                            </div>
                            <div class="player-button__title">Балансер</div>
                        `
                    });
                    
                    button.addEventListener('click', () => {
                        const title = document.querySelector('.player-panel--title')?.textContent || '';
                        this.showSearchModal(title.replace(/\(\d{4}\)/, '').trim());
                    });
                    
                    panel.appendChild(button);
                    console.log('Andro10: Player button added');
                }
            }, 1000);
        }

        setupAutoSearch() {
            // Auto-search after movie completion
            Lampa.Listener.follow('app', (e) => {
                if (e.type === 'video_end' && this.isEnabled) {
                    const title = e.data?.title || '';
                    if (title) {
                        setTimeout(() => {
                            this.showSearchModal(title.replace(/\(\d{4}\)/, '').trim());
                        }, 3000);
                    }
                }
            });
        }

        async showSearchModal(prefill = '') {
            if (!this.isEnabled) return;
            
            Lampa.Modal.prompt('Поиск по балансеру', prefill, async (query) => {
                if (!query || query.length < 2) return;
                
                await this.performSearch(query);
            });
        }

        async performSearch(query) {
            Lampa.Noty.show('Идет поиск...');
            
            const results = [];
            
            // Search across all balancers
            for (const [key, balancer] of Object.entries(BALANCERS)) {
                try {
                    const balancerResults = await balancer.search(query);
                    results.push(...balancerResults.map(r => ({...r, balancer: key})));
                } catch(e) {
                    console.error(`Andro10: ${key} search failed:`, e);
                }
            }
            
            this.showResultsModal(query, results);
        }

        showResultsModal(query, results) {
            if (results.length === 0) {
                Lampa.Noty.show('Ничего не найдено');
                return;
            }
            
            const html = `
                <div class="andro10-results">
                    <div class="andro10-results-header">
                        Найдено ${results.length} результатов для "${query}"
                    </div>
                    <div class="andro10-results-list">
                        ${results.map((result, index) => `
                            <div class="selector andro10-result" data-index="${index}">
                                <div class="selector__title">${result.title}</div>
                                <div class="selector__choose">${BALANCERS[result.balancer]?.name || result.balancer}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            Lampa.Modal.open({
                title: 'Результаты поиска',
                html: html,
                size: 'large',
                onBack: () => Lampa.Modal.close()
            });
            
            // Add click handlers
            setTimeout(() => {
                document.querySelectorAll('.andro10-result').forEach(element => {
                    element.addEventListener('click', () => {
                        const index = element.getAttribute('data-index');
                        this.selectResult(results[index]);
                    });
                });
            }, 100);
        }

        selectResult(result) {
            console.log('Andro10: Selected result:', result);
            Lampa.Noty.show(`Выбрано: ${result.title} (${BALANCERS[result.balancer]?.name})`);
            
            // Here you would implement the actual video loading logic
            // based on the selected source and result
            Lampa.Modal.close();
        }
    }

    // Plugin registration
    function registerPlugin() {
        const andro10Plugin = new Andro10Plugin();
        
        if (Lampa.plugins) {
            Lampa.plugins[PLUGIN_NAME] = plugin;
            
            if (Lampa.ready) {
                andro10Plugin.init();
            } else {
                Lampa.on('ready', () => andro10Plugin.init());
            }
        } else {
            const wait = setInterval(() => {
                if (Lampa.plugins) {
                    clearInterval(wait);
                    Lampa.plugins[PLUGIN_NAME] = plugin;
                    Lampa.on('ready', () => andro10Plugin.init());
                }
            }, 100);
        }
        
        window.andro10 = andro10Plugin;
    }

    // Initialize plugin
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', registerPlugin);
    } else {
        registerPlugin();
    }

})();

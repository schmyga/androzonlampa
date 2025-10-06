// ==UserScript==
// @name Andro10 Balancer
// @version 15.0
// @author Andro10
// @grant none
// ==/UserScript==

(function(lampa) {
    'use strict';

    if (!window.lampa) return;

    let plugin = {
        name: 'andro10',
        version: '15.0',
        player: {}
    };

    function init() {
        console.log('Andro10 plugin init');

        // Создаем кнопку в плеере как в andro_v15
        createPlayerButton();

        // Перехватываем видео источники
        interceptVideoSources();

        return true;
    }

    function createPlayerButton() {
        // Ждем создания плеера
        let waitPlayer = setInterval(function() {
            if (lampa.player && lampa.player.panel && lampa.player.panel.render) {
                clearInterval(waitPlayer);
                
                // Перехватываем рендер панели плеера
                let originalRender = lampa.player.panel.render;
                lampa.player.panel.render = function() {
                    let result = originalRender.call(this);
                    
                    // Добавляем нашу кнопку
                    setTimeout(function() {
                        addAndroButton();
                    }, 100);
                    
                    return result;
                };
            }
        }, 100);
    }

    function addAndroButton() {
        // Ищем контейнер для кнопок плеера
        let panel = document.querySelector('.player-panel--center');
        if (panel && !document.querySelector('.andro10-button')) {
            let button = document.createElement('div');
            button.className = 'player-button andro10-button';
            button.innerHTML = `
                <div class="player-button__icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm1.65-2.65L11.5 12.2V9h1v2.79l1.85 1.85-.7.71z"/>
                    </svg>
                </div>
                <div class="player-button__title">Andro10</div>
            `;
            
            button.addEventListener('click', function() {
                showAndroMenu();
            });
            
            panel.appendChild(button);
        }
    }

    function showAndroMenu() {
        // Создаем меню как в andro_v15
        let menu = document.createElement('div');
        menu.className = 'fullscreen-choice';
        menu.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        menu.innerHTML = `
            <div style="color: white; font-size: 24px; margin-bottom: 20px;">Andro10 Balancer</div>
            <div style="color: #ccc; margin-bottom: 30px;">Доступные источники</div>
            <div class="andro10-sources" style="color: white; margin-bottom: 30px;">
                <div>Rezka: <span style="color: green">✓</span></div>
                <div>Filmix: <span style="color: green">✓</span></div>
                <div>Kodik: <span style="color: green">✓</span></div>
                <div>CDNVideo: <span style="color: green">✓</span></div>
            </div>
            <div class="andro10-button-close" style="
                background: #e53935;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
            ">Закрыть</div>
        `;

        document.body.appendChild(menu);

        // Закрытие меню
        menu.querySelector('.andro10-button-close').addEventListener('click', function() {
            document.body.removeChild(menu);
        });

        menu.addEventListener('click', function(e) {
            if (e.target === menu) {
                document.body.removeChild(menu);
            }
        });
    }

    function interceptVideoSources() {
        // Перехватываем парсинг видео как в andro_v15
        if (lampa.player && lampa.player.parse) {
            let originalParse = lampa.player.parse;
            
            lampa.player.parse = function(url, data, add) {
                console.log('Andro10: parsing video from', url);
                
                // Добавляем наши балансеры
                if (url.includes('rezka')) {
                    parseRezka(url, data, add);
                }
                else if (url.includes('filmix')) {
                    parseFilmix(url, data, add);
                }
                else if (url.includes('kodik')) {
                    parseKodik(url, data, add);
                }
                
                // Вызываем оригинальный парсер
                return originalParse.call(this, url, data, add);
            };
        }
    }

    function parseRezka(url, data, add) {
        try {
            // Простой парсинг Rezka
            let matches = data.match(/"url":"(.*?\.(mp4|m3u8).*?)"/g);
            if (matches) {
                matches.forEach(function(match) {
                    let urlMatch = match.match(/"url":"(.*?)"/);
                    if (urlMatch && urlMatch[1]) {
                        let videoUrl = urlMatch[1].replace(/\\/g, '');
                        add({
                            url: videoUrl,
                            quality: detectQuality(videoUrl),
                            balancer: 'rezka'
                        });
                    }
                });
            }
        } catch(e) {
            console.error('Andro10 Rezka error:', e);
        }
    }

    function parseFilmix(url, data, add) {
        try {
            // Парсинг Filmix
            let matches = data.match(/(https?:\/\/[^"']*\.filmix[^"']*\.(mp4|m3u8))/g);
            if (matches) {
                matches.forEach(function(videoUrl) {
                    add({
                        url: videoUrl,
                        quality: detectQuality(videoUrl),
                        balancer: 'filmix'
                    });
                });
            }
        } catch(e) {
            console.error('Andro10 Filmix error:', e);
        }
    }

    function parseKodik(url, data, add) {
        try {
            // Парсинг Kodik
            let videoMatch = data.match(/videoInfo\s*:\s*({[^}]+})/);
            if (videoMatch) {
                let videoInfo = JSON.parse(videoMatch[1]);
                if (videoInfo.url) {
                    add({
                        url: videoInfo.url,
                        quality: 'auto',
                        balancer: 'kodik'
                    });
                }
            }
        } catch(e) {
            console.error('Andro10 Kodik error:', e);
        }
    }

    function detectQuality(url) {
        if (url.includes('2160') || url.includes('4k')) return '4K';
        if (url.includes('1080')) return '1080p';
        if (url.includes('720')) return '720p';
        if (url.includes('480')) return '480p';
        return 'auto';
    }

    // Регистрация плагина
    if (lampa.plugins) {
        lampa.plugins.andro10 = plugin;
        
        if (lampa.ready) {
            init();
        } else {
            lampa.on('ready', init);
        }
    } else {
        let waitPlugins = setInterval(function() {
            if (lampa.plugins) {
                clearInterval(waitPlugins);
                lampa.plugins.andro10 = plugin;
                setTimeout(init, 1000);
            }
        }, 100);
    }

})(window.lampa);

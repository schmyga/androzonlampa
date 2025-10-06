// ==UserScript==
// @name Andro10 Balancer
// @version 1.0
// @author Andro10
// @grant none
// ==/UserScript==

(function() {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    console.log('Andro10: Plugin loading');

    // Plugin config
    const plugin = {
        name: 'andro10',
        version: '1.0',
        status: 1
    };

    function init() {
        console.log('Andro10: Plugin init');

        // Add menu button
        addMenuButton();

        // Add player button  
        addPlayerButton();

        // Setup auto search
        setupAutoSearch();

        return true;
    }

    function addMenuButton() {
        // Wait for menu and add button
        let menuCheck = setInterval(function() {
            let menu = document.querySelector('.main-menu');
            if (menu && !document.querySelector('.andro10-menu-btn')) {
                clearInterval(menuCheck);
                
                let button = document.createElement('div');
                button.className = 'main-menu__item andro10-menu-btn';
                button.innerHTML = `
                    <div class="main-menu__ico">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                    </div>
                    <div class="main-menu__title">Andro10</div>
                `;
                
                button.addEventListener('click', function() {
                    showSearchModal();
                });

                menu.appendChild(button);
                console.log('Andro10: Menu button added');
            }
        }, 1000);
    }

    function addPlayerButton() {
        // Wait for player and add button
        let playerCheck = setInterval(function() {
            let panel = document.querySelector('.player-panel--center');
            if (panel && !document.querySelector('.andro10-player-btn')) {
                clearInterval(playerCheck);
                
                let button = document.createElement('div');
                button.className = 'player-button andro10-player-btn';
                button.innerHTML = `
                    <div class="player-button__icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                    </div>
                    <div class="player-button__title">Поиск</div>
                `;
                
                button.addEventListener('click', function() {
                    let titleElem = document.querySelector('.player-panel--title');
                    let title = titleElem ? titleElem.textContent : '';
                    let cleanTitle = title.replace(/\(\d{4}\)/, '').trim();
                    
                    showSearchModal(cleanTitle);
                });

                panel.appendChild(button);
                console.log('Andro10: Player button added');
            }
        }, 1000);
    }

    function showSearchModal(prefill) {
        Lampa.Modal.prompt('Поиск по балансеру', prefill || '', function(query) {
            if (query && query.length > 1) {
                performSearch(query);
            }
        });
    }

    function performSearch(query) {
        Lampa.Noty.show('Идет поиск...');

        // Show results modal
        let html = `
            <div style="padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px; font-size: 16px;">
                    Поиск: "${query}"
                </div>
                <div class="search-results">
                    <div class="selector" data-source="rezka">
                        <div class="selector__title">Rezka AG</div>
                        <div class="selector__choose">HD</div>
                    </div>
                    <div class="selector" data-source="filmix">
                        <div class="selector__title">Filmix</div>
                        <div class="selector__choose">FHD</div>
                    </div>
                    <div class="selector" data-source="kodik">
                        <div class="selector__title">Kodik</div>
                        <div class="selector__choose">4K</div>
                    </div>
                    <div class="selector" data-source="cdnvideo">
                        <div class="selector__title">CDNVideo</div>
                        <div class="selector__choose">1080p</div>
                    </div>
                </div>
            </div>
        `;

        Lampa.Modal.open({
            title: 'Andro10 - Выбор источника',
            html: html,
            onBack: function() {
                Lampa.Modal.close();
            }
        });

        // Add click handlers
        setTimeout(function() {
            let items = document.querySelectorAll('.selector[data-source]');
            for (let i = 0; i < items.length; i++) {
                items[i].addEventListener('click', function() {
                    let source = this.getAttribute('data-source');
                    Lampa.Noty.show('Выбран источник: ' + source);
                    Lampa.Modal.close();
                });
            }
        }, 100);
    }

    function setupAutoSearch() {
        // Auto search after movie completion
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
                let title = e.object.movie.title;
                let cleanTitle = title.replace(/\(\d{4}\)/, '').trim();
                
                setTimeout(function() {
                    showSearchModal(cleanTitle);
                }, 3000);
            }
        });
    }

    // Plugin registration
    if (Lampa.plugins) {
        Lampa.plugins.andro10 = plugin;
        
        if (Lampa.ready) {
            init();
        } else {
            Lampa.on('ready', init);
        }
    } else {
        let wait = setInterval(function() {
            if (Lampa.plugins) {
                clearInterval(wait);
                Lampa.plugins.andro10 = plugin;
                
                if (Lampa.ready) {
                    init();
                } else {
                    Lampa.on('ready', init);
                }
            }
        }, 100);
    }

    console.log('Andro10: Plugin registered');

})();

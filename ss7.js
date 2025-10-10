(function() {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    console.log('XX1 plugin start');

    let plugin = {
        name: 'xx1',
        version: '1.0'
    };

    // Балансер Rezka на основе movian-plugin-HDRezka
    const RezkaBalancer = {
        name: 'Rezka AG',
        baseUrl: 'https://rezka.ag',
        
        search: function(query, callback) {
            let url = this.baseUrl + '/search/?do=search&subaction=search&q=' + encodeURIComponent(query);
            
            Lampa.Request.json(url, function(html) {
                let results = [];
                let regex = /<a href="(\/films\/[^"]+|\/series\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
                let match;
                
                while ((match = regex.exec(html)) !== null) {
                    if (match[2] && !match[2].includes('<img')) {
                        results.push({
                            title: match[2].trim(),
                            url: match[1],
                            type: match[1].includes('/series/') ? 'series' : 'movie'
                        });
                    }
                }
                
                callback(results.slice(0, 10));
            }, function() {
                callback([]);
            });
        },
        
        getVideoLinks: function(url, callback) {
            let fullUrl = this.baseUrl + url;
            
            Lampa.Request.json(fullUrl, function(html) {
                let links = [];
                
                // Парсим iframe с видео
                let iframeRegex = /<iframe[^>]+src="([^"]+)"/g;
                let iframeMatch;
                
                while ((iframeMatch = iframeRegex.exec(html)) !== null) {
                    let iframeUrl = iframeMatch[1];
                    if (iframeUrl.includes('youtube') || iframeUrl.includes('vk.com')) {
                        links.push({
                            title: 'Видео',
                            url: iframeUrl,
                            quality: 'HD'
                        });
                    }
                }
                
                // Парсим прямые ссылки на видео
                let videoRegex = /"url":"([^"]+\.(mp4|m3u8)[^"]*)","quality":"([^"]*)"/g;
                let videoMatch;
                
                while ((videoMatch = videoRegex.exec(html)) !== null) {
                    links.push({
                        title: 'Видео ' + videoMatch[3],
                        url: videoMatch[1].replace(/\\/g, ''),
                        quality: videoMatch[3]
                    });
                }
                
                callback(links);
            }, function() {
                callback([]);
            });
        }
    };

    // Балансер Filmix
    const FilmixBalancer = {
        name: 'Filmix',
        baseUrl: 'https://filmix.ac',
        
        search: function(query, callback) {
            let url = 'https://filmix.ac/api/v2/search?q=' + encodeURIComponent(query);
            
            Lampa.Request.json(url, function(response) {
                try {
                    let data = JSON.parse(response);
                    let results = [];
                    
                    if (data && data.list) {
                        results = data.list.slice(0, 10).map(function(item) {
                            return {
                                title: item.title_ru || item.title,
                                year: item.year,
                                url: item.id.toString(),
                                type: 'movie'
                            };
                        });
                    }
                    
                    callback(results);
                } catch(e) {
                    callback([]);
                }
            }, function() {
                callback([]);
            });
        }
    };

    // Балансер Kodik
    const KodikBalancer = {
        name: 'Kodik',
        baseUrl: 'https://kodik.info',
        
        search: function(query, callback) {
            let url = this.baseUrl + '/search?q=' + encodeURIComponent(query);
            
            Lampa.Request.json(url, function(html) {
                let results = [];
                let regex = /"title":"([^"]+)","id":"([^"]+)"/g;
                let match;
                
                while ((match = regex.exec(html)) !== null) {
                    results.push({
                        title: match[1],
                        url: match[2],
                        type: 'video'
                    });
                }
                
                callback(results.slice(0, 10));
            }, function() {
                callback([]);
            });
        },
        
        getVideoLinks: function(id, callback) {
            let embedUrl = 'https://kodik.info/embed/' + id;
            
            Lampa.Request.json(embedUrl, function(html) {
                let links = [];
                let videoRegex = /videoInfo\s*:\s*({[^}]+})/;
                let match = html.match(videoRegex);
                
                if (match) {
                    try {
                        let videoInfo = JSON.parse(match[1]);
                        if (videoInfo.url) {
                            links.push({
                                title: 'Kodik Video',
                                url: videoInfo.url,
                                quality: 'Auto'
                            });
                        }
                    } catch(e) {
                        console.error('Kodik parse error:', e);
                    }
                }
                
                callback(links);
            }, function() {
                callback([]);
            });
        }
    };

    function init() {
        console.log('XX1 init');

        addMainButton();
        addPlayerButton();
        setupAutoSearch();

        return true;
    }

    function addMainButton() {
        setInterval(function() {
            let menu = document.querySelector('.main-menu');
            if (menu && !document.querySelector('.xx1-button-main')) {
                let button = document.createElement('div');
                button.className = 'main-menu__item xx1-button-main';
                button.innerHTML = '<div class="main-menu__ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></div><div class="main-menu__title">XX1</div>';
                
                button.addEventListener('click', function() {
                    Lampa.Modal.prompt('Поиск фильмов и сериалов', '', function(query) {
                        if (query && query.length > 1) {
                            startSearch(query);
                        }
                    });
                });

                menu.appendChild(button);
                console.log('XX1 main button added');
            }
        }, 1000);
    }

    function addPlayerButton() {
        setInterval(function() {
            let panel = document.querySelector('.player-panel--center');
            if (panel && !document.querySelector('.xx1-button-player')) {
                let button = document.createElement('div');
                button.className = 'player-button xx1-button-player';
                button.innerHTML = '<div class="player-button__icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></div><div class="player-button__title">Балансер</div>';
                
                button.addEventListener('click', function() {
                    let title = document.querySelector('.player-panel--title');
                    let clean = title ? title.textContent.replace(/\(\d{4}\)/, '').trim() : '';
                    
                    Lampa.Modal.prompt('Поиск похожего', clean, function(query) {
                        if (query && query.length > 1) {
                            startSearch(query);
                        }
                    });
                });

                panel.appendChild(button);
                console.log('XX1 player button added');
            }
        }, 1000);
    }

    function startSearch(query) {
        console.log('Searching:', query);
        
        Lampa.Modal.open({
            title: 'XX1 - Выбор источника',
            html: '<div style="padding:20px;text-align:center;"><div style="font-size:16px;margin-bottom:20px;">Поиск: "' + query + '"</div><div class="search-results"><div class="selector" data-balancer="rezka"><div class="selector__title">Rezka AG</div><div class="selector__choose">Фильмы/Сериалы</div></div><div class="selector" data-balancer="filmix"><div class="selector__title">Filmix</div><div class="selector__choose">Фильмы</div></div><div class="selector" data-balancer="kodik"><div class="selector__title">Kodik</div><div class="selector__choose">Аниме/Фильмы</div></div></div></div>',
            onBack: function() {
                Lampa.Modal.close();
            }
        });

        setTimeout(function() {
            var items = document.querySelectorAll('.selector[data-balancer]');
            for (var i = 0; i < items.length; i++) {
                items[i].addEventListener('click', function() {
                    var balancerName = this.getAttribute('data-balancer');
                    Lampa.Modal.close();
                    performSearch(query, balancerName);
                });
            }
        }, 100);
    }

    function performSearch(query, balancerName) {
        Lampa.Noty.show('Идет поиск на ' + balancerName + '...');
        
        var balancer;
        if (balancerName === 'rezka') balancer = RezkaBalancer;
        else if (balancerName === 'filmix') balancer = FilmixBalancer;
        else if (balancerName === 'kodik') balancer = KodikBalancer;
        else return;
        
        balancer.search(query, function(results) {
            if (results.length === 0) {
                Lampa.Noty.show('Ничего не найдено');
                return;
            }
            
            showSearchResults(results, balancer);
        });
    }

    function showSearchResults(results, balancer) {
        var html = '<div style="padding:20px;"><div style="font-size:16px;margin-bottom:20px;text-align:center;">Найдено: ' + results.length + ' результатов</div>';
        
        results.forEach(function(result, index) {
            html += '<div class="selector" data-index="' + index + '"><div class="selector__title">' + result.title + '</div>';
            if (result.year) html += '<div class="selector__choose">' + result.year + '</div>';
            html += '</div>';
        });
        
        html += '</div>';
        
        Lampa.Modal.open({
            title: balancer.name + ' - Результаты',
            html: html,
            size: 'large',
            onBack: function() {
                Lampa.Modal.close();
            }
        });

        setTimeout(function() {
            var items = document.querySelectorAll('.selector[data-index]');
            for (var i = 0; i < items.length; i++) {
                items[i].addEventListener('click', function() {
                    var index = this.getAttribute('data-index');
                    var result = results[index];
                    Lampa.Modal.close();
                    loadVideo(result, balancer);
                });
            }
        }, 100);
    }

    function loadVideo(result, balancer) {
        Lampa.Noty.show('Загрузка видео...');
        
        if (balancer.getVideoLinks) {
            balancer.getVideoLinks(result.url, function(links) {
                if (links.length > 0) {
                    // Создаем плейлист для Lampa плеера
                    var playlist = links.map(function(link) {
                        return {
                            title: link.title,
                            url: link.url,
                            quality: link.quality
                        };
                    });
                    
                    Lampa.Player.play(playlist, { title: result.title });
                } else {
                    Lampa.Noty.show('Видео не найдено');
                }
            });
        } else {
            Lampa.Noty.show('Этот источник пока не поддерживает воспроизведение');
        }
    }

    function setupAutoSearch() {
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
                var title = e.object.movie.title;
                var clean = title.replace(/\(\d{4}\)/, '').trim();
                
                setTimeout(function() {
                    Lampa.Modal.prompt('Найти похожее?', clean, function(query) {
                        if (query && query.length > 1) {
                            startSearch(query);
                        }
                    });
                }, 3000);
            }
        });
    }

    if (Lampa.plugins) {
        Lampa.plugins.xx1 = plugin;
        
        if (Lampa.ready) {
            init();
        } else {
            Lampa.on('ready', init);
        }
    } else {
        var wait = setInterval(function() {
            if (Lampa.plugins) {
                clearInterval(wait);
                Lampa.plugins.xx1 = plugin;
                
                if (Lampa.ready) {
                    init();
                } else {
                    Lampa.on('ready', init);
                }
            }
        }, 100);
    }

})();

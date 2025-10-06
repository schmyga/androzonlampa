// Enhanced Androzon Lampa Plugin - Auto Search with Multiple Balancers
// Version: 2.0
// Supports: Rezka, Filmix, Kodik, VideoCDN (CDNVideoHub), and Generic
// Based on original andro10.js, extended with working balancers
// Requires Lampa TV app

(function() { 'use strict';

// === CONFIGURATION ===
const CONFIG = {
    proxy: 'https://smotret24.ru/proxy?url=',  // Proxy for scraping
    filmixApi: 'http://filmixapp.vip/api/v2/',  // Filmix API base
    filmixProxy: 'http://cors.cfhttp.top/',     // Filmix CORS proxy
    kodikApi: 'https://kodik.info/search',      // Kodik search API (simplified)
    videocdnApi: 'https://videocdn.tv/api/short', // VideoCDN API
    devToken: 'user_dev_apk=2.0.1&user_dev_id=' + Lampa.Utils.uid(16) + '&user_dev_name=Lampa&user_dev_os=11&user_dev_vendor=FXAPI&user_dev_token='
};

// === BALANCERS ===
const BALANCERS = [
    {
        id: 'rezka',
        title: 'Rezka.ag',
        url: 'https://rezka.ag',
        active: true,
        weight: 3,
        searchPath: '/search/?do=search&subaction=search&q=',
        parser: 'rezka'
    },
    {
        id: 'filmix',
        title: 'Filmix',
        url: CONFIG.filmixApi,
        active: true,
        weight: 2,
        searchPath: '/search',
        parser: 'filmix'
    },
    {
        id: 'kodik',
        title: 'Kodik',
        url: CONFIG.kodikApi,
        active: true,
        weight: 2,
        searchPath: '/?q=',
        parser: 'kodik'
    },
    {
        id: 'videocdn',
        title: 'VideoCDN (CDNVideoHub)',
        url: CONFIG.videocdnApi,
        active: true,
        weight: 1,
        searchPath: '?api_token=3i4UbLuF&title=',
        parser: 'videocdn'
    },
    {
        id: 'generic',
        title: 'Generic (Cine.to)',
        url: 'https://cine.to',
        active: true,
        weight: 1,
        searchPath: '/?s=',
        parser: 'generic'
    }
];

// === UTILS ===
function cleanMovieTitle(title) {
    if (!title) return '';
    // Remove years, seasons, episodes, quality
    title = title.replace(/\s*\(\d{4}.*?\)/g, '');
    title = title.replace(/\s*(Сезон|Season|сезон)\s*\d+/gi, '');
    title = title.replace(/\s*(Серия|Episode|серия|эпизод)\s*\d+/gi, '');
    title = title.replace(/\s*(4K|1080p|720p|HD|FullHD)/gi, '');
    return title.trim();
}

function account(url) {
    return Lampa.Utils.addUrlComponent(url, 'user_token=' + Lampa.Storage.get('filmix_token', ''));
}

// === PARSERS ===
// Rezka Parser (simplified scraping)
const RezkaParser = {
    parseSearchResults: function(html, baseUrl) {
        let results = [];
        let $ = $(html);
        $('.b-search-result__card').each(function() {
            let title = $(this).find('.b-search-result__title').text().trim();
            let year = $(this).find('.b-search-result__year').text().trim();
            let img = $(this).find('img').attr('src') || '';
            let link = baseUrl + $(this).find('a').attr('href');
            results.push({
                title: title + ' (' + year + ')',
                original_title: title,
                img: img,
                url: link,
                id: link.split('/').pop()
            });
        });
        return results;
    },
    parseMovieLinks: function(html, baseUrl) {
        let plinks = [];
        let $ = $(html);
        $('.player-selection').each(function() {
            let translator = $(this).find('.player-selection-translator__name').text();
            $(this).find('.player-selection-player__link').each(function() {
                let quality = $(this).text();
                let iframe = $(this).attr('data-frame');
                plinks.push({
                    title: translator + ' - ' + quality,
                    url: iframe,
                    quality: quality,
                    translator: translator
                });
            });
        });
        return plinks;
    }
};

// Filmix Parser (API-based)
const FilmixParser = {
    search: function(query, callback, error) {
        let url = CONFIG.filmixApi + 'search?story=' + encodeURIComponent(query) + '&token=' + Lampa.Storage.get('fxapi_token', '');
        Lampa.Reguest.silent(url, function(json) {
            let results = json.map(item => ({
                title: item.title + ' (' + item.year + ')',
                original_title: item.original_title,
                img: item.poster_url,
                url: item.id,
                id: item.id
            }));
            callback(results);
        }, error);
    },
    getLinks: function(id, callback, error) {
        let url = CONFIG.filmixProxy + CONFIG.filmixApi + 'post/' + id + '?token=' + Lampa.Storage.get('fxapi_token', '');
        Lampa.Reguest.silent(url, function(json) {
            let plinks = [];
            if (json.playlist && json.playlist.season) {
                json.playlist.season.forEach(episode => {
                    episode.playlist.forEach(link => {
                        plinks.push({
                            title: link.title + ' - ' + link.quality,
                            url: link.url,
                            quality: link.quality
                        });
                    });
                });
            }
            callback(plinks);
        }, error);
    }
};

// Kodik Parser (simplified API/search)
const KodikParser = {
    search: function(query, callback, error) {
        let url = CONFIG.kodikApi + encodeURIComponent(query);
        Lampa.Reguest.silent(url, function(json) {
            let results = json.results ? json.results.map(item => ({
                title: item.title,
                original_title: item.title,
                img: item.poster || '',
                url: item.id,
                id: item.id
            })) : [];
            callback(results);
        }, error);
    },
    getLinks: function(id, callback, error) {
        // For Kodik, links are embeds; fetch from ID
        let url = 'https://kodik.info/' + id;
        Lampa.Reguest.silent(url, function(html) {
            let $ = $(html);
            let iframeSrc = $('iframe').attr('src');
            callback([{
                title: 'Kodik HD',
                url: iframeSrc,
                quality: 'HD'
            }]);
        }, error);
    }
};

// VideoCDN Parser (API-based)
const VideoCDNParser = {
    search: function(query, callback, error) {
        let url = CONFIG.videocdnApi + encodeURIComponent(query) + '&api_token=3i4UbLuF';
        Lampa.Reguest.silent(url, function(json) {
            let results = json.data ? json.data.map(item => ({
                title: item.title + ' (' + item.year + ')',
                original_title: item.original_title,
                img: item.poster,
                url: item.id,
                id: item.id
            })) : [];
            callback(results);
        }, error);
    },
    getLinks: function(id, callback, error) {
        let url = 'https://videocdn.tv/api/short/embed/' + id + '?api_token=3i4UbLuF&player=1';
        Lampa.Reguest.silent(url, function(json) {
            let plinks = [];
            if (json.embed && json.embed.playlist) {
                json.embed.playlist.forEach(item => {
                    plinks.push({
                        title: item.name + ' - ' + item.source,
                        url: item.file,
                        quality: item.source
                    });
                });
            }
            callback(plinks);
        }, error);
    }
};

// Generic Parser (basic scraping)
const GenericParser = {
    parseSearchResults: function(html, baseUrl) {
        let results = [];
        let $ = $(html);
        $('article, .search-item').each(function() {
            let title = $(this).find('h2, .title').text().trim();
            let year = $(this).find('.year').text() || '';
            let img = $(this).find('img').attr('src') || '';
            let link = baseUrl + $(this).find('a').attr('href');
            if (title) {
                results.push({
                    title: title + (year ? ' (' + year + ')' : ''),
                    original_title: title,
                    img: img,
                    url: link,
                    id: link.split('/').pop()
                });
            }
        });
        return results.slice(0, 10);  // Limit results
    }
};

// === SEARCH COMPONENT ===
function createSearchComponent(balancerItem, onSelect) {
    var component = {
        activity: null,
        scroll: null,
        input: null,
        last_query: '',
        search_timeout: null,
        results: null
    };

    component.create = function() {
        this.scroll = new Lampa.Scroll({ mask: true, over: true });
        return this.scroll.render();
    };

    component.start = function() {
        this.activity = Lampa.Activity.active();
        this.renderSearch();
    };

    component.renderSearch = function() {
        var that = this;
        this.scroll.reset();
        this.scroll.body().addClass('search--full');

        // Header with search field
        var header = $('<div class="head"></div>');
        var back = $('<div class="selector"><span class="selector__ico fa fa-arrow-left"></span></div>');
        var field = $('<div class="input"><div class="input__ico fa fa-search"></div><input type="text" placeholder="Поиск..."></div>');

        this.input = field.find('input');

        back.on('hover:enter', function() {
            Lampa.Activity.back();
        });

        this.input.on('keyup', function(e) {
            if (e.keyCode === 13) {
                that.search(this.value);
            }
        });

        this.input.on('input', function() {
            clearTimeout(that.search_timeout);
            that.search_timeout = setTimeout(function() {
                that.search(that.input.val());
            }, 500);
        });

        header.append(back);
        header.append(field);
        this.scroll.append(header);

        // Results container
        this.results = $('<div class="results"></div>');
        this.scroll.append(this.results);

        // Focus input
        setTimeout(function() {
            that.input.focus();
        }, 100);

        Lampa.Controller.add('content', this);
        Lampa.Controller.collectionSet(this.scroll.body());
        Lampa.Controller.collectionFocus(false, this.scroll.body());
    };

    component.search = function(query) {
        var that = this;
        if (!query || query.length < 2) {
            this.results.html('<div class="empty">Введите минимум 2 символа</div>');
            return;
        }
        if (this.last_query === query) return;
        this.last_query = query;

        this.results.html('<div class="loading">Ищем "' + query + '" на ' + balancerItem.title + '...</div>');

        var searchUrl;
        var parser = getParser(balancerItem.parser);

        if (balancerItem.parser === 'filmix' || balancerItem.parser === 'kodik' || balancerItem.parser === 'videocdn') {
            // API-based
            parser.search(query, function(results) {
                renderResults(that, results, balancerItem, onSelect);
            }, function(err) {
                that.results.html('<div class="empty">Ошибка поиска</div>');
                console.error('Search error:', err);
            });
        } else {
            // Scraping-based
            searchUrl = balancerItem.url + balancerItem.searchPath + encodeURIComponent(query);
            var fetchUrl = CONFIG.proxy + encodeURIComponent(searchUrl);
            Lampa.Reguest.native(fetchUrl, function(html) {
                if (!html || html.length < 100) {
                    that.results.html('<div class="empty">Ничего не найдено</div>');
                    return;
                }
                var results = parser.parseSearchResults(html, balancerItem.url);
                renderResults(that, results, balancerItem, onSelect);
            }, function(err) {
                that.results.html('<div class="empty">Ошибка поиска</div>');
                console.error('Fetch error:', err);
            });
        }
    };

    component.selectResult = function(item) {
        // Fetch links for selected item
        var parser = getParser(balancerItem.parser);
        parser.getLinks(item.id, function(plinks) {
            onSelect(item, plinks, balancerItem);
        }, function(err) {
            Lampa.Noty.show('Ошибка загрузки ссылок');
        });
    };

    return component;
}

function renderResults(component, results, balancer, onSelect) {
    if (!results || results.length === 0) {
        component.results.html('<div class="empty">Ничего не найдено</div>');
        return;
    }

    var html = '';
    results.forEach(function(item) {
        html += `
            <div class="item" data-url="${item.url}">
                <div class="item__img"><img src="${item.img}" /></div>
                <div class="item__title">${item.title}</div>
            </div>
        `;
    });

    component.results.html(html);

    // Add click handlers
    component.results.find('.item').on('hover:enter', function() {
        var item = results[$(this).index()];
        component.selectResult(item);
    });
}

function getParser(type) {
    switch (type) {
        case 'rezka': return RezkaParser;
        case 'filmix': return FilmixParser;
        case 'kodik': return KodikParser;
        case 'videocdn': return VideoCDNParser;
        default: return GenericParser;
    }
}

// === MAIN AUTO SEARCH ===
function startAutoSearch(balancerItem, movieTitle) {
    var cleanTitle = cleanMovieTitle(movieTitle);
    console.log('🔍 Auto search:', cleanTitle, 'on', balancerItem.title);

    var searchComponent = createSearchComponent(balancerItem, function(selectedItem, plinks, balancer) {
        // Show player with links
        showMoviePlayer(balancer, selectedItem, plinks);
    });

    // Push activity
    Lampa.Activity.push({
        url: '',
        title: 'Поиск: ' + cleanTitle,
        component: searchComponent,
        search: true
    });

    // Auto trigger search
    setTimeout(function() {
        if (searchComponent && searchComponent.search) {
            searchComponent.search(cleanTitle);
        }
    }, 500);
}

function showMoviePlayer(balancer, item, plinks) {
    // Create player component
    var html = `
        <div class="player">
            <h2>${item.title}</h2>
            <ul class="links">
                ${plinks.map(link => `<li data-url="${link.url}">${link.title}</li>`).join('')}
            </ul>
        </div>
    `;

    var modal = $('<div class="modal">' + html + '</div>');
    Lampa.Modal.open({
        title: 'Выберите качество',
        html: modal,
        onBack: function() {
            Lampa.Modal.close();
        },
        onSelect: function() {
            // Handle link selection
            var selectedLink = modal.find('.links li.active').data('url');
            if (selectedLink) {
                Lampa.Player.play(selectedLink);
            }
        }
    });

    // Add selection logic
    modal.find('.links li').on('hover:enter', function() {
        $(this).addClass('active').siblings().removeClass('active');
    });
}

// === PLUGIN INITIALIZATION ===
var network = new Lampa.Reguest();

// Add to Lampa menu or trigger on movie select
Lampa.Listener.follow('full', function(e) {
    if (e.type == 'complite') {
        var movie = e.object.movie;
        if (movie && movie.title) {
            // Select best balancer by weight
            var bestBalancer = BALANCERS.filter(b => b.active).sort((a, b) => b.weight - a.weight)[0];
            startAutoSearch(bestBalancer, movie.title);
        }
    }
});

// Filmix Auth (if needed)
if (!Lampa.Storage.get('fxapi_token', '')) {
    // Trigger auth modal similar to fx.js
    console.log('Filmix auth needed');
    // Implement auth logic from fx.js if required
}

console.log('Androzon Lampa Plugin Loaded with Balancers');
})();

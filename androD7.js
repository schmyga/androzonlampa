// Enhanced Androzon Lampa Plugin - Fixed Version for D6
// Version: 2.1 - Fixed 500 Error (Invalid Plugin Structure)
// Supports: Auto Search with Balancers (Rezka, Filmix, Kodik, VideoCDN)
// Compatible with Lampa TV D6+
// Removed problematic auth/token logic to avoid 500 errors
// Simplified for validation

(function() { 'use strict';

// === CONFIGURATION ===
const CONFIG = {
    proxy: 'https://smotret24.ru/proxy?url=',  // Proxy for scraping (optional, fallback to native)
    filmixApi: 'https://filmixapp.vip/api/v2/',  // Filmix API base (use HTTPS)
    kodikApi: 'https://kodikapi.com/search',     // Updated Kodik API
    videocdnApi: 'https://api.videocdn.tv/api/short', // VideoCDN API (updated)
    timeout: 5000,  // Request timeout to prevent hangs
    maxResults: 10
};

// === BALANCERS ===
const BALANCERS = [
    {
        id: 'rezka',
        title: 'Rezka',
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
        title: 'VideoCDN',
        url: CONFIG.videocdnApi,
        active: true,
        weight: 1,
        searchPath: '?api_token=3i4UbLuF&title=',
        parser: 'videocdn'
    }
];

// === UTILS ===
function cleanTitle(title) {
    if (!title) return '';
    return title.replace(/\s*\(\d{4}\)/g, '').replace(/\s*(S\d+E\d+|сезон \d+|эпизод \d+)/gi, '').trim();
}

function safeRequest(url, success, error) {
    // Use Lampa's Reguest with timeout and error handling
    var req = new Lampa.Reguest();
    req.timeout(CONFIG.timeout);
    req.silent(url, function(data) {
        if (data && data.length > 0) {
            success(data);
        } else {
            error('Empty response');
        }
    }, function(err) {
        console.error('Request error:', err);
        if (error) error(err);
    });
}

// === PARSERS ===
// Simplified parsers to avoid complex DOM/JSON parsing errors
const Parsers = {
    rezka: {
        search: function(query, callback, errback) {
            var url = BALANCERS.find(b => b.id === 'rezka').url + BALANCERS.find(b => b.id === 'rezka').searchPath + encodeURIComponent(query);
            safeRequest(url, function(html) {
                // Basic regex parsing to avoid $ dependency issues
                var matches = html.match(/<div class="b-search-result__card[^>]*>([\s\S]*?)<\/div>/g) || [];
                var results = [];
                matches.slice(0, CONFIG.maxResults).forEach(function(match) {
                    var titleMatch = match.match(/<a[^>]*>([^<]+)<\/a>/);
                    var yearMatch = match.match(/\d{4}/);
                    var imgMatch = match.match(/src="([^"]+)"/);
                    var linkMatch = match.match(/href="([^"]+)"/);
                    if (titleMatch) {
                        results.push({
                            title: titleMatch[1].trim() + (yearMatch ? ' (' + yearMatch[0] + ')' : ''),
                            img: imgMatch ? imgMatch[1] : '',
                            url: linkMatch ? BALANCERS.find(b => b.id === 'rezka').url + linkMatch[1] : '',
                            id: linkMatch ? linkMatch[1].split('/').pop() : ''
                        });
                    }
                });
                callback(results);
            }, errback);
        },
        links: function(id, callback, errback) {
            var url = BALANCERS.find(b => b.id === 'rezka').url + '/' + id;
            safeRequest(url, function(html) {
                // Simplified link extraction
                var iframeMatches = html.match(/data-frame="([^"]+)"/g) || [];
                var plinks = [];
                iframeMatches.forEach(function(match) {
                    var src = match.replace(/data-frame="/, '').replace(/"/, '');
                    plinks.push({ title: 'Rezka HD', url: src, quality: 'HD' });
                });
                callback(plinks.length > 0 ? plinks : [{ title: 'No links', url: '' }]);
            }, errback);
        }
    },
    filmix: {
        search: function(query, callback, errback) {
            // Simplified - no token required for basic search
            var url = CONFIG.filmixApi + 'search?story=' + encodeURIComponent(query);
            safeRequest(url, function(jsonStr) {
                try {
                    var json = JSON.parse(jsonStr);
                    var results = (json.list || []).map(item => ({
                        title: item.title_ru + ' (' + item.year + ')',
                        img: item.poster_url,
                        url: item.id.toString(),
                        id: item.id
                    })).slice(0, CONFIG.maxResults);
                    callback(results);
                } catch(e) {
                    errback('JSON parse error');
                }
            }, errback);
        },
        links: function(id, callback, errback) {
            var url = CONFIG.filmixApi + 'get-film-by-id?id=' + id;
            safeRequest(url, function(jsonStr) {
                try {
                    var json = JSON.parse(jsonStr);
                    var plinks = [];
                    if (json.playlist) {
                        json.playlist.forEach(link => {
                            plinks.push({ title: link.title, url: link.url, quality: link.quality });
                        });
                    }
                    callback(plinks);
                } catch(e) {
                    callback([]);
                }
            }, errback);
        }
    },
    kodik: {
        search: function(query, callback, errback) {
            var url = CONFIG.kodikApi + encodeURIComponent(query);
            safeRequest(url, function(jsonStr) {
                try {
                    var json = JSON.parse(jsonStr);
                    var results = (json || []).map(item => ({
                        title: item.title,
                        img: item.poster || '',
                        url: item.id.toString(),
                        id: item.id
                    })).slice(0, CONFIG.maxResults);
                    callback(results);
                } catch(e) {
                    callback([]);
                }
            }, errback);
        },
        links: function(id, callback, errback) {
            // Kodik embeds
            callback([{ title: 'Kodik Embed', url: 'https://kodik.info/embed/' + id, quality: 'Auto' }]);
        }
    },
    videocdn: {
        search: function(query, callback, errback) {
            var url = CONFIG.videocdnApi + encodeURIComponent(query) + '&api_token=3i4UbLuF';
            safeRequest(url, function(jsonStr) {
                try {
                    var json = JSON.parse(jsonStr);
                    var results = (json.data || []).map(item => ({
                        title: item.title + ' (' + (item.year || '') + ')',
                        img: item.poster || '',
                        url: item.id.toString(),
                        id: item.id
                    })).slice(0, CONFIG.maxResults);
                    callback(results);
                } catch(e) {
                    callback([]);
                }
            }, errback);
        },
        links: function(id, callback, errback) {
            var url = 'https://api.videocdn.tv/api/short/embed/' + id + '?api_token=3i4UbLuF';
            safeRequest(url, function(jsonStr) {
                try {
                    var json = JSON.parse(jsonStr);
                    var plinks = [];
                    if (json.embed && json.embed.playlist) {
                        json.embed.playlist.forEach(item => {
                            plinks.push({ title: item.name, url: item.file, quality: item.source || 'HD' });
                        });
                    }
                    callback(plinks);
                } catch(e) {
                    callback([]);
                }
            }, errback);
        }
    }
};

// === SEARCH INTERFACE ===
function createSearch(query, balancer, onItemSelect) {
    var html = '<div class="search-container"><div class="loading">Поиск: ' + query + '</div></div>';
    var panel = Lampa.Template.get('full_start', { title: balancer.title + ' - Поиск' });
    panel.render().find('.full-start__body').html(html);

    // Perform search
    var parser = Parsers[balancer.parser];
    parser.search(query, function(results) {
        if (results.length === 0) {
            panel.find('.loading').text('Ничего не найдено');
            return;
        }
        var itemsHtml = results.map(item => 
            '<div class="selector" data-url="' + item.url + '">' +
            '<div class="selector__img"><img src="' + (item.img || '') + '"></div>' +
            '<div class="selector__title">' + item.title + '</div>' +
            '</div>'
        ).join('');
        panel.find('.loading').replaceWith('<div class="items">' + itemsHtml + '</div>');

        // Bind events
        panel.find('.selector').on('hover:enter', function() {
            var item = results[$(this).index()];
            loadLinks(item, balancer, onItemSelect);
        });
    }, function(err) {
        panel.find('.loading').text('Ошибка: ' + err);
        console.error('Search failed:', err);
    });

    Lampa.Modal.open({
        title: 'Результаты поиска',
        html: panel,
        size: 'large',
        onBack: function() { Lampa.Modal.close(); }
    });
}

function loadLinks(item, balancer, onSelect) {
    var parser = Parsers[balancer.parser];
    parser.links(item.id, function(plinks) {
        if (plinks.length === 0) {
            Lampa.Noty.show('Ссылки не найдены');
            return;
        }
        // Show playlist
        var playlist = plinks.map(link => ({ 
            title: link.title, 
            url: link.url, 
            subtitles: [] 
        }));
        Lampa.Player.play(playlist, { title: item.title });
        Lampa.Modal.close();
    }, function(err) {
        Lampa.Noty.show('Ошибка загрузки ссылок');
    });
}

// === INTEGRATION ===
Lampa.Listener.follow('full', function(e) {
    if (e.type === 'complite' && e.object.movie && e.object.movie.title) {
        var cleanQuery = cleanTitle(e.object.movie.title);
        if (cleanQuery.length < 2) return;

        // Select top active balancer
        var topBalancer = BALANCERS.filter(b => b.active).sort((a, b) => b.weight - a.weight)[0];
        if (topBalancer) {
            createSearch(cleanQuery, topBalancer, function(item, plinks) {
                // Callback for selection
            });
        }
    }
});

// === PLUGIN VALIDATION ===
// Add to Lampa params for recognition (prevents 500 unconfirmed error)
if (typeof Lampa !== 'undefined') {
    Lampa.Params.select('plugins', '', {
        'androzon': 'Androzon Auto Search',
        'androzon_enabled': true
    });
    console.log('Androzon Plugin v2.1 Loaded - Fixed for D6');
}

})();

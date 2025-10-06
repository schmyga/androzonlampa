(function () {
    'use strict';

    Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') {
            var plugin = {
                name: 'AndroLegalFixed',
                desc: 'Оригинальные + легальные DE-источники',
                version: 'fixed-v1',
                balanser: 'rezka', // Default
                balancers: {
                    // Оригинальные (не трогаю, заглушки для твоего парсинга)
                    rezka: { search: 'https://rezka.ag/search/?q=', movie: 'https://rezka.ag/films/', stream: 'https://rezka.ag/series/', type: 'html' },
                    filmix: { search: 'https://filmix.ac/search?q=', movie: 'https://filmix.ac/series/', stream: 'https://filmix.ac/movies/', type: 'html' },
                    // Добавь другие оригинальные здесь, если есть

                    // Легальные DE (API)
                    ard: { base: 'https://api.ardmediathek.de', search: '/search?q=', movie: '/documents/', stream: '/streams/', type: 'api' },
                    zdf: { base: 'https://api.zdf.de/content', search: '/documents?q=', movie: '/documents/', stream: '/streams/', type: 'api' },
                    joyn: { base: 'https://api.joyn.de/v1/search', search: '?q=', movie: '/items/', stream: '/streams/', type: 'api' },
                    arte: { base: 'https://api.arte.tv/api/v1/videos', search: '?query=', movie: '', stream: '/streams/', type: 'api' }
                },

                getBalanser: function () {
                    return Lampa.Storage.field('online_balanser') || this.balanser;
                },

                init: function () {
                    // Минимальный select без событий (Lampa сам сохранит в Storage)
                    var options = [];
                    for (var key in this.balancers) {
                        options.push({ title: key.toUpperCase(), subtitle: this.balancers[key].type === 'api' ? 'DE API' : 'HTML' });
                    }
                    Lampa.Params.select('online_balanser', options, 0);
                    // Всё. Нет .on или listener — выбор сохраняется автоматически
                },

                search: function (query, onSuccess, onError) {
                    var bal = this.getBalanser();
                    var b = this.balancers[bal];
                    var url = (b.base || '') + (b.search || '') + encodeURIComponent(query) + '&limit=20';

                    if (b.type === 'html') {
                        // Заглушка для оригинального HTML-парсинга (вставь свой из v15.js)
                        fetch(url)
                            .then(res => res.text())
                            .then(html => {
                                var items = []; // Парсинг: new DOMParser().parseFromString(html, 'text/html').querySelectorAll('...');
                                // Пример: items.push({ title: 'Test', url: 'test' }); // Замени на реальный
                                onSuccess(items);
                            })
                            .catch(onError);
                    } else {
                        // API для легальных
                        fetch(url, { mode: 'cors' })
                            .then(res => res.json())
                            .then(json => {
                                var items = [];
                                switch (bal) {
                                    case 'ard':
                                        if (json.results) json.results.forEach(el => items.push({ title: el.title, url: el.id, img: el.teaserImage?.url, year: el.publicationDate ? new Date(el.publicationDate).getFullYear() : '' }));
                                        break;
                                    case 'zdf':
                                        if (json.documents) json.documents.forEach(el => items.push({ title: el.title, url: el.id, img: el.mainVideoImageUrl, year: el.broadcastDate ? new Date(el.broadcastDate).getFullYear() : '' }));
                                        break;
                                    case 'joyn':
                                        if (json.items) json.items.forEach(el => items.push({ title: el.title, url: el.id, img: el.image, year: el.year || '' }));
                                        break;
                                    case 'arte':
                                        if (json.value) json.value.forEach(el => items.push({ title: el.title, url: el.programId, img: el.images?.[0]?.url, year: el.productionYear || '' }));
                                        break;
                                }
                                onSuccess(items);
                            })
                            .catch(err => {
                                Lampa.Noty.show('Ошибка: ' + err.message);
                                onSuccess([]); // Пустой результат вместо краша
                            });
                    }
                },

                movie: function (data, onSuccess, onError) {
                    var bal = this.getBalanser();
                    var b = this.balancers[bal];
                    var url = (b.base || '') + (b.movie || '') + data.url;

                    if (b.type === 'html') {
                        // Заглушка для HTML (вставь свой парсер)
                        fetch(url).then(res => res.text()).then(html => {
                            onSuccess({ title: data.title, description: 'From HTML' }); // Замени
                        }).catch(onError);
                    } else {
                        fetch(url, { mode: 'cors' })
                            .then(res => res.json())
                            .then(json => {
                                onSuccess({
                                    title: json.title || data.title,
                                    description: json.longDescription || json.description,
                                    poster: json.teaserImage?.url || data.img,
                                    genres: json.genres || []
                                });
                            })
                            .catch(onError);
                    }
                },

                seasons: function (data, onSuccess, onError) {
                    onSuccess([]); // Заглушка — доработай по API/HTML
                },

                episodes: function (data, onSuccess, onError) {
                    onSuccess([]); // Заглушка
                },

                stream: function (data, onSuccess, onError) {
                    var bal = this.getBalanser();
                    var b = this.balancers[bal];
                    var url = (b.base || '') + (b.stream || '') + data.url;

                    if (b.type === 'html') {
                        // Заглушка для stream (вставь парсер m3u8)
                        onSuccess([{ quality: 'HD', url: 'https://example.m3u8' }]); // Замени
                    } else {
                        fetch(url, { mode: 'cors' })
                            .then(res => res.json())
                            .then(json => {
                                var streams = [];
                                var sdata = json.urls || json.streams || [];
                                sdata.forEach(s => streams.push({ quality: s.quality || 'Auto', url: s.url, hls: true }));
                                if (!streams.length) streams.push({ quality: 'Auto', url: url + '/default.m3u8' });
                                onSuccess(streams);
                            })
                            .catch(err => {
                                onSuccess([{ quality: 'Auto', url: 'fallback.m3u8' }]);
                            });
                    }
                }
            };

            // Переопределение поиска
            Lampa.Search.start = function (find, onSuccess, onError) {
                plugin.search(find, onSuccess, onError);
            };

            Lampa.Plugins.add('online', plugin);
            plugin.init();
        }
    });
})();

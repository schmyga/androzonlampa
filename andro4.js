(function () {
    'use strict';

    Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') {
            var plugin = {
                name: 'AndroGermanLegal',
                desc: 'Оригинальные + легальные DE-источники: ARD, ZDF, Joyn, Arte',
                version: 'v2-fixed-legal',
                balanser: 'rezka', // По умолчанию оригинальный
                balancers: {
                    // Оригинальные балансеры (не трогаю, как просил)
                    rezka: {
                        search: 'https://rezka.ag/search/?q=',
                        movie: 'https://rezka.ag/films/',
                        stream: 'https://rezka.ag/series/'
                    },
                    filmix: {
                        search: 'https://filmix.ac/search?q=',
                        movie: 'https://filmix.ac/series/',
                        stream: 'https://filmix.ac/movies/'
                    },
                    // ... (добавь другие оригинальные, если есть в твоём коде, e.g. hdrezka, collaps и т.д.)

                    // Новые легальные балансеры для проверки (API-only, без scraping)
                    ard: {
                        base: 'https://api.ardmediathek.de',
                        search: '/search?q=',
                        movie: '/documents/',
                        stream: '/streams/'
                    },
                    zdf: {
                        base: 'https://api.zdf.de/content',
                        search: '/documents?q=',
                        movie: '/documents/',
                        stream: '/streams/'
                    },
                    joyn: {
                        base: 'https://api.joyn.de/v1/search',
                        search: '?q=',
                        movie: '/items/',
                        stream: '/streams/'
                    },
                    arte: {
                        base: 'https://api.arte.tv/api/v1/videos',
                        search: '?query=',
                        movie: '',
                        stream: '/streams/'
                    }
                },

                init: function () {
                    // Упрощённая настройка балансера без .on() (исправление ошибки)
                    // Список опций для Params (статический, без event handlers)
                    var balanser_options = [];
                    for (var key in this.balancers) {
                        balanser_options.push({
                            title: key.toUpperCase(),
                            subtitle: key === 'ard' || key === 'zdf' || key === 'joyn' || key === 'arte' ? 'Легальный API' : 'Оригинальный',
                            selected: this.balanser === key
                        });
                    }
                    // Добавляем в Params без select.on() — Lampa сам обработает выбор
                    Lampa.Params.add('online_balanser', {
                        type: 'select',
                        title: 'Балансер',
                        options: balanser_options,
                        value: this.balanser,
                        onChange: function (value) {
                            plugin.balanser = value;
                            Lampa.Storage.set('online_balanser', value);
                            Lampa.Noty.show('Переключено на: ' + value.toUpperCase());
                        }
                    });
                    // Загружаем сохранённый
                    this.balanser = Lampa.Storage.field('online_balanser') || this.balanser;
                },

                search: function (query, onSuccess, onError) {
                    var b = this.balancers[this.balanser];
                    var url = (b.base ? b.base : '') + (b.search || '') + encodeURIComponent(query) + (b.limit ? '&limit=20' : '');

                    // Для оригинальных балансеров (HTML scraping, как в твоём коде)
                    if (this.balanser === 'rezka' || this.balanser === 'filmix') { // Добавь другие оригинальные здесь
                        fetch(url)
                            .then(function (res) { return res.text(); })
                            .then(function (html) {
                                // Твой оригинальный парсинг HTML (упрощённо, адаптируй под полный код)
                                var parser = new DOMParser();
                                var doc = parser.parseFromString(html, 'text/html');
                                var items = [];
                                // Пример для Rezka: doc.querySelectorAll('.b-search-result-item')...
                                // (Вставь свой парсер из andro2.js здесь)
                                var results = doc.querySelectorAll('[data-item]'); // Заглушка, замени на реальный селектор
                                results.forEach(function (elem) {
                                    items.push({
                                        title: elem.textContent.trim(),
                                        original_title: elem.dataset.original || '',
                                        release_year: elem.dataset.year || '',
                                        url: elem.href || '',
                                        img: elem.querySelector('img') ? elem.querySelector('img').src : ''
                                    });
                                });
                                onSuccess(items);
                            })
                            .catch(onError);
                    } else {
                        // Для легальных (API JSON)
                        fetch(url, { method: 'GET', mode: 'cors' })
                            .then(function (res) { return res.json(); })
                            .then(function (json) {
                                var items = [];
                                if (this.balanser === 'ard') {
                                    if (json.results) json.results.forEach(function (elem) {
                                        items.push({
                                            title: elem.title,
                                            original_title: elem.originalTitle || elem.title,
                                            release_year: elem.publicationDate ? new Date(elem.publicationDate).getFullYear() : '',
                                            url: elem.id,
                                            img: elem.teaserImage ? elem.teaserImage.url : '',
                                            description: elem.shortDescription
                                        });
                                    });
                                } else if (this.balanser === 'zdf') {
                                    if (json.documents) json.documents.forEach(function (elem) {
                                        items.push({
                                            title: elem.title,
                                            original_title: elem.title,
                                            release_year: elem.broadcastDate ? new Date(elem.broadcastDate).getFullYear() : '',
                                            url: elem.id,
                                            img: elem.mainVideoImageUrl || '',
                                            description: elem.teaserText
                                        });
                                    });
                                } else if (this.balanser === 'joyn') {
                                    if (json.items) json.items.forEach(function (elem) {
                                        items.push({
                                            title: elem.title,
                                            original_title: elem.originalTitle,
                                            release_year: elem.year || '',
                                            url: elem.id,
                                            img: elem.image || '',
                                            description: elem.description
                                        });
                                    });
                                } else if (this.balanser === 'arte') {
                                    if (json.value) json.value.forEach(function (elem) {
                                        items.push({
                                            title: elem.title,
                                            original_title: elem.originalTitle,
                                            release_year: elem.productionYear || '',
                                            url: elem.programId,
                                            img: elem.images ? elem.images[0].url : '',
                                            description: elem.shortDescription
                                        });
                                    });
                                }
                                onSuccess(items);
                            })
                            .catch(function (err) {
                                Lampa.Noty.show('Ошибка API: ' + err.message);
                                onError(err);
                            });
                    }
                },

                movie: function (params, onSuccess, onError) {
                    var b = this.balancers[this.balanser];
                    var url = (b.base ? b.base : '') + (b.movie || '') + params.url;

                    // Для оригинальных (HTML)
                    if (this.balanser === 'rezka' || this.balanser === 'filmix') {
                        fetch(url)
                            .then(function (res) { return res.text(); })
                            .then(function (html) {
                                var parser = new DOMParser();
                                var doc = parser.parseFromString(html, 'text/html');
                                // Твой оригинальный парсер для деталей (вставь из andro2.js)
                                var data = {
                                    title: doc.querySelector('h1') ? doc.querySelector('h1').textContent : params.title,
                                    // ... другие поля
                                };
                                onSuccess(data);
                            })
                            .catch(onError);
                    } else {
                        // Для легальных (API)
                        fetch(url, { method: 'GET', mode: 'cors' })
                            .then(function (res) { return res.json(); })
                            .then(function (json) {
                                var data = {
                                    title: json.title || params.title,
                                    original_title: json.originalTitle || params.original_title,
                                    release_year: json.publicationDate ? new Date(json.publicationDate).getFullYear() : params.release_year,
                                    description: json.longDescription || json.description,
                                    poster: json.teaserImage ? json.teaserImage.url : params.img,
                                    genres: json.genres || [],
                                    actors: json.cast || [],
                                    directors: json.directors || []
                                };
                                onSuccess(data);
                            })
                            .catch(onError);
                    }
                },

                seasons: function (params, onSuccess, onError) {
                    // Твой оригинальный код для сезонов (или заглушка)
                    onSuccess([]); // Доработай
                },

                episodes: function (params, onSuccess, onError) {
                    // Твой оригинальный код для эпизодов
                    onSuccess([]); // Доработай
                },

                stream: function (params, onSuccess, onError) {
                    var b = this.balancers[this.balanser];
                    var url = (b.base ? b.base : '') + (b.stream || '') + params.url;

                    // Для оригинальных (HTML parse для ссылок)
                    if (this.balanser === 'rezka' || this.balanser === 'filmix') {
                        fetch(url)
                            .then(function (res) { return res.text(); })
                            .then(function (html) {
                                // Твой парсер для stream URLs (вставь из andro2.js, e.g. extract m3u8)
                                var streams = []; // Пример: [{quality: 'HD', url: 'https://...m3u8'}]
                                onSuccess(streams);
                            })
                            .catch(onError);
                    } else {
                        // Для легальных (API streams)
                        fetch(url, { method: 'GET', mode: 'cors' })
                            .then(function (res) { return res.json(); })
                            .then(function (json) {
                                var streams = [];
                                if (json.urls || json.streams) {
                                    (json.urls || json.streams).forEach(function (stream) {
                                        streams.push({
                                            quality: stream.quality || 'Auto',
                                            url: stream.url,
                                            hls: stream.hls || true,
                                            subtitles: stream.subtitles || []
                                        });
                                    });
                                }
                                if (streams.length === 0) {
                                    streams.push({ quality: 'Auto', url: params.url + '/default.m3u8' }); // Fallback
                                }
                                onSuccess(streams);
                            })
                            .catch(onError);
                    }
                }
            };

            // Переопределение для поиска (как в оригинале)
            Lampa.Search.start = function (find, onSearch, onError) {
                plugin.search(find, onSearch, onError);
            };

            // Добавление плагина
            Lampa.Plugins.add('online', plugin);
            plugin.init();
        }
    });
})();

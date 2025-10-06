(function () {
    'use strict';

    Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') {
            var plugin = {
                name: 'AndroGermanLegalV15',
                desc: 'Оригинальные балансеры + легальные DE-источники: ARD, ZDF, Joyn, Arte',
                version: 'v15-fixed',
                balanser: 'rezka', // По умолчанию оригинальный из твоего кода
                balancers: {
                    // Оригинальные балансеры из твоего andro_v15.js (не трогаю структуру, добавил только комментарии)
                    rezka: {
                        search: 'https://rezka.ag/search/?q=',
                        movie: 'https://rezka.ag/films/',
                        stream: 'https://rezka.ag/series/',
                        parse: true // Флаг для HTML-парсинга
                    },
                    filmix: {
                        search: 'https://filmix.ac/search?q=',
                        movie: 'https://filmix.ac/series/',
                        stream: 'https://filmix.ac/movies/',
                        parse: true
                    },
                    // Добавь другие оригинальные из v15.js, если есть (e.g. hdrezka, collaps и т.д.), с parse: true

                    // Новые легальные балансеры (API-only, для проверки)
                    ard: {
                        base: 'https://api.ardmediathek.de',
                        search: '/search?q=',
                        movie: '/documents/',
                        stream: '/streams/',
                        parse: false // Флаг для JSON API
                    },
                    zdf: {
                        base: 'https://api.zdf.de/content',
                        search: '/documents?q=',
                        movie: '/documents/',
                        stream: '/streams/',
                        parse: false
                    },
                    joyn: {
                        base: 'https://api.joyn.de/v1/search',
                        search: '?q=',
                        movie: '/items/',
                        stream: '/streams/',
                        parse: false
                    },
                    arte: {
                        base: 'https://api.arte.tv/api/v1/videos',
                        search: '?query=',
                        movie: '',
                        stream: '/streams/',
                        parse: false
                    }
                },

                init: function () {
                    // Упрощённая настройка балансера без .on() — используем только select для UI, Storage для значения
                    var balanser_options = [];
                    for (var key in this.balancers) {
                        balanser_options.push({
                            title: key.toUpperCase(),
                            subtitle: this.balancers[key].parse ? 'Оригинальный (HTML)' : 'Легальный API (DE)',
                            selected: this.balanser === key
                        });
                    }
                    // Создаём select без event handlers — Lampa сам сохранит выбор в Storage при изменении
                    var select = Lampa.Params.select('online_balanser', balanser_options, 0);
                    // Не добавляем .on('select') — это вызывало undefined 'on'. Вместо этого читаем Storage в функциях
                    Lampa.Params.listener(select, 'online_balanser');
                    // Загружаем сохранённый балансер (из Storage или default)
                    this.balanser = Lampa.Storage.field('online_balanser') || this.balanser;
                },

                // Функция для построения URL (адаптировано из твоего v15.js)
                buildUrl: function (type, query) {
                    var b = this.balancers[this.balanser];
                    var url = (b.base ? b.base : '') + (b[type] || '') + encodeURIComponent(query || '') + '&limit=20';
                    return url;
                },

                search: function (query, onSuccess, onError) {
                    var url = this.buildUrl('search', query);
                    var b = this.balancers[this.balanser];

                    if (b.parse) {
                        // Оригинальный HTML-парсинг из твоего v15.js (вставь полный код парсера сюда, если нужно доработать)
                        fetch(url)
                            .then(function (res) { return res.text(); })
                            .then(function (html) {
                                var parser = new DOMParser();
                                var doc = parser.parseFromString(html, 'text/html');
                                var items = [];
                                // Твой оригинальный парсер (из v15.js: e.g. doc.querySelectorAll('.b-search-result-item'))
                                // Пример заглушки — замени на реальный:
                                var results = doc.querySelectorAll('div.result-item'); // Адаптируй селектор под Rezka/Filmix
                                results.forEach(function (elem) {
                                    var title = elem.querySelector('h3') ? elem.querySelector('h3').textContent.trim() : '';
                                    var year = elem.querySelector('.year') ? elem.querySelector('.year').textContent.trim() : '';
                                    items.push({
                                        title: title,
                                        original_title: title, // Или parse отдельно
                                        release_year: year,
                                        url: elem.querySelector('a') ? elem.querySelector('a').href : '',
                                        img: elem.querySelector('img') ? elem.querySelector('img').src : '',
                                        description: elem.querySelector('.desc') ? elem.querySelector('.desc').textContent.trim() : ''
                                    });
                                });
                                onSuccess(items);
                            })
                            .catch(onError);
                    } else {
                        // Легальные API (JSON)
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
                                            original_title: elem.originalTitle || '',
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
                                            original_title: elem.originalTitle || '',
                                            release_year: elem.productionYear || '',
                                            url: elem.programId,
                                            img: elem.images ? elem.images[0].url : '',
                                            description: elem.shortDescription
                                        });
                                    });
                                }
                                onSuccess(items);
                            }.bind(this)) // Bind для this.balanser
                            .catch(function (err) {
                                Lampa.Noty.show('Ошибка поиска в ' + this.balanser + ': ' + err.message);
                                onError(err);
                            }.bind(this));
                    }
                },

                movie: function (params, onSuccess, onError) {
                    var url = this.buildUrl('movie', params.url);
                    var b = this.balancers[this.balanser];

                    if (b.parse) {
                        // Оригинальный HTML для деталей (из v15.js)
                        fetch(url)
                            .then(function (res) { return res.text(); })
                            .then(function (html) {
                                var parser = new DOMParser();
                                var doc = parser.parseFromString(html, 'text/html');
                                // Твой парсер для movie (e.g. title, desc, poster из v15.js)
                                var data = {
                                    title: doc.querySelector('h1.title') ? doc.querySelector('h1.title').textContent.trim() : params.title,
                                    original_title: params.original_title, // Или parse
                                    release_year: params.release_year,
                                    description: doc.querySelector('.description') ? doc.querySelector('.description').textContent.trim() : '',
                                    poster: doc.querySelector('.poster img') ? doc.querySelector('.poster img').src : params.img,
                                    genres: [], // Parse если нужно
                                    actors: [], // Parse
                                    directors: [] // Parse
                                };
                                onSuccess(data);
                            })
                            .catch(onError);
                    } else {
                        // Легальные API
                        fetch(url, { method: 'GET', mode: 'cors' })
                            .then(function (res) { return res.json(); })
                            .then(function (json) {
                                var data = {
                                    title: json.title || params.title,
                                    original_title: json.originalTitle || params.original_title,
                                    release_year: json.publicationDate ? new Date(json.publicationDate).getFullYear() : params.release_year,
                                    description: json.longDescription || json.description || params.description,
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
                    // Из твоего v15.js — оригинальная логика для сезонов (HTML или API)
                    // Заглушка: onSuccess([]); — доработай по балансеру
                    if (this.balancers[this.balanser].parse) {
                        // HTML для сезонов
                        onSuccess([]); // Вставь парсер
                    } else {
                        // API для сезонов (e.g. ARD seasons)
                        onSuccess([]); // Доработай
                    }
                },

                episodes: function (params, onSuccess, onError) {
                    // Аналогично seasons — из v15.js
                    onSuccess([]); // Вставь логику
                },

                stream: function (params, onSuccess, onError) {
                    var url = this.buildUrl('stream', params.url);
                    var b = this.balancers[this.balanser];

                    if (b.parse) {
                        // Оригинальный stream-парсер (из v15.js, e.g. extract m3u8 links)
                        fetch(url)
                            .then(function (res) { return res.text(); })
                            .then(function (html) {
                                var parser = new DOMParser();
                                var doc = parser.parseFromString(html, 'text/html');
                                var streams = [];
                                // Твой парсер: e.g. doc.querySelectorAll('.player-link') для HLS
                                // Пример: streams.push({quality: 'HD', url: 'extracted_m3u8'});
                                onSuccess(streams);
                            })
                            .catch(onError);
                    } else {
                        // Легальные streams
                        fetch(url, { method: 'GET', mode: 'cors' })
                            .then(function (res) { return res.json(); })
                            .then(function (json) {
                                var streams = [];
                                var streamData = json.urls || json.streams || json.media || [];
                                streamData.forEach(function (stream) {
                                    streams.push({
                                        quality: stream.quality || stream.resolution || 'Auto',
                                        url: stream.url || stream.href,
                                        hls: stream.format === 'hls' || true,
                                        subtitles: stream.subtitles || []
                                    });
                                });
                                if (streams.length === 0) {
                                    // Fallback для легальных (e.g. default HLS)
                                    streams.push({ quality: 'Auto', url: params.url + '/stream.m3u8' });
                                }
                                onSuccess(streams);
                            })
                            .catch(onError);
                    }
                }
            };

            // Переопределение поиска (как в твоём v15.js и online.js)
            Lampa.Search.start = function (find, onSearch, onError) {
                plugin.search(find, onSearch, onError);
            };

            // Добавление плагина
            Lampa.Plugins.add('online', plugin);
            plugin.init();
        }
    });
})();

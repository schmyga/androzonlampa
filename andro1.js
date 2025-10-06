(function () {
    'use strict';

    const SOURCES = [
        { title: 'cine.to', url: 'https://cine.to', active: true },
        { title: 'kinoger.to', url: 'https://kinoger.to', active: false },
        { title: 'netzkino.de', url: 'https://www.netzkino.de', active: false },
        { title: 'filmfriend.de', url: 'https://www.filmfriend.de', active: false }
    ];

    // === ИНИЦИАЛИЗАЦИЯ ПЛАГИНА ===
    function startPlugin() {
        console.log('Androzon gestartet ✅');

        // Добавляем пункт в главное меню (не в настройки!)
        Lampa.Menu.add({
            title: '🎬 Androzon',
            icon: '<svg viewBox="0 0 24 24"><path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>',
            background: false,
            onSelect: () => {
                showSources();
            }
        });
    }

    // === ВЫБОР ИСТОЧНИКА ===
    function showSources() {
        const list = SOURCES.map(src => ({
            title: src.title + (src.active ? '' : ' (bald verfügbar)'),
            source: src
        }));

        Lampa.Select.show({
            title: 'Quelle auswählen',
            items: list,
            onSelect: (item) => {
                if (!item.source.active) {
                    Lampa.Noty.show('Diese Quelle ist noch nicht aktiv');
                    return;
                }
                showSearch(item.source);
            },
            onBack: () => {
                Lampa.Controller.back();
            }
        });
    }

    // === ПОИСК ===
    function showSearch(source) {
        Lampa.Search.start({
            title: 'Suche in ' + source.title,
            onSearch: (query) => {
                const searchUrl = source.url + '/?s=' + encodeURIComponent(query);
                Lampa.Noty.show('Suche läuft... 🔍');

                fetch(searchUrl)
                    .then(r => r.text())
                    .then(html => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const results = [];

                        doc.querySelectorAll('.ml-item, article, .movie').forEach(el => {
                            const a = el.querySelector('a');
                            const img = el.querySelector('img');
                            const h2 = el.querySelector('h2, .title, .entry-title');

                            const link = a ? a.href : '';
                            const poster = img ? (img.dataset.original || img.src) : '';
                            const title = h2 ? h2.textContent.trim() : (a ? a.title || a.textContent.trim() : '');

                            if (link && title) {
                                results.push({ title, poster, link });
                            }
                        });

                        if (results.length === 0) {
                            Lampa.Noty.show('Keine Ergebnisse gefunden 😕');
                            return;
                        }

                        showResults(source, results);
                    })
                    .catch(err => {
                        console.error('Fehler bei Suche:', err);
                        Lampa.Noty.show('Fehler beim Laden');
                    });
            }
        });
    }

    // === РЕЗУЛЬТАТЫ ===
    function showResults(source, items) {
        const scroll = new Lampa.Scroll({ mask: true });
        const container = $('<div class="androzon-results"></div>');

        items.forEach(movie => {
            const card = Lampa.Template.get('card', {
                title: movie.title,
                poster: movie.poster || '',
                quality: 'HD',
            });

            card.on('hover:enter', () => {
                showMoviePage(source, movie);
            });

            container.append(card);
        });

        scroll.body().append(container);

        Lampa.Activity.push({
            title: 'Ergebnisse – ' + source.title,
            component: 'androzon_results',
            background: '',
            ready: scroll.render(),
            onBack: Lampa.Controller.back
        });
    }

    // === СТРАНИЦА ФИЛЬМА ===
    function showMoviePage(source, item) {
        Lampa.Select.show({
            title: item.title,
            items: [
                { title: '🎬 Film ansehen', item: item }
            ],
            onSelect: (btn) => {
                loadMovieStream(source, btn.item);
            },
            onBack: () => {
                Lampa.Controller.back();
            }
        });
    }

    // === ПОИСК ВИДЕО ===
    function loadMovieStream(source, item) {
        Lampa.Noty.show('Video wird geladen... ⏳');

        fetch(item.link)
            .then(r => r.text())
            .then(html => {
                const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);

                if (!iframeMatch) {
                    Lampa.Noty.show('Kein Video gefunden 😕');
                    return;
                }

                const videoUrl = iframeMatch[1];
                const finalUrl = videoUrl.startsWith('http') ? videoUrl : new URL(videoUrl, source.url).href;

                console.log('🎥 Video URL:', finalUrl);

                Lampa.Player.play({
                    title: item.title,
                    url: finalUrl,
                    poster: item.poster || '',
                });
            })
            .catch(err => {
                console.error('Fehler beim Laden:', err);
                Lampa.Noty.show('Fehler beim Videoabruf');
            });
    }

    // === СТАРТ ===
    startPlugin();

})();

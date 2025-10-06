(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function AndrozonComponent(data) {
        var scroll = new Lampa.Scroll({ mask: true });
        var html = $('<div style="padding:20px;color:#fff;font-size:18px;">' +
            'Поиск для: <b>' + (data.movie.title || data.movie.name || 'Без названия') + '</b><br><br>' +
            '<a href="https://rezka.ag/search/?q=' + encodeURIComponent(data.movie.title || data.movie.name) + '" target="_blank" style="color:#00aaff;">Rezka</a><br>' +
            '<a href="https://filmix.ac/search?q=' + encodeURIComponent(data.movie.title || data.movie.name) + '" target="_blank" style="color:#00aaff;">Filmix</a><br>' +
            '<a href="https://kodik.cc/search?query=' + encodeURIComponent(data.movie.title || data.movie.name) + '" target="_blank" style="color:#00aaff;">Kodik</a><br>' +
            '<a href="https://videocdn.tv/search?q=' + encodeURIComponent(data.movie.title || data.movie.name) + '" target="_blank" style="color:#00aaff;">VideoCDN</a>' +
            '</div>');

        scroll.append(html);

        this.create = function () {
            return scroll.render();
        };

        this.render = function () {
            return scroll.render();
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render(), 'selector');
                    Lampa.Controller.collectionFocus(scroll.render().find('.selector')[0], scroll.render());
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });
            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () {
            scroll.destroy();
        };
    }

    function addButtonToCard(card, movie) {
        if (card.find('.androzon-btn').length) return;

        var btn = $('<div class="full-start__button selector androzon-btn" style="background:#FF6B35;margin:10px;border-radius:8px;">' +
            '<div style="padding:10px 16px;display:flex;align-items:center;justify-content:center;">' +
            '<span style="margin-right:8px;">🔍</span>' +
            '<span style="font-weight:700;color:#fff;">Androzon</span>' +
            '</div></div>');

        btn.on('hover:enter', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Androzon',
                component: 'androzon',
                movie: movie,
                page: 1
            });
        });

        card.append(btn);
    }

    function init() {
        Lampa.Component.add('androzon', AndrozonComponent);

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var card = $('.full-start');
                if (card.length) {
                    addButtonToCard(card, e.data.movie);
                }
            }
        });

        if (Lampa.Activity.active().component === 'full') {
            var card = $('.full-start');
            if (card.length) {
                addButtonToCard(card, Lampa.Activity.active().card);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    function component(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var last;

        this.create = function () {
            return this.render();
        };

        this.render = function () {
            return scroll.render();
        };

        this.start = function () {
            scroll.append($('<div style="padding:20px;font-size:18px;color:#fff;">Плагин Androzon запущен для: <b>' + (object.movie.title || object.movie.name || 'Без названия') + '</b></div>'));
            scroll.append($('<div style="padding:20px;color:#ccc;">Здесь может быть ваш контент: ссылки, видео, поиск...</div>'));
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render(), 'selector');
                    Lampa.Controller.collectionFocus(last || scroll.render().find('.selector')[0], scroll.render());
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

    function addButton(e) {
        if (e.render.find('.androzon-button').length) return;

        var btn = $('<div class="full-start__button selector androzon-button" style="background:#FF6B35;margin:6px;border-radius:8px;"><div style="padding:10px 16px;display:flex;align-items:center;justify-content:center;"><span style="margin-right:8px;">🎬</span><span style="font-weight:700;color:#fff;">Androzon</span></div></div>');

        btn.on('hover:enter', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Androzon - ' + (e.movie.title || e.movie.name),
                component: 'androzon',
                movie: e.movie,
                page: 1
            });
        });

        var container = e.render.find('.view--torrent');
        if (container.length) container.after(btn);
        else e.render.append(btn);
    }

    function init() {
        Lampa.Component.add('androzon', component);

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                addButton({
                    render: e.object.activity.render().find('.view--torrent'),
                    movie: e.data.movie
                });
            }
        });

        if (Lampa.Activity.active().component === 'full') {
            addButton({
                render: Lampa.Activity.active().activity.render().find('.view--torrent'),
                movie: Lampa.Activity.active().card
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

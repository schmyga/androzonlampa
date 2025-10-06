// andro_v16_fixed.js
(function() {
  'use strict';

  // === Настройки ===
  const PROXY = 'https://smotret24.ru/proxy?url='; // прокси (рекомендуемый)
  const BALANCERS = [
    { id: 'cine', title: 'cine.to', url: 'https://cine.to', active: true },
    { id: 'kinoger', title: 'kinoger', url: 'https://kinoger.com', active: false },
    { id: 'movie4k', title: 'movie4k', url: 'https://movie4k.to', active: false }
  ];

  // Helper: network factory (Lampa.Reguest or fetch fallback)
  function createNetwork() {
    var Net = (typeof Lampa !== 'undefined' && (Lampa.Reguest || Lampa.Request)) ? (Lampa.Reguest || Lampa.Request) : null;
    if (Net) {
      try { return new Net(); }
      catch (e) { console.warn('createNetwork: new Net failed', e); }
    }
    return {
      native: function(url, success, error) {
        try {
          fetch(url, { credentials: 'include' })
            .then(r => r.text())
            .then(t => success && success(t))
            .catch(e => error && error(e));
        } catch (e) { error && error(e); }
      },
      clear: function() {}
    };
  }

  // account(url) - аналогично smotret24, добавляет uid если есть
  function account(url) {
    try {
      if (!url || typeof url !== 'string') return url;
      var uid = (typeof Lampa !== 'undefined' && Lampa.Storage) ? Lampa.Storage.get('lampac_unic_id', '') : '';
      if (uid && url.indexOf('uid=') === -1) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'uid=' + encodeURIComponent(uid);
      }
      return url;
    } catch (e) { return url; }
  }

  var network = createNetwork();

  // Robust extractor: ищет m3u8/mp4/iframe/src/data-attrs в html
  function extractVideoUrl(html, base) {
    try {
      if (!html) return null;

      // Быстрый regexp на m3u8/mp4
      var r = html.match(/(https?:\/\/[^\s"'<>]+?\.(?:m3u8|mp4)[^\s"'<>]*)/i);
      if (r && r[1]) return r[1];

      // Ищем iframe src в HTML
      var iframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframe && iframe[1]) {
        var src = iframe[1];
        if (src.indexOf('//') === 0) src = window.location.protocol + src;
        if (src.indexOf('http') !== 0 && base) {
          try { src = (new URL(src, base)).href; } catch(e) {}
        }
        return src;
      }

      // DOMParser scan (если есть)
      try {
        var doc = (new DOMParser()).parseFromString(html, 'text/html');
        var videoTag = doc.querySelector('video source, video');
        if (videoTag) {
          var vsrc = videoTag.getAttribute('src') || videoTag.getAttribute('data-src') || '';
          if (vsrc) {
            if (vsrc.indexOf('//') === 0) vsrc = window.location.protocol + vsrc;
            if (vsrc.indexOf('http') !== 0 && base) {
              try { vsrc = (new URL(vsrc, base)).href; } catch(e) {}
            }
            return vsrc;
          }
        }
        var dataEls = doc.querySelectorAll('[data-url],[data-src],[data-file]');
        for (var i=0;i<dataEls.length;i++){
          var u = dataEls[i].getAttribute('data-url') || dataEls[i].getAttribute('data-src') || dataEls[i].getAttribute('data-file');
          if (u && u.indexOf('http')===0) return u;
        }
        // Поиск в скриптах
        var scripts = doc.querySelectorAll('script');
        for (var s=0;s<scripts.length;s++){
          var sc = scripts[s].textContent || '';
          var rr = sc.match(/(https?:\/\/[^\s"']+?\.m3u8[^\s"']*)/i) || sc.match(/(https?:\/\/[^\s"']+?\.mp4[^\s"']*)/i);
          if (rr && rr[1]) return rr[1];
        }
      } catch (e) {
        // ignore DOMParser errors
      }

      return null;
    } catch (err) {
      console.error('extractVideoUrl error', err);
      return null;
    }
  }

  // Component (как в твоём шаблоне)
  function component(object) {
    var movie = object.movie || {};
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var last;

    this.create = function() { return this.render(); };
    this.render = function() { return scroll.render(); };

    this.start = function() {
      this.initialize();
    };

    this.initialize = function() {
      var that = this;
      scroll.body().addClass('torrent-list');

      // Header (poster + title)
      var header = $('<div style="display:flex;padding:16px;gap:14px;align-items:center;"></div>');
      var posterUrl = movie.poster_path ? Lampa.TMDB.image('t/p/w300' + movie.poster_path) : (movie.img || '');
      var poster = $('<div style="width:130px;height:190px;background:#111;border-radius:8px;overflow:hidden;"></div>');
      if (posterUrl) {
        var img = $('<img style="width:100%;height:100%;object-fit:cover;">').attr('src', posterUrl);
        poster.append(img);
      } else poster.append($('<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#777">No poster</div>'));
      var info = $('<div style="flex:1;"></div>');
      info.append('<div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:6px;">' + (movie.title || movie.name || '') + '</div>');
      info.append('<div style="color:#bbb;font-size:13px;">' + ((movie.overview && movie.overview.slice(0,200)) || '') + '</div>');

      header.append(poster).append(info);
      scroll.append(header);

      // Sources list
      scroll.append($('<div style="padding:12px 16px;color:#ddd;font-weight:600;">Выберите источник</div>'));
      for (var i=0;i<BALANCERS.length;i++){
        (function(b){
          var el = $('<div class="selector" style="padding:14px;margin:8px 16px;border-radius:10px;background:rgba(255,255,255,0.02);display:flex;justify-content:space-between;align-items:center;cursor:pointer;"></div>');
          el.append('<div><div style="font-weight:700;color:#fff;">'+b.title+'</div><div style="font-size:12px;color:#bbb;">'+(b.active?'':'(скоро)')+'</div></div>');
          el.append('<div style="color:#fff;font-size:12px;">'+(b.id==='cine'?'По умолчанию':'')+'</div>');
          el.on('hover:enter', function(){
            if (!b.active) { Lampa.Noty.show('Источник пока не активен'); return; }
            that.searchOnBalancer(b);
          });
          el.on('hover:focus', function(e){ last = e.target; });
          scroll.append(el);
        })(BALANCERS[i]);
      }

      // Demo streams
      that.addDemoStreams();

      Lampa.Controller.enable('content');
    };

    this.addDemoStreams = function() {
      scroll.append($('<div style="padding:12px 16px;color:#ddd;font-weight:600;margin-top:6px;">Тестовые потоки</div>'));
      var demo = [
        { title: 'HLS 720p (test)', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
        { title: 'BigBuckBunny MP4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' }
      ];
      demo.forEach(function(d){
        var el = $('<div class="selector" style="padding:12px;margin:8px 16px;border-radius:8px;background:rgba(255,255,255,0.02);cursor:pointer;"><div style="font-weight:600;color:#fff;">'+d.title+'</div></div>');
        el.on('hover:enter', function(){ Lampa.Player.play({ url: d.url, title: d.title, quality: { 'Auto': d.url } }); });
        scroll.append(el);
      });
    };

    this.searchOnBalancer = function(balancer) {
      var that = this;
      // Открываем стандартное окно поиска Lampa
      Lampa.Search.start({
        title: 'Поиск на ' + balancer.title,
        onSearch: function(q) {
          if (!q) return;
          var searchUrl = balancer.url + '/?s=' + encodeURIComponent(q);
          // используем прокси для надежности
          var fetchUrl = PROXY + encodeURIComponent(searchUrl);
          Lampa.Noty.show('Ищем на ' + balancer.title + ' ...');
          network.native(account(fetchUrl), function(html) {
            try {
              if (!html || html.length < 50) {
                Lampa.Noty.show('Пустой ответ от источника');
                return;
              }
              // Парсим страницу — ищем карточки с результатами
              var doc = (new DOMParser()).parseFromString(html, 'text/html');
              var items = [];
              // Try common selectors (cine.to)
              var nodes = doc.querySelectorAll('.ml-item, .movie, article');
              nodes.forEach(function(n){
                try {
                  var a = n.querySelector('a');
                  var img = n.querySelector('img');
                  var titleEl = n.querySelector('h2, .title, .entry-title');
                  var title = titleEl ? titleEl.textContent.trim() : (a ? (a.title || a.textContent.trim()) : '');
                  var link = a ? a.getAttribute('href') : '';
                  var poster = img ? (img.getAttribute('data-original') || img.getAttribute('src')) : '';
                  if (link && title) items.push({ title: title, link: link, poster: poster });
                } catch(e){}
              });
              // Fallback: try to find links in page if nodes empty
              if (!items.length) {
                var anchors = doc.querySelectorAll('a');
                anchors.forEach(function(a){
                  var href = a.getAttribute('href') || '';
                  var text = a.textContent || '';
                  if (href && text && text.length>2 && (href.indexOf(balancer.url) >= 0 || href.match(/\/watch|\/movie|\/serie|\/film/i))) {
                    items.push({ title: text.trim(), link: href, poster: '' });
                  }
                });
              }

              if (!items.length) {
                Lampa.Noty.show('Не найдено результатов');
                return;
              }

              that.showResultsPanel(balancer, items);
            } catch (e) {
              console.error('parse search results error', e);
              Lampa.Noty.show('Ошибка разбора результатов');
            }
          }, function(err) {
            console.error('network error', err);
            Lampa.Noty.show('Ошибка сети при поиске');
          });
        }
      });
    };

    this.showResultsPanel = function(balancer, items) {
      var that = this;
      scroll.clear();
      var header = $('<div style="padding:12px 16px;color:#fff;font-weight:700;">Результаты</div>');
      scroll.append(header);

      items.forEach(function(it){
        var card = $('<div class="selector" style="display:flex;gap:12px;padding:12px;margin:8px 16px;border-radius:8px;background:rgba(255,255,255,0.02);align-items:center;cursor:pointer;"></div>');
        var img = $('<div style="width:80px;height:55px;background:#222;border-radius:6px;overflow:hidden;"></div>');
        if (it.poster) img.append('<img src="'+it.poster+'" style="width:100%;height:100%;object-fit:cover;">');
        var info = $('<div style="flex:1;"></div>');
        info.append('<div style="font-weight:700;color:#fff;">'+it.title+'</div>');
        info.append('<div style="font-size:12px;color:#bbb;">'+(it.link.length>80? it.link.slice(0,80)+'...':it.link)+'</div>');
        card.append(img).append(info);

        card.on('hover:enter', function() {
          that.showMoviePage(balancer, it);
        });
        scroll.append(card);
      });

      // back
      var back = $('<div class="selector" style="padding:12px;margin:16px;border-radius:8px;background:rgba(255,255,255,0.02);text-align:center;cursor:pointer;">← Назад</div>');
      back.on('hover:enter', function(){ that.initialize(); });
      scroll.append(back);
    };

    this.showMoviePage = function(balancer, movieItem) {
      var that = this;
      scroll.clear();
      var header = $('<div style="padding:16px;"></div>');
      header.append('<div style="font-weight:700;color:#fff;font-size:18px;margin-bottom:8px;">'+movieItem.title+'</div>');
      header.append('<div style="color:#bbb;font-size:13px;margin-bottom:12px;">'+(movieItem.poster?'<img src="'+movieItem.poster+'" style="width:120px;height:auto;border-radius:6px;"/>':'')+'</div>');
      scroll.append(header);

      var watch = $('<div class="selector" style="padding:14px;margin:8px 16px;border-radius:8px;background:#FF6B35;color:#fff;text-align:center;font-weight:700;cursor:pointer;">▶ Смотреть</div>');
      watch.on('hover:enter', function(){
        that.playFromMoviePage(balancer, movieItem);
      });
      scroll.append(watch);

      var back = $('<div class="selector" style="padding:12px;margin:16px;border-radius:8px;background:rgba(255,255,255,0.02);text-align:center;cursor:pointer;">← Назад</div>');
      back.on('hover:enter', function(){ that.initialize(); });
      scroll.append(back);
    };

    this.playFromMoviePage = function(balancer, movieItem) {
      var that = this;
      var page = movieItem.link;
      var fetchUrl = PROXY + encodeURIComponent(page);
      Lampa.Noty.show('Загружаю страницу плеера...');

      network.native(account(fetchUrl), function(html) {
        try {
          if (!html || html.length < 20) {
            Lampa.Noty.show('Нет содержимого страницы');
            return;
          }
          var video = extractVideoUrl(html, page);
          if (video) {
            Lampa.Noty.show('Видео найдено, запускаю плеер');
            Lampa.Player.play({ url: video, title: movieItem.title, quality: { 'Auto': video } });
          } else {
            // собираем внешние ссылки и показываем пользователю
            var ext = that.findExternalLinks(html, page);
            if (ext && ext.length) {
              that.showExternalLinks(ext, balancer, movieItem);
            } else {
              Lampa.Noty.show('Не удалось найти прямую ссылку. Нужен серверный парсер.');
            }
          }
        } catch (e) {
          console.error('playFromMoviePage parse error', e);
          Lampa.Noty.show('Ошибка обработки плеера');
        }
      }, function(err) {
        console.error('network error load player', err);
        Lampa.Noty.show('Сетевая ошибка при загрузке плеера');
      });
    };

    this.findExternalLinks = function(html, base) {
      try {
        var out = [];
        var doc = null;
        try { doc = (new DOMParser()).parseFromString(html, 'text/html'); } catch(e){}
        if (doc) {
          var iframes = doc.querySelectorAll('iframe');
          for (var i=0;i<iframes.length;i++){
            var s = iframes[i].getAttribute('src') || iframes[i].src || '';
            if (s) {
              if (s.indexOf('//')===0) s = window.location.protocol + s;
              if (s.indexOf('http') !== 0 && base) {
                try { s = (new URL(s, base)).href; } catch(e){}
              }
              out.push(s);
            }
          }
        }
        // regex fallback
        var m = html.match(/https?:\/\/[^\s"'<>]{20,300}/gi) || [];
        m.forEach(function(u){ if (out.indexOf(u)===-1) out.push(u); });
        return out.filter(Boolean);
      } catch(e) { return []; }
    };

    this.showExternalLinks = function(list, balancer, movieItem) {
      var that = this;
      scroll.clear();
      scroll.append($('<div style="padding:12px 16px;color:#fff;font-weight:700;">Найденные внешние ссылки</div>'));
      list.forEach(function(u){
        var el = $('<div class="selector" style="padding:12px;margin:8px 16px;border-radius:8px;background:rgba(255,255,255,0.02);cursor:pointer;"><div style="word-break:break-all;color:#fff;">'+(u.length>140?u.slice(0,140)+'...':u)+'</div></div>');
        el.on('hover:enter', function(){
          // при выборе пробуем загрузить внешнюю ссылку и извлечь оттуда видео
          that.tryExternalLink(u, movieItem);
        });
        scroll.append(el);
      });
      var back = $('<div class="selector" style="padding:12px;margin:16px;border-radius:8px;background:rgba(255,255,255,0.02);text-align:center;cursor:pointer;">← Назад</div>');
      back.on('hover:enter', function(){ that.initialize(); });
      scroll.append(back);
    };

    this.tryExternalLink = function(url, movieItem) {
      var that = this;
      Lampa.Noty.show('Обрабатываю ссылку...');
      var fetchUrl = PROXY + encodeURIComponent(url);
      network.native(account(fetchUrl), function(html) {
        try {
          var video = extractVideoUrl(html, url);
          if (video) {
            Lampa.Player.play({ url: video, title: movieItem.title, quality: { 'Auto': video } });
          } else {
            Lampa.Noty.show('Не удалось извлечь поток из внешней ссылки');
          }
        } catch(e) {
          console.error('tryExternalLink parse error', e);
          Lampa.Noty.show('Ошибка при обработке внешней ссылки');
        }
      }, function(err) {
        console.error('network external link error', err);
        Lampa.Noty.show('Ошибка сети');
      });
    };

    this.pause = function(){};
    this.stop = function(){};
    this.destroy = function() {
      try { network.clear(); } catch(e) {}
      try { scroll.destroy(); } catch(e) {}
    };
  } // end component

  // === Registration & button insertion (как в v15) ===
  function init() {
    console.log('Androzon init (fixed v16)');

    // Регистрация компонента
    try { Lampa.Component.add('androzon', component); } catch(e){ console.error('Component.add error', e); }

    // Добавление кнопки в карточку фильма (robust insertion like v15)
    Lampa.Listener.follow('full', function(e) {
      if (e.type !== 'complite') return;
      try {
        var render = e.object.activity.render();
        var movie = e.data.movie;
        // удалить старые
        render.find('.androzon-button').remove();

        // кнопка
        var btn = $('<div class="full-start__button selector androzon-button" style="background: linear-gradient(45deg,#FF6B35,#FF8E53); margin:6px; border-radius:8px;"><div style="padding:10px 16px;display:flex;align-items:center;justify-content:center;"><span style="margin-right:8px;">🎬</span><span style="font-weight:700;color:#fff;">Androzon</span></div></div>');
        btn.on('hover:enter', function() {
          Lampa.Activity.push({
            url: '',
            title: 'Androzon - ' + (movie.title || movie.name),
            component: 'androzon',
            movie: movie,
            page: 1
          });
        });

        // разные места для вставки (как в v15)
        var torrentBtn = render.find('.view--torrent');
        var playBtn = render.find('.button--play');
        var buttonsContainer = render.find('.full-start__buttons');

        if (torrentBtn.length) torrentBtn.after(btn);
        else if (playBtn.length) playBtn.after(btn);
        else if (buttonsContainer.length) buttonsContainer.prepend(btn);
        else {
          var cardActions = render.find('.full-actions, .full-start');
          if (cardActions.length) cardActions.prepend(btn);
          else render.append(btn);
        }
        console.log('Androzon button added for', movie.title || movie.name);
      } catch(err) {
        console.error('Add button error', err);
      }
    });
  }

  // try init
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  } catch (e) {
    console.error('Androzon init fatal', e);
  }

})();

(function() {
  'use strict';

  /**
   * Androzon Lampa plugin (v11)
   * - универсальный network fallback (Reguest / Request / fetch)
   * - UI: список балансеров (sources), выбор, парсинг страницы, попытка извлечь m3u8/mp4
   * - fallback: показать найденные внешние ссылки
   *
   * При сборке кастомных правил для конкретных сайтов (cine.to, kinoger и т.д.)
   * рекомендуется добавить site-specific парсеры внутри extractVideoUrl или отдельной функции.
   */

  try {
    console.log('Androzon v11 starting...');

    if (typeof Lampa === 'undefined') {
      console.error('Lampa API not found — abort');
      return;
    }

    // ---------- CONFIG: балансеры (легальные / допустимые) ----------
    // Заменяй / добавляй сюда источники. Каждый балансер имеет:
    // { id, name, description, color, buildSearchUrl(movie) }
    var BALANCERS = [
      {
        id: 'cine',
        name: 'Cine.to',
        description: 'Фильмы и сериалы (поиск)',
        color: '#50E3C2',
        buildSearchUrl: function(movie) {
          var q = encodeURIComponent(movie.title || movie.name || '');
          return 'https://cine.to/search?q=' + q;
        }
      },
      {
        id: 'kinoger',
        name: 'Kinoger',
        description: 'Прямой поиск фильмов',
        color: '#FF6B35',
        buildSearchUrl: function(movie) {
          var q = encodeURIComponent(movie.title || movie.name || '');
          return 'https://kinoger.com/search/?q=' + q;
        }
      },
      {
        id: 'bsto',
        name: 'BS.to',
        description: 'Немецкие сериалы (поиск)',
        color: '#4A90E2',
        buildSearchUrl: function(movie) {
          var q = encodeURIComponent(movie.title || movie.name || '');
          return 'https://bs.to/search?q=' + q;
        }
      },
      // демо / тестовый балансер (для проверки)
      {
        id: 'demo',
        name: 'Demo (тест поток)',
        description: 'Тестовые HLS/MP4 потоки',
        color: '#9B59B6',
        buildSearchUrl: function(movie) {
          // не используется для поиска — это тест
          return '';
        }
      }
    ];

    var DEFAULT_BALANCER_KEY = 'androzon_default_balancer';
    var LAST_BALANCER_CHOICE = 'androzon_last_choice';

    // ---------- Network helper ----------
    function createNetwork() {
      var NetClass = (typeof Lampa.Reguest !== 'undefined' ? Lampa.Reguest : (typeof Lampa.Request !== 'undefined' ? Lampa.Request : null));
      if (NetClass) {
        try {
          return new NetClass();
        } catch (e) {
          console.warn('Network class construction failed, fallback to fetch', e);
        }
      }
      return {
        native: function(url, onSuccess, onError) {
          try {
            fetch(url, { credentials: 'include' })
              .then(function(resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.text();
              })
              .then(function(text) {
                if (onSuccess) onSuccess(text);
              })
              .catch(function(err) {
                if (onError) onError(err && err.toString ? err.toString() : err);
              });
          } catch (err) {
            if (onError) onError(err && err.toString ? err.toString() : err);
          }
        },
        clear: function() {}
      };
    }

    // безопасная обёртка account (как в online.js) — добавляет uid при наличии
    function account(url) {
      try {
        if (!url || typeof url !== 'string') return url;
        var uid = '';
        try {
          uid = (Lampa && Lampa.Storage) ? Lampa.Storage.get('lampac_unic_id', '') : '';
        } catch (e) { uid = ''; }
        if (uid && url.indexOf('uid=') === -1) {
          url += (url.indexOf('?') === -1 ? '?' : '&') + 'uid=' + encodeURIComponent(uid);
        }
        return url;
      } catch (e) {
        return url;
      }
    }

    var network = createNetwork();

    // ---------- Utility: save/get default balancer ----------
    function getDefaultBalancer() {
      var b = Lampa.Storage.get(DEFAULT_BALANCER_KEY, '');
      if (!b && BALANCERS.length) {
        b = BALANCERS[0].id;
        Lampa.Storage.set(DEFAULT_BALANCER_KEY, b);
      }
      return b;
    }

    function setDefaultBalancer(id) {
      Lampa.Storage.set(DEFAULT_BALANCER_KEY, id);
    }

    // ---------- Robust extractor ----------
    // ищет m3u8/mp4/iframe/src/data-* в html. Можно расширять site-specific правила.
    function extractVideoUrl(html, sourceId) {
      try {
        if (!html || typeof html !== 'string') return null;
        // Быстрый пас 1: регулярки по всей странице
        var quick = [
          /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/gi,
          /(https?:\/\/[^\s"']+\.mp4[^\s"']*)/gi,
          /(https?:\/\/[^\s"']+\/hls[^\s"']*)/gi,
          /(https?:\/\/[^\s"']+\/stream[^\s"']*)/gi,
          /(https?:\/\/[^\s"']+\/video[^\s"']*)/gi
        ];
        for (var qi = 0; qi < quick.length; qi++) {
          var m = html.match(quick[qi]);
          if (m && m.length) {
            console.log('Androzon: quick extract ->', m[0]);
            return m[0];
          }
        }

        // Попытка DOMParser (если доступен) — удобнее искать iframe/video/data-attrs
        var doc = null;
        try {
          doc = (new DOMParser()).parseFromString(html, 'text/html');
        } catch (e) {
          doc = null;
        }

        if (doc) {
          // iframe
          var iframes = doc.querySelectorAll('iframe');
          for (var i = 0; i < iframes.length; i++) {
            var src = iframes[i].getAttribute('src') || iframes[i].src || '';
            if (src && (src.indexOf('.m3u8') !== -1 || src.indexOf('.mp4') !== -1 || /\/(embed|player|stream)/i.test(src))) {
              console.log('Androzon: found iframe src', src);
              return src;
            }
          }
          // video / source tags
          var vels = doc.querySelectorAll('video>source, video');
          for (var v = 0; v < vels.length; v++) {
            var vsrc = vels[v].getAttribute('src') || vels[v].getAttribute('data-src') || '';
            if (vsrc && vsrc.indexOf('http') === 0) {
              console.log('Androzon: found <video> src', vsrc);
              return vsrc;
            }
          }
          // data attributes
          var dataEls = doc.querySelectorAll('[data-url],[data-src],[data-file],[data-video]');
          for (var d = 0; d < dataEls.length; d++) {
            var url = dataEls[d].getAttribute('data-url') || dataEls[d].getAttribute('data-src') || dataEls[d].getAttribute('data-file') || dataEls[d].getAttribute('data-video');
            if (url && url.indexOf('http') === 0) {
              console.log('Androzon: found data-* url', url);
              return url;
            }
          }
          // inline scripts search (less aggressive)
          var scripts = doc.querySelectorAll('script');
          for (var s = 0; s < scripts.length; s++) {
            var sc = scripts[s].textContent || scripts[s].innerText || '';
            if (!sc) continue;
            var reList = [
              /file\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
              /source\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
              /url\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
              /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i,
              /(https?:\/\/[^\s"']+\.mp4[^\s"']*)/i
            ];
            for (var r = 0; r < reList.length; r++) {
              var found = sc.match(reList[r]);
              if (found && found[1]) {
                console.log('Androzon: script found url ->', found[1]);
                return found[1];
              } else if (found && found[0] && found[0].indexOf('http') === 0) {
                console.log('Androzon: script fallback ->', found[0]);
                return found[0];
              }
            }
          }
        }

        // final fallback: regex again
        var final = html.match(/(https?:\/\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*)/i);
        if (final && final[0]) {
          console.log('Androzon: final regex ->', final[0]);
          return final[0];
        }

        return null;
      } catch (err) {
        console.error('Androzon.extractVideoUrl error', err);
        return null;
      }
    }

    // ---------- Component (UI + logic) ----------
    function component(object) {
      console.log('Androzon component init');
      var movie = object.movie || {};
      var scroll = new Lampa.Scroll({ mask: true, over: true });
      var lastFocused = false;

      this.create = function() { return this.render(); };
      this.render = function() { return scroll.render(); };

      this.start = function() {
        this.initialize();
      };

      this.initialize = function() {
        scroll.body().addClass('torrent-list');
        this.renderMain();
        this.setupController();
      };

      this.setupController = function() {
        var self = this;
        Lampa.Controller.add('content', {
          toggle: function() {
            Lampa.Controller.collectionSet(scroll.render(), '');
            Lampa.Controller.collectionFocus(lastFocused || scroll.render().find('.selector')[0], scroll.render());
          },
          up: function() { if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
          down: function() { if (Navigator.canmove('down')) Navigator.move('down'); },
          left: function() { Lampa.Controller.toggle('menu'); },
          right: function() { /* noop */ },
          back: function() { Lampa.Activity.backward(); }
        });
        Lampa.Controller.toggle('content');
      };

      this.renderMain = function() {
        var self = this;
        scroll.clear();

        // header with movie card (poster clickable if available)
        var headHtml = $('<div style="display:flex;gap:18px;padding:18px 20px;align-items:center;"></div>');
        var posterUrl = (movie.poster_path ? Lampa.TMDB.image('t/p/w300' + movie.poster_path) : (movie.img || ''));
        var posterBlock = $('<div style="width:140px;height:200px;background:#222;border-radius:6px;overflow:hidden;"></div>');
        if (posterUrl) {
          var img = $('<img alt="poster" style="width:100%;height:100%;object-fit:cover;" />');
          img.attr('src', posterUrl);
          posterBlock.append(img);
        } else {
          posterBlock.append($('<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999">No poster</div>'));
        }
        var infoBlock = $('<div style="flex:1;"></div>');
        infoBlock.append('<div style="font-size:20px;font-weight:700;margin-bottom:6px;">' + (movie.title || movie.name || 'Фильм') + '</div>');
        infoBlock.append('<div style="color:#bbb;margin-bottom:8px;">' + (movie.tagline || (movie.overview ? movie.overview.substring(0,150)+'...' : '')) + '</div>');

        headHtml.append(posterBlock).append(infoBlock);
        scroll.append(headHtml);

        // Балансеры (sources)
        var balHeader = $('<div style="padding:12px 20px;color:#ddd;font-weight:600;">Выберите источник</div>');
        scroll.append(balHeader);

        var defaultBalancer = getDefaultBalancer();

        BALANCERS.forEach(function(b) {
          var isDemo = (b.id === 'demo');
          var el = $('<div class="selector" data-balancer="'+b.id+'" style="padding:16px;margin:10px 20px;border-radius:10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:'+ (b.color || 'rgba(255,255,255,0.03)') +';"></div>');
          var left = $('<div></div>');
          left.append('<div style="font-weight:700;color:#fff;">'+b.name+'</div>');
          left.append('<div style="font-size:12px;color:#eee;opacity:0.9;">'+b.description+'</div>');
          el.append(left);
          var right = $('<div style="font-size:12px;color:#fff;opacity:0.95">'+ (defaultBalancer === b.id ? 'По умолчанию' : '') +'</div>');
          el.append(right);

          el.on('hover:enter', function() {
            // сохранить выбор как последний для текущего фильма
            Lampa.Storage.set(LAST_BALANCER_CHOICE, b.id);
            // если demo - показать демо потоки
            if (isDemo) self.addDemoStreams();
            else self.searchBalancer(b);
          });

          el.on('hover:focus', function(e) { lastFocused = e.target; });

          scroll.append(el);
        });

        // демонстрация / помощи
        var help = $('<div style="padding:12px 20px;color:#999;font-size:13px;">Если сайт генерирует ссылки через JS/редиректы, потребуется серверный парсер. Этот плагин пытается извлечь прямые ссылки из HTML.</div>');
        scroll.append(help);

        // тестовые потоки внизу
        this.addDemoStreams();
      };

      this.addDemoStreams = function() {
        var self = this;
        scroll.append($('<div style="padding:12px 20px;font-weight:600;color:#ddd;">Попробуйте тестовые видео</div>'));
        var demo = [
          { title: 'HLS 720p тест', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', q:'720p' },
          { title: 'BigBuckBunny MP4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', q:'1080p' }
        ];
        demo.forEach(function(d) {
          var el = $('<div class="selector" style="padding:12px;margin:8px 20px;border-radius:8px;background:rgba(255,255,255,0.02);cursor:pointer;"><div style="font-weight:600;color:#fff;">'+d.title+'</div><div style="font-size:12px;color:#ccc;">Качество: '+d.q+'</div></div>');
          el.on('hover:enter', function() {
            try {
              Lampa.Player.play({ url: d.url, title: d.title, quality: { [d.q]: d.url } });
            } catch (e) {
              Lampa.Noty.show('Ошибка запуска плеера');
            }
          });
          scroll.append(el);
        });
      };

      // -------------- поиск на выбранном балансере --------------
      this.searchBalancer = function(balancer) {
        var self = this;
        scroll.clear();

        // показать поисковый экран
        var loading = $('<div style="padding:36px 20px;text-align:center;color:#bbb">Ищем "'+(movie.title || movie.name || '')+'" на '+balancer.name+'...</div>');
        scroll.append(loading);

        // если balancer предоставляет прямой URL для поиска:
        var url = '';
        try {
          url = balancer.buildSearchUrl(movie);
        } catch (e) {
          url = '';
        }

        if (!url) {
          // показать сообщение
          scroll.clear();
          scroll.append($('<div style="padding:20px;color:#f7c6c6">Балансер не поддерживает авто-поиск.</div>'));
          this.addDemoStreams();
          this.addBackToMain();
          return;
        }

        // начать загрузку
        var fetchUrl = account(url);
        console.log('Androzon: fetch balancer url ->', fetchUrl);
        try {
          network.native(fetchUrl, function(html) {
            try {
              if (!html || html.length < 50) {
                self.showError('Страница балансера пустая или недоступна');
                return;
              }
              // если balanceС возвращает список ссылок на другие сайты (как cine.to -> videzz / jillian...),
              // мы пытаемся собрать все внешние ссылки и дать пользователю выбор
              // сначала попытаемся извлечь прямую ссылку
              var video = extractVideoUrl(html, balancer.id);
              if (video) {
                // нормализовать относительные ссылки
                if (video.indexOf('//') === 0) video = window.location.protocol + video;
                if (video.indexOf('http') !== 0) {
                  try { video = (new URL(video, fetchUrl)).href; } catch(e){ /* ignore */ }
                }
                self.showVideoCard(video, balancer);
                return;
              }

              // если прямого нет — попробуем извлечь внешние ссылки (iframe/redirects)
              var ext = self.findExternalLinks(html, fetchUrl);
              if (ext && ext.length) {
                self.showExternalLinks(ext, balancer);
              } else {
                // нет ничего — возможно нужно дополнительный парсер (сервер)
                self.showError('На странице не найдено прямых ссылок. Нужен дополнительный парсер для этого сайта.');
              }
            } catch (e) {
              console.error('parse balancer html error', e);
              self.showError('Ошибка обработки ответа балансера');
            }
          }, function(err) {
            console.error('network error', err);
            self.showError('Сетевая ошибка: ' + (err && err.toString ? err.toString() : err));
          });
        } catch (err) {
          console.error('fetch exception', err);
          self.showError('Ошибка запроса');
        }
      };

      this.findExternalLinks = function(html, base) {
        try {
          var links = [];
          // 1) quick regex collect
          var m = html.match(/https?:\/\/[^\s"'<>]{20,300}/gi) || [];
          m = Array.from(new Set(m)).slice(0, 200);
          m.forEach(function(u) {
            // фильтруем (оставляем mp4/m3u8/embed/player/stream/video)
            if (u.match(/(\.m3u8|\.mp4|\/embed\/|\/player\/|\/stream\/|\/video\/)/i) || u.length < 200) {
              links.push(u);
            }
          });
          // 2) если DOM парсинг доступен, соберём iframe src
          try {
            var doc = (new DOMParser()).parseFromString(html, 'text/html');
            var ifr = doc.querySelectorAll('iframe');
            for (var i=0;i<ifr.length;i++){
              var s = ifr[i].getAttribute('src') || ifr[i].src || '';
              if (s) {
                if (s.indexOf('//') === 0) s = window.location.protocol + s;
                if (s.indexOf('http') !== 0 && base) {
                  try { s = (new URL(s, base)).href; } catch(e){ }
                }
                links.push(s);
              }
            }
          } catch(e){ /* ignore */ }
          links = Array.from(new Set(links)).filter(Boolean);
          return links;
        } catch (e) {
          console.warn('findExternalLinks error', e);
          return [];
        }
      };

      this.showExternalLinks = function(list, balancer) {
        var self = this;
        scroll.clear();
        scroll.append($('<div style="padding:16px 20px;font-weight:700;color:#fff;">Найденные внешние ссылки ('+list.length+')</div>'));
        list.forEach(function(u) {
          var el = $('<div class="selector" style="padding:12px;margin:8px 20px;border-radius:8px;background:rgba(255,255,255,0.02);cursor:pointer;"><div style="font-size:13px;color:#fff;word-break:break-all;">'+ (u.length>120 ? u.substring(0,120)+'...' : u) +'</div></div>');
          el.on('hover:enter', function() {
            // при выборе — попробуем загрузить страницу и извлечь поток
            self.tryExternalLink(u, balancer);
          });
          scroll.append(el);
        });
        this.addBackToMain();
      };

      this.tryExternalLink = function(url, balancer) {
        var self = this;
        scroll.clear();
        scroll.append($('<div style="padding:36px 20px;text-align:center;color:#bbb">Обрабатываем ссылку...</div>'));
        try {
          network.native(account(url), function(html) {
            try {
              if (!html || html.length < 50) {
                self.showError('Внешняя страница пустая или недоступна');
                return;
              }
              var video = extractVideoUrl(html, balancer.id);
              if (video) {
                if (video.indexOf('//') === 0) video = window.location.protocol + video;
                if (video.indexOf('http') !== 0) {
                  try { video = (new URL(video, url)).href; } catch(e){ }
                }
                self.showVideoCard(video, balancer);
              } else {
                // ничего найдено — показать ссылку как есть и возможность открыть
                self.showLinksFromPage(html, balancer, url);
              }
            } catch (e) {
              console.error('tryExternalLink parse error', e);
              self.showError('Ошибка обработки внешней ссылки');
            }
          }, function(err) {
            console.error('network error on external', err);
            self.showError('Ошибка сети при загрузке внешней ссылки');
          });
        } catch (e) {
          console.error('native exception', e);
          self.showError('Ошибка запроса внешней ссылки');
        }
      };

      this.showLinksFromPage = function(html, balancer, origin) {
        scroll.clear();
        scroll.append($('<div style="padding:16px 20px;font-weight:700;color:#fff;">Ссылки на странице</div>'));
        var all = this.findExternalLinks(html, origin || '');
        if (!all.length) {
          scroll.append($('<div style="padding:18px 20px;color:#999;">Не найдено подходящих ссылок.</div>'));
        } else {
          all.forEach(function(u) {
            var row = $('<div class="selector" style="padding:12px;margin:8px 20px;border-radius:8px;background:rgba(255,255,255,0.02);cursor:pointer;"><div style="font-size:13px;color:#fff;word-break:break-all;">'+ (u.length>120 ? u.substring(0,120)+'...' : u) +'</div></div>');
            row.on('hover:enter', function() {
              try { Lampa.Player.play({ url: u, title: (movie.title||movie.name||'Видео') }); } catch (e) { Lampa.Noty.show('Не удалось запустить ссылку'); }
            });
            scroll.append(row);
          });
        }
        this.addBackToMain();
      };

      this.showVideoCard = function(videoUrl, balancer) {
        var self = this;
        scroll.clear();
        var header = $('<div style="padding:18px 20px;"><div style="font-weight:700;color:#fff;">Видео найдено</div><div style="color:#aaa;margin-top:6px;">Источник: '+balancer.name+'</div></div>');
        scroll.append(header);

        var card = $('<div class="selector" style="padding:18px;margin:10px 20px;border-radius:10px;background:rgba(255,255,255,0.02);cursor:pointer;"></div>');
        card.append('<div style="font-weight:700;color:#fff;margin-bottom:8px;">'+(movie.title||movie.name||'Видео')+'</div>');
        card.append('<div style="color:#ccc;font-size:13px;word-break:break-all;margin-bottom:12px;">'+ (videoUrl.length>180?videoUrl.substring(0,180)+'...':videoUrl) +'</div>');
        var playBtn = $('<div style="background:#4CAF50;color:#fff;padding:12px;border-radius:8px;text-align:center;font-weight:700;">▶ Запустить</div>');
        card.append(playBtn);

        playBtn.on('hover:enter', function() {
          try {
            Lampa.Player.play({ url: videoUrl, title: (movie.title||movie.name||'Видео'), quality: { 'Auto': videoUrl } });
            // при успешном старте сохранить баланcер как дефолтный
            setDefaultBalancer(balancer.id);
          } catch (e) {
            console.error('Player.play error', e);
            Lampa.Noty.show('Ошибка запуска плеера');
          }
        });

        scroll.append(card);
        this.addBackToMain();
      };

      this.addBackToMain = function() {
        var self = this;
        var back = $('<div class="selector" style="padding:14px;margin:20px;border-radius:8px;background:rgba(255,255,255,0.04);text-align:center;font-weight:700;">← Назад</div>');
        back.on('hover:enter', function() { self.renderMain(); });
        scroll.append(back);
      };

      this.showError = function(msg) {
        scroll.clear();
        scroll.append($('<div style="padding:36px 20px;text-align:center;color:#f44336;font-weight:700;">Ошибка</div>'));
        scroll.append($('<div style="padding:6px 20px;color:#ddd;text-align:center;">'+ (msg || 'Неизвестная ошибка') +'</div>'));
        this.addDemoStreams();
        this.addBackToMain();
      };

      this.pause = function(){};
      this.stop = function(){};
      this.destroy = function() {
        try { network.clear(); } catch(e) {}
        try { scroll.destroy(); } catch(e) {}
      };
    } // end component

    // ---------- plugin registration & button addition ----------
    function initAndrozon() {
      console.log('Androzon init: register component');
      Lampa.Component.add('androzon', component);

      // Add button to full card (robust insertion)
      Lampa.Listener.follow('full', function(e) {
        if (e.type !== 'complite') return;
        try {
          var render = e.object.activity.render();
          var movie = e.data.movie;

          // remove duplicates
          render.find('.androzon-button').remove();

          // create button
          var btn = $('<div class="full-start__button selector androzon-button" style="background: linear-gradient(45deg,#FF6B35,#FF8E53);margin:6px;border-radius:8px;"><div style="padding:10px 16px;display:flex;align-items:center;justify-content:center;"><span style="margin-right:8px;">🎬</span><span style="font-weight:700;color:#fff;">Androzon</span></div></div>');
          btn.on('hover:enter', function() {
            Lampa.Activity.push({
              url: '',
              title: 'Androzon - ' + (movie.title || movie.name),
              component: 'androzon',
              movie: movie,
              page: 1
            });
          });

          // try several containers
          var placed = false;
          var torrentBtn = render.find('.view--torrent');
          var playBtn = render.find('.button--play');
          var buttonsContainer = render.find('.full-start__buttons');
          if (torrentBtn.length) { torrentBtn.after(btn); placed = true; }
          else if (playBtn.length) { playBtn.after(btn); placed = true; }
          else if (buttonsContainer.length) { buttonsContainer.prepend(btn); placed = true; }
          else {
            var cardActions = render.find('.full-actions, .full-start');
            if (cardActions.length) { cardActions.prepend(btn); placed = true; }
            else render.append(btn);
          }
          console.log('Androzon button added (placed=' + placed + ') for', movie.title || movie.name);
        } catch (err) {
          console.error('Androzon: add button error', err);
        }
      });

      console.log('Androzon v11 registered');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAndrozon);
    } else {
      initAndrozon();
    }

  } catch (err) {
    console.error('Androzon fatal error', err);
  }

})();

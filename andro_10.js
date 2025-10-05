(function() {
  'use strict';

  try {
    console.log('Androzon plugin starting...');

    if (typeof Lampa === 'undefined') {
      console.error('Lampa API not loaded');
      return;
    }

    // ---------- Network helper (works with Lampa.Reguest / Lampa.Request / fetch fallback) ----------
    function createNetwork() {
      var NetClass = (typeof Lampa.Reguest !== 'undefined' ? Lampa.Reguest : (typeof Lampa.Request !== 'undefined' ? Lampa.Request : null));
      if (NetClass) {
        try {
          return new NetClass();
        } catch (e) {
          console.warn('Network class construction failed, falling back to fetch', e);
        }
      }

      // minimal fallback "network" that uses fetch
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
                if (onError) onError(err.toString ? err.toString() : err);
              });
          } catch (err) {
            if (onError) onError(err.toString ? err.toString() : err);
          }
        },
        clear: function() {}
      };
    }

    var network = createNetwork();

    // ---------- Utility: safely append uid/ip/account params (optional) ----------
    function account(url) {
      try {
        if (!url || url.indexOf('http') !== 0) return url;
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

    // ---------- Robust video URL extractor ----------
    function extractVideoUrl(html, sourceId) {
      try {
        if (!html || typeof html !== 'string') return null;
        console.log('Extracting video for source:', sourceId);

        // Quick heuristic search first (fast)
        var quickPatterns = [
          /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/gi,
          /(https?:\/\/[^\s"']+\.mp4[^\s"']*)/gi,
          /(https?:\/\/[^\s"']+\/hls[^\s"']*)/gi,
          /(https?:\/\/[^\s"']+\/stream[^\s"']*)/gi,
          /(https?:\/\/[^\s"']+\/video[^\s"']*)/gi
        ];
        for (var i = 0; i < quickPatterns.length; i++) {
          var m = html.match(quickPatterns[i]);
          if (m && m.length) {
            console.log('Quick match found:', m[0]);
            return m[0];
          }
        }

        // Try to parse DOM if possible
        var parser, doc;
        try {
          parser = new DOMParser();
          doc = parser.parseFromString(html, 'text/html');
        } catch (e) {
          doc = null;
        }

        if (doc) {
          // 1) iframes
          var iframes = doc.querySelectorAll('iframe');
          for (var ii = 0; ii < iframes.length; ii++) {
            var src = iframes[ii].getAttribute('src') || iframes[ii].src || '';
            if (src && (src.indexOf('.m3u8') !== -1 || src.indexOf('.mp4') !== -1 || /\/(embed|player|stream)/i.test(src))) {
              console.log('Found iframe src ->', src);
              return src;
            }
          }

          // 2) common data attrs
          var dataEls = doc.querySelectorAll('[data-url], [data-src], [data-file], [data-video]');
          for (var di = 0; di < dataEls.length; di++) {
            var url = dataEls[di].getAttribute('data-url') || dataEls[di].getAttribute('data-src') || dataEls[di].getAttribute('data-file') || dataEls[di].getAttribute('data-video');
            if (url && url.indexOf('http') === 0) {
              console.log('Found video in data attr ->', url);
              return url;
            }
          }

          // 3) video / source tags
          var videos = doc.querySelectorAll('video>source, video');
          for (var v = 0; v < videos.length; v++) {
            var vsrc = videos[v].getAttribute('src') || videos[v].getAttribute('data-src') || '';
            if (vsrc && vsrc.indexOf('http') === 0) {
              console.log('Found <video> source ->', vsrc);
              return vsrc;
            }
          }

          // 4) inspect inline scripts (more carefully)
          var scripts = doc.querySelectorAll('script');
          for (var s = 0; s < scripts.length; s++) {
            var sc = scripts[s].textContent || scripts[s].innerText || '';
            if (!sc) continue;

            // patterns that extract 'file/url/src' key values
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
                console.log('Found video in script ->', found[1]);
                return found[1];
              } else if (found && found[0] && found[0].indexOf('http') === 0) {
                console.log('Found video in script (fallback) ->', found[0]);
                return found[0];
              }
            }
          }
        }

        // final fallback: regex on whole page again for any http...m3u8/mp4
        var final = html.match(/(https?:\/\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*)/i);
        if (final && final[0]) {
          console.log('Final regex fallback ->', final[0]);
          return final[0];
        }

        console.log('No video URL found');
        return null;
      } catch (err) {
        console.error('extractVideoUrl error', err);
        return null;
      }
    }

    // ---------- Main component ----------
    function component(object) {
      console.log('Androzon component created');

      var scroll = new Lampa.Scroll({ mask: true, over: true });
      var movie = object.movie || {};

      this.create = function() {
        return this.render();
      };

      this.render = function() {
        return scroll.render();
      };

      this.start = function() {
        this.initialize();
      };

      this.initialize = function() {
        scroll.body().addClass('torrent-list');
        this.showMainScreen();
        this.setupNavigation();
      };

      this.setupNavigation = function() {
        Lampa.Controller.add('content', {
          toggle: () => {
            Lampa.Controller.collectionSet(scroll.render());
            var firstSelector = scroll.render().find('.selector').first()[0];
            if (firstSelector) {
              Lampa.Controller.collectionFocus(firstSelector, scroll.render());
            }
          },
          up: () => {
            if (Navigator.canmove('up')) Navigator.move('up');
            else Lampa.Controller.toggle('head');
          },
          down: () => {
            if (Navigator.canmove('down')) Navigator.move('down');
          },
          left: () => {
            Lampa.Controller.toggle('menu');
          },
          back: () => {
            Lampa.Activity.backward();
          }
        });

        Lampa.Controller.toggle('content');
      };

      this.showMainScreen = function() {
        scroll.clear();

        var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
          '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">🎬 Androzon</div>' +
          '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">Выберите источник для поиска</div>' +
          '</div>');
        scroll.append(header);

        var sources = [
          {
            name: '🔍 Kinoger.com',
            id: 'kinoger',
            searchUrl: function(title) {
              // kinoger имеет форму /search/ в зависимости от структуры — возможно придётся подгонять
              return 'https://kinoger.com/stream/search/' + encodeURIComponent(title);
            },
            color: '#FF6B35',
            description: 'Прямой поиск фильмов'
          },
          {
            name: '🇩🇪 BS.to',
            id: 'bsto',
            searchUrl: function(title) {
              var cleanTitle = (title || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
              return 'https://bs.to/search?q=' + encodeURIComponent(title); // safer generic search
            },
            color: '#4A90E2',
            description: 'Немецкие сериалы'
          },
          {
            name: '🎥 Cine.to',
            id: 'cineto',
            searchUrl: function(title) {
              return 'https://cine.to/movies?q=' + encodeURIComponent(title);
            },
            color: '#50E3C2',
            description: 'Фильмы и сериалы'
          }
        ];

        sources.forEach(source => {
          var sourceElement = $('<div class="selector" style="padding: 20px; margin: 15px; background: ' + source.color + '; border-radius: 12px; cursor: pointer;">' +
            '<div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">' + source.name + '</div>' +
            '<div style="font-size: 12px; opacity: 0.9;">' + source.description + '</div>' +
            '</div>');

          sourceElement.on('hover:enter', () => {
            this.searchOnSource(source);
          });

          scroll.append(sourceElement);
        });

        // demo streams
        this.addDemoStreams();
      };

      this.searchOnSource = function(source) {
        scroll.clear();

        var loading = $('<div style="padding: 40px 20px; text-align: center;">' +
          '<div class="broadcast__scan" style="margin: 20px auto;"><div></div></div>' +
          '<div style="color: #999; font-size: 16px;">Ищем "' + (movie.title || movie.name || '') + '" на ' + source.name + '...</div>' +
          '</div>');
        scroll.append(loading);

        var searchTitle = movie.title || movie.name || 'film';
        var searchUrl = source.searchUrl(searchTitle);
        console.log('Fetching:', searchUrl);

        // use network.native with account wrapper
        try {
          var urlToFetch = account(searchUrl);
          network.native(urlToFetch, (html) => {
            try {
              if (html && html.length > 100) {
                this.processSearchResults(html, source);
              } else {
                this.showError('Страница не загрузилась или пустая');
              }
            } catch (e) {
              console.error('processSearchResults error', e);
              this.showError('Ошибка обработки страницы');
            }
          }, (err) => {
            console.error('Network error:', err);
            this.showError('Ошибка сети: ' + err);
          });
        } catch (e) {
          console.error('fetch exception', e);
          this.showError('Ошибка запроса');
        }
      };

      this.processSearchResults = function(html, source) {
        var videoUrl = extractVideoUrl(html, source.id);
        if (videoUrl) {
          // normalize some relative urls
          if (videoUrl.indexOf('//') === 0) videoUrl = window.location.protocol + videoUrl;
          if (videoUrl.indexOf('http') !== 0 && source && source.name && source.searchUrl) {
            // try to resolve relative URL by base
            try {
              var base = (new URL(source.searchUrl(''))).origin;
              videoUrl = new URL(videoUrl, base).href;
            } catch (e) {}
          }

          this.showVideoResult(videoUrl, source);
        } else {
          this.showLinksFromPage(html, source);
        }
      };

      this.showVideoResult = function(videoUrl, source) {
        scroll.clear();

        var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
          '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 5px; color: #4CAF50;">✅ Видео найдено!</div>' +
          '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">Источник: ' + source.name + '</div>' +
          '</div>');
        scroll.append(header);

        var videoCard = $('<div class="selector" style="padding: 25px; margin: 20px; background: rgba(76, 175, 80, 0.08); border: 2px solid #4CAF50; border-radius: 12px; cursor: pointer;">' +
          '<div style="font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #4CAF50;">🎬 ' + (movie.title || movie.name || 'Видео') + '</div>' +
          '<div style="font-size: 13px; color: #aaa; margin-bottom: 10px; word-break: break-all;">Ссылка: ' + (videoUrl.length > 160 ? videoUrl.substring(0, 160) + '...' : videoUrl) + '</div>' +
          '<div style="font-size: 12px; color: #888; margin-bottom: 20px;">Качество: Auto • Источник: ' + source.name + '</div>' +
          '<div style="background: #4CAF50; color: white; padding: 12px 25px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 16px;">▶ ЗАПУСТИТЬ ВИДЕО</div>' +
          '</div>');

        videoCard.on('hover:enter', () => {
          console.log('Playing video:', videoUrl);
          try {
            Lampa.Player.play({
              url: videoUrl,
              title: movie.title || movie.name || 'Видео',
              quality: { 'Auto': videoUrl }
            });
          } catch (err) {
            console.error('Player.play error', err);
            this.showError('Не удалось запустить плеер: ' + (err && err.message ? err.message : err));
          }
        });

        scroll.append(videoCard);
        this.addBackButton();
      };

      this.showLinksFromPage = function(html, source) {
        scroll.clear();

        var header = $('<div class="choice__head" style="padding: 20px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.2);">' +
          '<div class="choice__title" style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">🔗 Найдены ссылки</div>' +
          '<div class="choice__subtitle" style="font-size: 14px; color: #aaa;">' + source.name + ' — требуется обработка</div>' +
          '</div>');
        scroll.append(header);

        var info = $('<div style="padding: 20px; text-align: center; color: #ffa726;">' +
          '<div style="font-size: 16px; margin-bottom: 10px;">Страница загружена успешно!</div>' +
          '<div style="font-size: 14px; color: #aaa;">Нужен дополнительный парсер для обработки редиректов и JS-генерируемых ссылок.</div>' +
          '</div>');
        scroll.append(info);

        // Try to present all http(s) links (helpful fallback)
        try {
          var links = [];
          var matchAll = html.match(/https?:\/\/[^\s"'<>]{20,300}/gi) || [];
          matchAll = Array.from(new Set(matchAll)).slice(0, 50);
          matchAll.forEach(function(u) {
            // filter likely irrelevant (images, css) — keep mp4/m3u8 and anything with /embed/ or /player/
            if (u.match(/(\.m3u8|\.mp4|\/embed\/|\/player\/|\/stream\/|\/video\/)/i) || u.length < 200) {
              links.push(u);
            }
          });

          if (links.length) {
            links.forEach(function(l) {
              var row = $('<div class="selector" style="padding: 12px; margin: 8px 20px; background: rgba(255,255,255,0.04); border-radius: 8px;">' +
                '<div style="font-size: 12px; color: #ddd; word-break: break-all;">' + (l.length > 180 ? l.substring(0, 180) + '...' : l) + '</div>' +
                '</div>');
              row.on('hover:enter', function() {
                // try to play direct link
                Lampa.Player.play({ url: l, title: movie.title || movie.name || 'Ссылка', quality: { 'Auto': l } });
              });
              scroll.append(row);
            });
          } else {
            var none = $('<div style="padding:20px;color:#999;text-align:center;">Не найдено подходящих ссылок на странице.</div>');
            scroll.append(none);
          }
        } catch (e) {
          console.warn('links fallback error', e);
        }

        this.addDemoStreams();
        this.addBackButton();
      };

      this.addDemoStreams = function() {
        var demoHeader = $('<div style="padding: 20px 20px 10px 20px; font-size: 16px; font-weight: bold; color: #fff;">🎯 Попробуйте тестовые видео:</div>');
        scroll.append(demoHeader);

        var demoStreams = [
          { title: 'HLS пример 720p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', quality: '720p' },
          { title: 'MP4 пример 1080p', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', quality: '1080p' }
        ];

        demoStreams.forEach(stream => {
          var streamElement = $('<div class="selector" style="padding: 15px; margin: 10px 20px; background: rgba(255,255,255,0.06); border-radius: 8px; cursor: pointer;">' +
            '<div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">' + stream.title + '</div>' +
            '<div style="font-size: 11px; color: #aaa;">Качество: ' + stream.quality + '</div>' +
            '</div>');
          streamElement.on('hover:enter', () => {
            Lampa.Player.play({ url: stream.url, title: stream.title, quality: { [stream.quality]: stream.url } });
          });
          scroll.append(streamElement);
        });
      };

      this.addBackButton = function() {
        var backButton = $('<div class="selector" style="padding: 15px; margin: 20px; background: rgba(255,255,255,0.12); border-radius: 8px; text-align: center; font-weight: bold;">← Назад к источникам</div>');
        backButton.on('hover:enter', () => {
          this.showMainScreen();
        });
        scroll.append(backButton);
      };

      this.showError = function(message) {
        scroll.clear();
        var errorElement = $('<div style="padding: 40px 20px; text-align: center; color: #f44336;">' +
          '<div style="font-size: 24px; margin-bottom: 20px;">❌ Ошибка</div>' +
          '<div style="font-size: 16px; margin-bottom: 30px;">' + message + '</div>' +
          '</div>');
        scroll.append(errorElement);
        this.addDemoStreams();
        this.addBackButton();
      };

      this.pause = function() {};
      this.stop = function() {};
      this.destroy = function() {
        try { network.clear(); } catch (e) {}
        if (scroll && scroll.destroy) scroll.destroy();
      };
    }

    // ---------- plugin registration ----------
    function initAndrozon() {
      console.log('🚀 Initializing Androzon plugin...');

      // Register component
      Lampa.Component.add('androzon', component);
      console.log('✅ Androzon component registered');

      // Add button to full card
      Lampa.Listener.follow('full', function(e) {
        if (e.type === 'complite') {
          try {
            var activity = e.object.activity;
            var render = activity.render();
            var movie = e.data.movie;

            // remove existing
            render.find('.androzon-button').remove();

            var btn = $('<div class="full-start__button selector view--online androzon-button" style="background: linear-gradient(45deg, #FF6B35, #FF8E53); margin: 5px; border-radius: 8px;">' +
              '<div style="display: flex; align-items: center; justify-content: center; padding: 12px 20px;">' +
              '<span style="margin-right: 8px;">🎬</span>' +
              '<span style="font-weight: bold;">Androzon</span>' +
              '</div>' +
              '</div>');

            btn.on('hover:enter', function() {
              Lampa.Activity.push({
                url: '',
                title: 'Androzon - ' + (movie.title || movie.name),
                component: 'androzon',
                movie: movie,
                page: 1
              });
            });

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
            console.log('✅ Androzon button added for movie:', movie.title);
          } catch (error) {
            console.error('❌ Error adding button:', error);
          }
        }
      });

      console.log('✅ Androzon plugin fully initialized');
    }

    // init now
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAndrozon);
    } else {
      initAndrozon();
    }

  } catch (error) {
    console.error('💥 Androzon plugin fatal error:', error);
  }
})();

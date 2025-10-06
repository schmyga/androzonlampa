// andro_v16_fixed_search.js
(function() {
  'use strict';

  // === УМНЫЕ БАЛАНСЕРЫ С REZKA.AG ===
  const BALANCERS = {
    servers: [
      { 
        id: 'rezka', 
        title: 'Rezka.ag', 
        url: 'https://rezka.ag', 
        active: true,
        weight: 2,
        health: 'unknown',
        lastCheck: 0,
        searchPath: '/search/?do=search&subaction=search&q=',
        parser: 'rezka'
      },
      { 
        id: 'cine', 
        title: 'cine.to', 
        url: 'https://cine.to', 
        active: true,
        weight: 1,
        health: 'unknown',
        lastCheck: 0,
        searchPath: '/?s=',
        parser: 'generic'
      }
    ],
    currentIndex: 0,
    checkInterval: 30000,
    timeout: 10000
  };

  const PROXY = 'https://smotret24.ru/proxy?url=';

  // === КАСТОМНЫЙ ПОИСК (как в online_mod.js) ===
  function createSearchComponent(balancerItem, onSelect) {
    var component = {
      activity: null,
      scroll: null,
      input: null,
      last_query: ''
    };

    component.create = function() {
      this.scroll = new Lampa.Scroll({mask: true, over: true});
      return this.scroll.render();
    };

    component.start = function() {
      this.activity = Lampa.Activity.active();
      this.renderSearch();
    };

    component.renderSearch = function() {
      var that = this;
      this.scroll.reset();
      this.scroll.body().addClass('search--full');

      // Header с полем поиска
      var header = $('<div class="search--full__head"></div>');
      var back = $('<div class="search--full__back selector"><div class="search--full__back-icon"></div></div>');
      var field = $('<div class="search--full__field"><input type="text" placeholder="Поиск на ' + balancerItem.title + '" class="search--full__input"></div>');

      this.input = field.find('input');

      back.on('hover:enter', function() {
        Lampa.Activity.back();
      });

      this.input.on('keyup', function(e) {
        if (e.keyCode === 13) { // Enter
          that.search(this.value);
        }
      });

      this.input.on('input', function() {
        clearTimeout(that.search_timeout);
        that.search_timeout = setTimeout(function() {
          that.search(that.input.val());
        }, 500);
      });

      header.append(back);
      header.append(field);
      this.scroll.append(header);

      // Результаты
      this.results = $('<div class="search--full__results"></div>');
      this.scroll.append(this.results);

      // Фокус на поле ввода
      setTimeout(function() {
        that.input.focus();
      }, 100);

      Lampa.Controller.add('content', this);
      Lampa.Controller.collectionSet(this.scroll.body());
      Lampa.Controller.collectionFocus(false, this.scroll.body());
    };

    component.search = function(query) {
      var that = this;
      
      if (!query || query.length < 2) {
        this.results.html('<div class="search--full__empty">Введите минимум 2 символа</div>');
        return;
      }

      if (this.last_query === query) return;
      this.last_query = query;

      this.results.html('<div class="search--full__empty">Ищем "' + query + '" на ' + balancerItem.title + '...</div>');

      const searchUrl = balancerItem.url + balancerItem.searchPath + encodeURIComponent(query);
      const fetchUrl = PROXY + encodeURIComponent(searchUrl);

      network.native(account(fetchUrl), function(html) {
        try {
          if (!html || html.length < 100) {
            that.results.html('<div class="search--full__empty">Ничего не найдено</div>');
            return;
          }

          let results = [];
          
          if (balancerItem.parser === 'rezka') {
            results = RezkaParser.parseSearchResults(html, balancerItem.url);
          } else {
            results = that.parseGenericSearchResults(html, balancerItem.url);
          }

          if (results.length === 0) {
            that.results.html('<div class="search--full__empty">Ничего не найдено</div>');
            return;
          }

          that.showResults(results, query);
          
        } catch (error) {
          console.error('Search error:', error);
          that.results.html('<div class="search--full__empty">Ошибка поиска</div>');
        }
      }, function(err) {
        console.error('Search network error:', err);
        that.results.html('<div class="search--full__empty">Ошибка сети</div>');
      });
    };

    component.parseGenericSearchResults = function(html, baseUrl) {
      const results = [];
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        const selectors = ['.movie-item', '.film-item', '.search-result', '.item', 'article', '.movie'];
        
        let items = [];
        selectors.forEach(selector => {
          const found = doc.querySelectorAll(selector);
          if (found.length > 0) items = found;
        });

        items.forEach(item => {
          try {
            const linkEl = item.querySelector('a');
            const titleEl = item.querySelector('h2, h3, .title, .name');
            const posterEl = item.querySelector('img');
            
            if (linkEl) {
              const title = titleEl ? titleEl.textContent.trim() : linkEl.textContent.trim();
              let link = linkEl.getAttribute('href');
              const poster = posterEl ? (posterEl.getAttribute('src') || posterEl.getAttribute('data-src')) : '';
              
              if (link && !link.startsWith('http')) {
                link = new URL(link, baseUrl).href;
              }
              
              if (title && link) {
                results.push({
                  title: title,
                  link: link,
                  poster: poster,
                  info: '',
                  type: 'unknown'
                });
              }
            }
          } catch(e) {
            console.warn('Error parsing item:', e);
          }
        });

      } catch(error) {
        console.error('Parser error:', error);
      }
      
      return results;
    };

    component.showResults = function(results, query) {
      var that = this;
      this.results.empty();

      if (results.length === 0) {
        this.results.html('<div class="search--full__empty">Ничего не найдено</div>');
        return;
      }

      results.forEach(function(item) {
        var card = $('<div class="search--full__item selector"></div>');
        
        var content = $('<div class="search--full__item-content"></div>');
        
        if (item.poster) {
          var poster = $('<div class="search--full__item-poster"><img src="' + item.poster + '"></div>');
          content.append(poster);
        }
        
        var info = $('<div class="search--full__item-info"></div>');
        info.append('<div class="search--full__item-title">' + item.title + '</div>');
        
        if (item.info) {
          info.append('<div class="search--full__item-desc">' + item.info + '</div>');
        }
        
        content.append(info);
        card.append(content);
        
        card.on('hover:enter', function() {
          if (onSelect) {
            onSelect(item, balancerItem);
          }
        });
        
        that.results.append(card);
      });
    };

    component.pause = function() {};
    component.stop = function() {};
    component.destroy = function() {
      if (this.scroll) this.scroll.destroy();
    };

    return component;
  }

  // === ПАРСЕР ДЛЯ REZKA.AG ===
  const RezkaParser = {
    parseSearchResults: function(html, baseUrl) {
      try {
        const results = [];
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        const items = doc.querySelectorAll('.b-content__inline_item, .b-content__inline-item, .search-results__item');
        
        items.forEach(item => {
          try {
            const linkEl = item.querySelector('a');
            const titleEl = item.querySelector('.b-content__inline_item-link a, .search-results__item-link');
            const posterEl = item.querySelector('img');
            const infoEl = item.querySelector('.b-content__inline_item-list, .search-results__item-info');
            
            if (linkEl && titleEl) {
              const title = titleEl.textContent.trim();
              let link = linkEl.getAttribute('href');
              const poster = posterEl ? (posterEl.getAttribute('src') || posterEl.getAttribute('data-src')) : '';
              const info = infoEl ? infoEl.textContent.trim() : '';
              
              if (link && !link.startsWith('http')) {
                link = new URL(link, baseUrl).href;
              }
              
              if (title && link) {
                results.push({
                  title: title,
                  link: link,
                  poster: poster,
                  info: info,
                  type: this.detectContentType(title, info)
                });
              }
            }
          } catch(e) {
            console.warn('Error parsing Rezka item:', e);
          }
        });
        
        if (results.length === 0) {
          const allLinks = doc.querySelectorAll('a');
          allLinks.forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent.trim();
            if (href && text && (href.includes('/films/') || href.includes('/series/'))) {
              if (text.length > 2 && !results.find(r => r.link === href)) {
                results.push({
                  title: text,
                  link: href.startsWith('http') ? href : new URL(href, baseUrl).href,
                  poster: '',
                  info: '',
                  type: 'unknown'
                });
              }
            }
          });
        }
        
        return results;
      } catch (error) {
        console.error('Rezka parse error:', error);
        return [];
      }
    },

    parseVideoPage: function(html, pageUrl) {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        const iframe = doc.querySelector('#video-player iframe, .b-post__video iframe, iframe[src*="voidboost"]');
        if (iframe) {
          const src = iframe.getAttribute('src');
          if (src && src.includes('voidboost')) {
            return src;
          }
        }
        
        const scripts = doc.querySelectorAll('script');
        for (let script of scripts) {
          const text = script.textContent;
          if (text.includes('voidboost') || text.includes('videojs')) {
            const match = text.match(/\{[\s\S]*?"url":"[^"]*voidboost[^"]*"[\s\S]*?\}/);
            if (match) {
              try {
                const data = JSON.parse(match[0]);
                if (data.url) return data.url;
              } catch(e) {}
            }
            
            const urlMatch = text.match(/(https?:\\?\/\\?\/[^"']*voidboost[^"']*)/);
            if (urlMatch) {
              return urlMatch[1].replace(/\\\//g, '/');
            }
          }
        }
        
        return null;
      } catch (error) {
        console.error('Rezka video parse error:', error);
        return null;
      }
    },

    detectContentType: function(title, info) {
      if (info && (info.includes('сериал') || info.includes('сезон'))) return 'series';
      if (title && (title.includes('сезон') || title.includes('серия'))) return 'series';
      return 'movie';
    }
  };

  // === СЕТЕВОЙ СЛОЙ ===
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

  // === ИЗВЛЕКАТЕЛЬ ВИДЕО ===
  function extractVideoUrl(html, base) {
    try {
      if (!html) return null;

      const directMatches = html.match(/(https?:\/\/[^\s"'<>]+?\.(?:m3u8|mp4|mkv|avi)[^\s"'<>]*)/gi) || [];
      for (let match of directMatches) {
        if (match.includes('m3u8') || match.includes('mp4')) {
          return match;
        }
      }

      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeMatch && iframeMatch[1]) {
        let src = iframeMatch[1];
        if (src.startsWith('//')) src = 'https:' + src;
        if (!src.startsWith('http') && base) {
          try { src = new URL(src, base).href; } catch(e) {}
        }
        
        if (src.includes('voidboost')) {
          return src;
        }
        
        return src;
      }

      if (html.includes('voidboost')) {
        const voidboostMatch = html.match(/(https?:\\?\/\\?\/[^"']*voidboost[^"']*)/);
        if (voidboostMatch) {
          return voidboostMatch[1].replace(/\\\//g, '/');
        }
      }

      return null;
    } catch (err) {
      console.error('extractVideoUrl error', err);
      return null;
    }
  }

  // === ОСНОВНОЙ КОМПОНЕНТ ANDROZON ===
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

      // Header
      var header = $('<div style="display:flex;padding:16px;gap:14px;align-items:center;"></div>');
      var posterUrl = movie.poster_path ? Lampa.TMDB.image('t/p/w300' + movie.poster_path) : (movie.img || '');
      var poster = $('<div style="width:130px;height:190px;background:#111;border-radius:8px;overflow:hidden;"></div>');
      if (posterUrl) {
        var img = $('<img style="width:100%;height:100%;object-fit:cover;">').attr('src', posterUrl);
        poster.append(img);
      } else {
        poster.append($('<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#777">No poster</div>'));
      }
      
      var info = $('<div style="flex:1;"></div>');
      info.append('<div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:6px;">' + (movie.title || movie.name || '') + '</div>');
      info.append('<div style="color:#bbb;font-size:13px;">' + ((movie.overview && movie.overview.slice(0,200)) || '') + '</div>');

      header.append(poster).append(info);
      scroll.append(header);

      // Balancers list
      scroll.append($('<div style="padding:12px 16px;color:#ddd;font-weight:600;">Выберите источник для поиска</div>'));
      
      BALANCERS.servers.forEach((balancerItem) => {
        var el = $('<div class="selector" style="padding:14px;margin:8px 16px;border-radius:10px;background:rgba(255,255,255,0.02);display:flex;justify-content:space-between;align-items:center;cursor:pointer;"></div>');
        
        const status = '🟢'; // Упрощаем без health checks для демо
        
        el.append(`<div><div style="font-weight:700;color:#fff;">${status} ${balancerItem.title}</div><div style="font-size:12px;color:#bbb;">Нажмите ENTER для поиска</div></div>`);
        el.append('<div style="color:#fff;font-size:12px;">' + (balancerItem.weight > 1 ? '🔥' : '') + '</div>');
        
        el.on('hover:enter', function(){
          that.startSearchOnBalancer(balancerItem);
        });
        
        el.on('hover:focus', function(e){ last = e.target; });
        scroll.append(el);
      });

      Lampa.Controller.enable('content');
    };

    this.startSearchOnBalancer = function(balancerItem) {
      var that = this;
      
      var searchComponent = createSearchComponent(balancerItem, function(selectedItem, balancer) {
        // Обработка выбора результата поиска
        that.showMoviePage(balancer, selectedItem);
      });

      Lampa.Activity.push({
        url: '',
        title: 'Поиск на ' + balancerItem.title,
        component: searchComponent,
        search: true
      });
    };

    this.showMoviePage = function(balancerItem, movieItem) {
      var that = this;
      scroll.clear();
      
      var header = $('<div style="padding:16px;"></div>');
      header.append('<div style="font-weight:700;color:#fff;font-size:18px;margin-bottom:8px;">'+movieItem.title+'</div>');
      if (movieItem.poster) {
        header.append('<div style="margin-bottom:12px;"><img src="'+movieItem.poster+'" style="width:120px;height:auto;border-radius:6px;"/></div>');
      }
      if (movieItem.info) {
        header.append('<div style="color:#bbb;font-size:13px;margin-bottom:12px;">'+movieItem.info+'</div>');
      }
      scroll.append(header);

      var watch = $('<div class="selector" style="padding:14px;margin:8px 16px;border-radius:8px;background:#FF6B35;color:#fff;text-align:center;font-weight:700;cursor:pointer;">🎬 Смотреть на '+balancerItem.title+'</div>');
      watch.on('hover:enter', function(){
        that.playFromMoviePage(balancerItem, movieItem);
      });
      scroll.append(watch);

      var back = $('<div class="selector" style="padding:12px;margin:16px;border-radius:8px;background:rgba(255,255,255,0.02);text-align:center;cursor:pointer;">← Назад</div>');
      back.on('hover:enter', function(){ that.initialize(); });
      scroll.append(back);
    };

    this.playFromMoviePage = function(balancerItem, movieItem) {
      var that = this;
      var fetchUrl = PROXY + encodeURIComponent(movieItem.link);
      Lampa.Noty.show('Загружаю страницу плеера...');

      network.native(account(fetchUrl), function(html) {
        try {
          if (!html || html.length < 100) {
            Lampa.Noty.show('Нет содержимого страницы');
            return;
          }

          let videoUrl = null;

          if (balancerItem.parser === 'rezka') {
            videoUrl = RezkaParser.parseVideoPage(html, movieItem.link);
          }

          if (!videoUrl) {
            videoUrl = extractVideoUrl(html, movieItem.link);
          }

          if (videoUrl) {
            Lampa.Noty.show('Видео найдено, запускаю плеер 🎬');
            Lampa.Player.play({ 
              url: videoUrl, 
              title: movieItem.title, 
              quality: { 'Auto': videoUrl } 
            });
          } else {
            Lampa.Noty.show('Не удалось найти видео ссылку');
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

    this.pause = function(){};
    this.stop = function(){};
    this.destroy = function() {
      try { network.clear(); } catch(e) {}
      try { scroll.destroy(); } catch(e) {}
    };
  }

  // === ИНИЦИАЛИЗАЦИЯ ===
  function init() {
    console.log('🎯 Androzon Fixed Search v16 initialized');

    try { 
      Lampa.Component.add('androzon', component); 
    } catch(e){ 
      console.error('Component.add error', e); 
    }

    // Добавление кнопки
    Lampa.Listener.follow('full', function(e) {
      if (e.type !== 'complite') return;
      try {
        var render = e.object.activity.render();
        var movie = e.data.movie;
        
        render.find('.androzon-button').remove();

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
      } catch(err) {
        console.error('Add button error', err);
      }
    });
  }

  // Запуск
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

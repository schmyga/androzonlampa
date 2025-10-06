// andro_v16_rezka.js
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
        weight: 2, // Высокий приоритет
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
      },
      { 
        id: 'kinoger', 
        title: 'kinoger', 
        url: 'https://kinoger.com', 
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

  // === ПАРСЕР ДЛЯ REZKA.AG ===
  const RezkaParser = {
    // Парсинг результатов поиска Rezka
    parseSearchResults: function(html, baseUrl) {
      try {
        const results = [];
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        // Ищем карточки контента на Rezka
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
              
              // Преобразуем относительные ссылки в абсолютные
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
        
        // Fallback: поиск по всем ссылкам
        if (results.length === 0) {
          const allLinks = doc.querySelectorAll('a');
          allLinks.forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent.trim();
            if (href && text && href.includes('/films/') || href.includes('/series/')) {
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
        console.error('Rezka parseSearchResults error:', error);
        return [];
      }
    },

    // Парсинг страницы с видео Rezka
    parseVideoPage: function(html, pageUrl) {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        // Ищем iframe с видео
        const iframe = doc.querySelector('#video-player iframe, .b-post__video iframe, iframe[src*="voidboost"]');
        if (iframe) {
          const src = iframe.getAttribute('src');
          if (src && src.includes('voidboost')) {
            return this.extractFromVoidboost(src);
          }
        }
        
        // Ищем скрипты с видео данными
        const scripts = doc.querySelectorAll('script');
        for (let script of scripts) {
          const text = script.textContent;
          if (text.includes('voidboost') || text.includes('videojs')) {
            // Парсим JSON данные
            const match = text.match(/\{[\s\S]*?"url":"[^"]*voidboost[^"]*"[\s\S]*?\}/);
            if (match) {
              try {
                const data = JSON.parse(match[0]);
                if (data.url) return data.url;
              } catch(e) {}
            }
            
            // Ищем прямые ссылки
            const urlMatch = text.match(/(https?:\\?\/\\?\/[^"']*voidboost[^"']*)/);
            if (urlMatch) {
              return urlMatch[1].replace(/\\\//g, '/');
            }
          }
        }
        
        return null;
      } catch (error) {
        console.error('Rezka parseVideoPage error:', error);
        return null;
      }
    },

    extractFromVoidboost: function(voidboostUrl) {
      // Для voidboost нужно использовать специальный парсер
      // Возвращаем оригинальную ссылку для дальнейшей обработки
      return voidboostUrl;
    },

    detectContentType: function(title, info) {
      if (info && (info.includes('сериал') || info.includes('сезон'))) return 'series';
      if (title && (title.includes('сезон') || title.includes('серия'))) return 'series';
      return 'movie';
    }
  };

  // === КЛАСС УМНОГО БАЛАНСЕРА ===
  class SmartBalancer {
    constructor() {
      this.servers = BALANCERS.servers;
      this.healthyServers = [];
      this.isChecking = false;
      this.init();
    }

    init() {
      console.log('🚀 Smart Balancer with Rezka initialized');
      this.startHealthMonitoring();
      this.createStatusPanel();
    }

    // Мониторинг здоровья серверов
    startHealthMonitoring() {
      if (this.isChecking) return;
      this.isChecking = true;

      const checkServer = async (server) => {
        try {
          const testUrl = server.url + '/';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), BALANCERS.timeout);

          const response = await fetch(PROXY + encodeURIComponent(testUrl), {
            method: 'HEAD',
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.status === 200 || response.status === 404) {
            server.health = 'healthy';
            server.lastCheck = Date.now();
            if (!this.healthyServers.find(s => s.id === server.id)) {
              this.healthyServers.push(server);
            }
            console.log(`✅ ${server.title} is healthy`);
          } else {
            this.markServerUnhealthy(server);
          }
        } catch (error) {
          console.warn(`❌ ${server.title} health check failed:`, error.message);
          this.markServerUnhealthy(server);
        }
      };

      const promises = this.servers
        .filter(server => server.active)
        .map(server => checkServer(server));

      Promise.allSettled(promises).then(() => {
        this.isChecking = false;
        this.updateStatusPanel();
        setTimeout(() => this.startHealthMonitoring(), BALANCERS.checkInterval);
      });
    }

    markServerUnhealthy(server) {
      server.health = 'unhealthy';
      server.lastCheck = Date.now();
      const index = this.healthyServers.findIndex(s => s.id === server.id);
      if (index > -1) {
        this.healthyServers.splice(index, 1);
      }
    }

    // Получение лучшего сервера (с учетом весов)
    getBestServer() {
      if (this.healthyServers.length > 0) {
        // Сортируем по весу (приоритету)
        const sortedServers = [...this.healthyServers].sort((a, b) => b.weight - a.weight);
        return sortedServers[0];
      }
      
      // Fallback на любой активный сервер
      const activeServer = this.servers.find(s => s.active);
      return activeServer || this.servers[0];
    }

    // Получение сервера по ID
    getServerById(id) {
      return this.servers.find(s => s.id === id);
    }

    // Панель статуса балансеров
    createStatusPanel() {
      if (document.getElementById('balancer-status-panel')) return;

      const panel = document.createElement('div');
      panel.id = 'balancer-status-panel';
      panel.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        background: rgba(0,0,0,0.95);
        color: white;
        padding: 12px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 11px;
        z-index: 9998;
        border: 1px solid #333;
        max-width: 300px;
        max-height: 250px;
        overflow-y: auto;
        display: none;
      `;

      panel.innerHTML = `
        <div style="margin-bottom: 8px; font-weight: bold; color: #FF6B35;">
          🚀 Androzon Balancers
        </div>
        <div id="balancer-servers-list"></div>
        <div style="margin-top: 8px; font-size: 10px; color: #bbb;">
          Healthy: <span id="healthy-count">0</span>/${this.servers.length}
          <br>Press Ctrl+B to toggle
        </div>
        <button id="refresh-balancers" style="margin-top: 6px; padding: 4px 8px; background: #FF6B35; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 10px;">
          🔄 Refresh Status
        </button>
      `;

      document.body.appendChild(panel);
      this.setupPanelEvents();
    }

    setupPanelEvents() {
      document.getElementById('refresh-balancers').addEventListener('click', () => {
        this.startHealthMonitoring();
      });

      // Показ/скрытие панели по Ctrl+B
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'b') {
          const panel = document.getElementById('balancer-status-panel');
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
      });
    }

    updateStatusPanel() {
      const listEl = document.getElementById('balancer-servers-list');
      const countEl = document.getElementById('healthy-count');

      if (listEl && countEl) {
        countEl.textContent = this.healthyServers.length;

        const serversHtml = this.servers.map(server => {
          const status = server.health === 'healthy' ? '🟢' : 
                        server.health === 'unhealthy' ? '🔴' : '⚪';
          const weight = server.weight > 1 ? ` (priority: ${server.weight})` : '';
          return `<div style="margin: 3px 0; color: ${server.health === 'healthy' ? '#4CAF50' : '#ff4444'}">
            ${status} <strong>${server.title}</strong>${weight}
          </div>`;
        }).join('');

        listEl.innerHTML = serversHtml;
      }
    }
  }

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
  var balancer = new SmartBalancer();

  // === УЛУЧШЕННЫЙ ИЗВЛЕКАТЕЛЬ ВИДЕО ===
  function extractVideoUrl(html, base) {
    try {
      if (!html) return null;

      // Приоритет 1: Прямые ссылки на видео
      const directMatches = html.match(/(https?:\/\/[^\s"'<>]+?\.(?:m3u8|mp4|mkv|avi)[^\s"'<>]*)/gi) || [];
      for (let match of directMatches) {
        if (match.includes('m3u8') || match.includes('mp4')) {
          return match;
        }
      }

      // Приоритет 2: Iframe src (особенно для Rezka)
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeMatch && iframeMatch[1]) {
        let src = iframeMatch[1];
        if (src.startsWith('//')) src = 'https:' + src;
        if (!src.startsWith('http') && base) {
          try { src = new URL(src, base).href; } catch(e) {}
        }
        
        // Если это voidboost от Rezka
        if (src.includes('voidboost')) {
          return this.processVoidboostLink(src);
        }
        
        return src;
      }

      // Приоритет 3: Rezka специфичные данные
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

  function processVoidboostLink(voidboostUrl) {
    // Обработка ссылок voidboost (может потребоваться дополнительный парсинг)
    return voidboostUrl;
  }

  // === КОМПОНЕНТ ANDROZON С ПОДДЕРЖКОЙ REZKA ===
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
      scroll.append($('<div style="padding:12px 16px;color:#ddd;font-weight:600;">Умные балансеры (Rezka.ag приоритет)</div>'));
      
      BALANCERS.servers.forEach((balancerItem) => {
        var el = $('<div class="selector" style="padding:14px;margin:8px 16px;border-radius:10px;background:rgba(255,255,255,0.02);display:flex;justify-content:space-between;align-items:center;cursor:pointer;"></div>');
        
        const status = balancerItem.health === 'healthy' ? '🟢' : 
                     balancerItem.health === 'unhealthy' ? '🔴' : '⚪';
        const priority = balancerItem.weight > 1 ? ' 🔥' : '';
        
        el.append(`<div><div style="font-weight:700;color:#fff;">${status} ${balancerItem.title}${priority}</div><div style="font-size:12px;color:#bbb;">${balancerItem.health || 'checking...'}</div></div>`);
        el.append('<div style="color:#fff;font-size:12px;">' + (balancerItem.id === 'rezka' ? 'Высокий приоритет' : '') + '</div>');
        
        el.on('hover:enter', function(){
          if (!balancerItem.active) { 
            Lampa.Noty.show('Балансер временно неактивен'); 
            return; 
          }
          that.searchOnBalancer(balancerItem);
        });
        
        el.on('hover:focus', function(e){ last = e.target; });
        scroll.append(el);
      });

      // Автовыбор лучшего балансера
      setTimeout(() => {
        const bestServer = balancer.getBestServer();
        if (bestServer) {
          Lampa.Noty.show(`Автовыбор: ${bestServer.title} ${bestServer.weight > 1 ? '(приоритетный)' : ''}`);
        }
      }, 1500);

      Lampa.Controller.enable('content');
    };

    this.searchOnBalancer = function(balancerItem) {
      var that = this;
      
      Lampa.Search.start({
        title: 'Поиск на ' + balancerItem.title,
        onSearch: function(q) {
          if (!q) return;
          
          const searchUrl = balancerItem.url + balancerItem.searchPath + encodeURIComponent(q);
          const fetchUrl = PROXY + encodeURIComponent(searchUrl);
          
          Lampa.Noty.show(`🔍 Ищем "${q}" на ${balancerItem.title}...`);
          
          network.native(account(fetchUrl), function(html) {
            try {
              if (!html || html.length < 100) {
                Lampa.Noty.show('Пустой ответ от сервера');
                return;
              }

              let results = [];
              
              // Используем специальный парсер для Rezka
              if (balancerItem.parser === 'rezka') {
                results = RezkaParser.parseSearchResults(html, balancerItem.url);
              } else {
                // Общий парсер для других сайтов
                results = that.parseGenericSearchResults(html, balancerItem.url);
              }

              if (results.length === 0) {
                Lampa.Noty.show('Ничего не найдено');
                return;
              }

              that.showResultsPanel(balancerItem, results, q);
              
            } catch (error) {
              console.error('Search results parsing error:', error);
              Lampa.Noty.show('Ошибка обработки результатов');
            }
          }, function(err) {
            console.error('Search network error:', err);
            Lampa.Noty.show('Ошибка сети при поиске');
            
            // Автоматическое переключение на другой сервер
            const fallbackServer = balancer.servers.find(s => s.id !== balancerItem.id && s.active);
            if (fallbackServer) {
              Lampa.Noty.show(`Пробую ${fallbackServer.title}...`);
              that.searchOnBalancer(fallbackServer);
            }
          });
        }
      });
    };

    this.parseGenericSearchResults = function(html, baseUrl) {
      const results = [];
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        // Общие селекторы для киносайтов
        const selectors = [
          '.movie-item', '.film-item', '.search-result', '.item',
          'article', '.b-content__inline_item', '.movie'
        ];
        
        let items = [];
        selectors.forEach(selector => {
          const found = doc.querySelectorAll(selector);
          if (found.length > 0) {
            items = found;
          }
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
            console.warn('Error parsing search item:', e);
          }
        });

      } catch(error) {
        console.error('Generic parser error:', error);
      }
      
      return results;
    };

    // ... остальные методы (showResultsPanel, showMoviePage, playFromMoviePage и т.д.)
    // остаются аналогичными предыдущей версии, но с улучшенной обработкой Rezka

    this.showResultsPanel = function(balancerItem, items, query) {
      var that = this;
      scroll.clear();
      
      var header = $('<div style="padding:12px 16px;color:#fff;font-weight:700;">Результаты по запросу: "' + query + '"</div>');
      scroll.append(header);

      items.forEach(function(it){
        var card = $('<div class="selector" style="display:flex;gap:12px;padding:12px;margin:8px 16px;border-radius:8px;background:rgba(255,255,255,0.02);align-items:center;cursor:pointer;"></div>');
        var img = $('<div style="width:80px;height:55px;background:#222;border-radius:6px;overflow:hidden;"></div>');
        if (it.poster) {
          img.append('<img src="'+it.poster+'" style="width:100%;height:100%;object-fit:cover;">');
        }
        var info = $('<div style="flex:1;"></div>');
        info.append('<div style="font-weight:700;color:#fff;">'+it.title+'</div>');
        if (it.info) {
          info.append('<div style="font-size:12px;color:#bbb;">'+it.info+'</div>');
        }
        info.append('<div style="font-size:11px;color:#888;margin-top:4px;">'+(it.link.length>60? it.link.slice(0,60)+'...':it.link)+'</div>');
        card.append(img).append(info);

        card.on('hover:enter', function() {
          that.showMoviePage(balancerItem, it);
        });
        scroll.append(card);
      });

      // back
      var back = $('<div class="selector" style="padding:12px;margin:16px;border-radius:8px;background:rgba(255,255,255,0.02);text-align:center;cursor:pointer;">← Назад к балансерам</div>');
      back.on('hover:enter', function(){ that.initialize(); });
      scroll.append(back);
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

      var back = $('<div class="selector" style="padding:12px;margin:16px;border-radius:8px;background:rgba(255,255,255,0.02);text-align:center;cursor:pointer;">← Назад к результатам</div>');
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

          // Специальная обработка для Rezka
          if (balancerItem.parser === 'rezka') {
            videoUrl = RezkaParser.parseVideoPage(html, movieItem.link);
          }

          // Общий парсер если Rezka не нашел
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
            // Можно добавить fallback на другие методы
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
    console.log('🎯 Androzon with Rezka.ag v16 initialized');

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

        var btn = $('<div class="full-start__button selector androzon-button" style="background: linear-gradient(45deg,#FF6B35,#FF8E53); margin:6px; border-radius:8px;"><div style="padding:10px 16px;display:flex;align-items:center;justify-content:center;"><span style="margin-right:8px;">🔥</span><span style="font-weight:700;color:#fff;">Androzon Pro</span></div></div>');
        
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

// andro_v16_improved.js
(function() {
  'use strict';

  // === УМНЫЕ БАЛАНСЕРЫ ===
  const BALANCERS = {
    servers: [
      { 
        id: 'cine', 
        title: 'cine.to', 
        url: 'https://cine.to', 
        active: true,
        weight: 1,
        health: 'unknown',
        lastCheck: 0
      },
      { 
        id: 'kinoger', 
        title: 'kinoger', 
        url: 'https://kinoger.com', 
        active: true,
        weight: 1,
        health: 'unknown',
        lastCheck: 0
      },
      { 
        id: 'movie4k', 
        title: 'movie4k', 
        url: 'https://movie4k.to', 
        active: true,
        weight: 1,
        health: 'unknown',
        lastCheck: 0
      }
    ],
    currentIndex: 0,
    checkInterval: 30000,
    timeout: 10000
  };

  const PROXY = 'https://smotret24.ru/proxy?url=';

  // === КЛАСС УМНОГО БАЛАНСЕРА ===
  class SmartBalancer {
    constructor() {
      this.servers = BALANCERS.servers;
      this.healthyServers = [];
      this.isChecking = false;
      this.init();
    }

    init() {
      console.log('🚀 Smart Balancer initialized');
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

      // Проверяем все активные серверы
      const promises = this.servers
        .filter(server => server.active)
        .map(server => checkServer(server));

      Promise.allSettled(promises).then(() => {
        this.isChecking = false;
        this.updateStatusPanel();
        
        // Планируем следующую проверку
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

    // Получение лучшего сервера
    getBestServer() {
      if (this.healthyServers.length > 0) {
        // Round-robin среди здоровых серверов
        const server = this.healthyServers[BALANCERS.currentIndex % this.healthyServers.length];
        BALANCERS.currentIndex = (BALANCERS.currentIndex + 1) % this.healthyServers.length;
        return server;
      }
      
      // Fallback на любой активный сервер
      const activeServer = this.servers.find(s => s.active);
      return activeServer || this.servers[0];
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
        max-width: 280px;
        max-height: 200px;
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
        </div>
        <button id="refresh-balancers" style="margin-top: 6px; padding: 4px 8px; background: #FF6B35; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 10px;">
          🔄 Refresh
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
          const active = server.active ? '' : ' (inactive)';
          return `<div style="margin: 2px 0; color: ${server.health === 'healthy' ? '#4CAF50' : '#ff4444'}">
            ${status} ${server.title}${active}
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

      // Приоритет 2: Iframe src
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeMatch && iframeMatch[1]) {
        let src = iframeMatch[1];
        if (src.startsWith('//')) src = 'https:' + src;
        if (!src.startsWith('http') && base) {
          try { src = new URL(src, base).href; } catch(e) {}
        }
        return src;
      }

      // Приоритет 3: Data атрибуты
      const dataAttrs = ['data-url', 'data-src', 'data-file', 'data-video'];
      for (let attr of dataAttrs) {
        const regex = new RegExp(`${attr}=["']([^"']+)["']`, 'i');
        const match = html.match(regex);
        if (match && match[1] && (match[1].includes('m3u8') || match[1].includes('mp4'))) {
          return match[1];
        }
      }

      // Приоритет 4: JSON в скриптах
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let scriptMatch;
      while ((scriptMatch = scriptRegex.exec(html)) !== null) {
        const scriptContent = scriptMatch[1];
        const jsonMatches = scriptContent.match(/(https?:\/\/[^\s"']+?\.(?:m3u8|mp4)[^\s"']*)/gi);
        if (jsonMatches) {
          for (let url of jsonMatches) {
            if (url.includes('m3u8') || url.includes('mp4')) return url;
          }
        }
      }

      return null;
    } catch (err) {
      console.error('extractVideoUrl error', err);
      return null;
    }
  }

  // === КОМПОНЕНТ ANDROZON ===
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
      scroll.append($('<div style="padding:12px 16px;color:#ddd;font-weight:600;">Умные балансеры</div>'));
      
      BALANCERS.servers.forEach((balancerItem, index) => {
        var el = $('<div class="selector" style="padding:14px;margin:8px 16px;border-radius:10px;background:rgba(255,255,255,0.02);display:flex;justify-content:space-between;align-items:center;cursor:pointer;"></div>');
        
        const status = balancerItem.health === 'healthy' ? '🟢' : 
                     balancerItem.health === 'unhealthy' ? '🔴' : '⚪';
        
        el.append(`<div><div style="font-weight:700;color:#fff;">${status} ${balancerItem.title}</div><div style="font-size:12px;color:#bbb;">${balancerItem.health || 'checking...'}</div></div>`);
        el.append('<div style="color:#fff;font-size:12px;">' + (index === 0 ? 'Рекомендуемый' : '') + '</div>');
        
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

      // Автовыбор лучшего балансера через 2 секунды
      setTimeout(() => {
        const bestServer = balancer.getBestServer();
        if (bestServer) {
          Lampa.Noty.show(`Автовыбор: ${bestServer.title}`);
        }
      }, 2000);

      Lampa.Controller.enable('content');
    };

    // Остальные методы (searchOnBalancer, showResultsPanel, showMoviePage, playFromMoviePage и т.д.)
    // остаются такими же как в вашем оригинальном коде, но используют умный балансер
    
    this.searchOnBalancer = function(balancerItem) {
      var that = this;
      Lampa.Search.start({
        title: 'Поиск на ' + balancerItem.title,
        onSearch: function(q) {
          if (!q) return;
          const bestServer = balancer.getBestServer();
          const searchUrl = bestServer.url + '/?s=' + encodeURIComponent(q);
          const fetchUrl = PROXY + encodeURIComponent(searchUrl);
          
          Lampa.Noty.show(`Ищем на ${bestServer.title}...`);
          network.native(account(fetchUrl), function(html) {
            // ... остальная логика поиска
            that.processSearchResults(html, bestServer, q);
          }, function(err) {
            console.error('Search error:', err);
            Lampa.Noty.show('Ошибка поиска, пробую другой сервер...');
            // Автоматическое переключение на другой сервер
            const fallbackServer = balancer.servers.find(s => s.id !== bestServer.id && s.active);
            if (fallbackServer) {
              Lampa.Noty.show(`Пробую ${fallbackServer.title}...`);
              that.searchOnBalancer(fallbackServer);
            }
          });
        }
      });
    };

    // ... остальные методы без изменений

    this.pause = function(){};
    this.stop = function(){};
    this.destroy = function() {
      try { network.clear(); } catch(e) {}
      try { scroll.destroy(); } catch(e) {}
    };
  }

  // === ИНИЦИАЛИЗАЦИЯ ===
  function init() {
    console.log('🎯 Androzon Improved v16 initialized');

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

        var btn = $('<div class="full-start__button selector androzon-button" style="background: linear-gradient(45deg,#FF6B35,#FF8E53); margin:6px; border-radius:8px;"><div style="padding:10px 16px;display:flex;align-items:center;justify-content:center;"><span style="margin-right:8px;">🚀</span><span style="font-weight:700;color:#fff;">Androzon Pro</span></div></div>');
        
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

// ==UserScript==
// @name         AndroZon Lamp Improved
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  Improved version with better balancers
// @author       Schmyga
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Конфигурация балансеров
    const BALANCERS_CONFIG = {
        servers: [
            {
                name: "Balancer 1",
                url: "https://server1.example.com",
                weight: 1,
                enabled: true
            },
            {
                name: "Balancer 2", 
                url: "https://server2.example.com",
                weight: 1,
                enabled: true
            },
            {
                name: "Balancer 3",
                url: "https://server3.example.com",
                weight: 1,
                enabled: true
            }
        ],
        checkInterval: 30000, // 30 секунд
        timeout: 10000, // 10 секунд таймаут
        retryCount: 3
    };

    class ImprovedBalancer {
        constructor(config) {
            this.config = config;
            this.currentServerIndex = 0;
            this.healthyServers = [];
            this.isChecking = false;
            this.init();
        }

        init() {
            console.log('🚀 Improved Balancer initialized');
            this.startHealthChecks();
            this.setupEventListeners();
            this.createControlPanel();
        }

        // Получение текущего сервера с балансировкой
        getCurrentServer() {
            if (this.healthyServers.length === 0) {
                return this.config.servers[this.currentServerIndex];
            }

            // Простая round-robin балансировка
            const server = this.healthyServers[this.currentServerIndex % this.healthyServers.length];
            this.currentServerIndex = (this.currentServerIndex + 1) % this.healthyServers.length;
            return server;
        }

        // Проверка здоровья серверов
        async startHealthChecks() {
            if (this.isChecking) return;
            this.isChecking = true;

            try {
                const checkPromises = this.config.servers
                    .filter(server => server.enabled)
                    .map(server => this.checkServerHealth(server));

                await Promise.allSettled(checkPromises);
                this.updateControlPanel();
            } catch (error) {
                console.error('Health check error:', error);
            } finally {
                this.isChecking = false;
                setTimeout(() => this.startHealthChecks(), this.config.checkInterval);
            }
        }

        async checkServerHealth(server) {
            for (let i = 0; i < this.config.retryCount; i++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

                    const response = await fetch(server.url + '/health', {
                        method: 'HEAD',
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        if (!this.healthyServers.includes(server)) {
                            this.healthyServers.push(server);
                            console.log(`✅ ${server.name} is healthy`);
                        }
                        return;
                    }
                } catch (error) {
                    console.warn(`❌ ${server.name} check ${i + 1} failed:`, error.message);
                }
            }

            // Удаляем из здоровых если все проверки провалились
            const index = this.healthyServers.indexOf(server);
            if (index > -1) {
                this.healthyServers.splice(index, 1);
                console.log(`❌ ${server.name} marked as unhealthy`);
            }
        }

        // Создание панели управления
        createControlPanel() {
            const panel = document.createElement('div');
            panel.id = 'balancer-control-panel';
            panel.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 15px;
                border-radius: 10px;
                font-family: Arial, sans-serif;
                font-size: 12px;
                z-index: 10000;
                border: 2px solid #00ff00;
                min-width: 250px;
                max-height: 400px;
                overflow-y: auto;
            `;

            panel.innerHTML = `
                <div style="margin-bottom: 10px; font-weight: bold; color: #00ff00;">
                    🚀 Improved Balancer v5.1
                </div>
                <div id="balancer-status">Checking servers...</div>
                <div style="margin-top: 10px; font-size: 10px; opacity: 0.7;">
                    Servers: <span id="healthy-count">0</span>/${this.config.servers.length}
                </div>
                <button id="refresh-balancers" style="margin-top: 10px; padding: 5px; background: #00ff00; border: none; border-radius: 3px; cursor: pointer;">
                    🔄 Refresh
                </button>
                <button id="toggle-panel" style="margin-top: 5px; padding: 3px; background: #ff4444; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">
                    Hide
                </button>
            `;

            document.body.appendChild(panel);
            this.setupPanelEvents();
        }

        setupPanelEvents() {
            document.getElementById('refresh-balancers').addEventListener('click', () => {
                this.startHealthChecks();
            });

            document.getElementById('toggle-panel').addEventListener('click', (e) => {
                const panel = document.getElementById('balancer-control-panel');
                if (panel.style.display === 'none') {
                    panel.style.display = 'block';
                    e.target.textContent = 'Hide';
                } else {
                    panel.style.display = 'none';
                    e.target.textContent = 'Show';
                }
            });
        }

        updateControlPanel() {
            const statusEl = document.getElementById('balancer-status');
            const countEl = document.getElementById('healthy-count');

            if (statusEl && countEl) {
                countEl.textContent = this.healthyServers.length;

                if (this.healthyServers.length === 0) {
                    statusEl.innerHTML = '<span style="color: #ff4444;">❌ No servers available</span>';
                } else {
                    statusEl.innerHTML = this.healthyServers.map(server => 
                        `<div style="color: #00ff00; margin: 2px 0;">✅ ${server.name}</div>`
                    ).join('');
                }
            }
        }

        setupEventListeners() {
            // Глобальный обработчик ошибок
            window.addEventListener('error', (e) => {
                console.warn('Global error caught by balancer:', e.error);
            });

            // Обработчик онлайн/офлайн статуса
            window.addEventListener('online', () => {
                console.log('📱 Device back online, refreshing balancers...');
                this.startHealthChecks();
            });

            window.addEventListener('offline', () => {
                console.warn('📱 Device offline');
            });
        }

        // Основной метод для получения URL через балансер
        async getBalancedUrl(path = '') {
            const server = this.getCurrentServer();
            if (!server) {
                throw new Error('No servers available');
            }

            const url = server.url + path;
            console.log(`🔀 Using balancer: ${server.name} -> ${url}`);
            return url;
        }

        // Метод для принудительного переключения сервера
        switchToServer(serverName) {
            const server = this.config.servers.find(s => s.name === serverName);
            if (server && server.enabled) {
                this.currentServerIndex = this.config.servers.indexOf(server);
                console.log(`🔄 Manually switched to: ${serverName}`);
                return true;
            }
            return false;
        }
    }

    // Инициализация при загрузке страницы
    function initializeApp() {
        try {
            // Создаем глобальный экземпляр балансера
            window.appBalancer = new ImprovedBalancer(BALANCERS_CONFIG);

            // Добавляем глобальные методы для доступа
            window.getBalancedUrl = (path) => window.appBalancer.getBalancedUrl(path);
            window.switchBalancer = (name) => window.appBalancer.switchToServer(name);
            window.refreshBalancers = () => window.appBalancer.startHealthChecks();

            console.log('🎯 Improved AndroZon Lamp v5.1 successfully initialized!');

            // Сигнализируем о готовности
            document.dispatchEvent(new CustomEvent('balancerReady'));

        } catch (error) {
            console.error('💥 Failed to initialize balancer:', error);
        }
    }

    // Запуск когда DOM готов
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

    // Экспорт для использования в других скриптах
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { ImprovedBalancer, BALANCERS_CONFIG };
    }

})();

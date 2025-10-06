// config.js - конфигурация балансеров
const ANDRO10_CONFIG = {
    balancers: {
        enabled: ['rezka', 'filmix', 'kodik', 'cdnvideohub'],
        priority: ['rezka', 'kodik', 'filmix', 'cdnvideohub'],
        timeout: 10000
    },
    
    // Настройки кеширования
    cache: {
        enabled: true,
        ttl: 300000 // 5 минут
    },
    
    // Настройки пользовательского интерфейса
    ui: {
        showSourceSelector: true,
        autoSelectBest: true
    },
    
    // Прокси настройки (если нужны)
    proxy: {
        enabled: false,
        url: ''
    }
};

// Пример добавления кастомного балансера
window.addEventListener('DOMContentLoaded', () => {
    if(window.andro10Plugin) {
        // Добавляем балансер AniLibria
        window.andro10Plugin.addBalancer('anilibria', {
            name: 'AniLibria',
            domains: ['anilibria.tv'],
            parse: async function(url) {
                // Реализация парсинга для AniLibria
                try {
                    const response = await fetch(url);
                    const html = await response.text();
                    // Парсинг специфичный для AniLibria
                    return [{
                        url: url,
                        quality: '1080p',
                        balancer: 'anilibria'
                    }];
                } catch(e) {
                    console.error('AniLibria error:', e);
                    return [];
                }
            }
        });
    }
});

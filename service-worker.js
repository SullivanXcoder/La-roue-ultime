self.addEventListener('install', e=>{
  e.waitUntil(caches.open('roue-v1').then(c=>c.addAll([
    'index.html','options.html','random.html',
    'assets/styles.css','assets/app.js','assets/wheel.js','assets/options.js','assets/random.js'
  ])));

});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});

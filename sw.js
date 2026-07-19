'use strict';

const CACHE = 'routine-board-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './assets/mascot-normal.png',
  './assets/mascot-wave.png',
  './assets/mascot-cheer.png',
  './assets/mascot-pig.png',
  './assets/icons/office.png',
  './assets/icons/calendar.png',
  './assets/icons/stretch.png',
  './assets/icons/toilet.png',
  './assets/icons/broom.png',
  './assets/icons/bottle.png',
  './assets/icons/bath.png',
  './assets/icons/bed.png',
  './assets/icons/clock.png',
  './assets/icons/pill.png',
  './assets/icons/coffee.png',
  './assets/icons/book.png',
  './assets/icons/shoes.png',
  './assets/icons/tooth.png',
  './assets/icons/laundry.png',
  './assets/icons/tomato.png',
  './assets/farm/balcony.png',
  './assets/farm/garden.png',
  './assets/farm/field.png',
  './assets/farm/rainshelter.png',
  './assets/farm/greenhouse.png',
  './assets/farm/multihouse.png',
  './assets/farm/smart.png',
  './assets/farm/stand.png',
  './assets/farm/bighouse.png',
  './assets/farm/tourism.png',
  './assets/challenge/cake.png',
  './assets/challenge/cake-party.png',
  './assets/zoo/dog.png',
  './assets/zoo/cat.png',
  './assets/zoo/rabbit.png',
  './assets/zoo/bear.png',
  './assets/zoo/panda.png',
  './assets/zoo/fox.png',
  './assets/zoo/tanuki.png',
  './assets/zoo/squirrel.png',
  './assets/zoo/hedgehog.png',
  './assets/zoo/penguin.png',
  './assets/zoo/bird.png',
  './assets/zoo/owl.png',
  './assets/zoo/frog.png',
  './assets/zoo/turtle.png',
  './assets/zoo/sheep.png',
  './assets/zoo/goat.png',
  './assets/zoo/cow.png',
  './assets/zoo/chicken.png',
  './assets/zoo/duck.png',
  './assets/zoo/mouse.png',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k !== CACHE; })
              .map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

// ネットワーク優先・失敗時にキャッシュ（更新が即座に届き、オフラインでも開ける）
// cache: 'no-cache' でHTTPキャッシュ(max-age=600)を素通りし、毎回サーバーに更新確認する
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(function (res) {
        if (res.ok && e.request.url.indexOf(self.location.origin) === 0) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(e.request, { ignoreSearch: true });
      })
  );
});

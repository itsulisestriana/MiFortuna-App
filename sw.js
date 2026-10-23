const CACHE_NAME = "mifortuna-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) =>
              cacheName.startsWith("mifortuna-") &&
              cacheName !== CACHE_NAME
            )
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // No interceptar solicitudes que no sean GET.
  if (request.method !== "GET") {
    return;
  }

  // No interceptar solicitudes de otros orígenes.
  const requestURL = new URL(request.url);

  if (requestURL.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Primero, buscar la solicitud en caché.
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      // Si no está en caché, intentar obtenerla de Internet.
      try {
        const response = await fetch(request);

        // Guardar únicamente respuestas correctas y del mismo origen.
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        // Si falla la conexión, ofrecer index.html como respaldo
        // para la navegación dentro de la aplicación.
        if (request.mode === "navigate") {
          const fallback = await cache.match("./index.html");

          if (fallback) {
            return fallback;
          }
        }

        // Para otros recursos sin conexión, devolver un error.
        return new Response("Sin conexión a Internet.", {
          status: 503,
          statusText: "Service Unavailable",
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }
    })()
  );
});

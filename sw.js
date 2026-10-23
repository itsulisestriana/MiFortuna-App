const CACHE_NAME = "mifortuna-v2";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json"
];

// Instalar la nueva versión
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// Activar la nueva versión y eliminar cachés antiguas
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

// Gestionar las solicitudes
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // No interceptar solicitudes que no sean GET
  if (request.method !== "GET") {
    return;
  }

  const requestURL = new URL(request.url);

  // No interceptar solicitudes de otros dominios
  if (requestURL.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Para la página principal, intentar obtener siempre
      // la versión más reciente del servidor
      if (request.mode === "navigate") {
        try {
          const response = await fetch(request);

          if (response.ok && response.type === "basic") {
            await cache.put("./index.html", response.clone());
          }

          return response;
        } catch (error) {
          // Si no hay conexión, utilizar la copia guardada
          const cachedPage = await cache.match("./index.html");

          if (cachedPage) {
            return cachedPage;
          }

          return new Response(
            "No hay conexión. Inténtalo de nuevo cuando tengas Internet.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        }
      }

      // Para otros archivos, consultar primero la caché
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      // Si no está guardado, solicitarlo al servidor
      try {
        const response = await fetch(request);

        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        return new Response("Recurso no disponible sin conexión.", {
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

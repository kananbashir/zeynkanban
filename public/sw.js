// Shows phone notifications sent by the site, and opens the right page when one is tapped.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "Zeyn Media", {
        body: data.body || "",
        tag: data.tag,
        icon: "/icon-192.png",
        data: { url: data.url || "/" },
      });
      if (self.navigator.setAppBadge && data.badge) await self.navigator.setAppBadge(data.badge).catch(() => {});
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if (client.navigate) return client.navigate(url).catch(() => self.clients.openWindow(url));
        return;
      }
      return self.clients.openWindow(url);
    })(),
  );
});

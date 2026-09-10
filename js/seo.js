fetch("person.jsonld")
  .then((r) => r.json())
  .then((data) => {
    if (document.querySelector('script[data-person-graph]')) return;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.dataset.personGraph = "true";
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
  })
  .catch(() => {});

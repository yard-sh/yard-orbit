// Orbit landing page.
//
// Who is looking comes from Yard Auth, never from code in this repo. One
// session covers the page and the app:
//   __yard/auth/me                    always 200: { authenticated, ... }
//   __yard/auth/logout?return=/       ends the Orbit session, back here
// The app (app/) requires sign-in, so every "Start free" link is just app/:
// Yard signs the visitor in on the way.
//
// window.yard (injected by the edge through embed.js) supplies the pricing
// tiers. Every URL is relative so the page works at <team>.yard.sh/<slug>/,
// inside a /@sandbox/, and on a custom domain.
(function () {
  "use strict";

  /* ------------------------------------------------------------ session */

  fetch("__yard/auth/me", { headers: { Accept: "application/json" } })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (me) {
      if (!me || !me.authenticated) return;
      document.querySelectorAll("[data-open-app]").forEach(function (a) {
        a.textContent = "Open Orbit";
      });
      document.querySelectorAll("[data-signed-out]").forEach(function (el) {
        el.hidden = true;
      });
      document.querySelectorAll("[data-signed-in]").forEach(function (el) {
        el.hidden = false;
      });
    })
    .catch(function () {});

  /* ------------------------------------------------------------ pricing */

  // The pricing section is complete markup; this fills it in from
  // window.yard.project.tiers so the page never carries a price of its own.
  // Tiers are matched by their stable key (settings.json pricing.tiers[].key):
  // ids change with every pricing revision, names are display text.
  function money(cents) {
    var dollars = cents / 100;
    return "$" + (Number.isInteger(dollars) ? dollars : dollars.toFixed(2));
  }

  function setText(root, selector, text) {
    var node = root.querySelector(selector);
    if (node && text) node.textContent = text;
  }

  function setFeatures(card, tier) {
    var list = card.querySelector("[data-features]");
    if (!list || !tier.features || !tier.features.length) return;
    list.textContent = "";
    tier.features.forEach(function (feature) {
      var li = document.createElement("li");
      li.textContent = feature;
      list.appendChild(li);
    });
  }

  function fillPro(card, tier) {
    var amount = card.querySelector("[data-amount]");
    var per = card.querySelector("[data-per]");
    var billed = card.querySelector("[data-billed]");
    var buy = card.querySelector("[data-buy]");
    var trial = card.querySelector("[data-trial]");
    var toggle = document.getElementById("interval");
    var subscription = tier.pricing_model === "subscription";
    var discount = subscription ? tier.yearly_discount_percent || 0 : 0;
    buy.dataset.tierId = tier.key;
    buy.textContent = "Get " + tier.name;

    function show(interval) {
      if (interval === "yearly") {
        var yearCents = Math.round(
          tier.price_cents * 12 * (1 - discount / 100),
        );
        amount.textContent = money(Math.round(yearCents / 12));
        billed.textContent = money(yearCents) + " billed yearly";
        billed.hidden = false;
      } else {
        amount.textContent = money(tier.price_cents);
        billed.hidden = true;
      }
      per.textContent = subscription ? "/ month" : "once";
      if (subscription) buy.dataset.interval = interval;
      else delete buy.dataset.interval;
      toggle.querySelectorAll(".toggle-opt").forEach(function (opt) {
        var on = opt.dataset.interval === interval;
        opt.classList.toggle("is-on", on);
        opt.setAttribute("aria-pressed", String(on));
      });
    }

    if (discount > 0) {
      toggle.hidden = false;
      setText(toggle, "[data-save]", "-" + discount + "%");
      toggle.addEventListener("click", function (event) {
        var opt = event.target.closest(".toggle-opt");
        if (opt) show(opt.dataset.interval);
      });
    }
    show("monthly");

    // Trials are per tier: the button only appears when this tier has one,
    // and it names this tier so the redirect starts the right trial.
    if (tier.free_trial && tier.free_trial.enabled) {
      trial.dataset.tierId = tier.key;
      trial.textContent =
        "Start a " + (tier.free_trial.days || 14) + "-day free trial";
      trial.hidden = false;
    }

    // Owned means "holds this tier", not just "signed in". Compare keys: a
    // holder from an earlier pricing revision has a tier_id this page no
    // longer lists.
    if (window.yard.ownership) {
      window.yard
        .ownership()
        .then(function (state) {
          if (state && state.owned && state.tier_key === tier.key)
            card.querySelector("[data-current]").hidden = false;
        })
        .catch(function () {});
    }
  }

  function fill(tiers) {
    tiers.forEach(function (tier) {
      var card = document.querySelector('[data-plan="' + tier.key + '"]');
      if (!card) return;
      setText(card, "[data-name]", tier.name);
      setText(card, "[data-blurb]", tier.description);
      setFeatures(card, tier);
      if (tier.price_cents > 0) fillPro(card, tier);
    });
    if (window.yard.refresh) window.yard.refresh();
  }

  // embed.js may land before or after this file, so wait for it briefly
  // rather than assuming an order.
  var tries = 0;
  (function waitForYard() {
    if (
      window.yard &&
      window.yard.project &&
      Array.isArray(window.yard.project.tiers)
    )
      return fill(window.yard.project.tiers);
    if (tries++ < 60) setTimeout(waitForYard, 100);
  })();

  /* -------------------------------------------------------- board still */

  var STAGES = [
    [
      "Lead",
      "--slate",
      [
        ["Copperleaf field ops", "Copperleaf Energy", "$54,000", "DA"],
        ["Lumen IT refresh", "Lumen Health", "$38,000", "SR"],
      ],
    ],
    [
      "Qualified",
      "--sky",
      [
        ["Harbor Labs LIMS", "Harbor Labs", "$42,000", "IC"],
        ["Summit holiday push", "Summit Outfitters", "$15,000", "GK"],
      ],
    ],
    [
      "Proposal",
      "--violet",
      [
        ["Grid monitoring", "Copperleaf Energy", "$96,000", "PR", true],
        ["Quill team seats", "Quill Analytics", "$28,000", "TL"],
      ],
    ],
    [
      "Negotiation",
      "--amber",
      [["Clinic pilot", "Lumen Health", "$24,000", "MO"]],
    ],
    [
      "Won",
      "--emerald",
      [
        ["Fleet rollout", "Brightline Logistics", "$125,000", "RN"],
        ["Annual renewal", "Northwind Traders", "$48,000", "AC"],
      ],
    ],
  ];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  var board = document.getElementById("board");
  STAGES.forEach(function (stage) {
    var col = el("div", "col");
    var head = el("div", "col-head");
    var dot = el("span", "dot");
    dot.style.setProperty("--c", "var(" + stage[1] + ")");
    head.append(
      dot,
      el("span", "", stage[0]),
      el("span", "n", String(stage[2].length)),
    );
    var body = el("div", "col-body");
    stage[2].forEach(function (deal) {
      var card = el("div", "card" + (deal[4] ? " lift" : ""));
      var row = el("div", "row");
      row.append(el("span", "v", deal[2]), el("span", "av", deal[3]));
      card.append(el("div", "t", deal[0]), el("div", "s", deal[1]), row);
      body.appendChild(card);
    });
    col.append(head, body);
    board.appendChild(col);
  });

  /* --------------------------------------------------------- theme, nav */

  document.getElementById("theme").addEventListener("click", function () {
    var dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("orbit.theme", dark ? "dark" : "light");
    } catch (err) {}
  });

  var nav = document.getElementById("nav");
  function onScroll() {
    nav.classList.toggle("stuck", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

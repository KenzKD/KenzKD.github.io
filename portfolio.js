"use strict";

const YT = "https://www.youtube.com";

// A YouTube video id: one or more letters, digits, "_" or "-" and nothing else
// ^ and $ anchor the pattern to the whole string, so "abc def" or "a<b" fail
const VIDEO_ID = /^[\w-]+$/;

// A section hash such as "#omniverseSection"
// ^#       starts with "#"
// (\w+)    captures the section name: letters, digits or "_"  ("omniverse")
// Section$ ends with the word "Section"
const SECTION_HASH = /^#(\w+)Section$/;

// Player options shared by every video (playlist is added per video for looping)
const PLAYER_PARAMS = { mute: 1, loop: 1, playsinline: 1, enablejsapi: 1, disablekb: 1, iv_load_policy: 3, rel: 0 };

// Only messages loaded players: an unloaded iframe is about:blank, and
// posting to it logs an origin-mismatch error in the console
function post(iframe, message)
{
	if (iframe.src)
	{
		iframe.contentWindow?.postMessage(JSON.stringify(message), YT);
	}
}

// Plays if the video is on screen and the tab is active, pauses otherwise
function sync(iframe)
{
	post(iframe, { event: "command", func: iframe.visible && !document.hidden ? "playVideo" : "pauseVideo", args: "" });
}

// The player only answers once its own script is running, which can be after
// the iframe's load event, so keep asking until it replies (max ~10 seconds)
function listen(iframe, tries = 0)
{
	if (!iframe.ready && tries < 20)
	{
		post(iframe, { event: "listening", id: 1, channel: "widget" });
		setTimeout(listen, 500, iframe, tries + 1);
	}
}

// "load" doesn't bubble, so capture it. Unloaded iframes have no src yet
document.addEventListener("load", ({ target }) =>
{
	if (target.tagName === "IFRAME" && target.src)
	{
		listen(target);
	}
}, true);

// Any reply means the player is listening. Once it is ready, autoplay it manually
window.addEventListener("message", ({ source, origin, data }) =>
{
	const iframe = origin === YT && [...document.getElementsByTagName("iframe")].find((f) => f.contentWindow === source);
	if (!iframe)
	{
		return;
	}

	iframe.ready = true;

	try
	{
		if (["onReady", "initialDelivery"].includes(JSON.parse(data).event))
		{
			sync(iframe);
		}
	}
	catch
	{
		// Not a JSON message, ignore
	}
});

// Videos in a closed (display:none) section are never intersecting, so they pause
const observer = new IntersectionObserver((entries) =>
{
	entries.forEach(({ target, isIntersecting }) =>
	{
		target.visible = isIntersecting;

		if (isIntersecting && !target.src)
		{
			target.src = target.dataset.src; // first time visible: load (onReady will play it)
		}
		else
		{
			sync(target);
		}
	});
}, { threshold: 0.25 });

// Pause everything when the tab is hidden, resume what is on screen when it returns
document.addEventListener("visibilitychange", () =>
{
	document.querySelectorAll("iframe").forEach(sync);
});

// toggleDropdown(id) toggles, toggleDropdown(id, true/false) forces open/closed
function toggleDropdown(id, open)
{
	const hidden = document.getElementById(`${id}Content`)?.classList.toggle("hidden", open === undefined ? undefined : !open);

	if (hidden === false)
	{
		document.getElementById(`${id}Section`)?.scrollIntoView(); // <html> has scroll-smooth
		history.replaceState(null, "", `#${id}Section`);
	}
}

window.toggleDropdown = toggleDropdown; // used by inline onclick="" attributes

// Opens the section named in the hash, e.g. #omniverseSection
// match() returns null when there's no match, and [1] is the captured name
function openFromHash()
{
	toggleDropdown(location.hash.match(SECTION_HASH)?.[1], true);
}

// Replace every <div data-yt="VIDEO_ID"></div> with a player that loads when first visible
document.querySelectorAll("[data-yt]").forEach((placeholder) =>
{
	const id = placeholder.dataset.yt;

	if (!VIDEO_ID.test(id))
	{
		console.warn(`Invalid YouTube video id: "${id}"`);
		return;
	}

	const params = new URLSearchParams({ ...PLAYER_PARAMS, playlist: id });

	placeholder.outerHTML = `<iframe class="project-vid" allow="autoplay; fullscreen" allowfullscreen data-src="${YT}/embed/${id}?${params}"></iframe>`;
});

document.querySelectorAll("iframe[data-src]").forEach((iframe) => observer.observe(iframe));

// On page load, ?toggle=omniverse and #omniverseSection both work
toggleDropdown(new URLSearchParams(location.search).get("toggle"), true);
openFromHash();
window.addEventListener("hashchange", openFromHash);
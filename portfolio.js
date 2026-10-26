"use strict";

const YT = "https://www.youtube.com";

function post(iframe, message)
{
	iframe.contentWindow?.postMessage(JSON.stringify(message), YT);
}

// Plays if the video is on screen, pauses otherwise
function sync(iframe)
{
	post(iframe, { event: "command", func: iframe.visible ? "playVideo" : "pauseVideo", args: "" });
}

// Ask each player to send us events once it has loaded (this triggers onReady)
document.addEventListener("load", ({ target }) =>
{
	if (target.tagName === "IFRAME")
	{
		post(target, { event: "listening", id: 1, channel: "widget" });
	}
}, true);

// The player reports onReady, then we autoplay it manually
window.addEventListener("message", ({ source, origin, data }) =>
{
	if (origin === YT && String(data).includes('"onReady"'))
	{
		sync([...document.getElementsByTagName("iframe")].find((f) => f.contentWindow === source));
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

// toggleDropdown(id) toggles, toggleDropdown(id, true/false) forces open/closed
function toggleDropdown(id, open)
{
	const hidden = document.getElementById(`${id}Content`)?.classList.toggle("hidden", open === undefined ? undefined : !open);

	if (hidden === false)
	{
		document.getElementById(`${id}Section`)?.scrollIntoView({ behavior: "smooth" });
		history.replaceState(null, "", `#${id}Section`);
	}
}

window.toggleDropdown = toggleDropdown; // used by inline onclick="" attributes

// Opens the section from ?toggle=omniverse or #omniverseSection
function openFromUrl()
{
	toggleDropdown(new URLSearchParams(location.search).get("toggle") ?? location.hash.match(/^#(\w+)Section$/)?.[1], true);
}

// Replace every <div data-yt="VIDEO_ID"></div> with a player that loads when first visible
document.querySelectorAll("[data-yt]").forEach((placeholder) =>
{
	const id = placeholder.dataset.yt;

	placeholder.outerHTML =
		`<iframe class="project-vid" title="Project video" allowfullscreen
			allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
			data-src="${YT}/embed/${id}?mute=1&loop=1&playlist=${id}&playsinline=1&enablejsapi=1"></iframe>`;
});

document.querySelectorAll("iframe[data-src]").forEach((iframe) => observer.observe(iframe));

openFromUrl();
window.addEventListener("hashchange", openFromUrl);
function youtubeAnnotationsPlugin(options) {
	if (!options.annotationXml) throw new Error("Annotation data must be provided");
	if (!options.videoContainer) throw new Error("A video container to overlay the data on must be provided");

	const xml = options.annotationXml;
	const parser = new AnnotationParser();
	const annotationElements = parser.getAnnotationsFromXml(xml);
	const annotations = parser.parseYoutubeFormat(annotationElements);

	includeStyles();

	const videoContainer = options.videoContainer;
	const renderer = new AnnotationRenderer(annotations, videoContainer, (options.postMessageOrigin || window.location.href), options.updateInterval);
	setupEventListeners(this, renderer);
	renderer.start();
}
function setupEventListeners(player, renderer) {
	if (!player) throw new Error("A video player must be provided");
	let rendererUpdateIntervalId;

	window.addEventListener("message", e => {
		const data = e.data;
		const type = data.type;
		if (type === "__annotations_restored_renderer_start") {
			rendererUpdateIntervalId = setInterval(() => {
				if (!video.paused()) {
					const videoTime = player.currentTime();
					const updateEvent = new CustomEvent("__annotations_restored_renderer_update", {
						detail: {videoTime}
					});
					window.dispatchEvent(updateEvent)
				}
			}, data.updateInterval);
		}
		else if (type === "__annotations_restored_renderer_stop") {
			clearInterval(rendererUpdateIntervalId);
			rendererUpdateIntervalId = null;
			renderer.hideAll();
		}
		else if (type === "__annotations_restored_renderer_seek_to") {
			player.currentTime(data.seconds);
			if (!player.paused()) {
				const videoTime = player.currentTime();
				const updateEvent = new CustomEvent("__annotations_restored_renderer_update", {
					detail: {videoTime}
				});
				window.dispatchEvent(updateEvent);
			}
		}
		else if (type === "__annotations_restored_renderer_urlclick") {
			window.location.href = data.url;
		}
	});

	player.on("pause", e => {
		if (rendererUpdateIntervalId !== null) {
			renderer.stop();
		}
	});
	player.on("play", e => {
		if (rendererUpdateIntervalId === null) {
			renderer.start();
		}
	});
}

function includeStyles() {
	const styleEl = document.createElement("style");
	styleEl.textContent = `
/* so the vjs controls are on top of annotation */
.vjs-control-bar {
	z-index: 2 !important; 
}

.__cxt-ar-annotations-container__ {
	position: absolute;

	width: 100%;
	height: 100%;

	top: 0px;
	left: 0px;
}

.__cxt-ar-annotation__ {
	position: absolute;
	display: flex;

	justify-content: center;
	align-items: center;

	box-sizing: border-box;

	font-family: Arial, sans-serif;
	font-size: 100%;
	color: white;
	cursor: pointer;
	background-color: rgba(0, 0, 0, 0.25);

	z-index: 1;
}
.__cxt-ar-annotation__:hover {
	border: 1px solid rgba(255, 255, 255, 0.50);
	background-color: rgba(0, 0, 0, 0.70);
}
.__cxt-ar-annotation__[hidden] {
	display: none !important;
}

.__cxt-ar-annotation__[data-ar-type="highlight"] {
	border: 1px solid rgba(255, 255, 255, 0.10);
	background-color: transparent;
}
.__cxt-ar-annotation__:hover[data-ar-type="highlight"] {
	border: 1px solid rgba(255, 255, 255, 0.50);
	background-color: transparent;
}
`;
	document.head.append(styleEl);
}
